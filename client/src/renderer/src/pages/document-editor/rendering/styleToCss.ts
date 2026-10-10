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
    if (layout.gapPt !== undefined) {
      css.gap = `${layout.gapPt}pt`;
      setCssVariable(css, "--markdown-block-gap", `${layout.gapPt}pt`);
    }
    if (layout.paddingPt) {
      css.padding = layout.paddingPt.map((value) => `${value}pt`).join(" ");
    }
    if (layout.align) css.alignItems = layout.align === "start" ? "flex-start" : layout.align === "end" ? "flex-end" : layout.align;
    if (layout.justify) {
      css.justifyContent = layout.justify === "start"
        ? "flex-start"
        : layout.justify === "end"
          ? "flex-end"
          : layout.justify === "between"
            ? "space-between"
            : layout.justify;
    }
    if (layout.width?.mode === "auto") css.width = "auto";
    if (layout.width?.mode === "fill") css.width = "100%";
    if (layout.width?.mode === "fixed") {
      css.width = `${layout.width.valuePt}pt`;
      css.flexShrink = 0;
    }
    if (layout.heightPt !== undefined) css.height = `${layout.heightPt}pt`;
    if (layout.grow !== undefined) {
      css.flexGrow = layout.grow;
      css.flexBasis = 0;
      css.minWidth = 0;
    }
  }
  const typography = style.typography;
  if (typography) {
    if (typography.fontFamily) {
      css.fontFamily = typography.fontFamily;
      setCssVariable(css, "--markdown-font-family", typography.fontFamily);
    }
    if (typography.fontSizePt !== undefined) {
      const size = typography.fontSizePt;
      css.fontSize = `${size}pt`;
      setCssVariable(css, "--markdown-body-size", `${size}pt`);
      setCssVariable(css, "--markdown-lead-size", `${size}pt`);
      setCssVariable(css, "--markdown-list-size", `${size}pt`);
      setCssVariable(css, "--markdown-code-size", `${size * 0.925}pt`);
      setCssVariable(css, "--markdown-table-size", `${size * 0.925}pt`);
      setCssVariable(css, "--markdown-h1-size", `${size * 2}pt`);
      setCssVariable(css, "--markdown-h2-size", `${size * 1.5}pt`);
      setCssVariable(css, "--markdown-h3-size", `${size * 1.25}pt`);
      setCssVariable(css, "--markdown-h4-size", `${size}pt`);
      setCssVariable(css, "--markdown-h5-size", `${size * 0.88}pt`);
      setCssVariable(css, "--markdown-h6-size", `${size * 0.8533}pt`);
    }
    if (typography.lineHeight !== undefined) {
      css.lineHeight = typography.lineHeight;
      setCssVariable(css, "--markdown-body-line-height", String(typography.lineHeight));
      setCssVariable(css, "--markdown-lead-line-height", String(typography.lineHeight));
      setCssVariable(css, "--markdown-list-line-height", String(typography.lineHeight));
    }
    if (typography.fontWeight !== undefined) css.fontWeight = typography.fontWeight;
    if (typography.color) {
      const color = colorToCss(typography.color);
      css.color = color;
      setCssVariable(css, "--markdown-text", color);
    }
  }
  const decoration = style.decoration;
  if (decoration) {
    if (decoration.background) css.backgroundColor = colorToCss(decoration.background);
    if (decoration.borderColor) css.borderColor = colorToCss(decoration.borderColor);
    if (decoration.borderWidthPt !== undefined) {
      css.borderStyle = "solid";
      if (decoration.borderEdges?.length) {
        css.borderWidth = 0;
        decoration.borderEdges.forEach((edge) => {
          const property = `border${edge[0].toUpperCase()}${edge.slice(1)}Width` as keyof CSSProperties;
          (css as Record<string, string | number | undefined>)[property] = `${decoration.borderWidthPt}pt`;
        });
      } else {
        css.borderWidth = `${decoration.borderWidthPt}pt`;
      }
    }
    if (decoration.radiusPt !== undefined) css.borderRadius = `${decoration.radiusPt}pt`;
  }
  if (style.pagination?.keepTogether) css.breakInside = "avoid";
  if (style.pagination?.forcePageBreakBefore) css.breakBefore = "page";
  return css;
}

function setCssVariable(css: CSSProperties, name: `--${string}`, value: string): void {
  (css as Record<string, string | number | undefined>)[name] = value;
}

export function colorToCss(color: ColorValue): string {
  if (color.kind === "hex") return color.value;
  return `var(--document-color-${color.token.replaceAll(".", "-")})`;
}
