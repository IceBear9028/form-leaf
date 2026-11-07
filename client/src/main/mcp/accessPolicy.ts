import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { failure } from "../../foundation/documentCommands.ts";
import { readManagedJson, writeManagedJson } from "../application/managedJsonStore.ts";

export const grantSchema = z.strictObject({
  documentIds: z.array(z.string().min(1).max(256)).max(10000),
  write: z.boolean(), create: z.boolean(), libraryRead: z.boolean(), render: z.boolean(),
});
export type Grants = z.infer<typeof grantSchema>;
export const emptyGrants = (): Grants => ({ documentIds: [], write: false, create: false, libraryRead: false, render: false });
export const tokenLifetimeSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export const connectionOptionsSchema = z.strictObject({
  clientType: z.enum(["codex", "claude-code", "other"]),
  expiresInDays: tokenLifetimeSchema,
  grants: grantSchema,
});
const credentialSchema = z.strictObject({
  id: z.uuid(), name: z.string().trim().min(1).max(200), tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  revoked: z.boolean(), grants: grantSchema, createdAt: z.string(),
  clientType: z.enum(["codex", "claude-code", "other"]).optional(),
  tokenCreatedAt: z.iso.datetime().optional(), expiresAt: z.iso.datetime().optional(),
});
const stateSchema = z.strictObject({
  schemaVersion: z.literal(1), workspaceId: z.uuid(), enabled: z.boolean(),
  port: z.number().int().min(1024).max(65535), credentials: z.array(credentialSchema),
});
export type Credential = z.infer<typeof credentialSchema>;
export type ConnectionSummary = Omit<Credential, "tokenHash">;
export class AccessPolicy {
  private readonly path: string;
  private state?: z.infer<typeof stateSchema>;
  private initialization?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly defaultPort: number;
  private readonly lastUsed = new Map<string, string>();
  constructor(workspace: string, port = 32516) { this.path = join(workspace, "agent-settings.json"); this.defaultPort = z.number().int().min(1024).max(65535).parse(port); }
  initialize(): Promise<void> {
    this.initialization ??= (async () => {
      const stored = await readManagedJson(this.path);
      this.state = stored === undefined ? { schemaVersion: 1, workspaceId: randomUUID(), enabled: false, port: this.defaultPort, credentials: [] } : stateSchema.parse(stored);
      if (stored === undefined) await writeManagedJson(this.path, this.state);
    })();
    return this.initialization;
  }
  private async update<T>(change: (next: z.infer<typeof stateSchema>) => T): Promise<T> {
    const result = this.queue.then(async () => {
      await this.initialize();
      const next = structuredClone(this.state!);
      const result = change(next);
      await writeManagedJson(this.path, next);
      this.state = next;
      return result;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
  settings() {
    if (!this.state) throw new Error("AccessPolicy is not initialized");
    return { workspaceId: this.state.workspaceId, enabled: this.state.enabled, port: this.state.port,
      connections: this.state.credentials.map(({ tokenHash: _tokenHash, ...rest }) => ({ ...structuredClone(rest), lastUsedAt: this.lastUsed.get(rest.id) })) };
  }
  setEnabled(enabled: boolean) { return this.update((state) => { state.enabled = z.boolean().parse(enabled); }); }
  async create(name: string, options?: z.infer<typeof connectionOptionsSchema>): Promise<{ connection: ConnectionSummary; token: string }> {
    const parsed = options === undefined ? undefined : connectionOptionsSchema.parse(options);
    const token = randomBytes(32).toString("base64url");
    const connection = await this.update((state) => {
      const credential: Credential = { id: randomUUID(), name: z.string().trim().min(1).max(200).parse(name), tokenHash: hash(token), revoked: false, grants: emptyGrants(), createdAt: new Date().toISOString() };
      if (parsed) Object.assign(credential, {
        clientType: parsed.clientType, tokenCreatedAt: credential.createdAt,
        expiresAt: expiry(parsed.expiresInDays),
        grants: { ...parsed.grants, documentIds: [...new Set(parsed.grants.documentIds)], create: parsed.grants.write && parsed.grants.create },
      });
      state.credentials.push(credential);
      const { tokenHash: _hash, ...summary } = credential;
      return structuredClone(summary);
    });
    return { connection, token };
  }
  async rotate(id: string, expiresInDays: z.infer<typeof tokenLifetimeSchema>): Promise<{ connection: ConnectionSummary; token: string }> {
    const lifetime = tokenLifetimeSchema.parse(expiresInDays);
    const token = randomBytes(32).toString("base64url");
    const connection = await this.update((state) => {
      const credential = state.credentials.find((item) => item.id === id && !item.revoked);
      if (!credential) failure("NOT_FOUND_OR_DENIED", "연결을 찾을 수 없습니다.");
      credential.tokenHash = hash(token);
      credential.tokenCreatedAt = new Date().toISOString();
      credential.expiresAt = expiry(lifetime);
      const { tokenHash: _hash, ...summary } = credential;
      return structuredClone(summary);
    });
    this.lastUsed.delete(id);
    return { connection, token };
  }
  setGrants(id: string, grants: Grants) {
    return this.update((state) => {
      const credential = state.credentials.find((item) => item.id === id && !item.revoked);
      if (!credential) failure("NOT_FOUND_OR_DENIED", "연결을 찾을 수 없습니다.");
      const parsed = grantSchema.parse(grants);
      // Turning write off also revokes create. UI enables write when selecting create.
      credential.grants = { ...parsed, documentIds: [...new Set(parsed.documentIds)], create: parsed.write && parsed.create };
    });
  }
  revoke(id: string) {
    return this.update((state) => {
      const credential = state.credentials.find((item) => item.id === id);
      if (!credential) failure("NOT_FOUND_OR_DENIED", "연결을 찾을 수 없습니다.");
      credential.revoked = true; credential.grants = emptyGrants();
    });
  }
  grantCreated(id: string, documentId: string) {
    return this.update((state) => {
      // Recovery records the created document even after revocation, without reactivating the token.
      const credential = state.credentials.find((item) => item.id === id);
      if (!credential) failure("OPERATION_RECOVERY_REQUIRED", "생성한 문서의 연결 정보를 찾을 수 없습니다.");
      if (!credential.grants.documentIds.includes(documentId)) credential.grants.documentIds.push(documentId);
    });
  }
  authenticate(token: string | undefined): string | undefined {
    if (!this.state?.enabled || !token || token.length > 256) return;
    const digest = Buffer.from(hash(token), "hex");
    return this.state.credentials.find((item) => usable(item) && timingSafeEqual(digest, Buffer.from(item.tokenHash, "hex")))?.id;
  }
  /** Ephemeral telemetry: no token, request body, or per-request settings-file write. */
  recordAccess(id: string, token: string) {
    if (this.authenticate(token) === id) this.lastUsed.set(id, new Date().toISOString());
  }
  current(id: string): Grants {
    const credential = this.state?.credentials.find((item) => item.id === id && usable(item));
    if (!this.state?.enabled || !credential) failure("NOT_FOUND_OR_DENIED", "접근할 수 없습니다.");
    return structuredClone(credential.grants);
  }
  document(id: string, documentId: string, capability?: "write" | "render"): Grants {
    const grants = this.current(id);
    if (!grants.documentIds.includes(documentId)) failure("NOT_FOUND_OR_DENIED", "문서를 찾을 수 없거나 접근할 수 없습니다.");
    if (capability && !grants[capability]) failure("CAPABILITY_DENIED", "이 작업을 허용하지 않았습니다.");
    return grants;
  }
  capability(id: string, capability: "create" | "libraryRead"): Grants {
    const grants = this.current(id);
    if (!grants[capability] || (capability === "create" && !grants.write)) failure("CAPABILITY_DENIED", "이 작업을 허용하지 않았습니다.");
    return grants;
  }
}
function usable(credential: Credential): boolean {
  return !credential.revoked && (!credential.expiresAt || Date.parse(credential.expiresAt) > Date.now());
}
function expiry(days: number): string { return new Date(Date.now() + days * 86_400_000).toISOString(); }
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
