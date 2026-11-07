import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";
import { DocumentService } from "../src/main/application/documentService.ts";
import { EditorCoordinator } from "../src/main/application/editorCoordinator.ts";
import { requestHash, documentRevision } from "../src/main/application/documentRevision.ts";

async function setup(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "formleaf-agent-service-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = (options = {}) => new DocumentService(new DocumentRepository(directory), new ComponentLibraryRepository(directory), directory, options);
  const service = make(options);
  return { directory, make, service };
}
const identity = (input = {}) => ({ credentialId: "test-credential", requestId: randomUUID(), hash: requestHash("apply_operations", input) });
const authorize = () => {};
const changes = { affectedNodeIds: [], affectedTargets: [], removedItemIds: [], summary: "문서 이름 변경" };
const transform = (name) => (document) => ({ document: { ...document, name }, changes, results: [], warnings: [] });
const code = (code) => (error) => error.detail?.code === code;

test("F03/F08: UI stale save와 동시 agent 변경은 현재 revision을 덮어쓰지 않는다", async (t) => {
  const { service } = await setup(t);
  const created = await service.create();
  const input = { documentId: created.document.documentId, expectedRevision: created.revision, dryRun: false };
  const results = await Promise.allSettled([
    service.mutate(identity(), input, authorize, transform("첫 변경")),
    service.mutate(identity(), input, authorize, transform("둘째 변경")),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].reason.detail.code, "REVISION_CONFLICT");
  await assert.rejects(service.save(input.documentId, { ...created.document, name: "stale UI" }, created.revision), code("REVISION_CONFLICT"));
  assert.equal((await service.load(input.documentId)).document.name, "첫 변경");
  const latest = await service.load(input.documentId);
  const saved = await service.save(input.documentId, { ...latest.document, name: "내 draft" }, latest.revision);
  assert.equal(saved.revision, (await service.load(input.documentId)).revision);
});

test("F03: batch 실패와 dryRun은 canonical/journal을 변경하지 않으며 no-op은 revision 유지", async (t) => {
  const { service } = await setup(t);
  const created = await service.create();
  const input = { documentId: created.document.documentId, expectedRevision: created.revision, dryRun: false };
  const journalBefore = await service.journal.list();
  await assert.rejects(service.mutate(identity(), input, authorize, (document) => {
    document.name = "부분 변경";
    throw new Error("second operation failed");
  }));
  assert.equal((await service.load(input.documentId)).revision, created.revision);
  const dry = await service.mutate(undefined, { ...input, dryRun: true }, authorize, transform("dry"));
  assert.equal(dry.persisted, false);
  assert.equal("revision" in dry, false);
  assert.equal("results" in dry, false);
  assert.deepEqual(await service.journal.list(), journalBefore);
  const noop = await service.mutate(identity(), input, authorize, transform(created.document.name));
  assert.equal(noop.revision, created.revision);
});

test("F08: 같은 requestId 재전송은 재실행하지 않고 다른 입력은 거절한다", async (t) => {
  const { service, make } = await setup(t);
  const created = await service.create();
  const key = identity();
  const input = { documentId: created.document.documentId, expectedRevision: created.revision, dryRun: false };
  const result = await service.mutate(key, input, authorize, transform("한번"));
  const repeated = await service.mutate(key, input, authorize, () => { throw new Error("must not execute"); });
  assert.deepEqual(repeated, result);
  const restarted = make();
  assert.deepEqual(await restarted.mutate(key, input, authorize, () => { throw new Error("must not execute"); }), result);
  await assert.rejects(service.mutate({ ...key, hash: "different" }, input, authorize, transform("two")), code("REQUEST_ID_REUSED"));
  await assert.rejects(service.mutate(key, input, () => { throw new Error("revoked"); }, transform("two")), /revoked/);
});

