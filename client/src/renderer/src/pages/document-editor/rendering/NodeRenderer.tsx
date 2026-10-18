import { Fragment, memo, type ReactNode } from "react";
import type { RichTextMark } from "../../../../../foundation/documentModel.ts";
import {
  documentEditTargetKey,
  type DirectEditValue,
  type DocumentEditTarget,
  type TextRange,
} from "../../../../../foundation/documentEditing.ts";
import { EditableTextValue, type DirectTextSelection } from "./EditableTextValue.tsx";
import { EditableMarkdownValue } from "./EditableMarkdownValue.tsx";
import { MarkdownView } from "./MarkdownView.tsx";
import type { RenderTreeNode } from "./renderTree.ts";
import { safeHref } from "./safeHref.ts";
import { colorToCss, styleToCss } from "./styleToCss.ts";
import {
  interactionEvent,
  interactionEventId,
  recordInteraction,
  snapshotEventTarget,
} from "../interactionDebug.ts";

export type RenderSelectionTarget = {
  renderId: string;
  nodeId: string;
  nodeType: RenderTreeNode["type"];
  repeaterItemId?: string;
  componentNodeId?: string;
};

export type RenderSelectionMode = "content" | "structure";

export type ActiveEditTarget = {
  targetKey: string;
  anchorRenderId: string;
};

type SelectionPointerEvent = {
  currentTarget: EventTarget | null;
  target: EventTarget | null;
  nativeEvent?: Event;
};

type NodeRendererProps = {
  node: RenderTreeNode;
  measure?: boolean;
  selectedNodeId?: string;
  selectedRepeaterItem?: { nodeId: string; itemId: string };
  selectableNodeIds?: ReadonlySet<string>;
  selectionMode?: RenderSelectionMode;
  onSelect?: (target: RenderSelectionTarget, event?: Event) => void;
  activeEditTarget?: ActiveEditTarget;
  onEditActivate?: (target: DocumentEditTarget, renderId: string, event?: Event) => void;
  onEditValueChange?: (target: DocumentEditTarget, value: DirectEditValue, selection: TextRange) => void;
  onRichTextSelection?: (selection?: DirectTextSelection) => void;
  richTextSelection?: DirectTextSelection;
};

