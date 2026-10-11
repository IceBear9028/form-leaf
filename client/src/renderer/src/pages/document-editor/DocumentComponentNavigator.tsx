import { BoxesIcon, ChevronRightIcon } from "lucide-react";
import type { DocumentData } from "../../../../foundation/documentModel.ts";
import { Button } from "@/shared/ui/button";

export function DocumentComponentNavigator({
  document,
  onEditComponent,
}: {
  document: DocumentData;
  onEditComponent: (componentId: string) => void;
}) {
  const components = Object.values(document.components);

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-background" aria-label="Document components">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <h2 className="text-sm font-semibold">콘텐츠</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          미리보기에서 글자를 눌러 값을 편집하세요.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
          <BoxesIcon className="size-3.5" aria-hidden="true" />
          공통 컴포넌트
        </div>
        {components.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            이 문서에는 아직 공통 컴포넌트가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {components.map((component) => {
              const usage = componentUsage(document, component.id);
              return (
                <div className="rounded-lg border border-border bg-background p-3" key={component.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{component.name || "이름 없는 컴포넌트"}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        연결된 항목 {usage}개 · 속성 {component.propDefinitions.filter((prop) => prop.status === "active").length}개
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${component.name || "컴포넌트"} 편집`}
                      onClick={() => onEditComponent(component.id)}
                    >
                      <ChevronRightIcon aria-hidden="true" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => onEditComponent(component.id)}
                  >
                    컴포넌트 편집
                  </Button>
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
  return Object.values(document.nodes).reduce((count, node) => {
    if (node.archivedFrom) return count;
    if (node.type === "component-instance" && node.componentId === componentId) return count + 1;
    if (node.type === "repeater" && node.itemComponentId === componentId) {
      return count + node.items.filter((item) => item.visible).length;
    }
    return count;
  }, 0);
}
