import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { IPC } from "../foundation/ipc";

type PdfHandlerOptions = {
  documentsDirectory: string;
  getMainWindow: () => BrowserWindow | null;
};

export function registerPdfHandlers({
  documentsDirectory,
  getMainWindow,
}: PdfHandlerOptions): void {
  ipcMain.handle(IPC.exportPdf, async (event, name: string) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? getMainWindow();
    const options: Electron.SaveDialogOptions = {
      title: "이력서 PDF 내보내기",
      defaultPath: join(documentsDirectory, safePdfName(name)),
      filters: [{ name: "PDF 문서", extensions: ["pdf"] }],
    };
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) return { canceled: true as const };

    const pdf = await event.sender.printToPDF({
      pageSize: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1,
    });
    const temporaryPath = `${result.filePath}.tmp`;
    await writeFile(temporaryPath, pdf);
    await rename(temporaryPath, result.filePath);
    return { canceled: false as const, filePath: result.filePath };
  });

  ipcMain.handle(IPC.showInFolder, (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
}

function safePdfName(name: string): string {
  const normalized = name.trim().replace(/[\\/:*?"<>|]/g, "-");
  return `${normalized || "resume"}.pdf`;
}
