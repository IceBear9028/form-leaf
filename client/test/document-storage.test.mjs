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

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "resume-studio-storage-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("문서 경로 계산은 기존 저장 위치와 파일 접미사를 유지한다", () => {
  const paths = createDocumentPaths("/workspace");

  assert.equal(paths.index, join("/workspace", "library.json"));
  assert.equal(paths.legacyDocument, join("/workspace", "default.resume.json"));
  assert.equal(paths.activeDocument("resume-1"), join("/workspace", "resumes", "resume-1.resume.json"));
  assert.equal(paths.trashDocument("resume-1"), join("/workspace", "trash", "resume-1.resume.json"));
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