for (const point of ["prepared", "document-saved", "grant-saved", "completed"]) {
  test(`F04/F08: 생성 장애 ${point} 후 문서·index·grant 복구와 중복 생성 방지`, async (t) => {
    const { service, make } = await setup(t, { fault: (current) => { if (current === point) throw new Error("injected crash"); } });
    const grants = new Set();
    service.setCreatedGrantHandler(async (_credential, documentId) => { grants.add(documentId); });
    const key = identity({ name: "재시작" });
    await assert.rejects(service.createForAgent(key, "재시작", authorize), code("PERSISTENCE_FAILED"));
    const entry = await service.operation(key.credentialId, key.requestId);
    assert.equal(entry.response.outcome, "unknown");
    const restarted = make();
    restarted.setCreatedGrantHandler(async (_credential, documentId) => { grants.add(documentId); });
    await restarted.initialize();
    const replay = await restarted.createForAgent(key, "재시작", authorize);
    assert.equal(replay.status, "completed");
    assert.equal((await restarted.list()).length, 1);
    assert.deepEqual([...grants], [replay.documentId]);
    assert.equal((await restarted.load(replay.documentId)).revision, replay.revision);
  });
}

test("F08: 복구 snapshot이 손상되면 문서 writer를 차단하고 자동 재실행하지 않는다", async (t) => {
  let crash = false;
  const { service, directory, make } = await setup(t, { fault: (point) => { if (crash && point === "prepared") throw new Error("crash"); } });
  const created = await service.create(); crash = true;
  const key = identity();
  const input = { documentId: created.document.documentId, expectedRevision: created.revision, dryRun: false };
  await assert.rejects(service.mutate(key, input, authorize, transform("복구 필요")), code("PERSISTENCE_FAILED"));
  const entry = await service.operation(key.credentialId, key.requestId);
  await writeFile(join(directory, "agent-operations", "staged", `${entry.stagedId}.json`), "{}", "utf8");
  const restarted = make(); await restarted.initialize();
  await assert.rejects(restarted.save(input.documentId, created.document, created.revision), code("OPERATION_RECOVERY_REQUIRED"));
  assert.equal((await restarted.load(input.documentId)).revision, created.revision);
});

test("F03: busy 거절, ack 실패에도 저장 성공, lease 해제", async (t) => {
  const coordinator = new EditorCoordinator(20);
  const { service } = await setup(t, { coordinator });
  const created = await service.create();
  const input = { documentId: created.document.documentId, expectedRevision: created.revision, dryRun: false };
  let busy = true;
  const requests = [];
  coordinator.attach((request) => {
    requests.push(request.type);
    if (request.type === "apply") return; // lost acknowledgement
    coordinator.reply({ requestId: request.requestId, ok: !busy, context: null, leaseId: request.type === "acquire" ? request.requestId : undefined });
  });
  await assert.rejects(service.mutate(identity(), input, authorize, transform("차단")), code("DOCUMENT_BUSY"));
  assert.equal((await service.load(input.documentId)).revision, created.revision);
  busy = false;
  const result = await service.mutate(identity(), input, authorize, transform("저장됨"));
  assert.equal(result.persisted, true); assert.equal(result.uiSynced, false);
  assert.deepEqual(requests, ["acquire", "acquire", "apply", "release"]);
  assert.equal((await service.load(input.documentId)).document.name, "저장됨");
});

test("F01/F03: queue에서 실행할 때 권한을 다시 확인한다", async (t) => {
  const { service } = await setup(t);
  const created = await service.create();
  let allowed = true; let calls = 0;
  const input = { documentId: created.document.documentId, expectedRevision: created.revision, dryRun: false };
  await assert.rejects(service.mutate(identity(), input, () => {
    calls += 1;
    if (!allowed) throw new Error("revoked");
    allowed = false;
  }, transform("not allowed")), /revoked/);
  assert.equal(calls, 2);
  assert.equal((await service.load(input.documentId)).revision, created.revision);
});
