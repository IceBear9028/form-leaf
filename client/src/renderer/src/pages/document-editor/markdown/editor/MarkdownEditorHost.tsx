import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createMarkdownEditorSession, type MarkdownEditorSession, type MarkdownEditorSnapshot } from "./MarkdownEditorSession.ts";
import { registerMarkdownOwner } from "./markdownEditorLifecycle.ts";
import { executeMarkdownEditorCommand } from "./markdownEditorCommands.ts";
import { MarkdownSelectionToolbar } from "../MarkdownSelectionToolbar.tsx";
import { MarkdownQuickInsertMenu } from "../MarkdownQuickInsertMenu.tsx";

type EditorUi = { rect: DOMRect; selected: boolean; quick?: { from: number; to: number; query: string } };
export type MarkdownEditorActivation = { markdown: string; textOffset: number; onSnapshot: (snapshot: MarkdownEditorSnapshot) => void; onClose: () => void };

export function MarkdownEditorHost({ activation }: { activation: MarkdownEditorActivation }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<MarkdownEditorSession | undefined>(undefined);
  const [ui, setUi] = useState<EditorUi>();
  const [dismissed, setDismissed] = useState<number>();
  useEffect(() => { if (!ui?.quick) setDismissed(undefined); }, [ui?.quick]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session = createMarkdownEditorSession({ element: host, initialMarkdown: activation.markdown, onSnapshot: activation.onSnapshot });
    sessionRef.current = session;
    const editor = session.editor;
    const updateUi = () => {
      if (editor.isDestroyed || editor.view.composing) return;
      const { from, to, $from, empty } = editor.state.selection;
      const coords = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
      const match = $from.parent.type.name !== "codeBlock" && before.match(/^\/([^\s/]*)$/);
      setUi({
        rect: new DOMRect(coords.left, coords.top, Math.max(0, end.right - coords.left), end.bottom - coords.top),
        selected: !empty,
        quick: empty && match ? { from: $from.start(), to: from, query: match[1] } : undefined,
      });
    };
    editor.on("transaction", updateUi);
    editor.commands.setTextSelection(positionAtTextOffset(editor, activation.textOffset));
    editor.view.focus();
    updateUi();
    const unregister = registerMarkdownOwner({
      flush: () => { session.flush(); },
      close: () => {
        session.finish();
        session.destroy();
        activation.onClose();
      },
    });
    return () => {
      unregister();
      if (!editor.isDestroyed) { session.finish(); session.destroy(); }
      sessionRef.current = undefined;
    };
  }, [activation]);

  const editor = sessionRef.current?.editor;
  const quick = ui?.quick;
  return <>
    <div ref={hostRef} className="markdown-body markdown-body--document markdown-editor-host" data-markdown-editor-host="true" />
    {ui?.selected && editor && <MarkdownSelectionToolbar rect={ui.rect}
      onFormat={(format) => executeMarkdownEditorCommand(editor, { type: "inline-format", format })}
      onBlockquote={() => executeMarkdownEditorCommand(editor, { type: "blockquote" })}
      onLink={() => {
        const href = window.prompt("링크 URL", editor.getAttributes("link").href ?? "https://");
        if (href !== null) executeMarkdownEditorCommand(editor, { type: "link", href });
      }} />}
    {quick && ui && editor && quick.from !== dismissed && <MarkdownQuickInsertMenu rect={ui.rect} query={quick.query}
      onSelect={(command) => { executeMarkdownEditorCommand(editor, command, quick); setDismissed(undefined); }}
      onClose={() => setDismissed(quick.from)} />}
  </>;
}

// Used only once when a read-only preview becomes an editor. Subsequent selection
// changes belong exclusively to ProseMirror, including all composition selection.
function positionAtTextOffset(editor: Editor, offset: number): number {
  let remaining = offset;
  let position = 1;
  let found = false;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "hardBreak") {
      if (remaining === 0) { position = pos; found = true; }
      else { remaining -= 1; position = pos + 1; }
    }
    if (node.isText) {
      if (remaining <= node.nodeSize) { position = pos + remaining; found = true; }
      else { remaining -= node.nodeSize; position = pos + node.nodeSize; }
    }
    return !found;
  });
  return position;
}
