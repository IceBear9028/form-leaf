import { useLayoutEffect, useRef, useState } from "react";
import {
  createMarkdownEditorSession,
  type MarkdownEditorSession,
  type MarkdownEditorSnapshot,
} from "./MarkdownEditorSession.ts";

export function MarkdownEditorOwnershipSpike() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<MarkdownEditorSession | undefined>(undefined);
  const [parentRevision, setParentRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<MarkdownEditorSnapshot>({
    markdown: "경쟁: ",
    revision: 0,
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session = createMarkdownEditorSession({
      element: host,
      initialMarkdown: "경쟁: ",
      onSnapshot: setSnapshot,
    });
    sessionRef.current = session;
    setSnapshot(session.snapshot());
    return () => {
      session.destroy();
      sessionRef.current = undefined;
    };
  }, []);

  return (
    <main
      aria-label="Markdown editor ownership spike"
      className="m-8 flex max-w-3xl flex-col gap-4"
      data-editor-ownership-spike="true"
      data-parent-revision={parentRevision}
    >
      <button
        type="button"
        data-editor-ownership-rerender="true"
        onClick={() => setParentRevision((current) => current + 1)}
      >
        Parent rerender
      </button>
      <div
        ref={hostRef}
        className="min-h-40 rounded border bg-white p-4"
        data-editor-ownership-host="true"
      />
      <output data-editor-ownership-snapshot="true">{snapshot.markdown}</output>
      <output data-editor-ownership-session-revision="true">{snapshot.revision}</output>
      <button
        type="button"
        onClick={() => setSnapshot(sessionRef.current?.flush() ?? snapshot)}
      >
        Flush
      </button>
    </main>
  );
}
