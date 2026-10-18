export type MarkdownSourceRange = {
  start: number;
  end: number;
};

export type MarkdownEditResult = {
  source: string;
  selection: MarkdownSourceRange;
};

export type MarkdownInlineFormat =
  | "strong"
  | "emphasis"
  | "underline"
  | "delete"
  | "inline-code";

const formatMarkers: Record<MarkdownInlineFormat, string> = {
  strong: "**",
  emphasis: "*",
  underline: "++",
  delete: "~~",
  "inline-code": "`",
};

export type MarkdownInputMode = "typing" | "paste";

export type MarkdownCommand =
  | { type: "inline-format"; format: MarkdownInlineFormat }
  | { type: "link"; href?: string }
  | { type: "blockquote" }
  | { type: "list"; style: "unordered" | "ordered" | "task" }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: "paragraph" }
  | { type: "code-block" }
  | { type: "divider" }
  | { type: "clear-formatting" };

export type MarkdownQuickInsertTrigger = {
  range: MarkdownSourceRange;
  query: string;
};

export function replaceMarkdownRange(
  source: string,
  range: MarkdownSourceRange,
  replacement: string,
  selectionInReplacement: MarkdownSourceRange = {
    start: replacement.length,
    end: replacement.length,
  },
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  return {
    source: source.slice(0, normalized.start) + replacement + source.slice(normalized.end),
    selection: {
      start: normalized.start + selectionInReplacement.start,
      end: normalized.start + selectionInReplacement.end,
    },
  };
}

export function replaceMarkdownText(
  source: string,
  range: MarkdownSourceRange,
  visibleText: string,
  visibleSelection: MarkdownSourceRange,
): MarkdownEditResult {
  const escaped = escapeMarkdownLiteralWithMap(visibleText);
  const selection = normalizeRange(visibleText, visibleSelection);
  return replaceMarkdownRange(source, range, escaped.value, {
    start: escaped.boundaries[selection.start] ?? escaped.value.length,
    end: escaped.boundaries[selection.end] ?? escaped.value.length,
  });
}

export function replaceMarkdownTextWithBlockShortcut(
  source: string,
  range: MarkdownSourceRange,
  visibleText: string,
  visibleSelection: MarkdownSourceRange,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  const shortcut = normalized.start === normalized.end && visibleText === " "
    ? markdownBlockShortcutBefore(source, normalized.start)
    : undefined;
  if (!shortcut) {
    return replaceMarkdownText(source, normalized, visibleText, visibleSelection);
  }
  const replacement = `${shortcut.marker} `;
  return replaceMarkdownRange(
    source,
    { start: shortcut.start, end: normalized.end },
    replacement,
  );
}

export function replaceMarkdownTextWithInputRules(
  source: string,
  range: MarkdownSourceRange,
  visibleText: string,
  visibleSelection: MarkdownSourceRange,
  mode: MarkdownInputMode,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  if (mode === "typing" && normalized.start === normalized.end) {
    const block = completeStandaloneBlockInput(source, normalized.start, visibleText);
    if (block) return block;
    const inline = completeInlineMarkdownInput(source, normalized.start, visibleText);
    if (inline) return inline;
    return replaceMarkdownTextWithBlockShortcut(
      source,
      normalized,
      visibleText,
      visibleSelection,
    );
  }
  return replaceMarkdownText(source, normalized, visibleText, visibleSelection);
}

export function insertMarkdownTextWithFormats(
  source: string,
  range: MarkdownSourceRange,
  visibleText: string,
  formats: readonly MarkdownInlineFormat[],
): MarkdownEditResult {
  const escaped = escapeMarkdownLiteralWithMap(visibleText);
  const markers = formats.map((format) => formatMarkers[format]);
  const opening = markers.join("");
  const closing = [...markers].reverse().join("");
  return replaceMarkdownRange(source, range, `${opening}${escaped.value}${closing}`, {
    start: opening.length + escaped.value.length,
    end: opening.length + escaped.value.length,
  });
}

