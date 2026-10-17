import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DocumentData } from "../../../../../foundation/documentModel.ts";
import type { DocumentUpdate } from "../../../../../foundation/documentUpdates.ts";
import type { DirectEditValue, DocumentEditTarget, TextRange } from "../../../../../foundation/documentEditing.ts";
import { NodeRenderer, type RenderSelectionTarget } from "./NodeRenderer.tsx";
import type { DirectTextSelection } from "./EditableTextValue.tsx";
import {
  collectPaginationUnits,
  paginate,
  reconcileVisiblePages,
  reusePaginationUnits,
  samePaginatedPages,
  type PaginatedPage,
} from "./pagination.ts";
import { buildRenderTree, reuseRenderTree, type RenderContainerNode } from "./renderTree.ts";
import {
  buildRenderDependencyIndex,
  createRenderWorkPlan,
  resolveRenderScope,
} from "./update/renderPipeline.ts";
import "./document.css";

type Unit = ReturnType<typeof collectPaginationUnits>[number];

type PaginatedDocumentRendererProps = {
  document: DocumentData;
  documentUpdate?: DocumentUpdate;
  mode: "screen" | "print";
  selectedNodeId?: string;
  selectedRepeaterItem?: { nodeId: string; itemId: string };
  selectableNodeIds?: ReadonlySet<string>;
  onSelect?: (target: RenderSelectionTarget) => void;
  onEditValueChange?: (target: DocumentEditTarget, value: DirectEditValue, selection: TextRange) => void;
  onRichTextSelection?: (selection?: DirectTextSelection) => void;
  richTextSelection?: DirectTextSelection;
  zoom?: number;
  onLayoutReady?: (result: { pageCount: number }) => void;
};

