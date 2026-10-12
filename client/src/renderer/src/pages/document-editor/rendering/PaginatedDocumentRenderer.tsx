import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DocumentData } from "../../../../../foundation/documentModel.ts";
import type { DirectEditValue, DocumentEditTarget, TextRange } from "../../../../../foundation/documentEditing.ts";
import { NodeRenderer, type RenderSelectionTarget } from "./NodeRenderer.tsx";
import type { DirectTextSelection } from "./EditableTextValue.tsx";
import { collectPaginationUnits, paginate, reconcileVisiblePages, type PaginatedPage } from "./pagination.ts";
import { buildRenderTree, type RenderContainerNode } from "./renderTree.ts";
import "./document.css";

type Unit = ReturnType<typeof collectPaginationUnits>[number];

export function PaginatedDocumentRenderer({
  document,
  mode,
  selectedNodeId,
  selectedRepeaterItem,
  selectableNodeIds,
  onSelect,
  onEditValueChange,
  onRichTextSelection,
  richTextSelection,
  zoom = 1,
}: {
  document: DocumentData;
  mode: "screen" | "print";
  selectedNodeId?: string;
  selectedRepeaterItem?: { nodeId: string; itemId: string };
  selectableNodeIds?: ReadonlySet<string>;
  onSelect?: (target: RenderSelectionTarget) => void;
  onEditValueChange?: (target: DocumentEditTarget, value: DirectEditValue, selection: TextRange) => void;
  onRichTextSelection?: (selection?: DirectTextSelection) => void;
  richTextSelection?: DirectTextSelection;
  zoom?: number;
}) {
  const tree = useMemo(() => buildRenderTree(document), [document]);
  const root = requireContainer(tree);
  const units = useMemo(() => collectPaginationUnits(tree), [tree]);
  const [pages, setPages] = useState<PaginatedPage<Unit>[]>(() => [{
    id: "page-1",
    units,
    overflow: false,
  }]);
  const measureContentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setPages((current) => reconcileVisiblePages(current, units));
  }, [units]);

  useLayoutEffect(() => {
    let canceled = false;
    const measure = () => {
      if (canceled || !measureContentRef.current) return;
      const rootElement = measureContentRef.current.querySelector(
        ":scope > .document-renderer--measure > .document-node",
      );
      if (!(rootElement instanceof HTMLElement)) return;
      const elements = Array.from(rootElement.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement && Boolean(element.dataset.measureId),
      );
      if (elements.length !== units.length) return;
      const heights = new Map<string, number>();
      elements.forEach((element, index) => {
        const current = element.getBoundingClientRect();
        const next = elements[index + 1]?.getBoundingClientRect();
        heights.set(element.dataset.measureId!, next ? next.top - current.top : current.height);
      });
      const rootStyle = getComputedStyle(rootElement);
      const verticalPadding = parseFloat(rootStyle.paddingTop) + parseFloat(rootStyle.paddingBottom);
      const capacity = Math.max(1, measureContentRef.current.getBoundingClientRect().height - verticalPadding);
      setPages(paginate(units, heights, capacity));
    };
    const schedule = () => requestAnimationFrame(measure);
    const initialFrame = requestAnimationFrame(measure);
    void documentFontsReady().then(schedule);
    const observer = new ResizeObserver(schedule);
    if (measureContentRef.current) {
      observer.observe(measureContentRef.current);
      const rootElement = measureContentRef.current.querySelector(
        ":scope > .document-renderer--measure > .document-node",
      );
      if (rootElement) observer.observe(rootElement);
    }
    window.addEventListener("resize", schedule);
    return () => {
      canceled = true;
      cancelAnimationFrame(initialFrame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [document, units]);

  return (
    <div className={`paginated-document paginated-document--${mode}`} data-document-page-count={pages.length}>
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
}

function requireContainer(node: ReturnType<typeof buildRenderTree>): RenderContainerNode {
  if (node.type !== "container") throw new Error("document root는 container여야 합니다.");
  return node;
}

async function documentFontsReady(): Promise<void> {
  await globalThis.document.fonts.ready;
}
