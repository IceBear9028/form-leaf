import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DocumentRepository } from "../src/main/document/documentRepository.ts";
import { ComponentLibraryRepository } from "../src/main/document/componentLibraryRepository.ts";
import { createDefaultDocument } from "../src/foundation/content/resume.ts";
import { createEmptyDocument } from "../src/foundation/documentModel.ts";
import { addNode } from "../src/foundation/documentTransactions.ts";
import {
  createComponentFromSubtree,
  exportComponentPackage,
  importComponentPackage,
} from "../src/foundation/documentComponentOperations.ts";
import { sortDeletedDocumentSummaries, sortDocumentSummaries } from "../src/foundation/documentLibrary.ts";

async function temporaryWorkspace(t) {
  const directory = await mkdtemp(join(tmpdir(), "document-library-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("활성 목록과 휴지통을 결정적인 최근 시각 순으로 정렬한다", () => {
  const base = { name: "문서", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" };
  const active = sortDocumentSummaries([
    { ...base, id: "document-c", updatedAt: "2026-02-02T00:00:00.000Z" },
    { ...base, id: "document-b", createdAt: "2026-01-02T00:00:00.000Z" },
    { ...base, id: "document-a", createdAt: "2026-01-02T00:00:00.000Z" },
  ]);
  assert.deepEqual(active.map((item) => item.id), ["document-c", "document-a", "document-b"]);
  const deleted = sortDeletedDocumentSummaries([
    { ...base, id: "document-a", deletedAt: "2026-03-01T00:00:00.000Z" },
    { ...base, id: "document-b", deletedAt: "2026-03-02T00:00:00.000Z" },
  ]);
  assert.deepEqual(deleted.map((item) => item.id), ["document-b", "document-a"]);
});

test("빈 범용 문서를 독립적으로 생성, 저장, 이름 변경, 삭제, 복원한다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new DocumentRepository(workspace);
  assert.deepEqual(await repository.list(), []);
  const first = await repository.create();
  const second = await repository.create();
  assert.deepEqual(first.document.nodes[first.document.rootNodeId].childIds, []);

  const textId = "node-text";
  const changed = addNode(first.document, first.document.rootNodeId, {
    id: textId,
    type: "text",
    name: "Text",
    visible: true,
    value: "독립 데이터",
  });
  const saved = await repository.save(first.summary.id, { ...changed, name: "첫 문서" });
  assert.equal(saved.name, "첫 문서");
  assert.equal((await repository.rename(second.summary.id, "둘째 문서")).name, "둘째 문서");

  await repository.remove(first.summary.id);
  assert.deepEqual((await repository.list()).map((item) => item.id), [second.summary.id]);
  assert.equal((await repository.listTrash())[0].name, "첫 문서");
  const restored = await repository.restore(first.summary.id);
  assert.equal(restored.createdAt, saved.createdAt);
  assert.equal((await repository.load(first.summary.id)).nodes[textId].value, "독립 데이터");
  assert.equal((await new DocumentRepository(workspace).list()).length, 2);
});

test("요청 ID와 문서 ID가 다르면 다른 문서에 저장하지 않는다", async (t) => {
  const repository = new DocumentRepository(await temporaryWorkspace(t));
  const first = await repository.create();
  const second = await repository.create();
  await assert.rejects(repository.save(first.summary.id, second.document), /문서 ID가 일치하지 않습니다/);
  assert.equal((await repository.load(first.summary.id)).name, "제목 없는 문서");
});

test("현재 문서나 목록이 손상되면 직전 정상 백업으로 연다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new DocumentRepository(workspace);
  const created = await repository.create();
  await repository.save(created.summary.id, { ...created.document, name: "백업 직전 제목" });
  const documentPath = join(workspace, "documents", `${created.summary.id}.document.json`);
  await writeFile(documentPath, "{broken", "utf8");
  await writeFile(join(workspace, "documents.json"), "{broken", "utf8");
  const restarted = new DocumentRepository(workspace);
  assert.equal((await restarted.list()).length, 1);
  assert.equal((await restarted.load(created.summary.id)).documentId, created.summary.id);
});

