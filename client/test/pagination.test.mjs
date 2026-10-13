import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPaginationUnits,
  paginate,
  reconcileVisiblePages,
} from "../src/renderer/src/pages/document-editor/rendering/pagination.ts";

test("Markdown 도입과 문제·해결 block을 페이지 경계에서 연속 묶음으로 유지한다", () => {
  const units = collectPaginationUnits({
    type: "markdown",
    renderId: "markdown",
    nodeId: "markdown-node",
    visible: true,
    source: `서비스 소개입니다.

담당 범위입니다.

### 응답 시간 개선

> 기존에는 응답이 느렸습니다.

- 캐시를 적용했습니다.

마무리 문단입니다.`,
  });

  assert.deepEqual(units.map((unit) => unit.keepWithNext), [true, true, true, true, undefined, undefined]);
});

test("keepWithNext 묶음은 남은 공간이 부족하면 함께 다음 페이지로 이동한다", () => {
  const units = [
    { id: "intro" },
    { id: "heading", keepWithNext: true },
    { id: "body" },
  ];
  const pages = paginate(units, new Map([
    ["intro", 50],
    ["heading", 30],
    ["body", 40],
  ]), 100);

  assert.deepEqual(pages.map((page) => page.units.map((unit) => unit.id)), [
    ["intro"],
    ["heading", "body"],
  ]);
  assert.equal(pages.some((page) => page.overflow), false);
});

test("강제 새 페이지와 단일 unit overflow를 표시한다", () => {
  const units = [
    { id: "first" },
    { id: "forced", forcePageBreakBefore: true },
    { id: "oversized" },
  ];
  const pages = paginate(units, new Map([
    ["first", 20],
    ["forced", 20],
    ["oversized", 120],
  ]), 100);

  assert.deepEqual(pages.map((page) => page.units.map((unit) => unit.id)), [
    ["first"],
    ["forced"],
    ["oversized"],
  ]);
  assert.equal(pages[2].overflow, true);
});

test("측정 전 임시 페이지는 기존 페이지 시작 unit을 기준으로 유지한다", () => {
  const visible = reconcileVisiblePages([
    { id: "page-1", units: [{ id: "a" }, { id: "b" }], overflow: false },
    { id: "page-2", units: [{ id: "c" }], overflow: true },
  ], [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);

  assert.deepEqual(visible.map((page) => page.units.map((unit) => unit.id)), [
    ["a", "b"],
    ["c", "d"],
  ]);
  assert.equal(visible[1].overflow, true);
});
