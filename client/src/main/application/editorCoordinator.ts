import { randomUUID } from "node:crypto";
import { failure } from "../../foundation/documentCommands.ts";
import type { EditorContext, EditorReply, EditorRequest, SavedDocument } from "../../foundation/documentSessionProtocol.ts";

export type EditorLease = { documentId: string; leaseId?: string };
type Sender = (request: EditorRequest) => void;
export class EditorCoordinator {
  private sender?: Sender;
  private context: EditorContext | null = null;
  private pending = new Map<string, { resolve: (reply: EditorReply) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(privateTimeout = 2000) { this.timeout = privateTimeout; }
  private readonly timeout: number;
  attach(sender: Sender): void { this.sender = sender; }
  detach(): void {
    this.sender = undefined; this.context = null;
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({ requestId, ok: false, context: null });
    }
    this.pending.clear();
  }
  update(context: EditorContext | null): void { this.context = context; }
  current(): EditorContext | null { return this.context; }
  reply(reply: EditorReply): void {
    const pending = this.pending.get(reply.requestId);
    if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(reply.requestId);
    this.context = reply.context; pending.resolve(reply);
  }
  async inspect(documentId: string): Promise<EditorContext | null> {
    if (!this.sender) return null;
    const reply = await this.request({ type: "inspect", documentId });
    if (!reply.ok) failure("DOCUMENT_BUSY", "편집기 상태를 확인할 수 없습니다.");
    return reply.context?.documentId === documentId ? reply.context : null;
  }
  async acquire(documentId: string): Promise<EditorLease> {
    if (!this.sender) return { documentId };
    const reply = await this.request({ type: "acquire", documentId });
    if (!reply.ok) failure("DOCUMENT_BUSY", "문서를 편집하거나 저장 중입니다. 편집을 마친 뒤 다시 시도하세요.");
    return { documentId, leaseId: reply.leaseId };
  }
  async apply(lease: EditorLease, snapshot: SavedDocument): Promise<boolean> {
    if (!lease.leaseId) return true;
    const reply = await this.request({ type: "apply", documentId: lease.documentId, leaseId: lease.leaseId, snapshot });
    return reply.ok;
  }
  async release(lease: EditorLease): Promise<void> {
    if (lease.leaseId) await this.request({ type: "release", documentId: lease.documentId, leaseId: lease.leaseId });
  }
  private request(request: Omit<Extract<EditorRequest, { type: "inspect" | "acquire" }>, "requestId"> | Omit<Extract<EditorRequest, { type: "apply" }>, "requestId"> | Omit<Extract<EditorRequest, { type: "release" }>, "requestId">): Promise<EditorReply> {
    const requestId = randomUUID();
    if (!this.sender) return Promise.resolve({ requestId, ok: false, context: null });
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId); resolve({ requestId, ok: false, context: null });
        // A late acquire may have locked the UI: its lease ID is the request ID.
        if (request.type === "acquire") this.sender?.({ type: "release", requestId: randomUUID(), documentId: request.documentId, leaseId: requestId });
      }, this.timeout);
      this.pending.set(requestId, { resolve, timer });
      try { this.sender!({ ...request, requestId }); }
      catch { clearTimeout(timer); this.pending.delete(requestId); resolve({ requestId, ok: false, context: null }); }
    });
  }
}
