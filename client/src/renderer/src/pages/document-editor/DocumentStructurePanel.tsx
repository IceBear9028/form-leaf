import { useEffect, useRef, useState } from "react";
import {
  ChevronRightIcon,
  ComponentIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  ListIcon,
  PlusIcon,
  RotateCcwIcon,
  TextQuoteIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import type { DocumentData, DocumentNode } from "../../../../foundation/documentModel.ts";
import { createEntityId } from "../../../../foundation/documentModel.ts";
import {
  addNode,
  archiveNode,
  duplicateNodeSubtree,
  findNodeParentId,
  moveNode,
  renameNode,
  restoreNode,
  setNodeVisibility,
} from "../../../../foundation/documentTransactions.ts";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { Input } from "@/shared/ui/input";
import type { GenericDocumentChange } from "./useGenericDocumentSession.ts";
import { selectNode, type DocumentSelection } from "./documentSelection.ts";

type AddableNodeType = "container" | "text" | "rich-text" | "markdown" | "image";

export function DocumentStructurePanel({
  document,
  rootNodeId = document.rootNodeId,
  selection,
  focusRequest,
  onSelectionChange,
  onChange,
}: {
  document: DocumentData;
  rootNodeId?: string;
  selection?: DocumentSelection;
  focusRequest?: { nodeId: string; requestId: number };
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const [draggedNodeId, setDraggedNodeId] = useState<string>();
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set());
  const treeRef = useRef<HTMLDivElement>(null);
  const lastHandledFocusRequestRef = useRef(0);
  const root = document.nodes[rootNodeId];
  const archived = rootNodeId === document.rootNodeId
    ? Object.values(document.nodes).filter((node) => node.archivedFrom)
    : [];

  const add = (type: AddableNodeType) => {
    const parentId = insertionParentId(document, selection?.nodeId, rootNodeId);
    const node = createNode(type);
    onChange((current) => addNode(current, parentId, node));
    onSelectionChange(selectNode(node.id));
  };

  useEffect(() => {
    if (!focusRequest || focusRequest.requestId === lastHandledFocusRequestRef.current) return;
    lastHandledFocusRequestRef.current = focusRequest.requestId;

    const ancestors = new Set<string>();
    let currentId: string | undefined = focusRequest.nodeId;
    while (currentId && currentId !== rootNodeId) {
      const parentId = findNodeParentId(document, currentId);
      if (!parentId) break;
      ancestors.add(parentId);
      currentId = parentId;
    }
    setCollapsedNodeIds((current) => {
      if (![...ancestors].some((nodeId) => current.has(nodeId))) return current;
      const next = new Set(current);
      ancestors.forEach((nodeId) => next.delete(nodeId));
      return next;
    });

    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        const row = [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-layer-node-id]") ?? [])]
          .find((element) => element.dataset.layerNodeId === focusRequest.nodeId);
        row?.scrollIntoView({ block: "nearest" });
        const activeElement = globalThis.document.activeElement as HTMLElement | null;
        const editingPreviewText = activeElement?.isContentEditable
          && Boolean(activeElement.closest('[data-document-render-mode="screen"]'));
        if (!editingPreviewText) row?.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [document, focusRequest, rootNodeId]);

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-background" aria-label="Document structure">
      <div className="border-b border-border bg-muted/30 px-3 py-3">
        <h2 className="text-sm font-semibold">레이어</h2>
        <p className="mt-1 text-xs text-muted-foreground">이름은 표시용 데이터이며 동작을 바꾸지 않습니다.</p>
      </div>
      <div ref={treeRef} className="min-h-0 flex-1 overflow-y-auto p-2" role="tree" aria-label="Document nodes">
        <TreeRow
          depth={0}
          document={document}
          node={root}
          scopeRootNodeId={rootNodeId}
          selection={selection}
          onSelectionChange={onSelectionChange}
          onChange={onChange}
          draggedNodeId={draggedNodeId}
          onDragStart={setDraggedNodeId}
          onDragEnd={() => setDraggedNodeId(undefined)}
          collapsedNodeIds={collapsedNodeIds}
          onToggleCollapsed={(nodeId) => setCollapsedNodeIds((current) => {
            const next = new Set(current);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
          })}
        />
      </div>
      <div className="border-t border-border bg-muted/20 p-3">
        <div className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <PlusIcon className="size-3.5" aria-hidden="true" /> 요소 추가
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ["container", "Container"],
            ["text", "Text"],
            ["rich-text", "Rich text"],
            ["markdown", "Markdown"],
            ["image", "Image"],
          ] as const).map(([type, label]) => (
            <Button key={type} type="button" variant="outline" size="sm" onClick={() => add(type)}>
              {label}
            </Button>
          ))}
        </div>
        {archived.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">보관함</h3>
            <div className="space-y-1">
              {archived.map((node) => (
                <div className="flex items-center gap-2" key={node.id}>
                  <span className="min-w-0 flex-1 truncate text-xs">{node.name || node.type}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${node.name || node.type} 복원`}
                    onClick={() => {
                      onChange((current) => restoreNode(current, node.id));
                      onSelectionChange(selectNode(node.id));
                    }}
                  >
                    <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function TreeRow({
  document,
  node,
  scopeRootNodeId,
  depth,
  selection,
  onSelectionChange,
  onChange,
  draggedNodeId,
  onDragStart,
  onDragEnd,
  collapsedNodeIds,
  onToggleCollapsed,
}: {
  document: DocumentData;
  node: DocumentNode;
  scopeRootNodeId: string;
  depth: number;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
  draggedNodeId?: string;
  onDragStart: (nodeId: string) => void;
  onDragEnd: () => void;
  collapsedNodeIds: ReadonlySet<string>;
  onToggleCollapsed: (nodeId: string) => void;
}) {
  const selected = selection?.nodeId === node.id;
  const isRoot = node.id === scopeRootNodeId;
  const parentId = findNodeParentId(document, node.id);
  const siblings = parentId && document.nodes[parentId]?.type === "container"
    ? document.nodes[parentId].childIds
    : [];
  const index = siblings.indexOf(node.id);
  const hasChildren = node.type === "container" && node.childIds.length > 0;
  const open = hasChildren && !collapsedNodeIds.has(node.id);

  return (
    <Collapsible
      open={open}
      onOpenChange={() => {
        if (hasChildren) onToggleCollapsed(node.id);
      }}
      role="treeitem"
      aria-selected={selected}
      aria-level={depth + 1}
      aria-expanded={hasChildren ? open : undefined}
    >
      <div
        className={`group flex items-center gap-1 rounded-md border px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${selected ? "border-ring bg-accent" : "border-transparent hover:bg-accent/50"}`}
        data-layer-node-id={node.id}
        tabIndex={-1}
        style={{ marginLeft: `${depth * 12}px` }}
        draggable={!isRoot}
        onDragStart={(event) => {
          if (isRoot) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
          onDragStart(node.id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (!draggedNodeId || !parentId || findNodeParentId(document, draggedNodeId) !== parentId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!draggedNodeId || !parentId || findNodeParentId(document, draggedNodeId) !== parentId) return;
          onChange((current) => moveNode(current, draggedNodeId, parentId, index));
          onDragEnd();
        }}
      >
        {hasChildren ? (
          <CollapsibleTrigger
            className={buttonVariants({
              variant: "ghost",
              size: "icon-xs",
              className: "size-6 shrink-0 bg-transparent text-muted-foreground aria-expanded:bg-transparent!",
            })}
            aria-label={`${node.name || nodeTypeLabel(node.type)} ${open ? "접기" : "펼치기"}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <ChevronRightIcon className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
          </CollapsibleTrigger>
        ) : <span className="size-6 shrink-0" aria-hidden="true" />}
        <span
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
          title={nodeTypeLabel(node.type)}
          aria-hidden="true"
        >
          <NodeTypeIcon type={node.type} />
        </span>
        <span className="sr-only">{nodeTypeLabel(node.type)}</span>
        <Input
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none"
          aria-label={`${node.type} 이름`}
          value={node.name}
          onFocus={() => onSelectionChange(selectNode(node.id))}
          onChange={(event) => onChange((current) => renameNode(current, node.id, event.target.value))}
        />
        {!isRoot && (
          <div className="hidden items-center group-focus-within:flex group-hover:flex">
            <IconButton
              label={node.visible ? "숨기기" : "표시하기"}
              onClick={() => onChange((current) => setNodeVisibility(current, node.id, !node.visible))}
            >
              {node.visible ? <EyeIcon /> : <EyeOffIcon />}
            </IconButton>
            <IconButton
              label="복제"
              onClick={() => {
                if (!parentId) return;
                onChange((current) => duplicateNodeSubtree(current, node.id, parentId, index + 1).document);
              }}
            ><CopyIcon /></IconButton>
            <IconButton
              label="보관함으로 이동"
              onClick={() => {
                onChange((current) => archiveNode(current, node.id));
                if (selected) onSelectionChange(undefined);
              }}
            ><Trash2Icon /></IconButton>
          </div>
        )}
      </div>
      {node.type === "container" && (
        <CollapsibleContent>
          {node.childIds.map((childId) => (
            <TreeRow
              key={childId}
              document={document}
              node={document.nodes[childId]}
              scopeRootNodeId={scopeRootNodeId}
              depth={depth + 1}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onChange={onChange}
              draggedNodeId={draggedNodeId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              collapsedNodeIds={collapsedNodeIds}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function NodeTypeIcon({ type }: { type: DocumentNode["type"] }) {
  const className = "size-3.5";
  if (type === "container") return <FolderIcon className={className} aria-hidden="true" />;
  if (type === "text") return <TypeIcon className={className} aria-hidden="true" />;
  if (type === "rich-text") return <TextQuoteIcon className={className} aria-hidden="true" />;
  if (type === "markdown") return <FileTextIcon className={className} aria-hidden="true" />;
  if (type === "image") return <ImageIcon className={className} aria-hidden="true" />;
  if (type === "repeater") return <ListIcon className={className} aria-hidden="true" />;
  return <ComponentIcon className={className} aria-hidden="true" />;
}

function nodeTypeLabel(type: DocumentNode["type"]): string {
  if (type === "container") return "Container";
  if (type === "text") return "Text";
  if (type === "rich-text") return "Rich text";
  if (type === "markdown") return "Markdown";
  if (type === "image") return "Image";
  if (type === "repeater") return "Repeater";
  return "Component";
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactElement<{ className?: string }>;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="size-7 p-0"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

function insertionParentId(document: DocumentData, selectedId: string | undefined, rootNodeId: string): string {
  if (!selectedId) return rootNodeId;
  const selected = document.nodes[selectedId];
  if (selected?.type === "container" && !selected.archivedFrom) return selected.id;
  return findNodeParentId(document, selectedId) ?? rootNodeId;
}

function createNode(type: AddableNodeType): DocumentNode {
  const id = createEntityId("node");
  const base = { id, type, name: nodeLabel(type), visible: true } as const;
  if (type === "container") return { ...base, type, childIds: [] };
  if (type === "text") return { ...base, type, value: "" };
  if (type === "rich-text") return { ...base, type, value: { runs: [{ text: "" }] } };
  if (type === "markdown") return { ...base, type, source: "" };
  return { ...base, type, alt: "" };
}

function nodeLabel(type: AddableNodeType): string {
  if (type === "rich-text") return "Rich text";
  return type[0].toUpperCase() + type.slice(1);
}
