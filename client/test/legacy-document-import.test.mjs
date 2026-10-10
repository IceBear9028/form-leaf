import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentData } from "../src/foundation/document.ts";
import {
  importLegacyDocument,
  LegacyDocumentImportError,
} from "../src/main/document/legacy/importLegacyDocument.ts";
import { upgradeLegacyImportedDocument } from "../src/main/document/legacy/upgradeLegacyImportedDocument.ts";

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
  assert.equal(document.styles["legacy-style-root"].layout.gapPt, 0);
  assert.equal(document.styles["legacy-style-section"].layout.gapPt, 18);
  assert.equal(document.styles["legacy-style-section"].pagination.keepTogether, true);
  assert.equal(document.styles["legacy-style-lead"].layout.gapPt, 16);
  assert.equal(document.styles["legacy-style-lead"].layout.paddingPt[2], 16);
  assert.equal(document.styles["legacy-style-header-row"].layout.paddingPt[2], 16.2);
  assert.equal(document.styles["legacy-style-aside"].layout.gapPt, 11.25);
  assert.equal(document.styles["legacy-style-roomy-boundary"].layout.paddingPt[0], 17.9);
  assert.equal(document.styles["legacy-style-roomy-heading-row"].layout.paddingPt[2], 24.5);
  assert.equal(document.styles["legacy-style-split-item"].layout.gapPt, 18.4);
  assert.equal(document.styles["legacy-style-split-item"].layout.paddingPt[2], 13.6);
  assert.deepEqual(document.styles["legacy-style-bullet-body"].markdown, { listItemGapPt: 4 });
  assert.equal(document.nodes["legacy-node-section-c-2"].styleId, "legacy-style-roomy-boundary");
  assert.equal(document.nodes["legacy-node-section-c-heading-row"].styleId, "legacy-style-roomy-heading-row");
  assert.equal(document.nodes["legacy-node-section-c-items"].styleId, "legacy-style-connected-list");
  assert.equal(document.nodes["legacy-node-section-c-item-root"].styleId, "legacy-style-split-item");
  assert.equal(document.nodes["legacy-node-section-c-item-period"].styleId, "legacy-style-period");
  assert.equal(document.nodes["legacy-node-section-c-period-label"].styleId, "legacy-style-duration");
  assert.equal(document.nodes["legacy-node-section-c-title"].styleId, "legacy-style-subtitle");
  assert.equal(document.nodes["legacy-node-section-c-body"].styleId, "legacy-style-bullet-body");
  assert.equal(document.nodes["legacy-node-section-a-links"].type, "rich-text");
  assert.deepEqual(
    document.nodes["legacy-node-section-a-links"].value.runs[0].marks.map((mark) => mark.type),
    ["underline", "link"],
  );

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

test("기존 legacy 범용 graph는 내용과 prop을 보존하며 새 시각 구조로 연다", () => {
  const fresh = importLegacyDocument(legacyV2Document());
  const current = downgradeVisualGraph(fresh);
  current.nodes["legacy-node-section-a-links"] = {
    id: "legacy-node-section-a-links",
    type: "markdown",
    name: "Links",
    visible: true,
    source: "- [Website](<https://example.com/a>)",
  };
  const body = Object.values(current.nodes).find((node) => node.type === "markdown" && node.name === "Body");
  body.source = "사용자가 수정한 본문";
  const repeater = Object.values(current.nodes).find((node) => node.type === "repeater" && node.items.length);
  repeater.items[0].props.body = "사용자가 수정한 prop";
  const snapshot = structuredClone(current);

  const upgraded = upgradeLegacyImportedDocument(current, fresh);

  assert.deepEqual(current, snapshot);
  assert.equal(validateDocumentData(upgraded).valid, true);
  assert.equal(Object.keys(upgraded.styles).length > 4, true);
  assert.equal(upgraded.styles["legacy-style-root"].layout.paddingPt, undefined);
  assert.equal(upgraded.nodes[body.id].source, "사용자가 수정한 본문");
  assert.equal(upgraded.nodes[repeater.id].items[0].props.body, "사용자가 수정한 prop");
  assert.equal(upgraded.nodes["legacy-node-section-a-links"].type, "rich-text");
  assert.equal(upgraded.nodes["legacy-node-section-a-links"].value.runs[0].text, "Website");
  assert.deepEqual(
    upgraded.nodes["legacy-node-section-a-links"].value.runs[0].marks.map((mark) => mark.type),
    ["underline", "link"],
  );
  assert.equal(Object.values(upgraded.nodes).some((node) => node.name === "Identity"), true);
  assert.equal(Object.values(upgraded.nodes).some((node) => node.name === "Meta"), true);
  assert.equal(Object.values(upgraded.nodes).some((node) => node.name === "Content"), true);
  assert.deepEqual(
    upgraded.nodes["legacy-node-section-c-heading-row"].childIds,
    ["legacy-node-section-c-heading", "legacy-node-section-c-annotation"],
  );
});

