export const IPC = {
  listDocuments: "document:list",
  listDeletedDocuments: "document:list-deleted",
  createDocument: "document:create",
  loadDocument: "document:load",
  saveDocument: "document:save",
  renameDocument: "document:rename",
  deleteDocument: "document:delete",
  restoreDocument: "document:restore",
  permanentlyDeleteDocument: "document:permanently-delete",
  exportPdf: "resume:export-pdf",
  showInFolder: "shell:show-in-folder",
} as const;