export const NodeRenderer = memo(function NodeRenderer({
  node,
  measure = false,
  selectedNodeId,
  selectedRepeaterItem,
  selectableNodeIds,
  selectionMode = "content",
  onSelect,
  activeEditTarget,
  onEditActivate,
  onEditValueChange,
  onRichTextSelection,
  richTextSelection,
}: NodeRendererProps) {
  if (!node.visible) return null;
  const isStructure = node.type === "container" || node.type === "component-instance" || node.type === "repeater";
  const style = styleToCss(node.style);
  const measurementLayoutStyle = measure
    ? node.layoutRole === "fixed-overlay"
      ? { position: "static" as const, top: undefined, left: undefined }
      : node.layoutRole === "fixed-placeholder" && node.layoutFragmentIndex === 0
        ? { display: "none" as const }
        : undefined
    : undefined;
  const selectable = Boolean(onSelect && selectableNodeIds?.has(node.sourceNodeId));
  const directlyEditable = Boolean(
    node.editTarget && onEditValueChange &&
    (node.type === "text" || node.type === "rich-text" || node.type === "markdown"),
  );
  const editTargetKey = node.editTarget ? documentEditTargetKey(node.editTarget) : undefined;
  const editTargetActive = selectionMode === "content" && directlyEditable &&
    activeEditTarget?.targetKey === editTargetKey &&
    activeEditTarget?.anchorRenderId === node.renderId;
  const focusSelectionOwnerOnMouseDown = selectable && selectionMode === "content"
    ? (event: SelectionPointerEvent & {
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      if (resolveDirectEditTarget(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
      currentTarget?.focus({ preventScroll: true });
    }
    : undefined;
  const select = selectable
    ? (event: SelectionPointerEvent & { stopPropagation: () => void }) => {
      event.stopPropagation();
      const clickedNode = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-document-node-id]")
        : undefined;
      const directEditTarget = resolveDirectEditTarget(event);
      const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
      const nativeEvent = interactionEvent(event);
      if (selectionMode === "content" && directEditTarget) {
        recordInteraction("node-handler", {
          selectionMode,
          action: "preserve-direct-edit",
          eventId: interactionEventId(nativeEvent),
          eventType: nativeEvent?.type,
          handlerNodeId: node.sourceNodeId,
          handlerRenderId: node.renderId,
          handlerNodeType: node.type,
          target: snapshotEventTarget(event.target),
          currentTarget: snapshotEventTarget(event.currentTarget),
          closestDocumentNode: snapshotEventTarget(clickedNode),
          directEditTarget: snapshotEventTarget(directEditTarget),
        });
        return;
      }
      const focusTarget = selectionMode === "structure" || clickedNode?.dataset.documentEditTarget === "true"
        ? clickedNode
        : currentTarget;
      focusTarget?.focus({ preventScroll: true });
      const clickedNodeId = clickedNode?.dataset.documentNodeId;
      const selectionTarget: RenderSelectionTarget = {
        renderId: node.renderId,
        nodeId: node.sourceNodeId,
        nodeType: node.type,
        ...(selectionMode === "structure" && clickedNodeId && clickedNodeId !== node.sourceNodeId
          ? { componentNodeId: clickedNodeId }
          : {}),
      };
      recordInteraction("node-handler", {
        selectionMode,
        action: selectionMode === "structure" ? "select-structure" : "select-owner",
        eventId: interactionEventId(nativeEvent),
        eventType: nativeEvent?.type,
        handlerNodeId: node.sourceNodeId,
        handlerRenderId: node.renderId,
        handlerNodeType: node.type,
        target: snapshotEventTarget(event.target),
        currentTarget: snapshotEventTarget(event.currentTarget),
        closestDocumentNode: snapshotEventTarget(clickedNode),
        selectionTarget,
      });
      onSelect?.(selectionTarget, nativeEvent);
    }
    : undefined;
  const attributes = {
    className: `document-node document-node--${node.type}`,
    style: isStructure
      ? { display: "flex", flexDirection: "column" as const, ...style, ...measurementLayoutStyle }
      : { ...style, ...measurementLayoutStyle },
    "data-document-render-id": node.renderId,
    "data-document-node-id": node.sourceNodeId,
    "data-document-node-type": node.type,
    "data-markdown-fragment-first": node.type === "markdown" && node.fragment ? String(node.fragment.first) : undefined,
    "data-markdown-fragment-last": node.type === "markdown" && node.fragment ? String(node.fragment.last) : undefined,
    "data-measure-id": measure ? node.renderId : undefined,
    "data-document-selected": selectedNodeId === node.sourceNodeId ? "true" : undefined,
    "data-document-content-edit-target": selectionMode === "content" && directlyEditable ? "true" : undefined,
    "data-document-edit-target-key": selectionMode === "content" && directlyEditable ? editTargetKey : undefined,
    "data-document-edit-active": editTargetActive ? "true" : undefined,
    tabIndex: onSelect && !directlyEditable ? selectable ? 0 : -1 : undefined,
    role: selectable && !directlyEditable ? "button" : undefined,
    onMouseDown: focusSelectionOwnerOnMouseDown,
    onClick: select,
    onKeyDown: selectable && !directlyEditable
      ? (event: {
        currentTarget: EventTarget | null;
        key: string;
        preventDefault: () => void;
        stopPropagation: () => void;
        target: EventTarget | null;
      }) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select?.(event);
      }
      : undefined,
  };

  if (node.type === "container") {
    return <div {...attributes}>{node.children.map((child) => <NodeRenderer key={child.renderId} node={child} measure={measure} selectedNodeId={selectedNodeId} selectedRepeaterItem={selectedRepeaterItem} selectableNodeIds={selectableNodeIds} selectionMode={selectionMode} onSelect={onSelect} activeEditTarget={activeEditTarget} onEditActivate={onEditActivate} onEditValueChange={onEditValueChange} onRichTextSelection={onRichTextSelection} richTextSelection={richTextSelection} />)}</div>;
  }
  if (node.type === "component-instance") {
    return <div {...attributes}><NodeRenderer node={node.child} measure={measure} selectedNodeId={selectedNodeId} selectedRepeaterItem={selectedRepeaterItem} selectableNodeIds={selectableNodeIds} selectionMode={selectionMode} onSelect={onSelect} activeEditTarget={activeEditTarget} onEditActivate={onEditActivate} onEditValueChange={onEditValueChange} onRichTextSelection={onRichTextSelection} richTextSelection={richTextSelection} /></div>;
  }
  if (node.type === "repeater") {
    return (
      <div {...attributes}>
        {node.items.map((item) => {
          if (!item.visible) return null;
          const itemSelectable = Boolean(selectable && onSelect);
          const selectItem = itemSelectable
            ? (event: SelectionPointerEvent & { stopPropagation: () => void }) => {
              event.stopPropagation();
              const clickedNode = event.target instanceof Element
                ? event.target.closest<HTMLElement>("[data-document-node-id]")
                : undefined;
              const directEditTarget = resolveDirectEditTarget(event);
              const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
              const nativeEvent = interactionEvent(event);
              if (selectionMode === "content" && directEditTarget) {
                recordInteraction("node-handler", {
                  selectionMode,
                  action: "preserve-direct-edit",
                  eventId: interactionEventId(nativeEvent),
                  eventType: nativeEvent?.type,
                  handlerNodeId: node.sourceNodeId,
                  handlerRenderId: node.renderId,
                  handlerNodeType: node.type,
                  repeaterItemId: item.id,
                  target: snapshotEventTarget(event.target),
                  currentTarget: snapshotEventTarget(event.currentTarget),
                  closestDocumentNode: snapshotEventTarget(clickedNode),
                  directEditTarget: snapshotEventTarget(directEditTarget),
                });
                return;
              }
              const focusTarget = selectionMode === "structure" || clickedNode?.dataset.documentEditTarget === "true"
                ? clickedNode
                : currentTarget;
              focusTarget?.focus({ preventScroll: true });
              const componentNodeId = clickedNode?.dataset.documentNodeId;
              const selectionTarget: RenderSelectionTarget = {
                renderId: `${node.renderId}/item:${item.id}`,
                nodeId: node.sourceNodeId,
                nodeType: node.type,
                repeaterItemId: item.id,
                ...(selectionMode === "structure" && componentNodeId ? { componentNodeId } : {}),
              };
              recordInteraction("node-handler", {
                selectionMode,
                action: selectionMode === "structure" ? "select-structure" : "select-owner",
                eventId: interactionEventId(nativeEvent),
                eventType: nativeEvent?.type,
                handlerNodeId: node.sourceNodeId,
                handlerRenderId: node.renderId,
                handlerNodeType: node.type,
                repeaterItemId: item.id,
                target: snapshotEventTarget(event.target),
                currentTarget: snapshotEventTarget(event.currentTarget),
                closestDocumentNode: snapshotEventTarget(clickedNode),
                selectionTarget,
              });
              onSelect?.(selectionTarget, nativeEvent);
            }
            : undefined;
          return (
            <div
              className="document-repeater-item"
              data-repeater-node-id={node.sourceNodeId}
              data-repeater-item-id={item.id}
              data-document-selected={selectedRepeaterItem?.nodeId === node.sourceNodeId && selectedRepeaterItem.itemId === item.id ? "true" : undefined}
              key={item.id}
              tabIndex={itemSelectable ? 0 : undefined}
              role={itemSelectable ? "button" : undefined}
              onMouseDown={itemSelectable && selectionMode === "content"
                ? (event) => {
                  if (resolveDirectEditTarget(event)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.focus({ preventScroll: true });
                }
                : undefined}
              onClick={selectItem}
              onKeyDown={itemSelectable
                ? (event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  selectItem?.(event);
                }
                : undefined}
            >
              <NodeRenderer node={item.child} measure={measure} selectedNodeId={selectedNodeId} selectedRepeaterItem={selectedRepeaterItem} selectableNodeIds={selectableNodeIds} selectionMode={selectionMode} onSelect={onSelect} activeEditTarget={activeEditTarget} onEditActivate={onEditActivate} onEditValueChange={onEditValueChange} onRichTextSelection={onRichTextSelection} richTextSelection={richTextSelection} />
            </div>
          );
        })}
      </div>
    );
  }
  if (node.type === "text") {
    return directlyEditable && node.editTarget && onEditValueChange
      ? <EditableTextValue hostProps={attributes} target={node.editTarget} renderId={node.renderId} value={node.value} onActivateTarget={onEditActivate} onChange={onEditValueChange} />
      : <div {...attributes}>{node.value}</div>;
  }
  if (node.type === "rich-text") {
    if (directlyEditable && node.editTarget && onEditValueChange) {
      return (
        <EditableTextValue
          hostProps={attributes}
          target={node.editTarget}
          renderId={node.renderId}
          value={node.value}
          onActivateTarget={onEditActivate}
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
          renderId={node.renderId}
          source={node.source}
          fragment={node.fragment}
          onActivateTarget={onEditActivate}
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
}, sameNodeRendererProps);

function resolveDirectEditTarget(event: SelectionPointerEvent): HTMLElement | undefined {
  if (!(event.target instanceof Element)) return undefined;
  const directEditTarget = event.target.closest<HTMLElement>('[data-document-edit-target="true"]');
  if (!directEditTarget) return undefined;
  if (directEditTarget.matches('[contenteditable="true"]')) return directEditTarget;
  const editableSurface = event.target.closest<HTMLElement>('[contenteditable="true"]');
  return editableSurface && directEditTarget.contains(editableSurface)
    ? directEditTarget
    : undefined;
}

function sameNodeRendererProps(previous: NodeRendererProps, next: NodeRendererProps): boolean {
  if (
    previous.node !== next.node ||
    previous.measure !== next.measure ||
    previous.selectableNodeIds !== next.selectableNodeIds ||
    previous.selectionMode !== next.selectionMode ||
    previous.onSelect !== next.onSelect ||
    previous.onEditActivate !== next.onEditActivate ||
    previous.onEditValueChange !== next.onEditValueChange ||
    previous.onRichTextSelection !== next.onRichTextSelection
  ) return false;

  if (
    previous.activeEditTarget !== next.activeEditTarget &&
    (renderSubtreeContainsRenderId(previous.node, previous.activeEditTarget?.anchorRenderId) ||
      renderSubtreeContainsRenderId(next.node, next.activeEditTarget?.anchorRenderId))
  ) return false;

  if (
    previous.selectedNodeId !== next.selectedNodeId &&
    (renderSubtreeContains(previous.node, previous.selectedNodeId) ||
      renderSubtreeContains(next.node, next.selectedNodeId))
  ) return false;

  if (!sameRepeaterSelection(previous.selectedRepeaterItem, next.selectedRepeaterItem)) {
    const previousNodeId = previous.selectedRepeaterItem?.nodeId;
    const nextNodeId = next.selectedRepeaterItem?.nodeId;
    if (
      renderSubtreeContains(previous.node, previousNodeId) ||
      renderSubtreeContains(next.node, nextNodeId)
    ) return false;
  }

  if (previous.richTextSelection !== next.richTextSelection) {
    const previousNodeId = editTargetOwnerNodeId(previous.richTextSelection?.target);
    const nextNodeId = editTargetOwnerNodeId(next.richTextSelection?.target);
    if (
      renderSubtreeContains(previous.node, previousNodeId) ||
      renderSubtreeContains(next.node, nextNodeId)
    ) return false;
  }
  return true;
}

function renderSubtreeContains(node: RenderTreeNode, sourceNodeId: string | undefined): boolean {
  if (!sourceNodeId) return false;
  if (node.sourceNodeId === sourceNodeId) return true;
  if (node.type === "container") return node.children.some((child) => renderSubtreeContains(child, sourceNodeId));
  if (node.type === "component-instance") return renderSubtreeContains(node.child, sourceNodeId);
  if (node.type === "repeater") {
    return node.items.some((item) => renderSubtreeContains(item.child, sourceNodeId));
  }
  return false;
}

function renderSubtreeContainsRenderId(node: RenderTreeNode, renderId: string | undefined): boolean {
  if (!renderId) return false;
  if (node.renderId === renderId) return true;
  if (node.type === "container") return node.children.some((child) => renderSubtreeContainsRenderId(child, renderId));
  if (node.type === "component-instance") return renderSubtreeContainsRenderId(node.child, renderId);
  if (node.type === "repeater") {
    return node.items.some((item) => renderSubtreeContainsRenderId(item.child, renderId));
  }
  return false;
}

function sameRepeaterSelection(
  previous: NodeRendererProps["selectedRepeaterItem"],
  next: NodeRendererProps["selectedRepeaterItem"],
): boolean {
  return previous?.nodeId === next?.nodeId && previous?.itemId === next?.itemId;
}

function editTargetOwnerNodeId(target: DocumentEditTarget | undefined): string | undefined {
  if (!target) return undefined;
  if (target.kind === "node") return target.nodeId;
  if (target.kind === "component-prop") return target.instanceNodeId;
  return target.repeaterNodeId;
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
