import { useEffect, useMemo, useState } from "react";
import { ArchiveIcon, BoxesIcon, CopyPlusIcon, DownloadIcon, ListPlusIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import type { ComponentLibrarySummary } from "../../../../foundation/componentLibrary.ts";
import type { ComponentDefinition, DocumentData, DocumentNode } from "../../../../foundation/documentModel.ts";
import { createEntityId } from "../../../../foundation/documentModel.ts";
import {
  applyComponentDefinitionDraft,
  createComponentFromSubtree,
  exposeComponentProp,
  exportComponentPackage,
  importComponentPackage,
} from "../../../../foundation/documentComponentOperations.ts";
import {
  addComponentInstance,
  addNode,
  archiveComponentProp,
} from "../../../../foundation/documentTransactions.ts";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { DocumentSelection } from "./documentSelection.ts";
import { selectNode } from "./documentSelection.ts";
import type { GenericDocumentChange } from "./useGenericDocumentSession.ts";

export function ComponentReusePanel({
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
  const componentIds = Object.keys(document.components);
  const [componentId, setComponentId] = useState<string>();
  const [libraryItems, setLibraryItems] = useState<ComponentLibrarySummary[]>([]);
  const [libraryId, setLibraryId] = useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState<string>();
  const selectedComponentId = componentId && document.components[componentId]
    ? componentId
    : componentIds[0];
  const component = selectedComponentId ? document.components[selectedComponentId] : undefined;
  const selectedNode = selection ? document.nodes[selection.nodeId] : undefined;

  const refreshLibrary = async () => {
    try {
      setLibraryItems(await window.documents.listComponents());
      setLibraryError(undefined);
    } catch (error) {
      setLibraryError(errorMessage(error));
    }
  };

  useEffect(() => {
    void refreshLibrary();
  }, []);

  const createFromSelection = () => {
    if (!selectedNode || selectedNode.id === document.rootNodeId || selectedNode.archivedFrom) return;
    const result = createComponentFromSubtree(
      document,
      selectedNode.id,
      selectedNode.name || "Component",
    );
    onChange(result.document);
    setComponentId(result.componentId);
    onSelectionChange(selectNode(result.instanceNodeId));
  };

  const addInstance = () => {
    if (!component) return;
    const nodeId = createEntityId("node");
    onChange((current) => addComponentInstance(current, current.rootNodeId, {
      id: nodeId,
      type: "component-instance",
      name: component.name,
      visible: true,
      componentId: component.id,
      props: {},
    }));
    onSelectionChange(selectNode(nodeId));
  };

  const addRepeater = () => {
    if (!component) return;
    const nodeId = createEntityId("node");
    onChange((current) => addNode(current, current.rootNodeId, {
      id: nodeId,
      type: "repeater",
      name: component.name,
      visible: true,
      itemComponentId: component.id,
      items: [],
    }));
    onSelectionChange(selectNode(nodeId));
  };

  const saveToLibrary = async () => {
    if (!component || libraryBusy) return;
    setLibraryBusy(true);
    try {
      await window.documents.saveComponent({
        name: component.name,
        package: exportComponentPackage(document, component.id),
      });
      await refreshLibrary();
    } catch (error) {
      setLibraryError(errorMessage(error));
    } finally {
      setLibraryBusy(false);
    }
  };

  const importFromLibrary = async () => {
    if (!libraryId || libraryBusy) return;
    setLibraryBusy(true);
    try {
      const item = await window.documents.loadComponent(libraryId);
      const imported = importComponentPackage(document, item.package);
      onChange(imported.document);
      setComponentId(imported.componentId);
      setLibraryError(undefined);
    } catch (error) {
      setLibraryError(errorMessage(error));
    } finally {
      setLibraryBusy(false);
    }
  };

  const deleteLibraryItem = async () => {
    if (!libraryId || libraryBusy) return;
    setLibraryBusy(true);
    try {
      await window.documents.deleteComponent(libraryId);
      setLibraryId("");
      await refreshLibrary();
    } catch (error) {
      setLibraryError(errorMessage(error));
    } finally {
      setLibraryBusy(false);
    }
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-t border-border bg-background" aria-label="Components">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">컴포넌트</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">문서 내부에서 재사용합니다.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedNode || selectedNode.id === document.rootNodeId || Boolean(selectedNode.archivedFrom)}
          onClick={createFromSelection}
        >
          <BoxesIcon aria-hidden="true" /> 만들기
        </Button>
      </div>

      {componentIds.length === 0 ? (
        <p className="p-3 text-xs leading-5 text-muted-foreground">레이어를 선택한 뒤 컴포넌트로 만드세요.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            선택한 컴포넌트
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              value={selectedComponentId}
              onChange={(event) => setComponentId(event.target.value)}
            >
              {componentIds.map((id) => (
                <option key={id} value={id}>{document.components[id].name || id}</option>
              ))}
            </select>
          </label>
          {component && (
            <ComponentDefinitionEditor
              key={component.id}
              document={document}
              component={component}
              onChange={onChange}
            />
          )}
        </div>
      )}

      {component && (
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          <Button type="button" variant="outline" size="sm" onClick={addInstance}>
            <CopyPlusIcon aria-hidden="true" /> Instance
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addRepeater}>
            <ListPlusIcon aria-hidden="true" /> Repeater
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={libraryBusy} className="col-span-2" onClick={() => void saveToLibrary()}>
            <SaveIcon aria-hidden="true" /> 라이브러리에 저장
          </Button>
        </div>
      )}
      <div className="space-y-2 border-t border-border p-3">
        <p className="text-xs font-semibold">개인 라이브러리</p>
        <select
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
          value={libraryId}
          onChange={(event) => setLibraryId(event.target.value)}
        >
          <option value="">저장된 컴포넌트 선택</option>
          {libraryItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!libraryId || libraryBusy} onClick={() => void importFromLibrary()}>
            <DownloadIcon aria-hidden="true" /> 문서로 복사
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="라이브러리 항목 삭제" disabled={!libraryId || libraryBusy} onClick={() => void deleteLibraryItem()}>
            <Trash2Icon aria-hidden="true" />
          </Button>
        </div>
        {libraryError && <p className="text-xs text-destructive">{libraryError}</p>}
      </div>
    </aside>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ComponentDefinitionEditor({
  document,
  component,
  onChange,
}: {
  document: DocumentData;
  component: ComponentDefinition;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const [draftName, setDraftName] = useState(component.name);
  useEffect(() => setDraftName(component.name), [component.name]);
  const bindableNodes = useMemo(
    () => collectBindableNodes(document, component),
    [component, document],
  );
  const boundNodeIds = new Set(component.propDefinitions.map((prop) => prop.binding.nodeId));

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input value={draftName} aria-label="컴포넌트 이름" onChange={(event) => setDraftName(event.target.value)} />
        <Button
          type="button"
          size="sm"
          disabled={draftName === component.name}
          onClick={() => onChange((current) => applyComponentDefinitionDraft(current, {
            ...current.components[component.id],
            name: draftName,
          }))}
        >
          적용
        </Button>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Props</h3>
        {component.propDefinitions.length === 0 && (
          <p className="text-xs text-muted-foreground">노출된 prop이 없습니다.</p>
        )}
        <div className="space-y-1">
          {component.propDefinitions.map((prop) => (
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5" key={prop.id}>
              <span className="min-w-0 flex-1 truncate text-xs">{prop.name}</span>
              <span className="text-[10px] text-muted-foreground">{prop.status}</span>
              {prop.status === "active" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${prop.name} 보관`}
                  onClick={() => onChange((current) => archiveComponentProp(current, component.id, prop.id))}
                >
                  <ArchiveIcon aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Prop으로 노출</h3>
        <div className="space-y-1">
          {bindableNodes.map((node) => {
            const bound = boundNodeIds.has(node.id);
            return (
              <Button
                key={node.id}
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={bound}
                onClick={() => onChange((current) => exposeComponentProp(
                  current,
                  component.id,
                  node.id,
                  node.name || node.type,
                ).document)}
              >
                <PlusIcon aria-hidden="true" />
                <span className="truncate">{node.name || node.type}</span>
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function collectBindableNodes(
  document: DocumentData,
  component: ComponentDefinition,
): Array<Extract<DocumentNode, { type: "text" | "rich-text" | "markdown" | "image" }>> {
  const result: Array<Extract<DocumentNode, { type: "text" | "rich-text" | "markdown" | "image" }>> = [];
  const visit = (nodeId: string) => {
    const node = document.nodes[nodeId];
    if (!node) return;
    if (["text", "rich-text", "markdown", "image"].includes(node.type)) {
      result.push(node as Extract<DocumentNode, { type: "text" | "rich-text" | "markdown" | "image" }>);
    }
    if (node.type === "container") node.childIds.forEach(visit);
  };
  visit(component.rootNodeId);
  return result;
}
