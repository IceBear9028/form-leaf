import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import { findNodeParentId, moveNode, updateNodeStyle } from "../../../../foundation/documentTransactions.ts";
import type { DocumentSelection } from "./documentSelection.ts";
import type { GenericDocumentChange } from "./useGenericDocumentSession.ts";
import {
  autoLayoutDropPosition,
  childInsertionIndex,
  pixelsToPoints,
  roundLayoutPoint,
} from "./componentDirectManipulation.ts";

type OverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DragBase = {
  nodeId: string;
  parentId: string;
  moved: boolean;
  settling: boolean;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  initialOverlayRect: OverlayRect;
  initialViewportRect: DOMRect;
  ghost: HTMLElement;
  cleanupListeners: () => void;
};

type ReorderDrag = DragBase & {
  kind: "reorder";
  direction: "row" | "column";
  originalIndex: number;
  pendingOrder?: string;
};

type PositionDrag = DragBase & {
  kind: "position";
  startLeftPt: number;
  startTopPt: number;
  leftPt: number;
  topPt: number;
};

type DirectDrag = ReorderDrag | PositionDrag;

export function ComponentDirectManipulationOverlay({
  canvasRef,
  document,
  selection,
  componentRootNodeId,
  onSelectionChange,
  onChange,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  document: DocumentData;
  selection?: DocumentSelection;
  componentRootNodeId: string;
  onSelectionChange: (nodeId: string) => void;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const documentRef = useRef(document);
  const onChangeRef = useRef(onChange);
  const dragRef = useRef<DirectDrag | undefined>(undefined);
  const flipRectsRef = useRef<Map<string, DOMRect> | undefined>(undefined);
  const [selectionRect, setSelectionRect] = useState<OverlayRect>();
  const [dragRect, setDragRect] = useState<OverlayRect>();
  const [dropIndicator, setDropIndicator] = useState<OverlayRect>();
  const [dragging, setDragging] = useState(false);
  documentRef.current = document;
  onChangeRef.current = onChange;

  const nodeId = selection?.nodeId;
  const parentId = nodeId ? findNodeParentId(document, nodeId) : undefined;
  const node = nodeId ? document.nodes[nodeId] : undefined;
  const style = node?.styleId ? document.styles[node.styleId] : undefined;
  const freelyPositioned = style?.layout?.position === "absolute";
  const movable = Boolean(nodeId && nodeId !== componentRootNodeId && parentId);

  const updateSelectionRect = useCallback(() => {
    if (dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas || !nodeId) {
      setSelectionRect(undefined);
      return;
    }
    const element = findNodeElement(canvas, nodeId);
    if (!element) {
      setSelectionRect(undefined);
      return;
    }
    setSelectionRect(relativeRect(element.getBoundingClientRect(), canvas.getBoundingClientRect()));
  }, [canvasRef, nodeId]);

  useLayoutEffect(() => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (drag && canvas) {
      const source = findNodeElement(canvas, drag.nodeId);
      if (source) source.style.visibility = "hidden";
      animateLayoutChanges(canvas, flipRectsRef.current);
      flipRectsRef.current = undefined;
      return;
    }

    updateSelectionRect();
    if (!canvas) return;
    const observer = new ResizeObserver(updateSelectionRect);
    observer.observe(canvas);
    const selected = nodeId ? findNodeElement(canvas, nodeId) : undefined;
    if (selected) observer.observe(selected);
    window.addEventListener("resize", updateSelectionRect);
    window.addEventListener("scroll", updateSelectionRect, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSelectionRect);
      window.removeEventListener("scroll", updateSelectionRect, true);
    };
  }, [canvasRef, document, nodeId, updateSelectionRect]);

  useLayoutEffect(() => () => {
    const drag = dragRef.current;
    drag?.cleanupListeners();
    drag?.ghost.remove();
    globalThis.document.body.style.userSelect = "";
  }, []);

  const moveDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.settling || !canvas) return;
    event.preventDefault();
    drag.deltaX = event.clientX - drag.startX;
    drag.deltaY = event.clientY - drag.startY;
    drag.moved ||= Math.hypot(drag.deltaX, drag.deltaY) >= 3;
    if (!drag.moved) return;

    drag.ghost.style.transform = `translate3d(${drag.deltaX}px, ${drag.deltaY}px, 0)`;
    setDragRect({
      ...drag.initialOverlayRect,
      left: drag.initialOverlayRect.left + drag.deltaX,
      top: drag.initialOverlayRect.top + drag.deltaY,
    });

    if (drag.kind === "position") {
      drag.leftPt = roundLayoutPoint(drag.startLeftPt + pixelsToPoints(drag.deltaX));
      drag.topPt = roundLayoutPoint(drag.startTopPt + pixelsToPoints(drag.deltaY));
      return;
    }

    const currentDocument = documentRef.current;
    const parentElement = findNodeElement(canvas, drag.parentId);
    const parent = currentDocument.nodes[drag.parentId];
    if (!parentElement || parent?.type !== "container") return;
    const siblings = flowSiblingElements(parentElement, drag.nodeId, currentDocument);
    const pointer = drag.direction === "row" ? event.clientX : event.clientY;
    const bounds = siblings.map((element) => element.getBoundingClientRect());
    const position = autoLayoutDropPosition(pointer, bounds.map((rect) => ({
      start: drag.direction === "row" ? rect.left : rect.top,
      end: drag.direction === "row" ? rect.right : rect.bottom,
    })));
    const siblingIds = siblings.map((element) => element.dataset.documentNodeId!).filter(Boolean);
    const insertionIndex = childInsertionIndex(parent.childIds, drag.nodeId, siblingIds, position);
    setDropIndicator(dropIndicatorRect(canvas, parentElement, bounds, position, drag.direction));

    const desiredOrder = [...parent.childIds];
    desiredOrder.splice(desiredOrder.indexOf(drag.nodeId), 1);
    desiredOrder.splice(insertionIndex, 0, drag.nodeId);
    const orderKey = desiredOrder.join("\u0000");
    if (orderKey === parent.childIds.join("\u0000") || orderKey === drag.pendingOrder) return;
    drag.pendingOrder = orderKey;
    flipRectsRef.current = captureChildRects(parentElement, drag.nodeId);
    onChangeRef.current((current) => moveNode(current, drag.nodeId, drag.parentId, insertionIndex));
  };

  const finishDrag = (event: PointerEvent, canceled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.settling) return;
    event.preventDefault();
    drag.cleanupListeners();
    globalThis.document.body.style.userSelect = "";
    setDropIndicator(undefined);

    if (!drag.moved) {
      cleanupDrag(drag);
      return;
    }

    drag.settling = true;
    if (drag.kind === "reorder" && canceled) {
      onChangeRef.current((current) => moveNode(current, drag.nodeId, drag.parentId, drag.originalIndex));
    }
    if (drag.kind === "position" && !canceled) {
      onChangeRef.current((current) => {
        const parentNode = current.nodes[drag.parentId];
        const parentStyle = parentNode.styleId ? current.styles[parentNode.styleId] : undefined;
        let next = current;
        if (!parentStyle?.layout?.position) {
          next = updateNodeStyle(next, drag.parentId, (currentStyle) => ({
            ...currentStyle,
            layout: { ...currentStyle.layout, position: "relative" },
          }));
        }
        return updateNodeStyle(next, drag.nodeId, (currentStyle) => {
          const layout = {
            ...currentStyle.layout,
            position: "absolute" as const,
            leftPt: drag.leftPt,
            topPt: drag.topPt,
          };
          delete layout.rightPt;
          delete layout.bottomPt;
          return { ...currentStyle, layout };
        });
      });
    }
    settleDrag(drag, canceled);
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!movable || !nodeId || !parentId || !selectionRect || dragRef.current) return;
    const canvas = canvasRef.current;
    const currentDocument = documentRef.current;
    const parent = currentDocument.nodes[parentId];
    const source = canvas ? findNodeElement(canvas, nodeId) : undefined;
    const parentElement = canvas ? findNodeElement(canvas, parentId) : undefined;
    if (!canvas || !source || !parentElement || parent?.type !== "container") return;
    event.preventDefault();
    event.stopPropagation();

    const sourceRect = source.getBoundingClientRect();
    const ghost = createDragGhost(source, sourceRect);
    const onMove = (pointerEvent: PointerEvent) => moveDrag(pointerEvent);
    const onUp = (pointerEvent: PointerEvent) => finishDrag(pointerEvent);
    const onCancel = (pointerEvent: PointerEvent) => finishDrag(pointerEvent, true);
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== "Escape") return;
      keyboardEvent.preventDefault();
      finishDrag(new PointerEvent("pointercancel"), true);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onCancel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    const cleanupListeners = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKeyDown);
    };
    source.style.visibility = "hidden";
    globalThis.document.body.style.userSelect = "none";

    const base = {
      nodeId,
      parentId,
      moved: false,
      settling: false,
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      initialOverlayRect: selectionRect,
      initialViewportRect: sourceRect,
      ghost,
      cleanupListeners,
    };
    if (freelyPositioned) {
      const parentRect = parentElement.getBoundingClientRect();
      const startLeftPt = style?.layout?.leftPt ?? pixelsToPoints(sourceRect.left - parentRect.left);
      const startTopPt = style?.layout?.topPt ?? pixelsToPoints(sourceRect.top - parentRect.top);
      dragRef.current = {
        ...base,
        kind: "position",
        startLeftPt,
        startTopPt,
        leftPt: startLeftPt,
        topPt: startTopPt,
      };
    } else {
      const parentStyle = parent.styleId ? currentDocument.styles[parent.styleId] : undefined;
      dragRef.current = {
        ...base,
        kind: "reorder",
        direction: parentStyle?.layout?.direction ?? "column",
        originalIndex: parent.childIds.indexOf(nodeId),
      };
    }
    setDragging(true);
    setDragRect(selectionRect);
  };

  const selectNestedNode = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!nodeId || dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const nested = globalThis.document.elementsFromPoint(event.clientX, event.clientY)
      .find((element): element is HTMLElement => (
        element instanceof HTMLElement &&
        Boolean(element.dataset.documentNodeId) &&
        element.dataset.documentNodeId !== nodeId &&
        canvas.contains(element)
      ));
    if (nested?.dataset.documentNodeId) onSelectionChange(nested.dataset.documentNodeId);
  };

  const cleanupDrag = (drag: DirectDrag) => {
    const canvas = canvasRef.current;
    const source = canvas ? findNodeElement(canvas, drag.nodeId) : undefined;
    if (source) source.style.visibility = "";
    drag.ghost.remove();
    if (dragRef.current === drag) dragRef.current = undefined;
    setDragging(false);
    setDragRect(undefined);
    setDropIndicator(undefined);
    requestAnimationFrame(updateSelectionRect);
  };

  const settleDrag = (drag: DirectDrag, canceled: boolean) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const source = canvas ? findNodeElement(canvas, drag.nodeId) : undefined;
      const finalRect = source?.getBoundingClientRect();
      if (!finalRect || canceled && !drag.moved) {
        cleanupDrag(drag);
        return;
      }
      const finalX = finalRect.left - drag.initialViewportRect.left;
      const finalY = finalRect.top - drag.initialViewportRect.top;
      const animation = drag.ghost.animate([
        { transform: `translate3d(${drag.deltaX}px, ${drag.deltaY}px, 0)` },
        { transform: `translate3d(${finalX}px, ${finalY}px, 0)` },
      ], {
        duration: 160,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "forwards",
      });
      void animation.finished.catch(() => undefined).finally(() => cleanupDrag(drag));
    }));
  };

  if (!selectionRect) return null;
  const visibleRect = dragRect ?? selectionRect;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {dropIndicator && (
        <div className="absolute rounded-full bg-[#1768e5] shadow-[0_0_0_1px_white]" style={dropIndicator} />
      )}
      {movable && (
        <button
          type="button"
          data-component-drag-handle
          className={`pointer-events-auto absolute touch-none border-0 bg-transparent p-0 outline-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={visibleRect}
          aria-label={freelyPositioned ? "선택 영역을 드래그해 위치 변경" : "선택 영역을 드래그해 Auto Layout 순서 변경"}
          title="드래그해 이동 · 더블클릭해 내부 요소 선택"
          onPointerDown={startDrag}
          onDoubleClick={selectNestedNode}
        />
      )}
    </div>
  );
}

function findNodeElement(canvas: HTMLElement, nodeId: string): HTMLElement | undefined {
  return [...canvas.querySelectorAll<HTMLElement>("[data-document-node-id]")]
    .find((element) => element.dataset.documentNodeId === nodeId);
}

function directChildNodeElements(parent: HTMLElement): HTMLElement[] {
  return [...parent.children].filter((element): element is HTMLElement => (
    element instanceof HTMLElement && Boolean(element.dataset.documentNodeId)
  ));
}

function flowSiblingElements(
  parent: HTMLElement,
  draggedNodeId: string,
  document: DocumentData,
): HTMLElement[] {
  return directChildNodeElements(parent).filter((element) => {
    const siblingId = element.dataset.documentNodeId;
    if (!siblingId || siblingId === draggedNodeId) return false;
    const sibling = document.nodes[siblingId];
    const siblingStyle = sibling?.styleId ? document.styles[sibling.styleId] : undefined;
    return siblingStyle?.layout?.position !== "absolute";
  });
}

function captureChildRects(parent: HTMLElement, draggedNodeId: string): Map<string, DOMRect> {
  return new Map(directChildNodeElements(parent).flatMap((element) => {
    const nodeId = element.dataset.documentNodeId;
    return nodeId && nodeId !== draggedNodeId ? [[nodeId, element.getBoundingClientRect()] as const] : [];
  }));
}

function animateLayoutChanges(canvas: HTMLElement, previous?: Map<string, DOMRect>): void {
  if (!previous) return;
  previous.forEach((before, nodeId) => {
    const element = findNodeElement(canvas, nodeId);
    if (!element) return;
    const after = element.getBoundingClientRect();
    const deltaX = before.left - after.left;
    const deltaY = before.top - after.top;
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;
    element.animate([
      { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
      { transform: "translate3d(0, 0, 0)" },
    ], {
      duration: 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
  });
}

function createDragGhost(source: HTMLElement, rect: DOMRect): HTMLElement {
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("data-document-selected");
  ghost.setAttribute("data-component-drag-ghost", "true");
  const computed = getComputedStyle(source);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (property.startsWith("--")) ghost.style.setProperty(property, computed.getPropertyValue(property));
  }
  Object.assign(ghost.style, {
    position: "fixed",
    zIndex: "10000",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    right: "auto",
    bottom: "auto",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    transform: "translate3d(0, 0, 0)",
    transformOrigin: "top left",
    pointerEvents: "none",
    visibility: "visible",
    opacity: "0.92",
    outline: "2px solid #1768e5",
    outlineOffset: "2px",
    boxShadow: "0 10px 24px rgb(23 104 229 / 18%)",
  });
  globalThis.document.body.append(ghost);
  return ghost;
}

function relativeRect(rect: DOMRect, canvasRect: DOMRect): OverlayRect {
  return {
    left: rect.left - canvasRect.left,
    top: rect.top - canvasRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function dropIndicatorRect(
  canvas: HTMLElement,
  parent: HTMLElement,
  siblingRects: DOMRect[],
  position: number,
  direction: "row" | "column",
): OverlayRect {
  const canvasRect = canvas.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const reference = siblingRects[position] ?? siblingRects.at(-1);
  if (direction === "row") {
    const x = reference
      ? position < siblingRects.length ? reference.left : reference.right
      : parentRect.left;
    return {
      left: x - canvasRect.left - 1,
      top: parentRect.top - canvasRect.top,
      width: 2,
      height: Math.max(parentRect.height, 8),
    };
  }
  const y = reference
    ? position < siblingRects.length ? reference.top : reference.bottom
    : parentRect.top;
  return {
    left: parentRect.left - canvasRect.left,
    top: y - canvasRect.top - 1,
    width: Math.max(parentRect.width, 8),
    height: 2,
  };
}
