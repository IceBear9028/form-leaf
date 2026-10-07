import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResumeRepository } from "../src/main/resumeRepository.ts";
import { createDefaultDocument } from "../src/foundation/resume.ts";
import {
  sortDeletedResumeSummaries,
  sortResumeSummaries,
} from "../src/foundation/resumeLibrary.ts";

async function temporaryWorkspace(t) {
  const directory = await mkdtemp(join(tmpdir(), "resume-studio-library-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("활성 목록과 휴지통을 결정적인 최근 시각 순으로 정렬한다", () => {
  const base = {
    title: "이력서",
    profileName: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
  const active = sortResumeSummaries([
    { ...base, id: "resume-c", updatedAt: "2026-02-02T00:00:00.000Z" },
    { ...base, id: "resume-b", createdAt: "2026-01-02T00:00:00.000Z" },
    { ...base, id: "resume-a", createdAt: "2026-01-02T00:00:00.000Z" },
  ]);
  assert.deepEqual(active.map((item) => item.id), ["resume-c", "resume-a", "resume-b"]);

  const deleted = sortDeletedResumeSummaries([
    { ...base, id: "resume-a", deletedAt: "2026-03-01T00:00:00.000Z" },
    { ...base, id: "resume-b", deletedAt: "2026-03-02T00:00:00.000Z" },
  ]);
  assert.deepEqual(deleted.map((item) => item.id), ["resume-b", "resume-a"]);
});

test("여러 이력서를 독립적으로 생성, 저장, 이름 변경, 삭제하고 복원한다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new ResumeRepository(workspace);
  assert.deepEqual(await repository.list(), []);

  const first = await repository.create();
  const second = await repository.create();
  const profile = first.document.sections.find((section) => section.type === "profile");
  assert.ok(profile);
  const saved = await repository.save(first.summary.id, {
    ...first.document,
    name: "프론트엔드 이력서",
    sections: first.document.sections.map((section) =>
      section.id === profile.id ? { ...profile, name: "홍길동" } : section,
    ),
  });
  assert.equal(saved.title, "프론트엔드 이력서");
  assert.equal(saved.profileName, "홍길동");

  const renamed = await repository.rename(second.summary.id, "백엔드 이력서");
  assert.equal(renamed.title, "백엔드 이력서");
  assert.equal((await repository.load(first.summary.id)).name, "프론트엔드 이력서");
  assert.equal((await repository.load(second.summary.id)).name, "백엔드 이력서");

  await repository.remove(first.summary.id);
  assert.deepEqual((await repository.list()).map((item) => item.id), [second.summary.id]);
  const trash = await repository.listTrash();
  assert.equal(trash.length, 1);
  assert.equal(trash[0].id, first.summary.id);
  assert.equal(trash[0].title, "프론트엔드 이력서");

  const restored = await repository.restore(first.summary.id);
  assert.equal(restored.id, first.summary.id);
  assert.equal(restored.createdAt, saved.createdAt);
  assert.equal(restored.updatedAt, saved.updatedAt);
  assert.deepEqual(await repository.listTrash(), []);
  assert.equal((await repository.load(first.summary.id)).sections.find(
    (section) => section.type === "profile",
  )?.name, "홍길동");

  const restarted = new ResumeRepository(workspace);
  assert.equal((await restarted.list()).length, 2);
});

test("요청 ID와 문서 ID가 다르면 다른 이력서에 저장하지 않는다", async (t) => {
  const repository = new ResumeRepository(await temporaryWorkspace(t));
  const first = await repository.create();
  const second = await repository.create();

  await assert.rejects(
    repository.save(first.summary.id, second.document),
    /문서 ID가 일치하지 않습니다/,
  );
  assert.equal((await repository.load(first.summary.id)).name, "제목 없는 이력서");
});

test("현재 문서나 목록이 손상되면 직전 정상 백업으로 연다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new ResumeRepository(workspace);
  const created = await repository.create();
  await repository.save(created.summary.id, {
    ...created.document,
    name: "백업 직전 제목",
  });

  const documentPath = join(workspace, "resumes", `${created.summary.id}.resume.json`);
  await writeFile(documentPath, "{broken", "utf8");
  await writeFile(join(workspace, "library.json"), "{broken", "utf8");

  const restarted = new ResumeRepository(workspace);
  assert.equal((await restarted.list()).length, 1);
  assert.equal((await restarted.load(created.summary.id)).documentId, created.summary.id);
});

test("같은 ID의 활성 파일이 있으면 휴지통 문서를 덮어쓰지 않는다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new ResumeRepository(workspace);
  const created = await repository.create();
  await repository.remove(created.summary.id);

  const fileName = `${created.summary.id}.resume.json`;
  const trashPath = join(workspace, "trash", fileName);
  const activePath = join(workspace, "resumes", fileName);
  await copyFile(trashPath, activePath);

  await assert.rejects(repository.restore(created.summary.id), /덮어쓰지 않았습니다/);
  assert.equal((await readFile(trashPath, "utf8")).length > 0, true);
});

test("휴지통의 선택한 이력서와 백업만 완전히 삭제한다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const repository = new ResumeRepository(workspace);
  const first = await repository.create();
  const second = await repository.create();
  await repository.save(first.summary.id, { ...first.document, name: "완전 삭제 대상" });
  await repository.remove(first.summary.id);
  await repository.remove(second.summary.id);

  const firstPath = join(workspace, "trash", `${first.summary.id}.resume.json`);
  await repository.permanentlyDelete(first.summary.id);

  assert.deepEqual((await repository.listTrash()).map((item) => item.id), [second.summary.id]);
  await assert.rejects(readFile(firstPath, "utf8"), { code: "ENOENT" });
  await assert.rejects(readFile(`${firstPath}.backup`, "utf8"), { code: "ENOENT" });
});

test("기존 단일 이력서를 한 번만 복사 이전하고 원본을 보존한다", async (t) => {
  const workspace = await temporaryWorkspace(t);
  await mkdir(workspace, { recursive: true });
  const legacy = {
    ...createDefaultDocument(),
    documentId: "resume-legacy",
    name: "새 이력서",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  const legacyPath = join(workspace, "default.resume.json");
  const original = `${JSON.stringify(legacy, null, 2)}\n`;
  await writeFile(legacyPath, original, "utf8");

  const repository = new ResumeRepository(workspace);
  const firstList = await repository.list();
  assert.equal(firstList.length, 1);
  assert.equal(firstList[0].id, "resume-legacy");
  assert.equal(firstList[0].title, "내 이력서");
  assert.equal((await repository.load("resume-legacy")).name, "내 이력서");
  assert.equal(await readFile(legacyPath, "utf8"), original);

  const restarted = new ResumeRepository(workspace);
  assert.equal((await restarted.list()).length, 1);
  assert.equal(await readFile(legacyPath, "utf8"), original);
});
