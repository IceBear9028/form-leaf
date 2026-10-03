import type { TextContent, TextMark, TextRun } from "../../../shared/resume";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function textContentToHtml(content: TextContent): string {
  return content.runs
    .map((run) => {
      let value = escapeHtml(run.text).replaceAll("\n", "<br>");
      if (run.marks?.includes("strong")) value = `<strong>${value}</strong>`;
      if (run.marks?.includes("underline")) value = `<u>${value}</u>`;
      if (run.marks?.includes("link") && run.href) {
        value = `<a href="${escapeHtml(run.href)}">${value}</a>`;
      }
      return value;
    })
    .join("");
}

function marksForNode(node: Node, inherited: TextMark[]): TextMark[] {
  if (!(node instanceof HTMLElement)) return inherited;
  const marks = [...inherited];
  const tag = node.tagName.toLowerCase();
  if ((tag === "strong" || tag === "b") && !marks.includes("strong")) {
    marks.push("strong");
  }
  if (tag === "u" && !marks.includes("underline")) marks.push("underline");
  if (tag === "a" && !marks.includes("link")) marks.push("link");
  return marks;
}

function appendRuns(node: Node, inherited: TextMark[], runs: TextRun[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return;
    const parentLink = node.parentElement?.closest("a");
    runs.push({
      text,
      marks: inherited.length ? inherited : undefined,
      href: inherited.includes("link") ? parentLink?.getAttribute("href") ?? undefined : undefined,
    });
    return;
  }

  if (node instanceof HTMLBRElement) {
    runs.push({ text: "\n", marks: inherited.length ? inherited : undefined });
    return;
  }

  const marks = marksForNode(node, inherited);
  node.childNodes.forEach((child) => appendRuns(child, marks, runs));
  if (node instanceof HTMLDivElement && node.nextSibling) {
    runs.push({ text: "\n", marks: marks.length ? marks : undefined });
  }
}

export function htmlElementToTextContent(element: HTMLElement): TextContent {
  const runs: TextRun[] = [];
  element.childNodes.forEach((node) => appendRuns(node, [], runs));
  return { runs: runs.length ? mergeRuns(runs) : [{ text: "" }] };
}

function mergeRuns(runs: TextRun[]): TextRun[] {
  return runs.reduce<TextRun[]>((result, run) => {
    const previous = result.at(-1);
    const previousMarks = previous?.marks?.join(",") ?? "";
    const nextMarks = run.marks?.join(",") ?? "";
    if (previous && previousMarks === nextMarks && previous.href === run.href) {
      previous.text += run.text;
    } else {
      result.push({ ...run });
    }
    return result;
  }, []);
}