test("과거 변환기가 만든 23-style graph도 내용 보존 후 최신 시각 구조로 연다", () => {
  const fresh = importLegacyDocument(legacyV2Document());
  const current = generatedVisualV1Graph(fresh);
  const repeater = current.nodes["legacy-node-section-c-items"];
  repeater.items[0].props.body = "사용자가 수정한 경력 본문";

  assert.equal(validateDocumentData(current).valid, true);

  const upgraded = upgradeLegacyImportedDocument(current, fresh);

  assert.equal(validateDocumentData(upgraded).valid, true);
  assert.equal(upgraded.nodes["legacy-node-section-c-2"].styleId, "legacy-style-roomy-boundary");
  assert.deepEqual(
    upgraded.nodes["legacy-node-section-c-2"].childIds,
    ["legacy-node-section-c-heading-row", "legacy-node-section-c-items"],
  );
  assert.deepEqual(
    upgraded.nodes["legacy-node-section-c-item-root"].childIds,
    ["legacy-node-section-c-item-meta", "legacy-node-section-c-item-content"],
  );
  assert.equal(upgraded.nodes["legacy-node-section-c-items"].items[0].props.body, "사용자가 수정한 경력 본문");
});

test("기존 기본 style이 수정된 legacy graph는 자동 시각 업그레이드로 덮어쓰지 않는다", () => {
  const fresh = importLegacyDocument(legacyV2Document());
  const current = downgradeVisualGraph(fresh);
  current.styles["legacy-style-root"].layout.gapPt = 99;

  assert.equal(upgradeLegacyImportedDocument(current, fresh), current);
});

test("사용자가 설명을 추가한 profile 링크 Markdown은 rich-text로 자동 치환하지 않는다", () => {
  const fresh = importLegacyDocument(legacyV2Document());
  const current = downgradeVisualGraph(fresh);
  current.nodes["legacy-node-section-a-links"] = {
    id: "legacy-node-section-a-links",
    type: "markdown",
    name: "Links",
    visible: true,
    source: "내 링크\n\n- [Website](<https://example.com/a>)",
  };

  const upgraded = upgradeLegacyImportedDocument(current, fresh);

  assert.equal(validateDocumentData(upgraded).valid, true);
  assert.equal(upgraded.nodes["legacy-node-section-a-links"].type, "markdown");
  assert.equal(upgraded.nodes["legacy-node-section-a-links"].source, current.nodes["legacy-node-section-a-links"].source);
});

function downgradeVisualGraph(fresh) {
  const current = structuredClone(fresh);
  const wrapper = (id) => /-(?:identity|contacts|(?:phone|email|links)-row|heading-row|item-meta|item-content|item-period)$/.test(id);
  const flatten = (childIds) => childIds.flatMap((id) => {
    const node = current.nodes[id];
    if (!node) return [];
    if (wrapper(id) && node.type === "container") return flatten(node.childIds);
    if (/-period-separator$/.test(id)) return [];
    return [id];
  });
  Object.values(current.nodes).forEach((node) => {
    if (node.type === "container") node.childIds = flatten(node.childIds);
  });
  Object.values(current.components).forEach((component) => {
    const root = current.nodes[component.rootNodeId];
    if (root?.type === "container") {
      root.childIds = component.propDefinitions.map((prop) => prop.binding.nodeId);
    }
  });
  Object.keys(current.nodes).forEach((id) => {
    if (wrapper(id) || /-period-separator$/.test(id)) delete current.nodes[id];
  });

  const rootChildren = new Set(current.nodes[current.rootNodeId].childIds);
  Object.values(current.nodes).forEach((node) => {
    delete node.styleId;
    if (node.id === current.rootNodeId) node.styleId = "legacy-style-root";
    else if (rootChildren.has(node.id)) node.styleId = "legacy-style-section";
    else if (node.id.endsWith("-item-root")) node.styleId = "legacy-style-item";
    else if (node.name === "Heading") node.styleId = "legacy-style-heading";
  });
  current.styles = {
    "legacy-style-root": {
      id: "legacy-style-root",
      name: "Document",
      layout: { direction: "column", gapPt: 10, paddingPt: [24, 28, 24, 28], align: "stretch", width: { mode: "fill" } },
      typography: { fontFamily: "Pretendard", fontSizePt: 7.5, lineHeight: 1.5, fontWeight: 400, color: { kind: "hex", value: "#000000" } },
    },
    "legacy-style-section": {
      id: "legacy-style-section",
      name: "Section",
      layout: { direction: "column", gapPt: 5.5, align: "stretch", width: { mode: "fill" } },
    },
    "legacy-style-item": {
      id: "legacy-style-item",
      name: "Item",
      layout: { direction: "column", gapPt: 3, align: "stretch", width: { mode: "fill" } },
      pagination: { keepTogether: true },
    },
    "legacy-style-heading": {
      id: "legacy-style-heading",
      name: "Heading",
      typography: { fontSizePt: 11.25, lineHeight: 1.25, fontWeight: 600, color: { kind: "hex", value: "#000000" } },
      pagination: { keepWithNext: true },
    },
  };
  assert.equal(validateDocumentData(current).valid, true);
  return current;
}

