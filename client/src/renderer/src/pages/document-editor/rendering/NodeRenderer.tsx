import { Fragment, type ReactNode } from "react";
import type { RichTextMark } from "../../../../../foundation/documentModel.ts";
import { MarkdownView } from "./MarkdownView.tsx";
import type { RenderTreeNode } from "./renderTree.ts";
import { safeHref } from "./safeHref.ts";
import { colorToCss, styleToCss } from "./styleToCss.ts";

export type RenderSelectionTarget = {
  renderId: string;
  nodeId: string;
  nodeType: RenderTreeNode["type"];
};

export function NodeRenderer({
  node,
  measure = false,
  selectedNodeId,
  selectableNodeIds,
  onSelect,
}: {
  node: RenderTreeNode;
  measure?: boolean;
  selectedNodeId?: string;
  selectableNodeIds?: ReadonlySet<string>;
  onSelect?: (target: RenderSelectionTarget) => void;
}) {
  if (!node.visible) return null;
  const isStructure = node.type === "container" || node.type === "component-instance" || node.type === "repeater";
  const style = styleToCss(node.style);
  const selectable = Boolean(onSelect && selectableNodeIds?.has(node.sourceNodeId));
  const select = selectable
    ? (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect?.({ renderId: node.renderId, nodeId: node.sourceNodeId, nodeType: node.type });
    }
    : undefined;
  const attributes = {
    className: `document-node document-node--${node.type}`,
    style: isStructure
      ? { display: "flex", flexDirection: "column" as const, ...style }
      : style,
    "data-document-render-id": node.renderId,
    "data-document-node-id": node.sourceNodeId,
    "data-document-node-type": node.type,
    "data-measure-id": measure ? node.renderId : undefined,
    "data-document-selected": selectedNodeId === node.sourceNodeId ? "true" : undefined,
    tabIndex: selectable ? 0 : undefined,
    role: selectable ? "button" : undefined,
    onClick: select,
    onKeyDown: selectable
      ? (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select?.(event);
      }
      : undefined,
  };

  if (node.type === "container") {
    return <div {...attributes}>{node.children.map((child) => <NodeRenderer key={child.renderId} node={child} measure={measure} selectedNodeId={selectedNodeId} selectableNodeIds={selectableNodeIds} onSelect={onSelect} />)}</div>;
  }
  if (node.type === "component-instance") {
    return <div {...attributes}><NodeRenderer node={node.child} measure={measure} selectedNodeId={selectedNodeId} selectableNodeIds={selectableNodeIds} onSelect={onSelect} /></div>;
  }
  if (node.type === "repeater") {
    return (
      <div {...attributes}>
        {node.items.map((item) => item.visible && (
          <div className="document-repeater-item" data-repeater-item-id={item.id} key={item.id}>
            <NodeRenderer node={item.child} measure={measure} selectedNodeId={selectedNodeId} selectableNodeIds={selectableNodeIds} onSelect={onSelect} />
          </div>
        ))}
      </div>
    );
  }
  if (node.type === "text") return <div {...attributes}>{node.value}</div>;
  if (node.type === "rich-text") {
    return (
      <div {...attributes}>
        {node.value.runs.map((run, index) => (
          <Fragment key={`${node.renderId}-run-${index}`}>
            {renderMarkedText(run.text, run.marks ?? [], `${node.renderId}-run-${index}`)}
          </Fragment>
        ))}
      </div>
    );
  }
  if (node.type === "markdown") return <div {...attributes}><MarkdownView source={node.source} /></div>;
  return (
    <div {...attributes}>
      {node.asset
        ? <img alt={node.alt} src={node.asset.dataUrl} />
        : <span className="document-image-placeholder" aria-label={node.alt || "Image"} />}
    </div>
  );
}

function renderMarkedText(text: string, marks: RichTextMark[], key: string): ReactNode {
  const byType = new Map(marks.map((mark) => [mark.type, mark]));
  let content: ReactNode = text;
  if (byType.has("bold")) content = <strong key={`${key}-bold`}>{content}</strong>;
  if (byType.has("italic")) content = <em key={`${key}-italic`}>{content}</em>;
  if (byType.has("underline")) content = <u key={`${key}-underline`}>{content}</u>;
  if (byType.has("strike")) content = <s key={`${key}-strike`}>{content}</s>;
  const color = byType.get("color");
  if (color?.type === "color") {
    content = <span key={`${key}-color`} style={{ color: colorToCss(color.color) }}>{content}</span>;
  }
  const link = byType.get("link");
  if (link?.type === "link") {
    const href = safeHref(link.href);
    content = href
      ? <a href={href} key={`${key}-link`} rel="noreferrer">{content}</a>
      : <span data-invalid-link={link.href} key={`${key}-invalid-link`}>{content}</span>;
  }
  return content;
}
