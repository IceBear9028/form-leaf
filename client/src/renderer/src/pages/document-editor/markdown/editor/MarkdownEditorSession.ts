import { Editor } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { MarkdownAuthoring } from "./markdownEditorCommands.ts";
import {
  inspectMarkdownEditorCompatibility,
  prepareMarkdownForEditor,
} from "./markdownEditorCompatibility.ts";

export type MarkdownEditorSnapshot = {
  markdown: string;
  revision: number;
};

export type MarkdownEditorSession = {
  editor: Editor;
  snapshot: () => MarkdownEditorSnapshot;
  flush: () => MarkdownEditorSnapshot;
  finish: () => MarkdownEditorSnapshot;
  receiveExternalSnapshot: (markdown: string) => "unchanged" | "acknowledged" | "deferred";
  deferredExternalSnapshot: () => string | undefined;
  destroy: () => void;
};

export class UnsupportedMarkdownEditorSourceError extends Error {
  readonly unsupportedTypes: string[];

  constructor(unsupportedTypes: string[]) {
    super(`Markdown editor가 보존할 수 없는 문법입니다: ${unsupportedTypes.join(", ")}`);
    this.name = "UnsupportedMarkdownEditorSourceError";
    this.unsupportedTypes = unsupportedTypes;
  }
}

export function createMarkdownEditorSession({
  element,
  initialMarkdown,
  onSnapshot,
}: {
  element: HTMLElement | null;
  initialMarkdown: string;
  onSnapshot?: (snapshot: MarkdownEditorSnapshot) => void;
}): MarkdownEditorSession {
  const compatibility = inspectMarkdownEditorCompatibility(initialMarkdown);
  if (!compatibility.editable) {
    throw new UnsupportedMarkdownEditorSourceError(compatibility.unsupportedTypes);
  }
  const editorMarkdown = prepareMarkdownForEditor(initialMarkdown);
  let revision = 0;
  let lastSnapshot: MarkdownEditorSnapshot = {
    markdown: editorMarkdown,
    revision,
  };

  const published = new Set<string>([initialMarkdown]);
  let deferredExternal: string | undefined;
  let compositionTimer: ReturnType<typeof setTimeout> | undefined;
  let composing = false;
  const publish = (currentEditor: Editor, finishing = false) => {
    if (!finishing && (composing || (element && currentEditor.view.composing))) return;
    const markdown = currentEditor.getMarkdown();
    if (markdown === lastSnapshot.markdown) return;
    revision += 1;
    lastSnapshot = { markdown, revision };
    published.add(markdown);
    onSnapshot?.(lastSnapshot);
  };

  const editor = new Editor({
    element,
    extensions: createMarkdownEditorExtensions(),
    content: editorMarkdown,
    contentType: "markdown",
    enablePasteRules: false,
    onUpdate: ({ editor: currentEditor }) => publish(currentEditor),
    editorProps: {
      attributes: { class: "markdown-editor ProseMirror", spellcheck: "false" },
      handleDOMEvents: {
        compositionstart: () => { composing = true; return false; },
        compositionend: () => {
          composing = false;
          const publishAfterComposition = () => {
            if (editor.isDestroyed) return;
            if (editor.view.composing) {
              compositionTimer = setTimeout(publishAfterComposition, 20);
              return;
            }
            publish(editor);
          };
          clearTimeout(compositionTimer);
          compositionTimer = setTimeout(publishAfterComposition, 0);
          return false;
        },
      },
    },
  });
  lastSnapshot = {
    markdown: editor.getMarkdown(),
    revision,
  };

  return {
    editor,
    snapshot: () => lastSnapshot,
    flush: () => {
      publish(editor);
      return lastSnapshot;
    },
    finish: () => {
      if (element) editor.view.dom.blur();
      publish(editor, true);
      return lastSnapshot;
    },
    receiveExternalSnapshot: (markdown) => {
      if (markdown === initialMarkdown && revision === 0) return "unchanged";
      if (published.has(markdown)) return "acknowledged";
      // A delayed acknowledgement must never call setContent during IME.
      deferredExternal = markdown;
      return "deferred";
    },
    deferredExternalSnapshot: () => deferredExternal,
    destroy: () => {
      clearTimeout(compositionTimer);
      editor.destroy();
    },
  };
}

function createMarkdownEditorExtensions() {
  return [
    StarterKit.configure({ trailingNode: false, link: { openOnClick: false, markdownLinks: true } }),
    MarkdownAuthoring,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({
      indentation: { style: "space", size: 4 },
      markedOptions: { gfm: true, breaks: false },
    }),
  ];
}
