import { useEffect, useRef } from "react";
import type { TextContent } from "../../../shared/resume";
import { htmlElementToTextContent, textContentToHtml } from "../lib/text";

type Props = {
  label: string;
  value: TextContent;
  onChange: (value: TextContent) => void;
  multiline?: boolean;
  placeholder?: string;
};

export function RichTextEditor({
  label,
  value,
  onChange,
  multiline = true,
  placeholder,
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
    <div className="rich-field">
      <div className="field-label-row">
        <span className="field-label">{label}</span>
        <div className="inline-toolbar" aria-label={`${label} 서식`}>
          <button type="button" aria-label="굵게" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>
            <strong>B</strong>
          </button>
          <button type="button" aria-label="밑줄" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")}>
            <u>U</u>
          </button>
          <button type="button" aria-label="링크" onMouseDown={(event) => event.preventDefault()} onClick={createLink}>
            ↗
          </button>
        </div>
      </div>
      <div
        ref={editorRef}
        className={`rich-input${multiline ? " rich-input--multiline" : ""}`}
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
