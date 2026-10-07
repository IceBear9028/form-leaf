import { useEffect, useRef } from "react";
import type { TextContent } from "../../../../../foundation/content/resume";
import { htmlElementToTextContent, textContentToHtml } from "../../../shared/lib/text";

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
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-[650] text-[#687384]">
        <span>{label}</span>
        <div className="flex overflow-hidden rounded-md border border-[#e1e5ea]" aria-label={`${label} 서식`}>
          <button type="button" className={toolbarButtonClass} aria-label="굵게" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>
            <strong>B</strong>
          </button>
          <button type="button" className={toolbarButtonClass} aria-label="밑줄" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")}>
            <u>U</u>
          </button>
          <button type="button" className={`${toolbarButtonClass} border-r-0`} aria-label="링크" onMouseDown={(event) => event.preventDefault()} onClick={createLink}>
            ↗
          </button>
        </div>
      </div>
      <div
        ref={editorRef}
        className={`min-h-[35px] whitespace-pre-wrap rounded-[7px] border border-[#dce1e7] bg-white px-[9px] py-2 text-xs leading-[1.55] text-[#263143] [overflow-wrap:anywhere] empty:before:pointer-events-none empty:before:text-[#b3bac4] empty:before:content-[attr(data-placeholder)] focus:border-[#73a4ec] focus:outline-2 focus:outline-[rgba(49,120,255,0.12)] [&_a]:text-[#1768e5] [&_a]:underline${multiline ? " min-h-[72px]" : ""}`}
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

const toolbarButtonClass = "h-[23px] w-[26px] cursor-pointer border-0 border-r border-[#e7eaee] bg-white text-[11px] text-[#536074] hover:bg-[#edf4ff] hover:text-[#1768e5] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3178ff]";
