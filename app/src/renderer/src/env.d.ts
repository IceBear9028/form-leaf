/// <reference types="vite/client" />

import type { ResumeStudioApi } from "../../shared/resume";

declare global {
  interface Window {
    resumeStudio: ResumeStudioApi;
  }
}

export {};
