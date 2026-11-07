import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { journalResultSchema } from "../../foundation/documentCommandSchemas.ts";
import { failure, type JournalResult } from "../../foundation/documentCommands.ts";
import { isDocumentData, type DocumentData } from "../../foundation/document.ts";
import { documentRevision } from "./documentRevision.ts";
import { readManagedJson, writeManagedJson } from "./managedJsonStore.ts";

const entrySchema = z.strictObject({
  acceptedAt: z.iso.datetime().optional(), credentialId: z.string(), requestHash: z.string(), documentId: z.string(),
  previousRevision: z.string().nullable(), nextRevision: z.string(), created: z.boolean(),
  response: journalResultSchema, stagedId: z.uuid(), artifactId: z.uuid().optional(),
});
export type JournalEntry = z.infer<typeof entrySchema>;
export class OperationJournal {
  private readonly directory: string;
  constructor(workspace: string) { this.directory = join(workspace, "agent-operations"); }
  private entryPath(credentialId: string, requestId: string) {
    // Credential/request strings never become filesystem components.
    return join(this.directory, `${documentRevision({ credentialId, requestId }).slice(7)}.json`);
  }
  async get(credentialId: string, requestId: string): Promise<JournalEntry | undefined> {
    const value = await readManagedJson(this.entryPath(credentialId, requestId));
    return value === undefined ? undefined : entrySchema.parse(value);
  }
  async list(): Promise<JournalEntry[]> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const entries: JournalEntry[] = [];
    for (const name of await readdir(this.directory)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      entries.push(entrySchema.parse(await readManagedJson(join(this.directory, name))));
    }
    return entries;
  }
  async prepare(entry: JournalEntry, snapshot: DocumentData): Promise<void> {
    await writeManagedJson(join(this.directory, "staged", `${entry.stagedId}.json`), snapshot);
    await this.put(entry);
  }
  async snapshot(entry: JournalEntry): Promise<DocumentData> {
    const snapshot = await readManagedJson(join(this.directory, "staged", `${entry.stagedId}.json`));
    if (!isDocumentData(snapshot) || documentRevision(snapshot) !== entry.nextRevision) {
      failure("OPERATION_RECOVERY_REQUIRED", "저장 중인 문서 snapshot을 확인할 수 없습니다.");
    }
    return snapshot;
  }
  async put(entry: JournalEntry): Promise<void> {
    entrySchema.parse(entry);
    await writeManagedJson(this.entryPath(entry.credentialId, entry.response.requestId), entry);
  }
  async finish(entry: JournalEntry, response: JournalResult): Promise<void> {
    await this.put({ ...entry, response });
  }
}
