import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createDocumentStyleFromPreset, DEFAULT_DOCUMENT_STYLE_PRESET_ID } from "../../foundation/documentStylePresets.ts";
const execute = promisify(execFile);
const baseFonts = ["serif", "sans-serif", "monospace", "system-ui", "-apple-system", "BlinkMacSystemFont"];
export class FontCatalog {
  private cached?: Promise<ReadonlySet<string>>;
  families(): Promise<ReadonlySet<string>> { return this.cached ??= this.read(); }
  private async read(): Promise<ReadonlySet<string>> {
    const defaultStack = createDocumentStyleFromPreset(DEFAULT_DOCUMENT_STYLE_PRESET_ID, "font-catalog").typography?.fontFamily;
    const names = new Set([...baseFonts, ...(defaultStack ? [defaultStack] : [])]);
    try {
      const options = { timeout: 30_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true };
      if (process.platform === "darwin") {
        const { stdout } = await execute("/usr/sbin/system_profiler", ["SPFontsDataType", "-json"], options);
        const data = JSON.parse(stdout);
        for (const file of data.SPFontsDataType ?? []) for (const font of file.typefaces ?? []) {
          if (font.enabled !== "yes" || font.valid !== "yes") continue;
          for (const name of [font.family, font.fullname]) if (typeof name === "string") names.add(name);
        }
      } else if (process.platform === "win32") {
        const script = "Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts','HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSObject.Properties.Name | Where-Object { $_ -notlike 'PS*' } } | ConvertTo-Json";
        const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], options);
        const values = JSON.parse(stdout);
        for (const value of Array.isArray(values) ? values : [values]) if (typeof value === "string") names.add(value.replace(/\s*\((TrueType|OpenType)\)$/, ""));
      } else {
        const { stdout } = await execute("fc-list", ["--format=%{family}\n"], options);
        for (const family of stdout.split(/[\n,]/)) if (family.trim()) names.add(family.trim());
      }
    } catch { /* Only known app/system fallback families are accepted if discovery fails. */ }
    return names;
  }
}
