import { createPortal } from "react-dom";
import type { MarkdownInlineFormat } from "./edits";

export function MarkdownSelectionToolbar({
  rect,
  onFormat,
  onLink,
}: {
  rect: DOMRect;
  onFormat: (format: MarkdownInlineFormat) => void;
  onLink: () => void;
}) {
  const left = Math.min(
    window.innerWidth - 172,
    Math.max(8, rect.left + rect.width / 2),
  );
  const top = Math.max(8, rect.top - 42);

  return createPortal(
    <div
      className="markdown-selection-toolbar"
      role="toolbar"
      aria-label="Markdown 텍스트 서식"
      style={{ left, top }}
      onPointerDown={(event) => event.preventDefault()}
    >
      <FormatButton label="굵게" title="굵게 (⌘B)" onClick={() => onFormat("strong")}><strong>B</strong></FormatButton>
      <FormatButton label="기울임" title="기울임 (⌘I)" onClick={() => onFormat("emphasis")}><em>I</em></FormatButton>
      <FormatButton label="밑줄" title="밑줄 (⌘U)" onClick={() => onFormat("underline")}><u>U</u></FormatButton>
      <FormatButton label="취소선" title="취소선" onClick={() => onFormat("delete")}><s>S</s></FormatButton>
      <FormatButton label="인라인 코드" title="인라인 코드" onClick={() => onFormat("inline-code")}><span className="markdown-toolbar-code">&lt;/&gt;</span></FormatButton>
      <FormatButton label="링크" title="링크" onClick={onLink}><span aria-hidden="true">↗</span></FormatButton>
    </div>,
    document.body,
  );
}

function FormatButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={title} onClick={onClick}>
      {children}
    </button>
  );
}
