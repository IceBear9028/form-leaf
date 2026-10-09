import { join } from "node:path";

export const DOCUMENT_SUFFIX = ".document.json";
export const DOCUMENT_BACKUP_SUFFIXES = [".backup"] as const;
export const LEGACY_DOCUMENT_SUFFIX = ".resume.json";
export const COMPONENT_SUFFIX = ".component.json";

export type DocumentPaths = ReturnType<typeof createDocumentPaths>;

export function createDocumentPaths(workspaceDirectory: string) {
  const activeDirectory = join(workspaceDirectory, "documents");
  const trashDirectory = join(workspaceDirectory, "document-trash");
  const componentDirectory = join(workspaceDirectory, "components");

  return {
    workspaceDirectory,
    activeDirectory,
    trashDirectory,
    index: join(workspaceDirectory, "documents.json"),
    migrationMarker: join(workspaceDirectory, "legacy-import-v1.json"),
    componentDirectory,
    componentIndex: join(workspaceDirectory, "components.json"),
    legacyDocument: join(workspaceDirectory, "default.resume.json"),
    activeDocument: (id: string) => join(activeDirectory, `${id}${DOCUMENT_SUFFIX}`),
    trashDocument: (id: string) => join(trashDirectory, `${id}${DOCUMENT_SUFFIX}`),
    componentItem: (id: string) => join(componentDirectory, `${id}${COMPONENT_SUFFIX}`),
    legacyActiveDirectory: join(workspaceDirectory, "resumes"),
    legacyTrashDirectory: join(workspaceDirectory, "trash"),
    legacyIndex: join(workspaceDirectory, "library.json"),
    legacyActiveDocument: (id: string) => join(workspaceDirectory, "resumes", `${id}${LEGACY_DOCUMENT_SUFFIX}`),
    legacyTrashDocument: (id: string) => join(workspaceDirectory, "trash", `${id}${LEGACY_DOCUMENT_SUFFIX}`),
  };
}
