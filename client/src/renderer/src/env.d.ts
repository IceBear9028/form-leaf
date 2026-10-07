/// <reference types="vite/client" />

import type { ResumeStudioApi } from "../../foundation/resumeLibrary";

declare global {
  interface Window {
    resumeStudio: ResumeStudioApi;
  }
}

export {};
