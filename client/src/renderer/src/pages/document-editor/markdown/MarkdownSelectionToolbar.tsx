import { createPortal } from "react-dom";
import {
  BoldIcon,
  CodeXmlIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
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
    window.innerWidth - 224,
    Math.max(8, rect.left + rect.width / 2),
  );
  const top = Math.max(8, rect.top - 42);

  return createPortal(
    <ButtonGroup
      className="markdown-selection-toolbar fixed z-50 -translate-x-1/2 rounded-lg bg-popover shadow-md ring-1 ring-foreground/10"
      role="toolbar"
      aria-label="Markdown 텍스트 서식"
      style={{ left, top }}
      onPointerDown={(event) => event.preventDefault()}
    >
      <FormatButton label="굵게" title="굵게 (⌘B)" onClick={() => onFormat("strong")}><BoldIcon aria-hidden="true" /></FormatButton>
      <FormatButton label="기울임" title="기울임 (⌘I)" onClick={() => onFormat("emphasis")}><ItalicIcon aria-hidden="true" /></FormatButton>
      <FormatButton label="밑줄" title="밑줄 (⌘U)" onClick={() => onFormat("underline")}><UnderlineIcon aria-hidden="true" /></FormatButton>
      <FormatButton label="취소선" title="취소선" onClick={() => onFormat("delete")}><StrikethroughIcon aria-hidden="true" /></FormatButton>
      <FormatButton label="인라인 코드" title="인라인 코드" onClick={() => onFormat("inline-code")}><CodeXmlIcon aria-hidden="true" /></FormatButton>
      <FormatButton label="링크" title="링크" onClick={onLink}><LinkIcon aria-hidden="true" /></FormatButton>
    </ButtonGroup>,
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
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
