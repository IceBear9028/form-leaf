import { BoxesIcon, CopyPlusIcon, ListPlusIcon, PencilIcon } from "lucide-react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import { createEntityId } from "../../../../foundation/documentModel.ts";
import { addComponentInstance, addNode } from "../../../../foundation/documentTransactions.ts";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  documentInsertionParentId,
  documentSelectableNodeIds,
  selectNode,
  type DocumentSelection,
} from "./documentSelection.ts";
import type { GenericDocumentChange } from "./useGenericDocumentSession.ts";

export function DocumentComponentNavigator({
  document,
  selection,
  onSelectionChange,
  onChange,
  onEditComponent,
}: {
  document: DocumentData;
  selection?: DocumentSelection;
  onSelectionChange: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
  onEditComponent: (componentId: string) => void;
}) {
  const components = Object.values(document.components);

  const addInstance = (componentId: string) => {
    const component = document.components[componentId];
    if (!component) return;
    const nodeId = createEntityId("node");
    const parentId = documentInsertionParentId(document, selection?.nodeId);
    onChange((current) => addComponentInstance(current, parentId, {
      id: nodeId,
      type: "component-instance",
      name: component.name,
      visible: true,
      componentId,
      props: {},
    }));
    onSelectionChange(selectNode(nodeId));
  };

  const addRepeater = (componentId: string) => {
    const component = document.components[componentId];
    if (!component) return;
    const nodeId = createEntityId("node");
    const parentId = documentInsertionParentId(document, selection?.nodeId);
    onChange((current) => addNode(current, parentId, {
      id: nodeId,
      type: "repeater",
      name: component.name,
      visible: true,
      itemComponentId: componentId,
      items: [],
    }));
    onSelectionChange(selectNode(nodeId));
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-t border-border bg-background" aria-label="Document components">
      <div className="border-b border-border bg-muted/30 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <BoxesIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">컴포넌트</h2>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          선택한 컨테이너 또는 현재 위치에 추가합니다.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {components.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            현재 문서에 등록된 컴포넌트가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {components.map((component) => {
              const usage = componentUsage(document, component.id);
              return (
                <div className="rounded-lg border border-border bg-background p-2.5" key={component.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{component.name || "이름 없는 컴포넌트"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      사용 {usage}개 · 속성 {component.propDefinitions.filter((prop) => prop.status === "active").length}개
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => addInstance(component.id)}>
                      <CopyPlusIcon aria-hidden="true" /> Instance
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addRepeater(component.id)}>
                      <ListPlusIcon aria-hidden="true" /> Repeater
                    </Button>
                    <Tooltip>
                      <TooltipTrigger
                        render={(
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${component.name || "컴포넌트"} 정의 편집`}
                            onClick={() => onEditComponent(component.id)}
                          />
                        )}
                      >
                        <PencilIcon aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>정의 편집</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function componentUsage(document: DocumentData, componentId: string): number {
  return [...documentSelectableNodeIds(document)].reduce((count, nodeId) => {
    const node = document.nodes[nodeId];
    if (node.archivedFrom) return count;
    if (node.type === "component-instance" && node.componentId === componentId) return count + 1;
    if (node.type === "repeater" && node.itemComponentId === componentId) return count + 1;
    return count;
  }, 0);
}