function generatedVisualV1Graph(fresh) {
  const current = structuredClone(fresh);
  const retainedStyleIds = [
    "legacy-style-root",
    "legacy-style-section",
    "legacy-style-section-boundary",
    "legacy-style-item",
    "legacy-style-heading",
    "legacy-style-heading-row",
    "legacy-style-annotation",
    "legacy-style-lead",
    "legacy-style-list",
    "legacy-style-meta",
    "legacy-style-content",
    "legacy-style-title",
    "legacy-style-accent-title",
    "legacy-style-compact-text",
    "legacy-style-header-row",
    "legacy-style-media",
    "legacy-style-identity",
    "legacy-style-role",
    "legacy-style-name",
    "legacy-style-aside",
    "legacy-style-contact-row",
    "legacy-style-contact-label",
    "legacy-style-contact-value",
  ];
  current.styles = Object.fromEntries(retainedStyleIds.map((id) => [id, structuredClone(fresh.styles[id])]));
  const compact = current.styles["legacy-style-root"].typography.fontSizePt === 7.5;
  current.styles["legacy-style-root"].layout.gapPt = compact ? 10 : 13;
  current.styles["legacy-style-section"].layout.gapPt = compact ? 9 : 12;
  delete current.styles["legacy-style-section"].pagination;
  current.styles["legacy-style-heading-row"].pagination = { keepWithNext: true };
  delete current.styles["legacy-style-lead"].layout;
  current.styles["legacy-style-header-row"].layout.paddingPt[2] = compact ? 13 : 16;
  current.styles["legacy-style-aside"].layout.gapPt = 8;

  const fallbackStyleIds = {
    "legacy-style-roomy-boundary": "legacy-style-section-boundary",
    "legacy-style-roomy-heading-row": "legacy-style-heading-row",
    "legacy-style-connected-list": "legacy-style-list",
    "legacy-style-split-item": "legacy-style-item",
    "legacy-style-period": "legacy-style-contact-row",
    "legacy-style-detailed-content": "legacy-style-content",
    "legacy-style-subtitle": "legacy-style-compact-text",
    "legacy-style-bullet-body": "legacy-style-compact-text",
  };
  Object.values(current.nodes).forEach((node) => {
    if (!node.styleId) return;
    const fallback = fallbackStyleIds[node.styleId];
    if (fallback) node.styleId = fallback;
    else if (node.styleId === "legacy-style-duration") delete node.styleId;
  });

  const section = current.nodes["legacy-node-section-c-2"];
  const headingRow = current.nodes["legacy-node-section-c-heading-row"];
  section.childIds = [...headingRow.childIds, "legacy-node-section-c-items"];
  delete current.nodes[headingRow.id];

  const component = current.components["legacy-component-section-c"];
  const itemRoot = current.nodes[component.rootNodeId];
  itemRoot.childIds = component.propDefinitions.map((prop) => prop.binding.nodeId);
  [
    "legacy-node-section-c-item-meta",
    "legacy-node-section-c-item-content",
    "legacy-node-section-c-item-period",
    "legacy-node-section-c-period-separator",
  ].forEach((id) => delete current.nodes[id]);
  return current;
}
