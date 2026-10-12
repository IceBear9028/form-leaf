import { Fragment, type ReactNode } from "react";
import type { RichTextMark } from "../../../../../foundation/documentModel.ts";
import type {
  DirectEditValue,
  DocumentEditTarget,
  TextRange,
} from "../../../../../foundation/documentEditing.ts";
import { EditableTextValue, type DirectTextSelection } from "./EditableTextValue.tsx";
import { EditableMarkdownValue } from "./EditableMarkdownValue.tsx";
import { MarkdownView } from "./MarkdownView.tsx";
import type { RenderTreeNode } from "./renderTree.ts";
import { safeHref } from "./safeHref.ts";
import { colorToCss, styleToCss } from "./styleToCss.ts";

export type RenderSelectionTarget = {
  renderId: string;
  nodeId: string;
  nodeType: RenderTreeNode["type"];
  repeaterItemId?: string;
};

export function NodeRenderer({
  node,
  measure = false,
  selectedNodeId,
  selectedRepeaterItem,
  selectableNodeIds,
  onSelect,
  onEditValueChange,
  onRichTextSelection,
  richTextSelection,
}: {
  node: RenderTreeNode;
  measure?: boolean;
  selectedNodeId?: string;
  selectedRepeaterItem?: { nodeId: string; itemId: string };
  selectableNodeIds?: ReadonlySet<string>;
  onSelect?: (target: RenderSelectionTarget) => void;
  onEditValueChange?: (target: DocumentEditTarget, value: DirectEditValue, selection: TextRange) => void;
  onRichTextSelection?: (selection?: DirectTextSelection) => void;
  richTextSelection?: DirectTextSelection;
}) {
  if (!node.visible) return null;
  const isStructure = node.type === "container" || node.type === "component-instance" || node.type === "repeater";
  const style = styleToCss(node.style);
  const selectable = Boolean(onSelect && selectableNodeIds?.has(node.sourceNodeId));
  const directlyEditable = Boolean(
    node.editTarget && onEditValueChange &&
    (node.type === "text" || node.type === "rich-text" || node.type === "markdown"),
  );
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
    "data-markdown-fragment-first": node.type === "markdown" && node.fragment ? String(node.fragment.first) : undefined,
    "data-markdown-fragment-last": node.type === "markdown" && node.fragment ? String(node.fragment.last) : undefined,
    "data-measure-id": measure ? node.renderId : undefined,
    "data-document-selected": selectedNodeId === node.sourceNodeId ? "true" : undefined,
    tabIndex: selectable && !directlyEditable ? 0 : undefined,
    role: selectable && !directlyEditable ? "button" : undefined,
    onClick: select,
    onKeyDown: selectable && !directlyEditable
      ? (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select?.(event);
      }
      : undefined,
  };

  if (node.type === "container") {
    return <div {...attributes}>{node.children.map((child) => <NodeRenderer key={child.renderId} node={child} measure={measure} selectedNodeId={selectedNodeId} selectedRepeaterItem={selectedRepeaterItem} selectableNodeIds={selectableNodeIds} onSelect={onSelect} onEditValueChange={onEditValueChange} onRichTextSelection={onRichTextSelection} richTextSelection={richTextSelection} />)}</div>;
  }
  if (node.type === "component-instance") {
    return <div {...attributes}><NodeRenderer node={node.child} measure={measure} selectedNodeId={selectedNodeId} selectedRepeaterItem={selectedRepeaterItem} selectableNodeIds={selectableNodeIds} onSelect={onSelect} onEditValueChange={onEditValueChange} onRichTextSelection={onRichTextSelection} richTextSelection={richTextSelection} /></div>;
  }
  if (node.type === "repeater") {
    return (
      <div {...attributes}>
        {node.items.map((item) => {
          if (!item.visible) return null;
          const itemSelectable = Boolean(selectable && onSelect);
          const selectItem = itemSelectable
            ? (event: { stopPropagation: () => void }) => {
              event.stopPropagation();
              onSelect?.({
                renderId: `${node.renderId}/item:${item.id}`,
                nodeId: node.sourceNodeId,
                nodeType: node.type,
                repeaterItemId: item.id,
              });
            }
            : undefined;
          return (
            <div
              className="document-repeater-item"
              data-repeater-item-id={item.id}
              data-document-selected={selectedRepeaterItem?.nodeId === node.sourceNodeId && selectedRepeaterItem.itemId === item.id ? "true" : undefined}
              key={item.id}
              tabIndex={itemSelectable ? 0 : undefined}
              role={itemSelectable ? "button" : undefined}
              onClick={selectItem}
              onKeyDown={itemSelectable
                ? (event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  selectItem?.(event);
                }
                : undefined}
            >
              <NodeRenderer node={item.child} measure={measure} selectedNodeId={selectedNodeId} selectedRepeaterItem={selectedRepeaterItem} selectableNodeIds={selectableNodeIds} onSelect={onSelect} onEditValueChange={onEditValueChange} onRichTextSelection={onRichTextSelection} richTextSelection={richTextSelection} />
            </div>
          );
        })}
      </div>
    );
  }
  if (node.type === "text") {
    return directlyEditable && node.editTarget && onEditValueChange
      ? <EditableTextValue hostProps={attributes} target={node.editTarget} value={node.value} onChange={onEditValueChange} />
      : <div {...attributes}>{node.value}</div>;
  }
  if (node.type === "rich-text") {
    if (directlyEditable && node.editTarget && onEditValueChange) {
      return (
        <EditableTextValue
          hostProps={attributes}
          target={node.editTarget}
          value={node.value}
          onChange={onEditValueChange}
          onRichTextSelection={onRichTextSelection}
          selectionToRestore={richTextSelection}
        />
      );
    }
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
  if (node.type === "markdown") {
    return directlyEditable && node.editTarget && onEditValueChange
      ? (
        <EditableMarkdownValue
          hostProps={attributes}
          target={node.editTarget}
          source={node.source}
          fragment={node.fragment}
          onChange={onEditValueChange}
        />
      )
      : <div {...attributes}><MarkdownView source={node.source} fragment={node.fragment} /></div>;
  }
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
