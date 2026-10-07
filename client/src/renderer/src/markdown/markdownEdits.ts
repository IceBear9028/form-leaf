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

export function toggleMarkdownLink(
  source: string,
  range: MarkdownSourceRange,
  href?: string,
): MarkdownEditResult {
  const normalized = normalizeRange(source, range);
  if (normalized.start === normalized.end) return { source, selection: normalized };
  const selected = source.slice(normalized.start, normalized.end);
  const linkSuffixLength = findLinkSuffixLength(source, normalized.end);

  if (source[normalized.start - 1] === "[" && linkSuffixLength > 0) {
    if (href && isSafeMarkdownHref(href)) {
      const destination = escapeLinkDestination(href);
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

  if (!href || !isSafeMarkdownHref(href)) return { source, selection: normalized };
  const destination = escapeLinkDestination(href);
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
  if (/^[0-9]{1,9}\.$/.test(prefix)) return { start: lineStart, marker: prefix };
  return undefined;
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
  return /^(https?:|mailto:)/i.test(value.trim());
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
