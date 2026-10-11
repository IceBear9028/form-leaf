import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { GripIcon } from "lucide-react";
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

type ReorderDrag = {
  kind: "reorder";
  nodeId: string;
  parentId: string;
  direction: "row" | "column";
  moved: boolean;
  startX: number;
  startY: number;
  insertionIndex?: number;
};

type PositionDrag = {
  kind: "position";
  nodeId: string;
  parentId: string;
  moved: boolean;
  startX: number;
  startY: number;
  startLeftPt: number;
  startTopPt: number;
  leftPt: number;
  topPt: number;
  initialRect: OverlayRect;
};

type DirectDrag = ReorderDrag | PositionDrag;

export function ComponentDirectManipulationOverlay({
  canvasRef,
  document,
  selection,
  componentRootNodeId,
  onChange,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  document: DocumentData;
  selection?: DocumentSelection;
  componentRootNodeId: string;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const dragRef = useRef<DirectDrag | undefined>(undefined);
  const [selectionRect, setSelectionRect] = useState<OverlayRect>();
  const [dragRect, setDragRect] = useState<OverlayRect>();
  const [dropIndicator, setDropIndicator] = useState<OverlayRect>();
  const nodeId = selection?.nodeId;
  const parentId = nodeId ? findNodeParentId(document, nodeId) : undefined;
  const node = nodeId ? document.nodes[nodeId] : undefined;
  const style = node?.styleId ? document.styles[node.styleId] : undefined;
  const freelyPositioned = style?.layout?.position === "absolute";
  const movable = Boolean(nodeId && nodeId !== componentRootNodeId && parentId);

  const updateSelectionRect = useCallback(() => {
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
    updateSelectionRect();
    const canvas = canvasRef.current;
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
    globalThis.document.body.style.userSelect = "";
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!movable || !nodeId || !parentId || !selectionRect) return;
    const canvas = canvasRef.current;
    const parent = document.nodes[parentId];
    if (!canvas || parent?.type !== "container") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (freelyPositioned) {
      const parentElement = findNodeElement(canvas, parentId);
      const parentRect = parentElement?.getBoundingClientRect();
      const selectedElement = findNodeElement(canvas, nodeId);
      const selectedBounds = selectedElement?.getBoundingClientRect();
      if (!parentRect || !selectedBounds) return;
      globalThis.document.body.style.userSelect = "none";
      const startLeftPt = style?.layout?.leftPt ?? pixelsToPoints(selectedBounds.left - parentRect.left);
      const startTopPt = style?.layout?.topPt ?? pixelsToPoints(selectedBounds.top - parentRect.top);
      dragRef.current = {
        kind: "position",
        nodeId,
        parentId,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        startLeftPt,
        startTopPt,
        leftPt: startLeftPt,
        topPt: startTopPt,
        initialRect: selectionRect,
      };
      setDragRect(selectionRect);
      return;
    }

    const parentStyle = parent.styleId ? document.styles[parent.styleId] : undefined;
    globalThis.document.body.style.userSelect = "none";
    dragRef.current = {
      kind: "reorder",
      nodeId,
      parentId,
      direction: parentStyle?.layout?.direction ?? "column",
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    event.preventDefault();

    if (drag.kind === "position") {
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      drag.moved ||= Math.hypot(deltaX, deltaY) >= 3;
      drag.leftPt = roundLayoutPoint(drag.startLeftPt + pixelsToPoints(deltaX));
      drag.topPt = roundLayoutPoint(drag.startTopPt + pixelsToPoints(deltaY));
      setDragRect({
        ...drag.initialRect,
        left: drag.initialRect.left + deltaX,
        top: drag.initialRect.top + deltaY,
      });
      return;
    }

    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 3;
    if (!drag.moved) return;
    const parentElement = findNodeElement(canvas, drag.parentId);
    const parent = document.nodes[drag.parentId];
    if (!parentElement || parent?.type !== "container") return;
    const siblings = directChildNodeElements(parentElement)
      .filter((element) => {
        const siblingId = element.dataset.documentNodeId;
        if (!siblingId || siblingId === drag.nodeId) return false;
        const sibling = document.nodes[siblingId];
        const siblingStyle = sibling?.styleId ? document.styles[sibling.styleId] : undefined;
        return siblingStyle?.layout?.position !== "absolute";
      });
    const pointer = drag.direction === "row" ? event.clientX : event.clientY;
    const bounds = siblings.map((element) => element.getBoundingClientRect());
    const position = autoLayoutDropPosition(pointer, bounds.map((rect) => ({
      start: drag.direction === "row" ? rect.left : rect.top,
      end: drag.direction === "row" ? rect.right : rect.bottom,
    })));
    const siblingIds = siblings.map((element) => element.dataset.documentNodeId!).filter(Boolean);
    drag.insertionIndex = childInsertionIndex(parent.childIds, drag.nodeId, siblingIds, position);
    setDropIndicator(dropIndicatorRect(canvas, parentElement, bounds, position, drag.direction));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = undefined;
    globalThis.document.body.style.userSelect = "";
    setDragRect(undefined);
    setDropIndicator(undefined);
    if (!drag.moved || event.type === "pointercancel") return;

    if (drag.kind === "reorder" && drag.insertionIndex !== undefined) {
      onChange((current) => moveNode(current, drag.nodeId, drag.parentId, drag.insertionIndex));
      return;
    }
    if (drag.kind === "position") {
      onChange((current) => {
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
  };

  if (!selectionRect) return null;
  const visibleRect = dragRect ?? selectionRect;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {dragRect && (
        <div
          className="absolute border-2 border-dashed border-[#1768e5] bg-[#1768e5]/5"
          style={visibleRect}
        />
      )}
      {dropIndicator && (
        <div className="absolute rounded-full bg-[#1768e5] shadow-[0_0_0_1px_white]" style={dropIndicator} />
      )}
      {movable && (
        <button
          type="button"
          className="pointer-events-auto absolute flex h-5 -translate-x-1/2 -translate-y-full touch-none items-center gap-1 rounded-t bg-[#1768e5] px-1.5 text-[9px] font-medium text-white shadow-sm active:cursor-grabbing"
          style={{ left: visibleRect.left + visibleRect.width / 2, top: visibleRect.top }}
          aria-label={freelyPositioned ? "드래그해 위치 변경" : "드래그해 Auto Layout 순서 변경"}
          title={freelyPositioned ? "드래그해 위치 변경" : "드래그해 Auto Layout 순서 변경"}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <GripIcon className="size-3" />
          {freelyPositioned ? "위치" : "Auto"}
        </button>
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
