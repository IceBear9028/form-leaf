import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultDocument,
  isResumeDocument,
  isV1ResumeDocument,
} from "../src/foundation/resume.ts";
import { migrateResumeDocumentV1 } from "../src/main/resumeMigration.ts";

const text = (value, marks, href) => ({
  runs: [{ text: value, ...(marks ? { marks } : {}), ...(href ? { href } : {}) }],
});

test("새 문서는 Markdown 본문을 사용하는 유효한 schemaVersion 2로 생성된다", () => {
  const document = createDefaultDocument();
  assert.equal(document.schemaVersion, 2);
  assert.equal(isResumeDocument(document), true);
  assert.equal(document.sections.find((section) => section.type === "introduction").bodyMarkdown, "");
});

test("v1의 정형 필드는 유지하고 서술형 블록만 Markdown 본문으로 합친다", () => {
  const source = {
    schemaVersion: 1,
    documentId: "resume-1",
    name: "테스트 이력서",
    styleSheetId: "reference-resume-v1",
    pagination: { mode: "multi-page" },
    updatedAt: "2026-10-04T00:00:00.000Z",
    sections: [
      {
        id: "profile-1",
        type: "profile",
        visible: true,
        role: "개발자",
        name: "홍길동",
        phone: "010-0000-0000",
        email: "test@example.com",
        links: [],
      },
      {
        id: "intro-1",
        type: "introduction",
        title: "소개",
        visible: true,
        paragraphs: [
          { id: "intro-p1", content: text("첫 문단") },
          { id: "intro-p2", content: text("강조 문단", ["strong"]) },
        ],
      },
      {
        id: "career-1",
        type: "timeline",
        timelineKind: "career",
        title: "경력",
        visible: true,
        items: [{
          id: "career-item-1",
          visible: true,
          period: { start: "2024. 01", end: "현재" },
          organization: "회사",
          title: text("프론트엔드 개발자"),
          links: [],
          blocks: [
            { id: "career-p", type: "paragraph", styleRef: "body", content: text("업무 설명") },
            { id: "career-tech", type: "tech-stack", items: ["React", "TypeScript"] },
          ],
        }],
      },
      {
        id: "project-1",
        type: "project-group",
        groupKind: "project",
        title: "프로젝트",
        visible: true,
        items: [{
          id: "project-item-1",
          visible: true,
          order: 0,
          period: { start: "2025. 01", end: "2025. 06" },
          organization: "개인",
          title: text("검색 프로젝트"),
          summary: text("프로젝트 소개"),
          links: [],
          blocks: [
            {
              id: "detail-1",
              type: "detail",
              title: text("검색 개선"),
              context: text("응답이 느렸습니다."),
              actions: [text("캐시를 적용했습니다.")],
              result: text("40% 단축했습니다.", ["strong"]),
            },
            { id: "tech-1", type: "tech-stack", items: ["React"] },
            { id: "tech-2", type: "tech-stack", items: ["Electron", "TypeScript"] },
          ],
        }],
      },
      {
        id: "free-1",
        type: "free-text",
        title: "추가 내용",
        visible: true,
        blocks: [{
          id: "links-1",
          type: "link-list",
          links: [{ id: "link-1", label: "문서", href: "https://example.com" }],
        }],
      },
    ],
  };
  const snapshot = structuredClone(source);

  assert.equal(isV1ResumeDocument(source), true);
  const migrated = migrateResumeDocumentV1(source);

  assert.equal(isResumeDocument(migrated), true);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.sections[1].bodyMarkdown, "첫 문단\n\n**강조 문단**");
  assert.equal(migrated.sections[2].items[0].bodyMarkdown, "업무 설명\n\n**기술 스택:** React, TypeScript");
  assert.deepEqual(migrated.sections[3].items[0].techStack, ["React", "Electron", "TypeScript"]);
  assert.match(migrated.sections[3].items[0].bodyMarkdown, /^프로젝트 소개\n\n### 검색 개선/);
  assert.doesNotMatch(migrated.sections[3].items[0].bodyMarkdown, /기술 스택/);
  assert.equal(migrated.sections[4].bodyMarkdown, "- [문서](https://example.com)");
  assert.deepEqual(source, snapshot);
});

test("v2 검증기는 알 수 없는 스타일 ID도 보존해 스타일 레지스트리 확장을 허용한다", () => {
  const document = {
    schemaVersion: 2,
    documentId: "resume-2",
    name: "확장 스타일",
    styleSheetId: "future-resume-v1",
    pagination: { mode: "multi-page" },
    updatedAt: "2026-10-04T00:00:00.000Z",
    sections: [],
  };

  assert.equal(isResumeDocument(document), true);
});
