import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArchiveIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  RotateCcwIcon,
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
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { GenericDocumentChange } from "./useGenericDocumentSession.ts";
import { selectNode, type DocumentSelection } from "./documentSelection.ts";

type AddableNodeType = "container" | "text" | "rich-text" | "markdown" | "image";

export function DocumentStructurePanel({
  document,
  selection,
  onSelectionChange,
  onChange,
}: {
  document: DocumentData;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const [draggedNodeId, setDraggedNodeId] = useState<string>();
  const root = document.nodes[document.rootNodeId];
  const archived = Object.values(document.nodes).filter((node) => node.archivedFrom);

  const add = (type: AddableNodeType) => {
    const parentId = insertionParentId(document, selection?.nodeId);
    const node = createNode(type);
    onChange((current) => addNode(current, parentId, node));
    onSelectionChange(selectNode(node.id));
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-background" aria-label="Document structure">
      <div className="border-b border-border bg-muted/30 px-3 py-3">
        <h2 className="text-sm font-semibold">레이어</h2>
        <p className="mt-1 text-xs text-muted-foreground">이름은 표시용 데이터이며 동작을 바꾸지 않습니다.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2" role="tree" aria-label="Document nodes">
        <TreeRow
          depth={0}
          document={document}
          node={root}
          selection={selection}
          onSelectionChange={onSelectionChange}
          onChange={onChange}
          draggedNodeId={draggedNodeId}
          onDragStart={setDraggedNodeId}
          onDragEnd={() => setDraggedNodeId(undefined)}
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
  depth,
  selection,
  onSelectionChange,
  onChange,
  draggedNodeId,
  onDragStart,
  onDragEnd,
}: {
  document: DocumentData;
  node: DocumentNode;
  depth: number;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
  draggedNodeId?: string;
  onDragStart: (nodeId: string) => void;
  onDragEnd: () => void;
}) {
  const selected = selection?.nodeId === node.id;
  const isRoot = node.id === document.rootNodeId;
  const parentId = findNodeParentId(document, node.id);
  const siblings = parentId && document.nodes[parentId]?.type === "container"
    ? document.nodes[parentId].childIds
    : [];
  const index = siblings.indexOf(node.id);

  const move = (offset: number) => {
    if (!parentId) return;
    onChange((current) => moveNode(current, node.id, parentId, index + offset));
  };

  return (
    <div role="treeitem" aria-selected={selected} aria-level={depth + 1}>
      <div
        className={`group flex items-center gap-1 rounded-md border px-1.5 py-1 ${selected ? "border-ring bg-accent" : "border-transparent hover:bg-accent/50"}`}
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
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onSelectionChange(selectNode(node.id))}
        >
          <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">{node.type}</span>
        </button>
        <Input
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none"
          aria-label={`${node.type} 이름`}
          value={node.name}
          onFocus={() => onSelectionChange(selectNode(node.id))}
          onChange={(event) => onChange((current) => renameNode(current, node.id, event.target.value))}
        />
        {!isRoot && (
          <div className="hidden items-center group-focus-within:flex group-hover:flex">
            <IconButton label="위로 이동" disabled={index <= 0} onClick={() => move(-1)}><ArrowUpIcon /></IconButton>
            <IconButton label="아래로 이동" disabled={index < 0 || index >= siblings.length - 1} onClick={() => move(1)}><ArrowDownIcon /></IconButton>
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
              label="보관"
              onClick={() => {
                onChange((current) => archiveNode(current, node.id));
                if (selected) onSelectionChange(undefined);
              }}
            ><ArchiveIcon /></IconButton>
          </div>
        )}
      </div>
      {node.type === "container" && node.childIds.map((childId) => (
        <TreeRow
          key={childId}
          document={document}
          node={document.nodes[childId]}
          depth={depth + 1}
          selection={selection}
          onSelectionChange={onSelectionChange}
          onChange={onChange}
          draggedNodeId={draggedNodeId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
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

function insertionParentId(document: DocumentData, selectedId?: string): string {
  if (!selectedId) return document.rootNodeId;
  const selected = document.nodes[selectedId];
  if (selected?.type === "container" && !selected.archivedFrom) return selected.id;
  return findNodeParentId(document, selectedId) ?? document.rootNodeId;
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