export function applyMarkdownCommand(
  source: string,
  range: MarkdownSourceRange,
  command: MarkdownCommand,
): MarkdownEditResult {
  if (command.type === "inline-format") {
    return toggleMarkdownInlineFormat(source, range, command.format);
  }
  if (command.type === "link") return toggleMarkdownLink(source, range, command.href);
  if (command.type === "blockquote") return toggleMarkdownBlockquote(source, range);
  if (command.type === "list") return toggleMarkdownList(source, range, command.style);
  if (command.type === "heading") return setMarkdownLinePrefix(source, range, `${"#".repeat(command.level)} `);
  if (command.type === "paragraph") return setMarkdownLinePrefix(source, range, "");
  if (command.type === "clear-formatting") return clearMarkdownFormatting(source, range);
  if (command.type === "divider") {
    return replaceMarkdownRange(source, range, "---\n\n");
  }
  const normalized = normalizeRange(source, range);
  const selected = source.slice(normalized.start, normalized.end);
  const replacement = `\`\`\`\n${selected}\n\`\`\``;
  return replaceMarkdownRange(source, normalized, replacement, {
    start: 4,
    end: 4 + selected.length,
  });
}

export function clearMarkdownFormatting(
  source: string,
  range: MarkdownSourceRange,
): MarkdownEditResult {
  let result: MarkdownEditResult = { source, selection: normalizeRange(source, range) };
  result = toggleMarkdownLink(result.source, result.selection);
  for (const format of ["strong", "emphasis", "underline", "delete", "inline-code"] as const) {
    const marker = formatMarkers[format];
    const before = result.source.slice(result.selection.start - marker.length, result.selection.start);
    const after = result.source.slice(result.selection.end, result.selection.end + marker.length);
    if (before === marker && after === marker) {
      result = toggleMarkdownInlineFormat(result.source, result.selection, format);
    }
  }
  return setMarkdownLinePrefix(result.source, result.selection, "");
}

export function findMarkdownQuickInsertTrigger(
  source: string,
  range: MarkdownSourceRange,
): MarkdownQuickInsertTrigger | undefined {
  const normalized = normalizeRange(source, range);
  if (normalized.start !== normalized.end) return undefined;
  const lineStart = source.lastIndexOf("\n", Math.max(0, normalized.start - 1)) + 1;
  const prefix = source.slice(lineStart, normalized.start);
  const match = prefix.match(/^\/([^\s/]*)$/u);
  if (!match) return undefined;
  return {
    range: { start: lineStart, end: normalized.start },
    query: match[1].toLocaleLowerCase(),
  };
}

export function markdownEmptyListItemCaretOffset(
  source: string,
  itemStart: number,
  fallback: number,
): number {
  const lineEnd = source.indexOf("\n", itemStart);
  const line = source.slice(itemStart, lineEnd < 0 ? source.length : lineEnd);
  const prefix = line.match(/^[ \t]*(?:(?:[-+*])[ \t]+(?:\[[ xX]\][ \t]+)?|[0-9]{1,9}[.)][ \t]+)/)?.[0];
  return prefix ? itemStart + prefix.length : fallback;
}

export function setMarkdownTaskItemChecked(
  source: string,
  itemStart: number,
  checked: boolean,
): MarkdownEditResult {
  const normalizedStart = Math.max(0, Math.min(source.length, itemStart));
  const lineEnd = source.indexOf("\n", normalizedStart);
  const end = lineEnd < 0 ? source.length : lineEnd;
  const line = source.slice(normalizedStart, end);
  const match = line.match(/^[ \t]*[-+*][ \t]+\[([ xX])\]/);
  if (!match || match.index === undefined) {
    return { source, selection: { start: normalizedStart, end: normalizedStart } };
  }
  const checkboxOffset = normalizedStart + match[0].lastIndexOf(match[1]);
  return replaceMarkdownRange(
    source,
    { start: checkboxOffset, end: checkboxOffset + 1 },
    checked ? "x" : " ",
    { start: 0, end: 0 },
  );
}

