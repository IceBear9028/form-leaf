import type { EditorReply, EditorRequest } from "../../../../foundation/documentSessionProtocol.ts";

type Handler = (request: EditorRequest) => EditorReply;
let editor: Handler | undefined;
export function registerAgentEditor(handler: Handler): () => void {
  editor = handler;
  return () => { if (editor === handler) editor = undefined; };
}
export function handleEditorRequest(request: EditorRequest): EditorReply {
  return editor?.(request) ?? { requestId: request.requestId, ok: true, context: null };
}
