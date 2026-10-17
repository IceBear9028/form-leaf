import { useEffect, useRef, useState } from "react";
import {
  BoxIcon,
  CircleIcon,
  ChevronRightIcon,
  ComponentIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  ListIcon,
  RotateCcwIcon,
  TextQuoteIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import type { ComponentInstanceValue, ComponentPropValue, DocumentData, DocumentNode } from "../../../../foundation/documentModel.ts";
import { createEntityId } from "../../../../foundation/documentModel.ts";
import {
  duplicateRepeaterItem,
  moveRepeaterItem,
  removeRepeaterItem,
  setRepeaterItemVisibility,
} from "../../../../foundation/documentComponentOperations.ts";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { GenericDocumentChange } from "./useGenericDocumentSession.ts";
import {
  documentInsertionParentId,
  selectComponentNode,
  selectNode,
  selectRepeaterItem,
  type DocumentLayerFocusRequest,
  type DocumentSelection,
} from "./documentSelection.ts";
import { repeaterItemLabel } from "./repeaterItemPresentation.ts";

type AddableNodeType = "container" | "text" | "rich-text" | "markdown" | "image";

export function DocumentStructurePanel({
  document,
  rootNodeId = document.rootNodeId,
  includeComponentStructure = false,
  selection,
  focusRequest,
  onSelectionChange,
  onChange,
}: {
  document: DocumentData;
  rootNodeId?: string;
  includeComponentStructure?: boolean;
  selection?: DocumentSelection;
  focusRequest?: DocumentLayerFocusRequest;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const [draggedNodeId, setDraggedNodeId] = useState<string>();
  const [draggedRepeaterItem, setDraggedRepeaterItem] = useState<{ nodeId: string; itemId: string }>();
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => (
    initialCollapsedLayerIds(document, rootNodeId)
  ));
  const treeRef = useRef<HTMLDivElement>(null);
  const lastHandledFocusRequestRef = useRef(0);
  const root = document.nodes[rootNodeId];
  const layerIndentWidth = documentLayerMaxDepth(document, rootNodeId, includeComponentStructure) * 12;
  const archived = rootNodeId === document.rootNodeId
    ? Object.values(document.nodes).filter((node) => node.archivedFrom)
    : [];

  useEffect(() => {
    if (!focusRequest || focusRequest.requestId === lastHandledFocusRequestRef.current) return;
    lastHandledFocusRequestRef.current = focusRequest.requestId;

    const ancestors = new Set<string>();
    if (focusRequest.itemId) {
      ancestors.add(focusRequest.nodeId);
      ancestors.add(repeaterItemLayerId(focusRequest.nodeId, focusRequest.itemId));
    }
    let currentId: string | undefined = focusRequest.nodeId;
    while (currentId && currentId !== rootNodeId) {
      const parentId = findNodeParentId(document, currentId);
      if (!parentId) break;
      ancestors.add(parentId);
      currentId = parentId;
    }
    setCollapsedNodeIds((current) => {
      const componentPrefix = focusRequest.componentNodeId
        ? componentNodeLayerPrefix(focusRequest.nodeId, focusRequest.itemId)
        : undefined;
      if (
        ![...ancestors].some((nodeId) => current.has(nodeId)) &&
        !(componentPrefix && [...current].some((nodeId) => nodeId.startsWith(componentPrefix)))
      ) return current;
      const next = new Set(current);
      ancestors.forEach((nodeId) => next.delete(nodeId));
      if (componentPrefix) {
        next.forEach((nodeId) => {
          if (nodeId.startsWith(componentPrefix)) next.delete(nodeId);
        });
      }
      return next;
    });

    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        const row = focusRequest.componentNodeId
          ? [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-layer-component-node-id]") ?? [])]
            .find((element) => (
              element.dataset.layerComponentOuterNodeId === focusRequest.nodeId &&
              element.dataset.layerComponentItemId === focusRequest.itemId &&
              element.dataset.layerComponentNodeId === focusRequest.componentNodeId
            ))
          : focusRequest.itemId
            ? [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-layer-repeater-item-id]") ?? [])]
              .find((element) => element.dataset.layerRepeaterItemId === focusRequest.itemId)
            : [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-layer-node-id]") ?? [])]
              .find((element) => element.dataset.layerNodeId === focusRequest.nodeId);
        const tree = treeRef.current;
        if (tree && row) {
          const treeRect = tree.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          if (rowRect.top < treeRect.top) {
            tree.scrollTop -= treeRect.top - rowRect.top;
          } else if (rowRect.bottom > treeRect.bottom) {
            tree.scrollTop += rowRect.bottom - treeRect.bottom;
          }
        }
        const activeElement = globalThis.document.activeElement as HTMLElement | null;
        const editingPreviewText = activeElement?.isContentEditable
          && Boolean(activeElement.closest('[data-document-render-mode="screen"], .document-renderer--screen'));
        if (focusRequest.moveFocus !== false && !editingPreviewText) row?.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [document, focusRequest, rootNodeId]);

  return (
    <aside className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-background" aria-label="Document structure">
      <div className="border-b border-border bg-muted/30 px-3 py-3">
        <h2 className="text-sm font-semibold">레이어</h2>
        <p className="mt-1 text-xs text-muted-foreground">이름은 표시용 데이터이며 동작을 바꾸지 않습니다.</p>
      </div>
      <div ref={treeRef} className="min-h-0 flex-1 overflow-auto overscroll-contain p-2" role="tree" aria-label="Document nodes">
        <div className="min-h-full" style={{ width: `calc(100% + ${layerIndentWidth}px)` }}>
          <TreeRow
            depth={0}
            document={document}
            node={root}
            scopeRootNodeId={rootNodeId}
            includeComponentStructure={includeComponentStructure}
            selection={selection}
            onSelectionChange={onSelectionChange}
            onChange={onChange}
            draggedNodeId={draggedNodeId}
            onDragStart={setDraggedNodeId}
            onDragEnd={() => setDraggedNodeId(undefined)}
            draggedRepeaterItem={draggedRepeaterItem}
            onRepeaterItemDragStart={(nodeId, itemId) => setDraggedRepeaterItem({ nodeId, itemId })}
            onRepeaterItemDragEnd={() => setDraggedRepeaterItem(undefined)}
            collapsedNodeIds={collapsedNodeIds}
            onToggleCollapsed={(nodeId) => setCollapsedNodeIds((current) => {
              const next = new Set(current);
              if (next.has(nodeId)) next.delete(nodeId);
              else next.add(nodeId);
              return next;
            })}
          />
        </div>
      </div>
      {archived.length > 0 && (
        <div className="border-t border-border bg-muted/20 p-3">
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
    </aside>
  );
}

export function DocumentElementToolbar({
  document,
  rootNodeId = document.rootNodeId,
  selection,
  onSelectionChange,
  onChange,
}: {
  document: DocumentData;
  rootNodeId?: string;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const add = (type: AddableNodeType) => {
    const parentId = documentInsertionParentId(document, selection?.nodeId, rootNodeId);
    const node = createNode(type);
    onChange((current) => addNode(current, parentId, node));
    onSelectionChange(selectNode(node.id));
  };
  const items: Array<{ type: AddableNodeType; label: string; icon: React.ReactNode }> = [
    { type: "container", label: "컨테이너", icon: <BoxIcon aria-hidden="true" /> },
    { type: "text", label: "텍스트", icon: <TypeIcon aria-hidden="true" /> },
    { type: "rich-text", label: "서식 텍스트", icon: <TextQuoteIcon aria-hidden="true" /> },
    { type: "markdown", label: "마크다운", icon: <FileTextIcon aria-hidden="true" /> },
    { type: "image", label: "이미지", icon: <ImageIcon aria-hidden="true" /> },
  ];

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-border/80 bg-background/95 p-1.5 shadow-[0_10px_28px_rgb(15_23_42_/_16%),0_2px_6px_rgb(15_23_42_/_8%)] backdrop-blur"
      role="toolbar"
      aria-label="요소 추가"
    >
      {items.map((item) => (
        <Tooltip key={item.type}>
          <TooltipTrigger
            render={(
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-9 rounded-lg bg-transparent! p-0 text-muted-foreground shadow-none hover:bg-muted/70! hover:text-foreground focus:bg-primary! focus:text-primary-foreground focus-visible:bg-primary! focus-visible:text-primary-foreground"
                aria-label={`${item.label} 추가`}
                onClick={(event) => {
                  event.currentTarget.focus();
                  add(item.type);
                }}
              />
            )}
          >
            {item.icon}
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>{item.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function TreeRow({
  document,
  node,
  scopeRootNodeId,
  includeComponentStructure,
  depth,
  selection,
  onSelectionChange,
  onChange,
  draggedNodeId,
  onDragStart,
  onDragEnd,
  draggedRepeaterItem,
  onRepeaterItemDragStart,
  onRepeaterItemDragEnd,
  collapsedNodeIds,
  onToggleCollapsed,
}: {
  document: DocumentData;
  node: DocumentNode;
  scopeRootNodeId: string;
  includeComponentStructure: boolean;
  depth: number;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
  draggedNodeId?: string;
  onDragStart: (nodeId: string) => void;
  onDragEnd: () => void;
  draggedRepeaterItem?: { nodeId: string; itemId: string };
  onRepeaterItemDragStart: (nodeId: string, itemId: string) => void;
  onRepeaterItemDragEnd: () => void;
  collapsedNodeIds: ReadonlySet<string>;
  onToggleCollapsed: (nodeId: string) => void;
}) {
  const selected = selection?.kind === "node" && selection.nodeId === node.id;
  const isRoot = node.id === scopeRootNodeId;
  const parentId = findNodeParentId(document, node.id);
  const siblings = parentId && document.nodes[parentId]?.type === "container"
    ? document.nodes[parentId].childIds
    : [];
  const index = siblings.indexOf(node.id);
  const hasChildren = (node.type === "container" && node.childIds.length > 0) ||
    (node.type === "repeater" && node.items.length > 0) ||
    (includeComponentStructure && node.type === "component-instance" && Boolean(document.components[node.componentId]));
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
        className={`group relative flex items-center gap-1 rounded-md border px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${selected ? "border-ring bg-accent" : "border-transparent hover:bg-accent/50"}`}
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
        {node.type === "repeater" && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {node.items.length}개
          </span>
        )}
        {!isRoot && (
          <div className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center rounded-md bg-accent/95 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
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
                const result = duplicateNodeSubtree(document, node.id, parentId, index + 1);
                onChange(result.document);
                onSelectionChange(selectNode(result.rootNodeId));
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
              includeComponentStructure={includeComponentStructure}
              depth={depth + 1}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onChange={onChange}
              draggedNodeId={draggedNodeId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              draggedRepeaterItem={draggedRepeaterItem}
              onRepeaterItemDragStart={onRepeaterItemDragStart}
              onRepeaterItemDragEnd={onRepeaterItemDragEnd}
              collapsedNodeIds={collapsedNodeIds}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))}
        </CollapsibleContent>
      )}
      {includeComponentStructure && node.type === "component-instance" && (
        <CollapsibleContent>
          <ComponentStructureRow
            document={document}
            componentId={node.componentId}
            values={node.props}
            componentNodeId={document.components[node.componentId].rootNodeId}
            outerNodeId={node.id}
            depth={depth + 1}
            selection={selection}
            onSelectionChange={onSelectionChange}
            collapsedNodeIds={collapsedNodeIds}
            onToggleCollapsed={onToggleCollapsed}
            root
          />
        </CollapsibleContent>
      )}
      {node.type === "repeater" && (
        <CollapsibleContent>
          {node.items.map((item, itemIndex) => (
            <RepeaterItemRow
              key={item.id}
              document={document}
              repeater={node}
              item={item}
              index={itemIndex}
              includeComponentStructure={includeComponentStructure}
              depth={depth + 1}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onChange={onChange}
              draggedRepeaterItem={draggedRepeaterItem}
              onDragStart={onRepeaterItemDragStart}
              onDragEnd={onRepeaterItemDragEnd}
              collapsedNodeIds={collapsedNodeIds}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function RepeaterItemRow({
  document,
  repeater,
  item,
  index,
  includeComponentStructure,
  depth,
  selection,
  onSelectionChange,
  onChange,
  draggedRepeaterItem,
  onDragStart,
  onDragEnd,
  collapsedNodeIds,
  onToggleCollapsed,
}: {
  document: DocumentData;
  repeater: Extract<DocumentNode, { type: "repeater" }>;
  item: ComponentInstanceValue;
  index: number;
  includeComponentStructure: boolean;
  depth: number;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
  draggedRepeaterItem?: { nodeId: string; itemId: string };
  onDragStart: (nodeId: string, itemId: string) => void;
  onDragEnd: () => void;
  collapsedNodeIds: ReadonlySet<string>;
  onToggleCollapsed: (nodeId: string) => void;
}) {
  const selected = selection?.kind === "repeater-item"
    && selection.nodeId === repeater.id
    && selection.itemId === item.id;
  const select = () => onSelectionChange(selectRepeaterItem(repeater.id, item.id));
  const component = document.components[repeater.itemComponentId];
  const layerId = repeaterItemLayerId(repeater.id, item.id);
  const hasComponentStructure = includeComponentStructure && Boolean(component);
  const open = hasComponentStructure && !collapsedNodeIds.has(layerId);

  return (
    <Collapsible
      open={open}
      onOpenChange={() => {
        if (hasComponentStructure) onToggleCollapsed(layerId);
      }}
      role="treeitem"
      aria-selected={selected}
      aria-level={depth + 1}
      aria-expanded={hasComponentStructure ? open : undefined}
    >
      <div
        className={`group relative flex items-center gap-1 rounded-md border px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${selected ? "border-ring bg-accent" : "border-transparent hover:bg-accent/50"}`}
        data-layer-repeater-item-id={item.id}
        data-layer-repeater-node-id={repeater.id}
        tabIndex={-1}
        style={{ marginLeft: `${depth * 12}px` }}
        draggable
        onClick={select}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          select();
        }}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", item.id);
          onDragStart(repeater.id, item.id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (draggedRepeaterItem?.nodeId !== repeater.id) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (draggedRepeaterItem?.nodeId !== repeater.id) return;
          onChange((current) => moveRepeaterItem(current, repeater.id, draggedRepeaterItem.itemId, index));
          onDragEnd();
        }}
      >
        {hasComponentStructure ? (
          <CollapsibleTrigger
            className={buttonVariants({
              variant: "ghost",
              size: "icon-xs",
              className: "size-6 shrink-0 bg-transparent text-muted-foreground aria-expanded:bg-transparent!",
            })}
            aria-label={`${repeaterItemLabel(document, repeater, item, index)} ${open ? "접기" : "펼치기"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <ChevronRightIcon className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
          </CollapsibleTrigger>
        ) : <span className="size-6 shrink-0" aria-hidden="true" />}
        <span
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
          title="Repeater item"
          aria-hidden="true"
        >
          <CircleIcon className="size-2.5 fill-current" />
        </span>
        <span className={`min-w-0 flex-1 truncate px-1 text-xs ${item.visible ? "" : "text-muted-foreground line-through"}`}>
          {repeaterItemLabel(document, repeater, item, index)}
        </span>
        <div className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center rounded-md bg-accent/95 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
          <IconButton
            label={item.visible ? "항목 숨기기" : "항목 표시하기"}
            onClick={() => onChange((current) => setRepeaterItemVisibility(current, repeater.id, item.id, !item.visible))}
          >
            {item.visible ? <EyeIcon /> : <EyeOffIcon />}
          </IconButton>
          <IconButton
            label="항목 복제"
            onClick={() => {
              const result = duplicateRepeaterItem(document, repeater.id, item.id);
              onChange(result.document);
              onSelectionChange(selectRepeaterItem(repeater.id, result.itemId));
            }}
          ><CopyIcon /></IconButton>
          <IconButton
            label="항목 삭제 · 실행 취소 가능"
            onClick={() => {
              onChange((current) => removeRepeaterItem(current, repeater.id, item.id));
              if (selected || selection?.kind === "component-node" && selection.itemId === item.id) {
                onSelectionChange(undefined);
              }
            }}
          ><Trash2Icon /></IconButton>
        </div>
      </div>
      {hasComponentStructure && component && (
        <CollapsibleContent>
          <ComponentStructureRow
            document={document}
            componentId={component.id}
            values={item.props}
            componentNodeId={component.rootNodeId}
            outerNodeId={repeater.id}
            itemId={item.id}
            depth={depth + 1}
            selection={selection}
            onSelectionChange={onSelectionChange}
            collapsedNodeIds={collapsedNodeIds}
            onToggleCollapsed={onToggleCollapsed}
            root
          />
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ComponentStructureRow({
  document,
  componentId,
  values,
  componentNodeId,
  outerNodeId,
  itemId,
  depth,
  selection,
  onSelectionChange,
  collapsedNodeIds,
  onToggleCollapsed,
  root = false,
}: {
  document: DocumentData;
  componentId: string;
  values: Record<string, ComponentPropValue>;
  componentNodeId: string;
  outerNodeId: string;
  itemId?: string;
  depth: number;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  collapsedNodeIds: ReadonlySet<string>;
  onToggleCollapsed: (nodeId: string) => void;
  root?: boolean;
}) {
  const component = document.components[componentId];
  const node = document.nodes[componentNodeId];
  if (!component || !node) return null;
  const nestedComponent = node.type === "component-instance"
    ? document.components[node.componentId]
    : undefined;
  const childIds = node.type === "container" ? node.childIds : [];
  const hasChildren = childIds.length > 0 || Boolean(nestedComponent);
  const layerId = componentNodeLayerId(outerNodeId, itemId, componentNodeId);
  const open = hasChildren && !collapsedNodeIds.has(layerId);
  const selected = selection?.kind === "component-node"
    && selection.nodeId === outerNodeId
    && selection.componentNodeId === componentNodeId
    && selection.itemId === itemId;
  const prop = component.propDefinitions.find((definition) => (
    definition.status === "active" && definition.binding.nodeId === componentNodeId
  ));
  const value = prop
    ? Object.hasOwn(values, prop.id) ? values[prop.id] : prop.defaultValue
    : undefined;
  const summary = value === undefined ? undefined : componentPropDisplayValue(value);
  const select = () => onSelectionChange(selectComponentNode(outerNodeId, componentNodeId, itemId));

  return (
    <Collapsible
      open={open}
      onOpenChange={() => {
        if (hasChildren) onToggleCollapsed(layerId);
      }}
      role="treeitem"
      aria-selected={selected}
      aria-level={depth + 1}
      aria-expanded={hasChildren ? open : undefined}
    >
      <div
        className={`group relative flex items-center gap-1 rounded-md border px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${selected ? "border-ring bg-accent" : "border-transparent hover:bg-accent/50"}`}
        data-layer-component-node-id={componentNodeId}
        data-layer-component-outer-node-id={outerNodeId}
        data-layer-component-item-id={itemId}
        tabIndex={-1}
        style={{ marginLeft: `${depth * 12}px` }}
        onClick={select}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          select();
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
            onClick={(event) => event.stopPropagation()}
          >
            <ChevronRightIcon className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
          </CollapsibleTrigger>
        ) : <span className="size-6 shrink-0" aria-hidden="true" />}
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
          {root ? <ComponentIcon className="size-3.5" /> : <NodeTypeIcon type={node.type} />}
        </span>
        <span className={`min-w-0 truncate px-1 text-xs ${node.visible ? "" : "text-muted-foreground line-through"}`}>
          {node.name || nodeTypeLabel(node.type)}
        </span>
        {summary && (
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" title={summary}>
            {summary}
          </span>
        )}
        {!summary && <span className="min-w-0 flex-1" />}
        {root && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            공유 구조
          </span>
        )}
      </div>
      {hasChildren && (
        <CollapsibleContent>
          {childIds.map((childId) => (
            <ComponentStructureRow
              key={childId}
              document={document}
              componentId={componentId}
              values={values}
              componentNodeId={childId}
              outerNodeId={outerNodeId}
              itemId={itemId}
              depth={depth + 1}
              selection={selection}
              onSelectionChange={onSelectionChange}
              collapsedNodeIds={collapsedNodeIds}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))}
          {nestedComponent && (
            <ComponentStructureRow
              document={document}
              componentId={nestedComponent.id}
              values={node.type === "component-instance" ? node.props : {}}
              componentNodeId={nestedComponent.rootNodeId}
              outerNodeId={outerNodeId}
              itemId={itemId}
              depth={depth + 1}
              selection={selection}
              onSelectionChange={onSelectionChange}
              collapsedNodeIds={collapsedNodeIds}
              onToggleCollapsed={onToggleCollapsed}
              root
            />
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function initialCollapsedLayerIds(document: DocumentData, rootNodeId: string): Set<string> {
  const result = new Set<string>();
  const visit = (nodeId: string) => {
    const node = document.nodes[nodeId];
    if (!node || node.archivedFrom) return;
    if (node.type === "container") node.childIds.forEach(visit);
    if (node.type === "repeater") {
      node.items.forEach((item) => result.add(repeaterItemLayerId(node.id, item.id)));
    }
  };
  visit(rootNodeId);
  return result;
}

function documentLayerMaxDepth(
  document: DocumentData,
  rootNodeId: string,
  includeComponentStructure: boolean,
): number {
  const visitComponent = (componentId: string, depth: number, componentPath: ReadonlySet<string>): number => {
    if (componentPath.has(componentId)) return depth;
    const component = document.components[componentId];
    if (!component) return depth;
    const nextPath = new Set(componentPath).add(componentId);
    return visitComponentNode(component.rootNodeId, depth, nextPath);
  };
  const visitComponentNode = (
    nodeId: string,
    depth: number,
    componentPath: ReadonlySet<string>,
  ): number => {
    const node = document.nodes[nodeId];
    if (!node || node.archivedFrom) return depth;
    let maximum = depth;
    if (node.type === "container") {
      node.childIds.forEach((childId) => {
        maximum = Math.max(maximum, visitComponentNode(childId, depth + 1, componentPath));
      });
    }
    if (includeComponentStructure && node.type === "component-instance") {
      maximum = Math.max(maximum, visitComponent(node.componentId, depth + 1, componentPath));
    }
    return maximum;
  };
  const visitDocumentNode = (nodeId: string, depth: number): number => {
    const node = document.nodes[nodeId];
    if (!node || node.archivedFrom) return depth;
    let maximum = depth;
    if (node.type === "container") {
      node.childIds.forEach((childId) => {
        maximum = Math.max(maximum, visitDocumentNode(childId, depth + 1));
      });
    }
    if (node.type === "component-instance") {
      maximum = Math.max(maximum, visitComponent(node.componentId, depth + 1, new Set()));
    }
    if (node.type === "repeater" && node.items.length > 0) {
      maximum = Math.max(maximum, includeComponentStructure
        ? visitComponent(node.itemComponentId, depth + 2, new Set())
        : depth + 1);
    }
    return maximum;
  };
  return visitDocumentNode(rootNodeId, 0);
}

function repeaterItemLayerId(nodeId: string, itemId: string): string {
  return `repeater:${nodeId}:item:${itemId}`;
}

function componentNodeLayerId(nodeId: string, itemId: string | undefined, componentNodeId: string): string {
  return `${componentNodeLayerPrefix(nodeId, itemId)}${componentNodeId}`;
}

function componentNodeLayerPrefix(nodeId: string, itemId?: string): string {
  return `component:${nodeId}:${itemId ?? "instance"}:node:`;
}

function componentPropDisplayValue(value: ComponentPropValue): string | undefined {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if ("runs" in value) return value.runs.map((run) => run.text).join("").replace(/\s+/g, " ").trim() || undefined;
  return value.alt.trim() || undefined;
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
    <Tooltip>
      <TooltipTrigger
        render={(
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
              if (event.detail > 0) event.currentTarget.blur();
            }}
          />
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
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