test("같은 ID의 활성 파일이 있으면 휴지통 문서를 덮어쓰지 않는다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new DocumentRepository(workspace);
  const created = await repository.create();
  await repository.remove(created.summary.id);
  const fileName = `${created.summary.id}.document.json`;
  const trashPath = join(workspace, "document-trash", fileName);
  await copyFile(trashPath, join(workspace, "documents", fileName));
  await assert.rejects(repository.restore(created.summary.id), /덮어쓰지 않았습니다/);
  assert.equal((await readFile(trashPath, "utf8")).length > 0, true);
});

test("휴지통의 선택한 문서와 백업만 완전히 삭제한다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new DocumentRepository(workspace);
  const first = await repository.create();
  const second = await repository.create();
  await repository.save(first.summary.id, { ...first.document, name: "완전 삭제 대상" });
  await repository.remove(first.summary.id);
  await repository.remove(second.summary.id);
  const firstPath = join(workspace, "document-trash", `${first.summary.id}.document.json`);
  await repository.permanentlyDelete(first.summary.id);
  assert.deepEqual((await repository.listTrash()).map((item) => item.id), [second.summary.id]);
  await assert.rejects(readFile(firstPath, "utf8"), { code: "ENOENT" });
  await assert.rejects(readFile(`${firstPath}.backup`, "utf8"), { code: "ENOENT" });
});

test("기존 문서를 한 번만 복사 변환하고 원본을 보존한다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  await mkdir(workspace, { recursive: true });
  const legacy = { ...createDefaultDocument(), documentId: "legacy-document", name: "기존 파일", updatedAt: "2026-09-01T00:00:00.000Z" };
  const legacyPath = join(workspace, "default.resume.json");
  const original = `${JSON.stringify(legacy, null, 2)}\n`;
  await writeFile(legacyPath, original, "utf8");
  const repository = new DocumentRepository(workspace);
  assert.deepEqual((await repository.list()).map((item) => item.id), ["legacy-document"]);
  assert.equal((await repository.load("legacy-document")).schemaVersion, 3);
  assert.equal(await readFile(legacyPath, "utf8"), original);
  await repository.rename("legacy-document", "변환 후 이름");
  assert.equal((await new DocumentRepository(workspace).list()).length, 1);
  assert.equal(await readFile(legacyPath, "utf8"), original);
});

test("개인 컴포넌트를 백업하며 저장하고 다른 문서에 독립 복사한다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new ComponentLibraryRepository(workspace);
  let source = createEmptyDocument({ documentId: "source", now: "2026-01-01T00:00:00.000Z" });
  source = addNode(source, source.rootNodeId, { id: "source-text", type: "text", name: "Reusable", visible: true, value: "원본" });
  const component = createComponentFromSubtree(source, "source-text", "Reusable");
  const componentPackage = exportComponentPackage(component.document, component.componentId);
  const saved = await repository.save({ name: "Reusable", package: componentPackage });
  await repository.save({ id: saved.id, name: "Reusable v2", package: componentPackage });
  const itemPath = join(workspace, "components", `${saved.id}.component.json`);
  assert.equal((await readFile(`${itemPath}.backup`, "utf8")).length > 0, true);

  const target = createEmptyDocument({ documentId: "target", now: "2026-01-02T00:00:00.000Z" });
  const loaded = await repository.load(saved.id);
  const imported = importComponentPackage(target, loaded.package).document;
  const importedComponentId = Object.keys(imported.components)[0];
  assert.notEqual(importedComponentId, component.componentId);
  const changedPackage = structuredClone(loaded.package);
  changedPackage.components[changedPackage.entryComponentId].name = "라이브러리 변경";
  await repository.save({ id: saved.id, name: "변경", package: changedPackage });
  assert.equal(imported.components[importedComponentId].name, "Reusable");

  await writeFile(itemPath, "{broken", "utf8");
  assert.equal((await new ComponentLibraryRepository(workspace).load(saved.id)).name, "Reusable v2");
  await repository.remove(saved.id);
  assert.deepEqual(await repository.list(), []);
});
