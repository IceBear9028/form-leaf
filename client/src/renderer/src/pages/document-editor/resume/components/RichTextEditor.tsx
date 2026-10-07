import { useEffect, useRef } from "react";
import { BoldIcon, LinkIcon, UnderlineIcon } from "lucide-react";
import type { TextContent } from "../../../../../../foundation/content/resume";
import { htmlElementToTextContent, textContentToHtml } from "../../../../shared/lib/text";
import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

type Props = {
  label: string;
  value: TextContent;
  onChange: (value: TextContent) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({
  label,
  value,
  onChange,
  multiline = true,
  placeholder,
  className = "",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const html = textContentToHtml(value);
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }, [value]);

  const emitChange = () => {
    if (editorRef.current) onChange(htmlElementToTextContent(editorRef.current));
  };

  const runCommand = (command: "bold" | "underline") => {
    editorRef.current?.focus();
    document.execCommand(command);
    emitChange();
  };

  const createLink = () => {
    const href = window.prompt("연결할 URL을 입력하세요", "https://");
    if (!href) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, href);
    emitChange();
  };

  return (
    <div className={`rich-field ${className}`}>
      <div className="mb-1.5 flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        <ButtonGroup aria-label={`${label} 서식`}>
          <RichTextToolbarButton label="굵게" onClick={() => runCommand("bold")}><BoldIcon aria-hidden="true" /></RichTextToolbarButton>
          <RichTextToolbarButton label="밑줄" onClick={() => runCommand("underline")}><UnderlineIcon aria-hidden="true" /></RichTextToolbarButton>
          <RichTextToolbarButton label="링크" onClick={createLink}><LinkIcon aria-hidden="true" /></RichTextToolbarButton>
        </ButtonGroup>
      </div>
      <div
        ref={editorRef}
        className={`min-h-8 whitespace-pre-wrap rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_a]:text-primary [&_a]:underline${multiline ? " min-h-18" : ""}`}
        contentEditable
        role="textbox"
        aria-label={label}
        aria-multiline={multiline}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyDown={(event) => {
          if (!multiline && event.key === "Enter") event.preventDefault();
        }}
        dangerouslySetInnerHTML={{ __html: textContentToHtml(value) }}
      />
    </div>
  );
}

function RichTextToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
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
            size="icon-xs"
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