export function applyMarkdownQuickInsertCommand(
  source: string,
  trigger: MarkdownQuickInsertTrigger,
  command: MarkdownCommand,
): MarkdownEditResult {
  const cleared = replaceMarkdownRange(source, trigger.range, "");
  return applyMarkdownCommand(cleared.source, cleared.selection, command);
}

function completeStandaloneBlockInput(
  source: string,
  caret: number,
  visibleText: string,
): MarkdownEditResult | undefined {
  const lineStart = source.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const before = source.slice(lineStart, caret);
  if ((visibleText === "-" && before === "\\-\\-") ||
      (visibleText === "*" && before === "\\*\\*")) {
    const marker = visibleText.repeat(3);
    return replaceMarkdownRange(
      source,
      { start: lineStart, end: caret },
      `${marker}\n\n`,
    );
  }
  if (visibleText === "`" && before === "\\`\\`") {
    return replaceMarkdownRange(
      source,
      { start: lineStart, end: caret },
      "```\n\n```",
      { start: 4, end: 4 },
    );
  }
  return undefined;
}

export function insertMarkdownParagraphBreak(
  source: string,
  range: MarkdownSourceRange,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  if (normalized.start !== normalized.end) {
    return replaceMarkdownRange(source, normalized, "\n\n");
  }
  const caret = normalized.start;
  const line = markdownLineAt(source, caret);
  const context = markdownLinePrefix(line.text);
  if (!context || caret < line.start + context.contentStart) {
    let start = caret;
    let end = caret;
    while (start > 0 && /[ \t]/.test(source[start - 1] ?? "")) start -= 1;
    while (end < source.length && /[ \t]/.test(source[end] ?? "")) end += 1;
    return replaceMarkdownRange(source, { start, end }, "\n\n");
  }

  const content = line.text.slice(context.contentStart);
  if (!content.trim()) {
    if (context.indent.length > 0) {
      const parentIndent = previousListIndentBelow(source, line.start, context.indent.length);
      return outdentMarkdownLine(
        source,
        caret,
        line,
        context.indent,
        context.indent.length - parentIndent,
      );
    }
    const replacement = line.end === source.length && line.start > 0 ? "\n" : "";
    return replaceMarkdownRange(
      source,
      { start: line.start, end: line.start + context.contentStart },
      replacement,
    );
  }

  const continuation = context.kind === "ordered"
    ? `${context.indent}${Number(context.number) + 1}${context.delimiter} `
    : context.kind === "task"
      ? `${context.indent}${context.marker} [ ] `
      : `${context.indent}${context.marker} `;
  return replaceMarkdownRange(source, { start: caret, end: caret }, `\n${continuation}`);
}

export function deleteMarkdownBackwardAtBlockStart(
  source: string,
  range: MarkdownSourceRange,
): MarkdownEditResult | undefined {
  const normalized = normalizeRange(source, range);
  if (normalized.start !== normalized.end) return undefined;
  const line = markdownLineAt(source, normalized.start);
  const context = markdownLinePrefix(line.text, true);
  if (!context || normalized.start !== line.start + context.contentStart) return undefined;
  if (context.indent.length > 0) {
    const parentIndent = previousListIndentBelow(source, line.start, context.indent.length);
    return outdentMarkdownLine(
      source,
      normalized.start,
      line,
      context.indent,
      context.indent.length - parentIndent,
    );
  }
  return replaceMarkdownRange(
    source,
    { start: line.start, end: line.start + context.contentStart },
    "",
  );
}

