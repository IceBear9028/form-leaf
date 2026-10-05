/// <reference types="vite/client" />

import type { ResumeStudioApi } from "../../shared/resumeLibrary";

declare global {
  interface Window {
    resumeStudio: ResumeStudioApi;
  }
}

export {};
