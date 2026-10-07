import { join } from "node:path";

export const DOCUMENT_SUFFIX = ".resume.json";
export const DOCUMENT_BACKUP_SUFFIXES = [".backup", ".v1.backup"] as const;

export type DocumentPaths = ReturnType<typeof createDocumentPaths>;

export function createDocumentPaths(workspaceDirectory: string) {
  const activeDirectory = join(workspaceDirectory, "resumes");
  const trashDirectory = join(workspaceDirectory, "trash");

  return {
    workspaceDirectory,
    activeDirectory,
    trashDirectory,
    index: join(workspaceDirectory, "library.json"),
    legacyDocument: join(workspaceDirectory, "default.resume.json"),
    activeDocument: (id: string) => join(activeDirectory, `${id}${DOCUMENT_SUFFIX}`),
    trashDocument: (id: string) => join(trashDirectory, `${id}${DOCUMENT_SUFFIX}`),
  };
}
