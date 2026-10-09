import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentData } from "../src/foundation/document.ts";
import {
  importLegacyDocument,
  LegacyDocumentImportError,
} from "../src/main/document/legacy/importLegacyDocument.ts";

const text = (value, marks, href) => ({
  runs: [{
    text: value,
    ...(marks ? { marks } : {}),
    ...(href ? { href } : {}),
  }],
});

function legacyV2Document() {
  return {
    schemaVersion: 2,
    documentId: "source-1",
    name: "Imported document",
    styleSheetId: "reference-resume-compact-v1",
    pagination: { mode: "multi-page" },
    updatedAt: "2026-10-09T00:00:00.000Z",
    sections: [
      {
        id: "section-a",
        type: "profile",
        visible: true,
        role: "Role value",
        name: "Name value",
        phone: "Phone value",
        email: "mail@example.com",
        photoDataUrl: "data:image/png;base64,AA==",
        links: [{ id: "link-a", label: "Website", href: "https://example.com/a" }],
      },
      {
        id: "section-b",
        type: "introduction",
        title: "Opening",
        visible: false,
        bodyMarkdown: "First **paragraph**.",
      },
      {
        id: "section-c",
        type: "timeline",
        timelineKind: "career",
        title: "Ordered entries",
        annotation: "Annotation value",
        visible: true,
        items: [{
          id: "entry-a",
          visible: false,
          period: { start: "2024-01", end: "2025-01", label: "One year" },
          organization: "Organization value",
          title: text("Linked title", ["strong", "underline", "link"], "https://example.com/title"),
          links: [{ id: "link-b", label: "Detail", href: "https://example.com/detail" }],
          bodyMarkdown: "Entry body",
        }],
      },
      {
        id: "section-d",
        type: "project-group",
        groupKind: "project",
        title: "Grouped entries",
        visible: true,
        items: [{
          id: "entry-b",
          visible: true,
          order: 0,
          period: { start: "2025-02", end: "2025-03" },
          organization: "Group value",
          title: text("Group title"),
          links: [],
          techStack: ["Tool A", "Tool B"],
          bodyMarkdown: "Group body",
        }],
      },
      {
        id: "section-e",
        type: "free-text",
        title: "Closing",
        visible: true,
        bodyMarkdown: "Last paragraph.",
      },
    ],
  };
}

test("v2 입력을 목적 type 없이 유효한 범용 document graph로 변환한다", () => {
  const source = legacyV2Document();
  const snapshot = structuredClone(source);

  const document = importLegacyDocument(source);
  const validation = validateDocumentData(document);

  assert.equal(validation.valid, true);
  assert.deepEqual(source, snapshot);
  assert.equal(document.schemaVersion, 3);
  assert.equal(document.documentId, source.documentId);
  assert.equal(document.name, source.name);
  assert.equal(document.updatedAt, source.updatedAt);
  assert.equal(document.nodes[document.rootNodeId].childIds.length, source.sections.length);
  assert.equal(Object.keys(document.components).length, 2);
  assert.equal(Object.keys(document.assets).length, 1);
  assert.equal("sections" in document, false);
  assert.equal("kind" in document, false);
  assert.equal("categories" in document, false);

  const rootChildren = document.nodes[document.rootNodeId].childIds.map((id) => document.nodes[id]);
  assert.equal(rootChildren[1].visible, false);

  const repeaters = Object.values(document.nodes).filter((node) => node.type === "repeater");
  assert.equal(repeaters.length, 2);
  assert.equal(repeaters[0].items[0].visible, false);
  assert.equal(repeaters[0].items[0].props["period-start"], "2024-01");
  assert.equal(repeaters[0].items[0].props["period-end"], "2025-01");
  assert.equal(repeaters[0].items[0].props["period-label"], "One year");
  assert.equal(repeaters[0].items[0].props.organization, "Organization value");
  assert.deepEqual(
    repeaters[0].items[0].props.title.runs[0].marks.map((mark) => mark.type),
    ["bold", "underline", "link"],
  );
  assert.match(repeaters[0].items[0].props.links, /Website|Detail/);
  assert.match(repeaters[1].items[0].props.tags, /Tool A/);
  assert.equal(repeaters[1].items[0].props.body, "Group body");

  const markdownSources = Object.values(document.nodes)
    .filter((node) => node.type === "markdown")
    .map((node) => node.source);
  assert.equal(markdownSources.includes("First **paragraph**."), true);
  assert.equal(markdownSources.includes("Last paragraph."), true);
});

test("v1 서술 블록을 먼저 Markdown으로 보존한 뒤 범용 문서로 변환한다", () => {
  const source = {
    schemaVersion: 1,
    documentId: "source-v1",
    name: "Old document",
    styleSheetId: "reference-resume-v1",
    pagination: { mode: "multi-page" },
    updatedAt: "2026-10-01T00:00:00.000Z",
    sections: [
      {
        id: "intro-v1",
        type: "introduction",
        title: "Opening",
        visible: true,
        paragraphs: [
          { id: "p-1", content: text("First") },
          { id: "p-2", content: text("Second", ["strong"]) },
        ],
      },
      {
        id: "free-v1",
        type: "free-text",
        title: "Notes",
        visible: true,
        blocks: [{
          id: "list-v1",
          type: "bullet-list",
          items: [text("Alpha"), text("Beta")],
        }],
      },
    ],
  };
  const snapshot = structuredClone(source);

  const document = importLegacyDocument(source);
  const sources = Object.values(document.nodes)
    .filter((node) => node.type === "markdown")
    .map((node) => node.source);

  assert.equal(validateDocumentData(document).valid, true);
  assert.deepEqual(source, snapshot);
  assert.equal(sources.includes("First\n\n**Second**"), true);
  assert.equal(sources.some((value) => value.includes("- Alpha") && value.includes("- Beta")), true);
});

test("지원하지 않는 이미지나 입력 형식은 위치를 포함한 오류로 중단하고 원본을 바꾸지 않는다", () => {
  const source = legacyV2Document();
  source.sections[0].photoDataUrl = "https://example.com/image.png";
  const snapshot = structuredClone(source);

  assert.throws(
    () => importLegacyDocument(source),
    (error) => error instanceof LegacyDocumentImportError &&
      error.path === "$.sections.0.photoDataUrl",
  );
  assert.deepEqual(source, snapshot);
  assert.throws(
    () => importLegacyDocument({ schemaVersion: 99 }),
    (error) => error instanceof LegacyDocumentImportError && error.path === "$",
  );
});
