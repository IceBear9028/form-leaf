import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile, mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { ArtifactRepository, artifactResult } from "../src/main/application/artifactRepository.ts";
import { OutputService } from "../src/main/application/outputService.ts";
import { DocumentService } from "../src/main/application/documentService.ts";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";
import { AccessPolicy, emptyGrants } from "../src/main/mcp/accessPolicy.ts";
import { requestHash } from "../src/main/application/documentRevision.ts";

async function temp(t) { const path = await mkdtemp(join(tmpdir(), "formleaf-agent-output-")); t.after(() => rm(path, { recursive: true, force: true })); return path; }
const code = (code) => (error) => error.detail?.code === code;
async function setup(t, renderer) {
  const workspace = await temp(t);
  const policy = new AccessPolicy(workspace); await policy.initialize(); await policy.setEnabled(true);
  const service = new DocumentService(new DocumentRepository(workspace), new ComponentLibraryRepository(workspace), workspace);
  const created = await service.create(); const { connection } = await policy.create("output");
  await policy.setGrants(connection.id, { ...emptyGrants(), documentIds: [created.document.documentId], render: true });
  const artifacts = new ArtifactRepository(workspace);
  const outputs = new OutputService(service, policy, renderer, artifacts); await outputs.initialize();
  return { workspace, policy, service, created, connection, artifacts, outputs };
}
async function completed(service, credential, request) {
  for (let count = 0; count < 200; count++) {
    const entry = await service.operation(credential, request);
    if (entry && entry.response.status !== "pending") return entry.response;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("job did not complete");
}
test("F07: artifact 한도·24시간 만료·정리는 새 관리 영역만 대상으로 한다", async (t) => {
  const workspace = await temp(t); let now = Date.now();
  const artifacts = new ArtifactRepository(workspace, { now: () => now, budget: 10, maxBytes: 8 });
  const userFile = join(workspace, "untouched.backup"); await writeFile(userFile, "USER BACKUP");
  const input = { credentialId: "c", documentId: "d", revision: "r", filename: "test.pdf" };
  const one = await artifacts.reserve(input);
  await assert.rejects(artifacts.reserve(input), code("RESULT_TOO_LARGE"));
  await assert.rejects(artifacts.complete(one.artifactId, Buffer.alloc(9), []), code("RESULT_TOO_LARGE"));
  const ready = await artifacts.complete(one.artifactId, Buffer.from("pdf"), []); assert.equal(ready.committed, true);
  assert.equal((await artifacts.read(one.artifactId)).toString(), "pdf");
  now += 24 * 60 * 60_000 + 1; await artifacts.cleanup();
  await assert.rejects(artifacts.read(one.artifactId), code("ARTIFACT_EXPIRED"));
  assert.equal((await artifacts.metadata(one.artifactId)).committed, true);
  assert.equal(await readFile(userFile, "utf8"), "USER BACKUP");
  const two = await artifacts.reserve(input); assert.notEqual(two.artifactId, one.artifactId);
  assert.equal(await artifacts.metadata("../untouched.backup"), undefined);
  const linked = randomUUID();
  const external = join(workspace, "user-directory"); await mkdir(external);
  await writeFile(join(external, "output.pdf"), "USER PDF");
  await writeFile(join(external, "metadata.json"), JSON.stringify({ ...ready, artifactId: linked }));
  await symlink(external, join(workspace, "agent-artifacts", linked));
  assert.equal(await artifacts.metadata(linked), undefined);
  await artifacts.fail(linked); await artifacts.cleanup();
  assert.equal(await readFile(join(external, "output.pdf"), "utf8"), "USER PDF");
});
test("F07: snapshot 고정·pending 재전송·artifact 소유권과 현재 권한", async (t) => {
  let finish; let rendered = 0; let captured;
  const renderer = { render: async (snapshot, kind, page, authorize) => {
    await authorize(); rendered++; captured = structuredClone(snapshot);
    await new Promise((resolve) => { finish = resolve; });
    return { bytes: Buffer.from("%PDF-fixed-snapshot"), pageCount: 1, widthPx: 1, heightPx: 1, warnings: [] };
  } };
  const { policy, service, created, connection, outputs } = await setup(t, renderer);
  const input = { documentId: created.document.documentId, expectedRevision: created.revision, requestId: randomUUID() };
  assert.equal((await outputs.export(connection.id, input)).status, "pending");
  assert.equal((await outputs.export(connection.id, input)).status, "pending");
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 5));
  await service.save(input.documentId, { ...created.document, name: "새 저장값" }, created.revision);
  finish(); const result = await completed(service, connection.id, input.requestId);
  assert.equal(result.status, "completed"); assert.equal(rendered, 1); assert.equal(captured.revision, created.revision);
  assert.equal(result.result.revision, created.revision);
  assert.equal((await outputs.export(connection.id, input)).status, "completed"); assert.equal(rendered, 1);
  const file = await outputs.artifact(connection.id, result.result.artifactId); assert.equal(file.bytes.toString(), "%PDF-fixed-snapshot");
  const other = await policy.create("other"); await policy.setGrants(other.connection.id, policy.current(connection.id));
  await assert.rejects(outputs.artifact(other.connection.id, result.result.artifactId), code("NOT_FOUND_OR_DENIED"));
  await policy.setGrants(connection.id, { ...policy.current(connection.id), render: false });
  await assert.rejects(outputs.artifact(connection.id, result.result.artifactId), code("CAPABILITY_DENIED"));
});
test("F07/F08: 완료 artifact와 미완료 출력을 재시작 때 구별하며 PDF를 재생성하지 않는다", async (t) => {
  const renderer = { render: async () => { throw new Error("recovery must not render"); } };
  const { outputs, service, created, connection, artifacts } = await setup(t, renderer);
  for (const committed of [false, true]) {
    const input = { documentId: created.document.documentId, expectedRevision: created.revision, requestId: randomUUID() };
    const prepared = await service.prepareExport({ credentialId: connection.id, requestId: input.requestId, hash: requestHash("export_pdf", input) }, input.documentId, input.expectedRevision, () => {}, async () => (await artifacts.reserve({ credentialId: connection.id, documentId: input.documentId, revision: input.expectedRevision, filename: "restart.pdf" })).artifactId);
    if (committed) await artifacts.complete(prepared.entry.artifactId, Buffer.from("%PDF-complete"), []);
    await outputs.initialize();
    const response = (await service.operation(connection.id, input.requestId)).response;
    assert.equal(response.status, committed ? "completed" : "failed");
    assert.equal(response.outcome, committed ? "committed" : "not_committed");
  }
});
