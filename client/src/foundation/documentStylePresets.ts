import type { StyleDefinition } from "./documentModel.ts";

export type DocumentStylePresetId = "regular" | "compact";

export type DocumentStylePreset = {
  id: DocumentStylePresetId;
  name: string;
  style: Omit<StyleDefinition, "id" | "name">;
};

const documentFont = 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const DEFAULT_DOCUMENT_STYLE_PRESET_ID: DocumentStylePresetId = "regular";

export const DOCUMENT_STYLE_PRESETS: readonly DocumentStylePreset[] = [
  {
    id: "regular",
    name: "일반",
    style: {
      layout: {
        direction: "column",
        gapPt: 8,
        align: "stretch",
        width: { mode: "fill" },
      },
      typography: {
        fontFamily: documentFont,
        fontSizePt: 8,
        lineHeight: 1.57,
        fontWeight: 400,
        color: { kind: "hex", value: "#000000" },
      },
    },
  },
  {
    id: "compact",
    name: "조밀",
    style: {
      layout: {
        direction: "column",
        gapPt: 5.5,
        align: "stretch",
        width: { mode: "fill" },
      },
      typography: {
        fontFamily: documentFont,
        fontSizePt: 7.5,
        lineHeight: 1.5,
        fontWeight: 400,
        color: { kind: "hex", value: "#000000" },
      },
    },
  },
];

export function createDocumentStyleFromPreset(
  presetId: DocumentStylePresetId,
  styleId: string,
): StyleDefinition {
  const preset = requireDocumentStylePreset(presetId);
  return {
    id: styleId,
    name: preset.name,
    ...structuredClone(preset.style),
  };
}

export function applyDocumentStylePreset(
  style: StyleDefinition,
  presetId: DocumentStylePresetId,
): StyleDefinition {
  return createDocumentStyleFromPreset(presetId, style.id);
}

export function matchesDocumentStylePreset(
  style: StyleDefinition | undefined,
  presetId: DocumentStylePresetId,
): boolean {
  if (!style) return false;
  const candidate = createDocumentStyleFromPreset(presetId, style.id);
  return JSON.stringify(style) === JSON.stringify(candidate);
}

function requireDocumentStylePreset(presetId: DocumentStylePresetId): DocumentStylePreset {
  const preset = DOCUMENT_STYLE_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) throw new Error(`지원하지 않는 문서 스타일 preset입니다: ${presetId}`);
  return preset;
}