export const PaginatedDocumentRenderer = memo(function PaginatedDocumentRenderer({
  document,
  documentUpdate,
  mode,
  selectedNodeId,
  selectedRepeaterItem,
  selectableNodeIds,
  onSelect,
  onEditValueChange,
  onRichTextSelection,
  richTextSelection,
  zoom = 1,
  onLayoutReady,
}: PaginatedDocumentRendererProps) {
  const previousTreeRef = useRef<ReturnType<typeof buildRenderTree> | undefined>(undefined);
  const previousUnitsRef = useRef<Unit[]>([]);
  const heightCacheRef = useRef(new Map<string, number>());
  const tree = useMemo(() => {
    const next = reuseRenderTree(previousTreeRef.current, buildRenderTree(document));
    previousTreeRef.current = next;
    return next;
  }, [document]);
  const root = requireContainer(tree);
  const units = useMemo(() => {
    const next = reusePaginationUnits(previousUnitsRef.current, collectPaginationUnits(tree));
    previousUnitsRef.current = next;
    return next;
  }, [tree]);
  const dependencyIndex = useMemo(() => buildRenderDependencyIndex(units), [units]);
  const renderWorkPlan = useMemo(() => createRenderWorkPlan(resolveRenderScope(
    documentUpdate,
    dependencyIndex,
    units.map((unit) => unit.id),
  )), [dependencyIndex, documentUpdate, units]);
  const [pages, setPages] = useState<PaginatedPage<Unit>[]>(() => [{
    id: "page-1",
    units,
    overflow: false,
  }]);
  const [layoutPass, setLayoutPass] = useState(0);
  const measureContentRef = useRef<HTMLDivElement>(null);
  const measureBoundsRef = useRef<{ width: number; height: number } | undefined>(undefined);

  useLayoutEffect(() => {
    setPages((current) => {
      const next = reconcileVisiblePages(current, units);
      return samePaginatedPages(current, next) ? current : next;
    });
  }, [units]);

  useLayoutEffect(() => {
    let canceled = false;
    const measure = (forceAll = false) => {
      if (canceled || !measureContentRef.current) return;
      const rootElement = measureContentRef.current.querySelector(
        ":scope > .document-renderer--measure > .document-node",
      );
      if (!(rootElement instanceof HTMLElement)) return;
      const elements = Array.from(rootElement.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement && Boolean(element.dataset.measureId),
      );
      if (elements.length !== units.length) return;
      if (units.length === 0) {
        setPages((current) => {
          const next: PaginatedPage<Unit>[] = [{ id: "page-1", units: [], overflow: false }];
          return samePaginatedPages(current, next) ? current : next;
        });
        setLayoutPass((current) => current + 1);
        return;
      }
      const activeUnitIds = new Set(units.map((unit) => unit.id));
      for (const unitId of heightCacheRef.current.keys()) {
        if (!activeUnitIds.has(unitId)) heightCacheRef.current.delete(unitId);
      }
      const measureIds = forceAll || renderWorkPlan.rebuildWholeTree || heightCacheRef.current.size === 0
        ? activeUnitIds
        : renderWorkPlan.measureUnitIdsAfterCommit;
      if (!measureIds.size && units.every((unit) => heightCacheRef.current.has(unit.id))) return;
      elements.forEach((element, index) => {
        const measureId = element.dataset.measureId!;
        if (!measureIds.has(measureId) && heightCacheRef.current.has(measureId)) return;
        const current = element.getBoundingClientRect();
        const next = elements[index + 1]?.getBoundingClientRect();
        heightCacheRef.current.set(measureId, next ? next.top - current.top : current.height);
      });
      if (units.some((unit) => !heightCacheRef.current.has(unit.id))) return;
      const rootStyle = getComputedStyle(rootElement);
      const verticalPadding = parseFloat(rootStyle.paddingTop) + parseFloat(rootStyle.paddingBottom);
      const measureBounds = measureContentRef.current.getBoundingClientRect();
      measureBoundsRef.current = { width: measureBounds.width, height: measureBounds.height };
      const capacity = Math.max(1, measureBounds.height - verticalPadding);
      setPages((current) => {
        const next = paginate(units, heightCacheRef.current, capacity);
        return samePaginatedPages(current, next) ? current : next;
      });
      setLayoutPass((current) => current + 1);
    };
    const scheduleAll = () => requestAnimationFrame(() => measure(true));
    const scheduleIfBoundsChanged = () => requestAnimationFrame(() => {
      const bounds = measureContentRef.current?.getBoundingClientRect();
      const previous = measureBoundsRef.current;
      if (!bounds || (previous?.width === bounds.width && previous.height === bounds.height)) return;
      measure(true);
    });
    const initialFrame = requestAnimationFrame(() => measure(false));
    if (globalThis.document.fonts.status !== "loaded") void documentFontsReady().then(scheduleAll);
    const observer = new ResizeObserver(scheduleIfBoundsChanged);
    if (measureContentRef.current) {
      observer.observe(measureContentRef.current);
    }
    window.addEventListener("resize", scheduleIfBoundsChanged);
    return () => {
      canceled = true;
      cancelAnimationFrame(initialFrame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleIfBoundsChanged);
    };
  }, [renderWorkPlan, units]);

  useLayoutEffect(() => {
    if (!layoutPass || !onLayoutReady) return;
    const frame = requestAnimationFrame(() => onLayoutReady({ pageCount: pages.length }));
    return () => cancelAnimationFrame(frame);
  }, [layoutPass, onLayoutReady, pages.length]);

  return (
    <div
      className={`paginated-document paginated-document--${mode}`}
      data-document-page-count={pages.length}
      data-document-layout-ready={layoutPass > 0 || undefined}
    >
      <div
        className={`document-page-stack document-page-stack--${mode}`}
        style={mode === "screen" ? { "--document-preview-zoom": zoom } as CSSProperties : undefined}
      >
        {pages.map((page, pageIndex) => (
          <div className={`document-page document-renderer document-renderer--${mode}`} data-document-page-id={page.id} data-document-page-overflow={page.overflow || undefined} key={page.id}>
            <div className="document-page-content">
              <NodeRenderer
                node={{ ...root, children: page.units.map((unit) => unit.node) }}
                selectedNodeId={selectedNodeId}
                selectedRepeaterItem={selectedRepeaterItem}
                selectableNodeIds={selectableNodeIds}
                onSelect={mode === "screen" ? onSelect : undefined}
                onEditValueChange={mode === "screen" ? onEditValueChange : undefined}
                onRichTextSelection={mode === "screen" ? onRichTextSelection : undefined}
                richTextSelection={mode === "screen" ? richTextSelection : undefined}
              />
            </div>
            <footer className="document-page-footer" aria-label={`${pageIndex + 1}페이지`}>
              <span>{pageIndex + 1}</span>
            </footer>
          </div>
        ))}
      </div>
      <div className="document-measure-page" aria-hidden="true">
        <div className="document-measure-content" ref={measureContentRef}>
          <div className="document-renderer document-renderer--measure">
            <NodeRenderer node={{ ...root, children: units.map((unit) => unit.node) }} measure />
          </div>
        </div>
      </div>
    </div>
  );
}, samePaginatedRendererProps);

function requireContainer(node: ReturnType<typeof buildRenderTree>): RenderContainerNode {
  if (node.type !== "container") throw new Error("document root는 container여야 합니다.");
  return node;
}

async function documentFontsReady(): Promise<void> {
  await globalThis.document.fonts.ready;
}

function samePaginatedRendererProps(
  previous: PaginatedDocumentRendererProps,
  next: PaginatedDocumentRendererProps,
): boolean {
  return previous.document === next.document &&
    previous.documentUpdate === next.documentUpdate &&
    previous.mode === next.mode &&
    previous.selectedNodeId === next.selectedNodeId &&
    previous.selectedRepeaterItem?.nodeId === next.selectedRepeaterItem?.nodeId &&
    previous.selectedRepeaterItem?.itemId === next.selectedRepeaterItem?.itemId &&
    previous.selectableNodeIds === next.selectableNodeIds &&
    previous.onSelect === next.onSelect &&
    previous.onEditValueChange === next.onEditValueChange &&
    previous.onRichTextSelection === next.onRichTextSelection &&
    previous.richTextSelection === next.richTextSelection &&
    previous.zoom === next.zoom &&
    previous.onLayoutReady === next.onLayoutReady;
}
