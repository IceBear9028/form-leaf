import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readJsonWithBackup,
  writeJsonAtomically,
} from "../src/main/document/atomicJsonStore.ts";
import { createDocumentPaths } from "../src/main/document/documentPaths.ts";
import { createLegacyDocumentPaths } from "../src/main/document/legacy/legacyPaths.ts";

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "formleaf-storage-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("범용 문서와 component 경로는 목적별 입력 경로를 포함하지 않는다", () => {
  const paths = createDocumentPaths("/workspace");

  assert.equal(paths.index, join("/workspace", "documents.json"));
  assert.equal(paths.activeDocument("document-1"), join("/workspace", "documents", "document-1.document.json"));
  assert.equal(paths.trashDocument("document-1"), join("/workspace", "document-trash", "document-1.document.json"));
  assert.equal(paths.componentItem("component-1"), join("/workspace", "components", "component-1.component.json"));
  assert.equal("legacyDocument" in paths, false);
});

test("과거 입력 경로는 legacy 모듈에서만 계산한다", () => {
  const paths = createLegacyDocumentPaths("/workspace");
  assert.equal(paths.singleDocument, join("/workspace", "default.resume.json"));
  assert.equal(paths.activeDocument("resume-1"), join("/workspace", "resumes", "resume-1.resume.json"));
});

test("atomic JSON 저장은 정상 직전본을 백업하고 손상된 현재 파일 대신 복구한다", async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, "library.json");
  const backup = `${path}.backup`;
  const backupTarget = (current) => current?.valid === true
    ? { path: backup, overwrite: true }
    : undefined;

  await writeJsonAtomically(path, { valid: true, version: 1 }, backupTarget);
  await writeJsonAtomically(path, { valid: true, version: 2 }, backupTarget);

  assert.deepEqual(JSON.parse(await readFile(backup, "utf8")), { valid: true, version: 1 });

  await writeFile(path, "{broken", "utf8");
  const restored = await readJsonWithBackup(
    path,
    (value) => {
      if (!value || typeof value !== "object" || value.valid !== true) throw new Error("invalid");
      return value;
    },
    "missing",
  );

  assert.deepEqual(restored, { valid: true, version: 1 });
});
