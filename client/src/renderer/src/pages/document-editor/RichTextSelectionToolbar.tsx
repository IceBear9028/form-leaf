import { createPortal } from "react-dom";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnderlineIcon,
  XIcon,
} from "lucide-react";
import type { RichTextMark } from "../../../../foundation/documentModel.ts";
import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";

export function RichTextSelectionToolbar({
  rect,
  onFormat,
  onRemove,
}: {
  rect: DOMRect;
  onFormat: (mark: RichTextMark) => void;
  onRemove: (type: RichTextMark["type"]) => void;
}) {
  const left = Math.min(window.innerWidth - 220, Math.max(12, rect.left + rect.width / 2));
  const top = Math.max(8, rect.top - 44);
  const link = () => {
    const href = window.prompt("링크 URL을 입력하세요. 같은 선택에서 다시 누르면 링크가 제거됩니다.", "https://");
    if (href === null) return;
    if (href.trim()) onFormat({ type: "link", href: href.trim() });
    else onRemove("link");
  };

  return createPortal(
    <div
      className="document-selection-toolbar fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-popover p-1 shadow-md ring-1 ring-border"
      role="toolbar"
      aria-label="서식 텍스트 도구"
      style={{ left, top }}
      onPointerDown={(event) => event.preventDefault()}
    >
      <ButtonGroup>
        <FormatButton label="굵게" onClick={() => onFormat({ type: "bold" })}><BoldIcon /></FormatButton>
        <FormatButton label="기울임" onClick={() => onFormat({ type: "italic" })}><ItalicIcon /></FormatButton>
        <FormatButton label="밑줄" onClick={() => onFormat({ type: "underline" })}><UnderlineIcon /></FormatButton>
        <FormatButton label="취소선" onClick={() => onFormat({ type: "strike" })}><StrikethroughIcon /></FormatButton>
        <FormatButton label="링크" onClick={link}><LinkIcon /></FormatButton>
      </ButtonGroup>
      <label className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border" title="글자색">
        <span className="sr-only">글자색</span>
        <input
          className="size-5 cursor-pointer border-0 bg-transparent p-0"
          type="color"
          defaultValue="#111111"
          onChange={(event) => onFormat({ type: "color", color: { kind: "hex", value: event.target.value.toUpperCase() } })}
        />
      </label>
      <FormatButton label="인라인 색상 제거" onClick={() => onRemove("color")}>
        <XIcon />
      </FormatButton>
    </div>,
    document.body,
  );
}

function FormatButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" variant="outline" size="icon-sm" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}
