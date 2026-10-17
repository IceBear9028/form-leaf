/// <reference types="vite/client" />

import type { DocumentApi } from "../../foundation/documentLibrary";

declare global {
  interface Window {
    documents: DocumentApi;
    __RESUME_STUDIO_DEBUG__?: {
      interactions?: {
        enable: () => void;
        disable: () => void;
        status: () => { enabled: boolean; recordCount: number; storageKey: string };
        clear: () => void;
        recent: () => Array<{
          sequence: number;
          timestampMs: number;
          kind: string;
          detail: Record<string, unknown>;
        }>;
      };
    };
  }
}

export {};
