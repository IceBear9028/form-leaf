import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type BackupTarget = {
  path: string;
  overwrite: boolean;
};

export async function readJsonWithBackup<T>(
  path: string,
  parse: (value: unknown) => T,
  notFoundMessage: string,
): Promise<T> {
  const candidates = [path, `${path}.backup`];
  let firstError: unknown;

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      return parse(JSON.parse(await readFile(candidate, "utf8")) as unknown);
    } catch (error) {
      firstError ??= error;
    }
  }

  throw firstError ?? new Error(notFoundMessage);
}

export async function writeJsonAtomically<T>(
  path: string,
  value: T,
  backupTarget: (current: unknown) => BackupTarget | undefined,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  if (existsSync(path)) {
    try {
      const current = JSON.parse(await readFile(path, "utf8")) as unknown;
      const backup = backupTarget(current);
      if (backup && (backup.overwrite || !existsSync(backup.path))) {
        await copyFile(path, backup.path);
      }
    } catch {
      // 손상된 현재 파일로 정상 백업을 덮어쓰지 않는다.
    }
  }

  await writeTextAtomically(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextAtomically(path: string, value: string): Promise<void> {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, path);
}
