export const IPC = {
  listResumes: "resume:list",
  listDeletedResumes: "resume:list-deleted",
  createResume: "resume:create",
  loadResume: "resume:load",
  saveResume: "resume:save",
  renameResume: "resume:rename",
  deleteResume: "resume:delete",
  restoreResume: "resume:restore",
  permanentlyDeleteResume: "resume:permanently-delete",
  exportPdf: "resume:export-pdf",
  showInFolder: "resume:show-in-folder",
} as const;
