import { Editor } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
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

  const editor = new Editor({
    element,
    extensions: createMarkdownEditorExtensions(),
    content: editorMarkdown,
    contentType: "markdown",
    onUpdate: ({ editor: currentEditor }) => {
      const markdown = currentEditor.getMarkdown();
      if (markdown === lastSnapshot.markdown) return;
      revision += 1;
      lastSnapshot = { markdown, revision };
      onSnapshot?.(lastSnapshot);
    },
  });
  lastSnapshot = {
    markdown: editor.getMarkdown(),
    revision,
  };

  const snapshot = (): MarkdownEditorSnapshot => {
    const markdown = editor.getMarkdown();
    if (markdown !== lastSnapshot.markdown) {
      revision += 1;
      lastSnapshot = { markdown, revision };
    }
    return lastSnapshot;
  };

  return {
    editor,
    snapshot,
    flush: () => {
      const current = snapshot();
      onSnapshot?.(current);
      return current;
    },
    destroy: () => editor.destroy(),
  };
}

function createMarkdownEditorExtensions() {
  return [
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({
      indentation: { style: "space", size: 4 },
      markedOptions: { gfm: true, breaks: false },
    }),
  ];
}
