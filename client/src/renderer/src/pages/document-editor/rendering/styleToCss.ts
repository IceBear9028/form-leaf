import type { CSSProperties } from "react";
import type { ColorValue, StyleDefinition } from "../../../../../foundation/documentModel.ts";

export function styleToCss(style?: StyleDefinition): CSSProperties | undefined {
  if (!style) return undefined;
  const css: CSSProperties = {};
  const layout = style.layout;
  if (layout) {
    if (layout.direction) {
      css.display = "flex";
      css.flexDirection = layout.direction;
    }
    if (layout.gapPt !== undefined) css.gap = `${layout.gapPt}pt`;
    if (layout.paddingPt) {
      css.padding = layout.paddingPt.map((value) => `${value}pt`).join(" ");
    }
    if (layout.align) css.alignItems = layout.align === "start" ? "flex-start" : layout.align === "end" ? "flex-end" : layout.align;
    if (layout.width?.mode === "auto") css.width = "auto";
    if (layout.width?.mode === "fill") css.width = "100%";
    if (layout.width?.mode === "fixed") css.width = `${layout.width.valuePt}pt`;
  }
  const typography = style.typography;
  if (typography) {
    if (typography.fontFamily) css.fontFamily = typography.fontFamily;
    if (typography.fontSizePt !== undefined) css.fontSize = `${typography.fontSizePt}pt`;
    if (typography.lineHeight !== undefined) css.lineHeight = typography.lineHeight;
    if (typography.fontWeight !== undefined) css.fontWeight = typography.fontWeight;
    if (typography.color) css.color = colorToCss(typography.color);
  }
  const decoration = style.decoration;
  if (decoration) {
    if (decoration.background) css.backgroundColor = colorToCss(decoration.background);
    if (decoration.borderColor) css.borderColor = colorToCss(decoration.borderColor);
    if (decoration.borderWidthPt !== undefined) {
      css.borderStyle = "solid";
      css.borderWidth = `${decoration.borderWidthPt}pt`;
    }
    if (decoration.radiusPt !== undefined) css.borderRadius = `${decoration.radiusPt}pt`;
  }
  if (style.pagination?.keepTogether) css.breakInside = "avoid";
  if (style.pagination?.forcePageBreakBefore) css.breakBefore = "page";
  return css;
}

export function colorToCss(color: ColorValue): string {
  if (color.kind === "hex") return color.value;
  return `var(--document-color-${color.token.replaceAll(".", "-")})`;
}
