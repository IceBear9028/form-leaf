import { join } from "node:path";

export const LEGACY_DOCUMENT_SUFFIX = ".resume.json";
export const LEGACY_APP_DIRECTORY_NAME = "Resume Studio";

export type LegacyDocumentPaths = ReturnType<typeof createLegacyDocumentPaths>;

export function createLegacyDocumentPaths(workspaceDirectory: string) {
  const activeDirectory = join(workspaceDirectory, "resumes");
  return {
    activeDirectory,
    singleDocument: join(workspaceDirectory, "default.resume.json"),
    migrationMarker: join(workspaceDirectory, "legacy-import-v1.json"),
    activeDocument: (id: string) => join(activeDirectory, `${id}${LEGACY_DOCUMENT_SUFFIX}`),
  };
}
