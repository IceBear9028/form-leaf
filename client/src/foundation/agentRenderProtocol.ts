import type { SavedDocument } from "./documentSessionProtocol.ts";
export type RenderReady = { pageCount: number; pages: Array<{ x: number; y: number; width: number; height: number }>; warnings: string[] };
export type AgentRenderApi = { snapshot: (jobId: string) => Promise<SavedDocument>; ready: (jobId: string, result: RenderReady) => void };
