/// <reference types="vite/client" />

import type { DocumentApi } from "../../foundation/documentLibrary";

declare global {
  interface Window {
    documents: DocumentApi;
  }
}

export {};
