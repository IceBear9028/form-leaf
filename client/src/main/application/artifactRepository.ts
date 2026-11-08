import { hasErrorCode } from "../../foundation/errors.ts";
import { mkdir, readdir, lstat, readFile, open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AGENT_LIMITS, pdfFilenameSchema } from "../../foundation/documentCommandSchemas.ts";
import { failure } from "../../foundation/documentCommands.ts";
import { readManagedJson, writeManagedJson } from "./managedJsonStore.ts";

const metadataSchema = z.strictObject({
  artifactId: z.uuid(), credentialId: z.string(), documentId: z.string(), revision: z.string(),
  filename: pdfFilenameSchema, mimeType: z.literal("application/pdf"), byteSize: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime(), warnings: z.array(z.string()), committed: z.boolean(), status: z.enum(["preparing", "completed", "failed", "expired"]),
});
export type ArtifactMetadata = z.infer<typeof metadataSchema>;
export class ArtifactRepository {
  private readonly directory: string;
  private readonly now: () => number;
  private readonly budget: number;
  private readonly maxBytes: number;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(workspace: string, options: { now?: () => number; budget?: number; maxBytes?: number } = {}) {
    this.directory = join(workspace, "agent-artifacts"); this.now = options.now ?? Date.now;
    this.budget = options.budget ?? AGENT_LIMITS.artifactBudgetBytes; this.maxBytes = options.maxBytes ?? AGENT_LIMITS.pdfBytes;
  }
  private path(id: string, filename: string): string { z.uuid().parse(id); return join(this.directory, id, filename); }
  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work); this.queue = result.catch(() => undefined); return result;
  }
  async metadata(id: string): Promise<ArtifactMetadata | undefined> {
    if (!z.uuid().safeParse(id).success) return;
    // Never follow a replaced artifact directory or metadata link into user files.
    const directory = await lstat(this.path(id, ".")).catch((error: unknown) => { if (!hasErrorCode(error, "ENOENT")) throw error; });
    if (!directory?.isDirectory() || directory.isSymbolicLink()) return;
    const info = await lstat(this.path(id, "metadata.json")).catch((error: unknown) => { if (!hasErrorCode(error, "ENOENT")) throw error; });
    if (!info?.isFile() || info.isSymbolicLink()) return;
    const value = await readManagedJson(this.path(id, "metadata.json"));
    if (value === undefined) return;
    const metadata = metadataSchema.parse(value);
    if (metadata.artifactId !== id) failure("RENDER_FAILED", "출력 식별자를 확인할 수 없습니다.");
    return metadata;
  }
  async list(): Promise<ArtifactMetadata[]> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const metadata: ArtifactMetadata[] = [];
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !z.uuid().safeParse(entry.name).success) continue;
      const value = await this.metadata(entry.name); if (value) metadata.push(value);
    }
    return metadata;
  }
  async reserve(input: { credentialId: string; documentId: string; revision: string; filename: string }): Promise<ArtifactMetadata> {
    return this.serial(async () => {
      await this.cleanupInside();
      const metadata = await this.list();
      const used = metadata.reduce((total, item) => total + (item.status === "preparing" ? this.maxBytes : item.status === "completed" ? item.byteSize : 0), 0);
      if (used + this.maxBytes > this.budget) failure("RESULT_TOO_LARGE", "출력 파일 저장 공간이 부족합니다. 만료된 파일 정리 후 다시 시도하세요.");
      const next: ArtifactMetadata = { ...input, artifactId: randomUUID(), mimeType: "application/pdf", byteSize: 0, expiresAt: new Date(this.now() + AGENT_LIMITS.artifactLifetimeMs).toISOString(), warnings: [], committed: false, status: "preparing" };
      metadataSchema.parse(next); await writeManagedJson(this.path(next.artifactId, "metadata.json"), next); return next;
    });
  }
  async complete(id: string, bytes: Buffer, warnings: string[]): Promise<ArtifactMetadata> {
    return this.serial(async () => {
      const metadata = await this.metadata(id);
      if (!metadata || metadata.status !== "preparing") failure("RENDER_FAILED", "출력 예약을 확인할 수 없습니다.");
      if (bytes.length > this.maxBytes) failure("RESULT_TOO_LARGE", "PDF가 출력 크기 한도를 초과합니다.");
      if (metadata.expiresAt <= new Date(this.now()).toISOString()) failure("ARTIFACT_EXPIRED", "출력 예약이 만료되었습니다.");
      const temporary = this.path(id, "output.pdf.tmp");
      const file = await open(temporary, "wx", 0o600);
      try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
      await rename(temporary, this.path(id, "output.pdf"));
      const next = { ...metadata, status: "completed" as const, committed: true, byteSize: bytes.length, warnings };
      await writeManagedJson(this.path(id, "metadata.json"), next); return next;
    });
  }
  async fail(id: string): Promise<void> {
    await this.serial(async () => {
      const metadata = await this.metadata(id);
      if (!metadata || metadata.status !== "preparing") return;
      await this.removePayload(id); await writeManagedJson(this.path(id, "metadata.json"), { ...metadata, status: "failed" });
    });
  }
  async read(id: string): Promise<Buffer> {
    const metadata = await this.metadata(id);
    if (!metadata) failure("NOT_FOUND_OR_DENIED", "출력을 찾을 수 없거나 접근할 수 없습니다.");
    if (metadata.expiresAt <= new Date(this.now()).toISOString() || metadata.status === "expired") failure("ARTIFACT_EXPIRED", "출력 파일이 만료되었습니다. 새 requestId로 출력하세요.");
    if (metadata.status !== "completed") failure("NOT_FOUND_OR_DENIED", "출력이 완료되지 않았습니다.");
    const path = this.path(id, "output.pdf"); const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > this.maxBytes || info.size !== metadata.byteSize) failure("RENDER_FAILED", "출력 파일을 확인할 수 없습니다.");
    return readFile(path);
  }
  async verifiedFilePath(id: string): Promise<string> { await this.read(id); return this.path(id, "output.pdf"); }
  async cleanup(): Promise<void> { await this.serial(() => this.cleanupInside()); }
  private async cleanupInside(): Promise<void> {
    for (const item of await this.list()) {
      if (item.status === "expired" || item.expiresAt > new Date(this.now()).toISOString()) continue;
      await this.removePayload(item.artifactId);
      // Keep a small ownership tombstone so allowed callers receive ARTIFACT_EXPIRED.
      await writeManagedJson(this.path(item.artifactId, "metadata.json"), { ...item, status: "expired" });
    }
  }
  private async removePayload(id: string): Promise<void> {
    for (const name of ["output.pdf", "output.pdf.tmp"]) await unlink(this.path(id, name)).catch((error: unknown) => { if (!hasErrorCode(error, "ENOENT")) throw error; });
  }
}
export function artifactResult(metadata: ArtifactMetadata) {
  const { credentialId: _credentialId, status: _status, committed: _committed, ...result } = metadata;
  return { ...result, uri: `formleaf://artifacts/${metadata.artifactId}` };
}