export function indentMarkdownListItem(
  source: string,
  range: MarkdownSourceRange,
  direction: "indent" | "outdent",
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  const line = markdownLineAt(source, normalized.start);
  const context = markdownLinePrefix(line.text);
  if (!context || context.kind === "blockquote") return { source, selection: normalized };

  if (direction === "outdent") {
    if (!context.indent.length) return { source, selection: normalized };
    const parentIndent = previousListIndentBelow(
      source,
      line.start,
      context.indent.length,
    );
    return outdentMarkdownLine(
      source,
      normalized.start,
      line,
      context.indent,
      context.indent.length - parentIndent,
    );
  }

  const previous = previousListItem(source, line.start);
  if (!previous || previous.context.indent.length > context.indent.length) {
    return { source, selection: normalized };
  }
  const targetIndent = previous.context.indent.length + markdownNestedListIndent(previous.context);
  const insertedIndent = " ".repeat(Math.max(0, targetIndent - context.indent.length));
  if (!insertedIndent) return { source, selection: normalized };
  return replaceMarkdownRange(
    source,
    { start: line.start, end: line.start },
    insertedIndent,
    {
      start: normalized.start - line.start + insertedIndent.length,
      end: normalized.end - line.start + insertedIndent.length,
    },
  );
}

export function toggleMarkdownInlineFormat(
  source: string,
  range: MarkdownSourceRange,
  format: MarkdownInlineFormat,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  if (normalized.start === normalized.end) return { source, selection: normalized };
  const marker = formatMarkers[format];
  const before = source.slice(normalized.start - marker.length, normalized.start);
  const after = source.slice(normalized.end, normalized.end + marker.length);

  if (before === marker && after === marker && isStandaloneMarker(source, normalized, marker)) {
    return {
      source:
        source.slice(0, normalized.start - marker.length) +
        source.slice(normalized.start, normalized.end) +
        source.slice(normalized.end + marker.length),
      selection: {
        start: normalized.start - marker.length,
        end: normalized.end - marker.length,
      },
    };
  }

  const selected = source.slice(normalized.start, normalized.end);
  return replaceMarkdownRange(source, normalized, `${marker}${selected}${marker}`, {
    start: marker.length,
    end: marker.length + selected.length,
  });
}

export function toggleMarkdownBlockquote(
  source: string,
  range: MarkdownSourceRange,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  const lineStart = source.lastIndexOf("\n", Math.max(0, normalized.start - 1)) + 1;
  const selectionEnd = normalized.end > normalized.start && source[normalized.end - 1] === "\n"
    ? normalized.end - 1
    : normalized.end;
  const nextBreak = source.indexOf("\n", selectionEnd);
  const lineEnd = nextBreak === -1 ? source.length : nextBreak;
  const lines = source.slice(lineStart, lineEnd).split("\n");
  const contentLines = lines.filter((line) => line.trim().length > 0);
  const remove = contentLines.length > 0 && contentLines.every((line) => /^\s*>\s?/.test(line));
  const replacement = lines.map((line) => {
    if (remove) return line.replace(/^(\s*)>\s?/, "$1");
    return line.length ? `> ${line}` : ">";
  }).join("\n");
  return replaceMarkdownRange(source, { start: lineStart, end: lineEnd }, replacement, {
    start: 0,
    end: replacement.length,
  });
}

export function toggleMarkdownList(
  source: string,
  range: MarkdownSourceRange,
  style: "unordered" | "ordered" | "task",
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  const line = markdownLineAt(source, normalized.start);
  const context = markdownLinePrefix(line.text);
  const targetKind = style === "task" ? "task" : style;
  const replacement = style === "ordered" ? "1. " : style === "task" ? "- [ ] " : "- ";

  if (context && context.kind !== "blockquote") {
    const prefixStart = line.start + context.indent.length;
    const prefixEnd = line.start + context.contentStart;
    const next = context.kind === targetKind ? "" : replacement;
    const delta = next.length - (prefixEnd - prefixStart);
    return replaceMarkdownRange(source, { start: prefixStart, end: prefixEnd }, next, {
      start: Math.max(0, normalized.start - prefixStart + delta),
      end: Math.max(0, normalized.end - prefixStart + delta),
    });
  }

  return replaceMarkdownRange(source, { start: line.start, end: line.start }, replacement, {
    start: normalized.start - line.start + replacement.length,
    end: normalized.end - line.start + replacement.length,
  });
}

