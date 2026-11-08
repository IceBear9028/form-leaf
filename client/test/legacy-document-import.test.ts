import type { TextMark } from "../src/main/document/legacy/legacyTypes.ts";
import * as Check from "./fixtures/assertions.ts";
import type * as Types from "./fixtures/types.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentData } from "../src/foundation/document.ts";
import { validateDocumentDataForMigration } from "../src/foundation/documentValidation.ts";
import {
  importLegacyDocument,
  importLegacyDocumentWithLegacyIds,
  LegacyDocumentImportError,
} from "../src/main/document/legacy/importLegacyDocument.ts";
import { upgradeLegacyImportedDocument } from "../src/main/document/legacy/upgradeLegacyImportedDocument.ts";
import { createDeterministicEntityId } from "../src/main/document/documentMigration.ts";

const text = (value: string, marks?: TextMark[], href?: string) => ({
  runs: [{
    text: value,
    ...(marks ? { marks } : {}),
    ...(href ? { href } : {}),
  }],
});

function legacyV2Document() {
  return {
    schemaVersion: 2 as const,
    documentId: "source-1",
    name: "Imported document",
    styleSheetId: "reference-resume-compact-v1",
    pagination: { mode: "multi-page" as const },
    updatedAt: "2026-10-09T00:00:00.000Z",
    sections: [
      {
        id: "section-a",
        type: "profile" as const,
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
        type: "introduction" as const,
        title: "Opening",
        visible: false,
        bodyMarkdown: "First **paragraph**.",
      },
      {
        id: "section-c",
        type: "timeline" as const,
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
        id: "section-education",
        type: "timeline" as const,
        timelineKind: "education",
        title: "Learning",
        annotation: "",
        visible: true,
        items: [{
          id: "entry-education",
          visible: true,
          period: { start: "2020-01", end: "2020-06" },
          organization: "Program value",
          title: text("Course value"),
          links: [],
          bodyMarkdown: "",
        }],
      },
      {
        id: "section-d",
        type: "project-group" as const,
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
        type: "free-text" as const,
        title: "Closing",
        visible: true,
        bodyMarkdown: "Last paragraph.",
      },
    ],
  };
}

