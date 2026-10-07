import test from "node:test";
import assert from "node:assert/strict";
import {
  getResumeStyleSheet,
  listResumeStyleSheets,
} from "../src/renderer/src/pages/document-editor/style/registry.ts";

test("스타일 프리셋은 같은 문법 계약을 서로 다른 CSS 변수로 제공한다", () => {
  const styles = listResumeStyleSheets();
  const reference = getResumeStyleSheet("reference-resume-v1");
  const compact = getResumeStyleSheet("reference-resume-compact-v1");

  assert.deepEqual(styles.map((style) => style.id), [
    "reference-resume-v1",
    "reference-resume-compact-v1",
  ]);
  assert.equal(reference.variables["--markdown-h1-size"], "16pt");
  assert.equal(compact.variables["--markdown-h1-size"], "15pt");
  assert.equal(reference.variables["--markdown-h3-weight"], "600");
  assert.equal(reference.variables["--markdown-text"], "#000000");
  assert.equal(reference.variables["--markdown-h6-color"], "#000000");
  assert.equal(reference.variables["--resume-project-title-size"], "13pt");
  assert.equal(reference.variables["--markdown-project-h1-size"], "12pt");
  assert.equal(reference.variables["--markdown-project-h3-size"], "9pt");
  assert.equal(compact.variables["--resume-project-title-size"], "12pt");
  assert.equal(compact.variables["--markdown-project-h3-size"], "8.5pt");
  assert.equal(reference.variables["--markdown-accent"], "#0969da");
  assert.equal("--markdown-marker-default" in reference.variables, false);
  assert.equal("markerDefault" in reference.markdown.list, false);
  assert.notEqual(reference.variables["--markdown-block-gap"], compact.variables["--markdown-block-gap"]);
});

test("등록되지 않은 스타일은 문서 데이터를 바꾸지 않고 기본 스타일로 표시한다", () => {
  assert.equal(getResumeStyleSheet("future-style").id, "reference-resume-v1");
});