function setMarkdownLinePrefix(
  source: string,
  range: MarkdownSourceRange,
  prefix: string,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  const line = markdownLineAt(source, normalized.start);
  const existing = markdownLinePrefix(line.text, true);
  const start = line.start + (existing?.indent.length ?? 0);
  const end = existing ? line.start + existing.contentStart : start;
  const currentPrefix = source.slice(start, end);
  const nextPrefix = currentPrefix === prefix ? "" : prefix;
  const delta = nextPrefix.length - currentPrefix.length;
  return replaceMarkdownRange(source, { start, end }, nextPrefix, {
    start: Math.max(0, normalized.start - start + delta),
    end: Math.max(0, normalized.end - start + delta),
  });
}

export function toggleMarkdownLink(
  source: string,
  range: MarkdownSourceRange,
  href?: string,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  if (normalized.start === normalized.end) {
    const canonicalHref = href ? canonicalMarkdownHref(href) : undefined;
    if (!canonicalHref) return { source, selection: normalized };
    const destination = escapeLinkDestination(canonicalHref);
    return replaceMarkdownRange(source, normalized, `[링크](${destination})`, {
      start: 1,
      end: 3,
    });
  }
  const selected = source.slice(normalized.start, normalized.end);
  const linkSuffixLength = findLinkSuffixLength(source, normalized.end);

  if (source[normalized.start - 1] === "[" && linkSuffixLength > 0) {
    const canonicalHref = href ? canonicalMarkdownHref(href) : undefined;
    if (canonicalHref) {
      const destination = escapeLinkDestination(canonicalHref);
      return replaceMarkdownRange(
        source,
        { start: normalized.start - 1, end: normalized.end + linkSuffixLength },
        `[${selected}](${destination})`,
        { start: 1, end: 1 + selected.length },
      );
    }
    return {
      source:
        source.slice(0, normalized.start - 1) +
        selected +
        source.slice(normalized.end + linkSuffixLength),
      selection: {
        start: normalized.start - 1,
        end: normalized.end - 1,
      },
    };
  }

  const canonicalHref = href ? canonicalMarkdownHref(href) : undefined;
  if (!canonicalHref) return { source, selection: normalized };
  const destination = escapeLinkDestination(canonicalHref);
  return replaceMarkdownRange(source, normalized, `[${selected}](${destination})`, {
    start: 1,
    end: 1 + selected.length,
  });
}

function escapeLinkDestination(value: string): string {
  return value.trim().replace(/[\\()]/g, "\\$&");
}