await test("v2 입력을 목적 type 없이 유효한 범용 document graph로 변환한다", () => {
  const source = legacyV2Document();
  const snapshot = structuredClone(source);

  const document = importLegacyDocument(source);
  const validation = validateDocumentData(document);

  assert.equal(validation.valid, true);
  assert.deepEqual(source, snapshot);
  assert.equal(document.schemaVersion, 4);
  assert.equal(document.documentId, source.documentId);
  assert.equal(document.name, source.name);
  assert.equal(document.updatedAt, source.updatedAt);
  assert.equal(Check.asNode(document.nodes[document.rootNodeId], 'container').childIds.length, source.sections.length);
  assert.equal(Object.keys(document.components).length, 3);
  assert.equal(Object.keys(document.assets).length, 1);
  assert.equal("sections" in document, false);
  assert.equal("kind" in document, false);
  assert.equal("categories" in document, false);
  assert.equal(canonicalInternalIds(document), true);

  const rootChildren = Check.asNode(document.nodes[document.rootNodeId], 'container').childIds.map((id: string) => document.nodes[id]);
  assert.equal(Check.present(Check.present(rootChildren, 'fixture node')[1], 'fixture node').visible, false);
  const node = (legacyId: string) => document.nodes[canonicalId(document, "node", legacyId)];
  const style = (legacyId: string) => document.styles[canonicalId(document, "style", legacyId)];
  const styleId = (legacyId: string) => canonicalId(document, "style", legacyId);
  assert.equal(Check.present(Check.present(style("legacy-style-root"), 'fixture value').layout, 'fixture value').gapPt, 0);
  assert.equal(Check.present(Check.present(style("legacy-style-section"), 'fixture value').layout, 'fixture value').gapPt, 18);
  assert.equal(Check.present(Check.present(style("legacy-style-section"), 'fixture value').pagination, 'fixture value').keepTogether, true);
  assert.equal(Check.present(Check.present(style("legacy-style-lead"), 'fixture value').layout, 'fixture value').gapPt, 16);
  assert.equal(Check.present(Check.present(Check.present(style("legacy-style-lead"), 'fixture value').layout, 'fixture value').paddingPt, 'fixture value')[2], 16);
  assert.equal(Check.present(Check.present(Check.present(style("legacy-style-header-row"), 'fixture value').layout, 'fixture value').paddingPt, 'fixture value')[2], 16.2);
  assert.equal(Check.present(Check.present(style("legacy-style-aside"), 'fixture value').layout, 'fixture value').gapPt, 11.25);
  assert.equal(Check.present(Check.present(Check.present(style("legacy-style-roomy-boundary"), 'fixture value').layout, 'fixture value').paddingPt, 'fixture value')[0], 17.9);
  assert.equal(Check.present(Check.present(Check.present(style("legacy-style-roomy-heading-row"), 'fixture value').layout, 'fixture value').paddingPt, 'fixture value')[2], 24.5);
  assert.equal(Check.present(Check.present(style("legacy-style-split-item"), 'fixture value').layout, 'fixture value').gapPt, 18.4);
  assert.equal(Check.present(Check.present(Check.present(style("legacy-style-split-item"), 'fixture value').layout, 'fixture value').paddingPt, 'fixture value')[2], 13.6);
  assert.deepEqual(Check.present(style("legacy-style-bullet-body"), 'fixture value').markdown, { listItemGapPt: 2 });
  assert.equal(Check.present(node("legacy-node-section-c-2"), 'fixture node').styleId, styleId("legacy-style-roomy-boundary"));
  assert.equal(Check.present(node("legacy-node-section-c-heading-row"), 'fixture node').styleId, styleId("legacy-style-roomy-heading-row"));
  assert.equal(Check.present(node("legacy-node-section-c-items"), 'fixture node').styleId, styleId("legacy-style-connected-list"));
  assert.equal(Check.present(node("legacy-node-section-c-item-root"), 'fixture node').styleId, styleId("legacy-style-split-item"));
  assert.equal(Check.present(node("legacy-node-section-c-item-period"), 'fixture node').styleId, styleId("legacy-style-period"));
  assert.equal(Check.present(node("legacy-node-section-c-period-label"), 'fixture node').styleId, styleId("legacy-style-duration"));
  assert.equal(Check.present(node("legacy-node-section-c-title"), 'fixture node').styleId, styleId("legacy-style-subtitle"));
  assert.equal(Check.present(node("legacy-node-section-c-body"), 'fixture node').styleId, styleId("legacy-style-bullet-body"));
  assert.equal(Check.present(node("legacy-node-section-education-3"), 'fixture node').styleId, styleId("legacy-style-stacked-boundary"));
  assert.equal(Check.present(node("legacy-node-section-education-items"), 'fixture node').styleId, styleId("legacy-style-spaced-list"));
  assert.equal(Check.present(node("legacy-node-section-education-item-root"), 'fixture node').styleId, styleId("legacy-style-stacked-item"));
  assert.deepEqual(
    Check.asNode(node("legacy-node-section-education-item-root"), 'container').childIds,
    [
      "legacy-node-section-education-item-period",
      "legacy-node-section-education-item-title",
      "legacy-node-section-education-period-label",
      "legacy-node-section-education-links",
      "legacy-node-section-education-body",
    ].map((id) => canonicalId(document, "node", id)),
  );
  assert.deepEqual(
    Check.asNode(node("legacy-node-section-education-item-title"), 'container').childIds,
    [
      "legacy-node-section-education-organization",
      "legacy-node-section-education-title-separator",
      "legacy-node-section-education-title",
    ].map((id) => canonicalId(document, "node", id)),
  );
  assert.equal(Check.present(node("legacy-node-section-education-period-label"), 'fixture node').visible, false);
  assert.equal(Check.present(node("legacy-node-section-education-links"), 'fixture node').visible, false);
  assert.equal(Check.present(node("legacy-node-section-education-body"), 'fixture node').visible, false);
  assert.equal(Check.present(node("legacy-node-section-a-links"), 'fixture node').type, "rich-text");
  assert.deepEqual(
    Check.present(Check.present(Check.asNode(node("legacy-node-section-a-links"), 'rich-text').value.runs[0], 'fixture value').marks, 'fixture value').map((mark) => mark.type),
    ["underline", "link"],
  );

  const repeaters = Object.values(document.nodes).filter((node) => node.type === "repeater");
  assert.equal(repeaters.length, 3);
  assert.equal(Check.present(Check.present(repeaters[0], 'fixture value').items[0], 'fixture value').visible, false);
  assert.equal(Check.present(Check.present(repeaters[0], 'fixture value').items[0], 'fixture value').props["period-start"], "2024-01");
  assert.equal(Check.present(Check.present(repeaters[0], 'fixture value').items[0], 'fixture value').props["period-end"], "2025-01");
  assert.equal(Check.present(Check.present(repeaters[0], 'fixture value').items[0], 'fixture value').props["period-label"], "One year");
  assert.equal(Check.present(Check.present(repeaters[0], 'fixture value').items[0], 'fixture value').props.organization, "Organization value");
  assert.deepEqual(
    Check.present(Check.present(Check.field(Check.present(Check.present(Check.present(repeaters[0], 'fixture value').items[0], 'fixture value').props.title, 'fixture value'), 'runs').runs[0], 'fixture object').marks, 'fixture value').map((mark) => mark.type),
    ["bold", "underline", "link"],
  );
  assert.match(Check.string(Check.present(Check.present(repeaters[0], 'fixture value').items[0], 'fixture value').props.links), /Website|Detail/);
  assert.equal(Check.present(Check.present(repeaters[1], 'fixture value').items[0], 'fixture value').props.organization, "Program value");
  assert.equal(Check.present(Check.field(Check.present(Check.present(Check.present(repeaters[1], 'fixture value').items[0], 'fixture value').props.title, 'fixture value'), 'runs').runs[0], 'fixture value').text, "Course value");
  assert.match(Check.string(Check.present(Check.present(repeaters[2], 'fixture value').items[0], 'fixture value').props.tags), /Tool A/);
  assert.equal(Check.present(Check.present(repeaters[2], 'fixture value').items[0], 'fixture value').props.body, "Group body");

  const markdownSources = Object.values(document.nodes)
    .filter((node) => node.type === "markdown")
    .map((node) => node.source);
  assert.equal(markdownSources.includes("First **paragraph**."), true);
  assert.equal(markdownSources.includes("Last paragraph."), true);
});