function markdownBlockShortcutBefore(
  source: string,
  caret: number,
): { start: number; marker: string } | undefined {
  const lineStart = source.lastIndexOf("\n", caret - 1) + 1;
  const prefix = source.slice(lineStart, caret);
  const heading = prefix.match(/^(?:\\#){1,6}$/)?.[0];
  if (heading) {
    return { start: lineStart, marker: heading.replaceAll("\\", "") };
  }
  if (prefix === "\\-") return { start: lineStart, marker: "-" };
  if (prefix === "\\*" || prefix === "\\+") {
    return { start: lineStart, marker: prefix.slice(1) };
  }
  if (prefix === "\\>") return { start: lineStart, marker: ">" };
  if (/^[0-9]{1,9}[.)]$/.test(prefix)) return { start: lineStart, marker: prefix };
  if (prefix === "\\[\\]" || prefix === "\\[ \\]") {
    return { start: lineStart, marker: "- [ ]" };
  }
  return undefined;
}

type MarkdownLine = {
  start: number;
  end: number;
  text: string;
};

type MarkdownLinePrefix = {
  kind: "unordered" | "ordered" | "task" | "blockquote" | "heading";
  indent: string;
  marker: string;
  contentStart: number;
  number?: string;
  delimiter?: string;
};

function markdownLineAt(source: string, caret: number): MarkdownLine {
  const start = source.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const nextBreak = source.indexOf("\n", caret);
  const end = nextBreak < 0 ? source.length : nextBreak;
  return { start, end, text: source.slice(start, end) };
}

function markdownLinePrefix(line: string, includeTextBlocks = false): MarkdownLinePrefix | undefined {
  const task = line.match(/^([ \t]*)([-+*])[ \t]+\[([ xX])\][ \t]+/);
  if (task) {
    return {
      kind: "task",
      indent: task[1],
      marker: task[2],
      contentStart: task[0].length,
    };
  }
  const unordered = line.match(/^([ \t]*)([-+*])[ \t]+/);
  if (unordered) {
    return {
      kind: "unordered",
      indent: unordered[1],
      marker: unordered[2],
      contentStart: unordered[0].length,
    };
  }
  const ordered = line.match(/^([ \t]*)([0-9]{1,9})([.)])[ \t]+/);
  if (ordered) {
    return {
      kind: "ordered",
      indent: ordered[1],
      marker: `${ordered[2]}${ordered[3]}`,
      number: ordered[2],
      delimiter: ordered[3],
      contentStart: ordered[0].length,
    };
  }
  const quote = line.match(/^([ \t]*)(>)[ \t]+/);
  if (quote) {
    return {
      kind: "blockquote",
      indent: quote[1],
      marker: quote[2],
      contentStart: quote[0].length,
    };
  }
  if (includeTextBlocks) {
    const heading = line.match(/^([ \t]*)(#{1,6})[ \t]+/);
    if (heading) {
      return {
        kind: "heading",
        indent: heading[1],
        marker: heading[2],
        contentStart: heading[0].length,
      };
    }
  }
  return undefined;
}

function outdentMarkdownLine(
  source: string,
  caret: number,
  line: MarkdownLine,
  indent: string,
  removalLength = indent.startsWith("\t") ? 1 : Math.min(2, indent.length),
): MarkdownEditResult {
  const removed = Math.max(1, Math.min(indent.length, removalLength));
  return replaceMarkdownRange(
    source,
    { start: line.start, end: line.start + removed },
    "",
    {
      start: Math.max(0, caret - line.start - removed),
      end: Math.max(0, caret - line.start - removed),
    },
  );
}

function previousListItem(
  source: string,
  lineStart: number,
): { context: MarkdownLinePrefix; start: number } | undefined {
  if (lineStart <= 0) return undefined;
  let previousEnd = lineStart - 1;
  while (previousEnd > 0 && source[previousEnd - 1] === "\n") previousEnd -= 1;
  const previousStart = source.lastIndexOf("\n", Math.max(0, previousEnd - 1)) + 1;
  const context = markdownLinePrefix(source.slice(previousStart, previousEnd));
  return context && context.kind !== "blockquote"
    ? { context, start: previousStart }
    : undefined;
}

function markdownNestedListIndent(context: MarkdownLinePrefix): number {
  return context.kind === "ordered"
    ? Math.max(4, context.marker.length + 1)
    : 4;
}

function previousListIndentBelow(
  source: string,
  lineStart: number,
  indentLength: number,
): number {
  let cursor = lineStart;
  while (cursor > 0) {
    const previous = previousListItem(source, cursor);
    if (!previous) break;
    const previousIndent = previous.context.indent.length;
    if (previousIndent < indentLength) return previousIndent;
    cursor = previous.start;
  }
  return 0;
}

function completeInlineMarkdownInput(
  source: string,
  caret: number,
  visibleText: string,
): MarkdownEditResult | undefined {
  if (visibleText.length !== 1) return undefined;
  const lineStart = source.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const before = source.slice(lineStart, caret);

  if (visibleText === ")") {
    const link = completeLinkInput(before);
    if (!link) return undefined;
    return replaceMarkdownRange(
      source,
      { start: lineStart + link.start, end: caret },
      link.replacement,
    );
  }

  const definition = visibleText === "*" || visibleText === "_"
    ? { character: visibleText, strong: true }
    : visibleText === "~"
      ? { character: visibleText, strong: true }
      : visibleText === "`"
        ? { character: visibleText, strong: false }
      : undefined;
  if (!definition) return undefined;
  const escaped = `\\${definition.character}`;
  const paired = definition.strong
    ? completeDelimitedInput(before, escaped, 2)
    : undefined;
  const single = paired ?? (definition.character === "~"
    ? undefined
    : completeDelimitedInput(before, escaped, 1));
  if (!single) return undefined;
  const marker = definition.character.repeat(single.markerLength);
  return replaceMarkdownRange(
    source,
    { start: lineStart + single.start, end: caret },
    `${marker}${single.content}${marker}`,
  );
}

function completeDelimitedInput(
  before: string,
  escaped: string,
  markerLength: number,
): { start: number; content: string; markerLength: number } | undefined {
  const opening = escaped.repeat(markerLength);
  const closingPrefix = escaped.repeat(markerLength - 1);
  if (closingPrefix && !before.endsWith(closingPrefix)) return undefined;
  const bodyEnd = before.length - closingPrefix.length;
  const start = before.lastIndexOf(opening, bodyEnd - opening.length);
  if (start < 0) return undefined;
  if (markerLength === 1 && before.slice(0, start).endsWith(escaped)) return undefined;
  const content = before.slice(start + opening.length, bodyEnd);
  if (!content || /\n/.test(content)) return undefined;
  return { start, content, markerLength };
}

function completeLinkInput(before: string): { start: number; replacement: string } | undefined {
  const separator = before.lastIndexOf("\\](");
  if (separator < 0) return undefined;
  const start = before.lastIndexOf("\\[", separator);
  if (start < 0) return undefined;
  const label = before.slice(start + 2, separator);
  const href = before.slice(separator + 3);
  const canonicalHref = canonicalMarkdownHref(href);
  if (!label || !canonicalHref) return undefined;
  return { start, replacement: `[${label}](${canonicalHref})` };
}

function findLinkSuffixLength(source: string, selectionEnd: number): number {
  if (source.slice(selectionEnd, selectionEnd + 2) !== "](") return 0;
  let escaped = false;
  for (let index = selectionEnd + 2; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\n") return 0;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === ")") return index - selectionEnd + 1;
  }
  return 0;
}

export function isSafeMarkdownHref(value: string): boolean {
  return canonicalMarkdownHref(value) !== undefined;
}

function canonicalMarkdownHref(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^www\.[^\s]+$/i.test(trimmed)) return `https://${trimmed}`;
  return undefined;
}

function escapeMarkdownLiteralWithMap(value: string): {
  value: string;
  boundaries: number[];
} {
  let escaped = "";
  const boundaries = [0];
  for (const character of value) {
    if (/[\\`*_[\]{}<>#+\-|~]/.test(character)) escaped += "\\";
    escaped += character;
    for (let index = 0; index < character.length; index += 1) {
      boundaries.push(escaped.length - character.length + index + 1);
    }
  }
  return { value: escaped, boundaries };
}

function isStandaloneMarker(
  source: string,
  range: MarkdownSourceRange,
  marker: string,
): boolean {
  if (marker !== "*") return true;
  return source[range.start - 2] !== "*" && source[range.end + 1] !== "*";
}

function normalizeRange(source: string, range: MarkdownSourceRange): MarkdownSourceRange {
  const start = Math.max(0, Math.min(source.length, Math.min(range.start, range.end)));
  const end = Math.max(start, Math.min(source.length, Math.max(range.start, range.end)));
  return { start, end };
}