await test("v1 서술 블록을 먼저 Markdown으로 보존한 뒤 범용 문서로 변환한다", () => {
  const source = {
    schemaVersion: 1 as const,
    documentId: "source-v1",
    name: "Old document",
    styleSheetId: "reference-resume-v1",
    pagination: { mode: "multi-page" as const },
    updatedAt: "2026-10-01T00:00:00.000Z",
    sections: [
      {
        id: "intro-v1",
        type: "introduction" as const,
        title: "Opening",
        visible: true,
        paragraphs: [
          { id: "p-1", content: text("First") },
          { id: "p-2", content: text("Second", ["strong"]) },
        ],
      },
      {
        id: "free-v1",
        type: "free-text" as const,
        title: "Notes",
        visible: true,
        blocks: [{
          id: "list-v1",
          type: "bullet-list" as const,
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

await test("지원하지 않는 이미지나 입력 형식은 위치를 포함한 오류로 중단하고 원본을 바꾸지 않는다", () => {
  const source = legacyV2Document();
  Check.present(Check.present(source.sections, 'fixture value')[0], 'fixture value').photoDataUrl = "https://example.com/image.png";
  const snapshot = structuredClone(source);

  assert.throws(
    () => importLegacyDocument(source),
    (error) => error instanceof LegacyDocumentImportError &&
      error.path === "$.sections.0.photoDataUrl",
  );
  assert.deepEqual(source, snapshot);
  assert.throws(
    () => importLegacyDocument({ schemaVersion: 99 as const }),
    (error) => error instanceof LegacyDocumentImportError && error.path === "$",
  );
});

await test("기존 legacy 범용 graph는 내용과 prop을 보존하며 새 시각 구조로 연다", () => {
  const fresh = importLegacyDocumentWithLegacyIds(legacyV2Document());
  const current = downgradeVisualGraph(fresh);
  current.nodes["legacy-node-section-a-links"] = {
    id: "legacy-node-section-a-links",
    type: "markdown" as const,
    name: "Links",
    visible: true,
    source: "- [Website](<https://example.com/a>)",
  };
  const body = Object.values(current.nodes).find((node) => node.type === "markdown" && node.name === "Body");
  Check.asNode(body, 'markdown').source = "사용자가 수정한 본문";
  const repeater = Object.values(current.nodes).find((node) => node.type === "repeater" && node.items.length);
  Check.present(Check.asNode(repeater, 'repeater').items[0], 'fixture value').props.body = "사용자가 수정한 prop";
  const snapshot = structuredClone(current);

  const upgraded = upgradeLegacyImportedDocument(current, fresh);

  assert.deepEqual(current, snapshot);
  assert.equal(validateDocumentDataForMigration(upgraded).valid, true);
  assert.equal(Object.keys(upgraded.styles).length > 4, true);
  assert.equal(Check.present(Check.present(upgraded.styles["legacy-style-root"], 'fixture value').layout, 'fixture value').paddingPt, undefined);
  assert.equal(Check.asNode(upgraded.nodes[Check.present(body, 'fixture node').id], 'markdown').source, "사용자가 수정한 본문");
  assert.equal(Check.present(Check.asNode(upgraded.nodes[Check.present(repeater, 'fixture node').id], 'repeater').items[0], 'fixture value').props.body, "사용자가 수정한 prop");
  assert.equal(Check.present(upgraded.nodes["legacy-node-section-a-links"], 'fixture node').type, "rich-text");
  assert.equal(Check.present(Check.asNode(upgraded.nodes["legacy-node-section-a-links"], 'rich-text').value.runs[0], 'fixture value').text, "Website");
  assert.deepEqual(
    Check.present(Check.present(Check.asNode(upgraded.nodes["legacy-node-section-a-links"], 'rich-text').value.runs[0], 'fixture value').marks, 'fixture value').map((mark) => mark.type),
    ["underline", "link"],
  );
  assert.equal(Object.values(upgraded.nodes).some((node) => node.name === "Identity"), true);
  assert.equal(Object.values(upgraded.nodes).some((node) => node.name === "Meta"), true);
  assert.equal(Object.values(upgraded.nodes).some((node) => node.name === "Content"), true);
  assert.deepEqual(
    Check.asNode(upgraded.nodes["legacy-node-section-c-heading-row"], 'container').childIds,
    ["legacy-node-section-c-heading", "legacy-node-section-c-annotation"],
  );
});

await test("과거 변환기가 만든 23-style graph도 내용 보존 후 최신 시각 구조로 연다", () => {
  const fresh = importLegacyDocumentWithLegacyIds(legacyV2Document());
  const current = generatedVisualV1Graph(fresh);
  const repeater = current.nodes["legacy-node-section-c-items"];
  Check.present(Check.asNode(repeater, 'repeater').items[0], 'fixture value').props.body = "사용자가 수정한 경력 본문";

  assert.equal(validateDocumentDataForMigration(current).valid, true);

  const upgraded = upgradeLegacyImportedDocument(current, fresh);

  assert.equal(validateDocumentDataForMigration(upgraded).valid, true);
  assert.equal(Check.present(upgraded.nodes["legacy-node-section-c-2"], 'fixture node').styleId, "legacy-style-roomy-boundary");
  assert.deepEqual(
    Check.asNode(upgraded.nodes["legacy-node-section-c-2"], 'container').childIds,
    ["legacy-node-section-c-heading-row", "legacy-node-section-c-items"],
  );
  assert.deepEqual(
    Check.asNode(upgraded.nodes["legacy-node-section-c-item-root"], 'container').childIds,
    ["legacy-node-section-c-item-meta", "legacy-node-section-c-item-content"],
  );
  assert.equal(Check.present(Check.asNode(upgraded.nodes["legacy-node-section-c-items"], 'repeater').items[0], 'fixture value').props.body, "사용자가 수정한 경력 본문");
  assert.equal(
    Check.present(upgraded.nodes["legacy-node-section-education-3"], 'fixture node').styleId,
    "legacy-style-stacked-boundary",
  );
  assert.deepEqual(
    Check.asNode(upgraded.nodes["legacy-node-section-education-item-root"], 'container').childIds,
    [
      "legacy-node-section-education-item-period",
      "legacy-node-section-education-item-title",
      "legacy-node-section-education-period-label",
      "legacy-node-section-education-links",
      "legacy-node-section-education-body",
    ],
  );
  assert.deepEqual(
    Check.asNode(upgraded.nodes["legacy-node-section-education-item-title"], 'container').childIds,
    [
      "legacy-node-section-education-organization",
      "legacy-node-section-education-title-separator",
      "legacy-node-section-education-title",
    ],
  );
  assert.equal(Check.present(upgraded.nodes["legacy-node-section-education-body"], 'fixture node').visible, false);
});

await test("기존 기본 style이 수정된 legacy graph는 자동 시각 업그레이드로 덮어쓰지 않는다", () => {
  const fresh = importLegacyDocumentWithLegacyIds(legacyV2Document());
  const current = downgradeVisualGraph(fresh);
  Check.present(Check.present(current.styles["legacy-style-root"], 'fixture value').layout, 'fixture value').gapPt = 99;

  assert.equal(upgradeLegacyImportedDocument(current, fresh), current);
});

await test("사용자가 설명을 추가한 profile 링크 Markdown은 rich-text로 자동 치환하지 않는다", () => {
  const fresh = importLegacyDocumentWithLegacyIds(legacyV2Document());
  const current = downgradeVisualGraph(fresh);
  current.nodes["legacy-node-section-a-links"] = {
    id: "legacy-node-section-a-links",
    type: "markdown" as const,
    name: "Links",
    visible: true,
    source: "내 링크\n\n- [Website](<https://example.com/a>)",
  };

  const upgraded = upgradeLegacyImportedDocument(current, fresh);

  assert.equal(validateDocumentDataForMigration(upgraded).valid, true);
  assert.equal(Check.present(upgraded.nodes["legacy-node-section-a-links"], 'fixture node').type, "markdown");
  assert.equal(Check.asNode(upgraded.nodes["legacy-node-section-a-links"], 'markdown').source, current.nodes["legacy-node-section-a-links"].source);
});

function downgradeVisualGraph(fresh: Types.DocumentData) {
  const current = structuredClone(fresh);
  const wrapper = (id: string) => /-(?:identity|contacts|(?:phone|email|links)-row|heading-row|item-meta|item-content|item-period|item-title)$/.test(id);
  const flatten = (childIds: string[]): string[] => childIds.flatMap((id: string) => {
    const node = current.nodes[id];
    if (!node) return [];
    if (wrapper(id) && node.type === "container") return flatten(node.childIds);
    if (/-(?:period|title)-separator$/.test(id)) return [];
    return [id];
  });
  Object.values(current.nodes).forEach((node) => {
    if (node.type === "container") node.childIds = flatten(node.childIds);
  });
  Object.values(current.components).forEach((component) => {
    const root = current.nodes[component.rootNodeId];
    if (root?.type === "container") {
      Check.asNode(root, 'container').childIds = component.propDefinitions.map((prop) => prop.binding.nodeId);
    }
  });
  Object.keys(current.nodes).forEach((id) => {
    if (wrapper(id) || /-(?:period|title)-separator$/.test(id)) delete current.nodes[id];
  });

  const rootChildren = new Set(Check.asNode(current.nodes[current.rootNodeId], 'container').childIds);
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
      layout: { direction: "column", gapPt: 10, paddingPt: [24, 28, 24, 28], align: "stretch", width: { mode: "fill" as const } },
      typography: { fontFamily: "Pretendard", fontSizePt: 7.5, lineHeight: 1.5, fontWeight: 400, color: { kind: "hex" as const, value: "#000000" } },
    },
    "legacy-style-section": {
      id: "legacy-style-section",
      name: "Section",
      layout: { direction: "column", gapPt: 5.5, align: "stretch", width: { mode: "fill" as const } },
    },
    "legacy-style-item": {
      id: "legacy-style-item",
      name: "Item",
      layout: { direction: "column", gapPt: 3, align: "stretch", width: { mode: "fill" as const } },
      pagination: { keepTogether: true },
    },
    "legacy-style-heading": {
      id: "legacy-style-heading",
      name: "Heading",
      typography: { fontSizePt: 11.25, lineHeight: 1.25, fontWeight: 600, color: { kind: "hex" as const, value: "#000000" } },
      pagination: { keepWithNext: true },
    },
  };
  assert.equal(validateDocumentDataForMigration(current).valid, true);
  return current;
}

function canonicalId(document: Types.DocumentData, kind: Parameters<typeof createDeterministicEntityId>[0], legacyId: string) {
  return createDeterministicEntityId(kind, `document:${document.documentId}`, legacyId);
}

function canonicalInternalIds(document: Types.DocumentData) {
  const ids = [
    ...Object.keys(document.nodes),
    ...Object.keys(document.components),
    ...Object.keys(document.styles),
    ...Object.keys(document.assets),
    ...Object.values(document.nodes).flatMap((node) => node.type === "repeater" ? node.items.map((item) => item.id) : []),
  ];
  return ids.every((id) => !id.startsWith("legacy-"));
}

function generatedVisualV1Graph(fresh: Types.DocumentData) {
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
  current.styles = Object.fromEntries(retainedStyleIds.map((id) => [id, structuredClone(Check.present(fresh.styles[id], `style ${id}`))]));
  const compact = Check.present(Check.present(current.styles["legacy-style-root"], 'fixture value').typography, 'fixture value').fontSizePt === 7.5;
  Check.present(Check.present(current.styles["legacy-style-root"], 'fixture value').layout, 'fixture value').gapPt = compact ? 10 : 13;
  Check.present(Check.present(current.styles["legacy-style-section"], 'fixture value').layout, 'fixture value').gapPt = compact ? 9 : 12;
  delete Check.present(current.styles["legacy-style-section"], 'fixture value').pagination;
  Check.present(current.styles["legacy-style-heading-row"], 'fixture value').pagination = { keepWithNext: true };
  delete Check.present(current.styles["legacy-style-lead"], 'fixture value').layout;
  Check.present(Check.present(Check.present(current.styles["legacy-style-header-row"], 'fixture value').layout, 'fixture value').paddingPt, 'fixture value')[2] = compact ? 13 : 16;
  Check.present(Check.present(current.styles["legacy-style-aside"], 'fixture value').layout, 'fixture value').gapPt = 8;

  const fallbackStyleIds: Record<string, string> = {
    "legacy-style-roomy-boundary": "legacy-style-section-boundary",
    "legacy-style-stacked-boundary": "legacy-style-section-boundary",
    "legacy-style-roomy-heading-row": "legacy-style-heading-row",
    "legacy-style-stacked-heading-row": "legacy-style-heading-row",
    "legacy-style-connected-list": "legacy-style-list",
    "legacy-style-spaced-list": "legacy-style-list",
    "legacy-style-split-item": "legacy-style-item",
    "legacy-style-stacked-item": "legacy-style-item",
    "legacy-style-period": "legacy-style-contact-row",
    "legacy-style-inline-period": "legacy-style-contact-row",
    "legacy-style-inline-title": "legacy-style-compact-text",
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
  Check.asNode(section, 'container').childIds = [...Check.asNode(headingRow, 'container').childIds, "legacy-node-section-c-items"];
  delete current.nodes[Check.present(headingRow, 'fixture node').id];

  const component = current.components["legacy-component-section-c"];
  const itemRoot = current.nodes[Check.present(component, 'fixture value').rootNodeId];
  Check.asNode(itemRoot, 'container').childIds = Check.present(component, 'fixture value').propDefinitions.map((prop) => prop.binding.nodeId);
  [
    "legacy-node-section-c-item-meta",
    "legacy-node-section-c-item-content",
    "legacy-node-section-c-item-period",
    "legacy-node-section-c-period-separator",
  ].forEach((id) => delete current.nodes[id]);

  const stackedComponent = current.components["legacy-component-section-education"];
  const stackedRoot = current.nodes[Check.present(stackedComponent, 'fixture value').rootNodeId];
  const stackedPeriod = current.nodes["legacy-node-section-education-item-period"];
  const metaId = "legacy-node-section-education-item-meta";
  const contentId = "legacy-node-section-education-item-content";
  current.nodes[metaId] = {
    id: metaId,
    type: "container" as const,
    name: "Meta",
    visible: true,
    styleId: "legacy-style-meta",
    childIds: [
      Check.present(stackedPeriod, 'fixture node').id,
      "legacy-node-section-education-period-label",
      "legacy-node-section-education-links",
    ],
  };
  current.nodes[contentId] = {
    id: contentId,
    type: "container" as const,
    name: "Content",
    visible: true,
    styleId: "legacy-style-content",
    childIds: [
      "legacy-node-section-education-organization",
      "legacy-node-section-education-title",
      "legacy-node-section-education-body",
    ],
  };
  Check.asNode(stackedRoot, 'container').childIds = [metaId, contentId];
  Check.present(current.nodes["legacy-node-section-education-period-label"], 'fixture node').visible = true;
  Check.present(current.nodes["legacy-node-section-education-links"], 'fixture node').visible = true;
  Check.present(current.nodes["legacy-node-section-education-body"], 'fixture node').visible = true;
  delete current.nodes["legacy-node-section-education-item-title"];
  delete current.nodes["legacy-node-section-education-title-separator"];
  return current;
}
