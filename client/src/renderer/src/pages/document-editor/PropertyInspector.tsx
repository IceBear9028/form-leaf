import type { KeyboardEvent } from "react";
import {
  AlignCenterVerticalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalJustifyCenterIcon,
  AlignHorizontalJustifyEndIcon,
  AlignHorizontalJustifyStartIcon,
  AlignHorizontalSpaceBetweenIcon,
  AlignStartVerticalIcon,
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
  AlignVerticalSpaceBetweenIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  CrosshairIcon,
  MoveIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PanelTopIcon,
  Rows3Icon,
  StretchHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import type {
  ComponentInstanceValue,
  ComponentPropDefinition,
  ComponentPropValue,
  DocumentData,
  DocumentNode,
  StyleDefinition,
  WidthValue,
} from "../../../../foundation/documentModel.ts";
import {
  applyDocumentStylePreset,
  DOCUMENT_STYLE_PRESETS,
  matchesDocumentStylePreset,
} from "../../../../foundation/documentStylePresets.ts";
import {
  addRepeaterItemFromDefaults,
  clearComponentInstanceProp,
  clearRepeaterItemProp,
  duplicateRepeaterItem,
  moveRepeaterItem,
  removeRepeaterItem,
  setComponentInstanceProp,
  setRepeaterItemProp,
  setRepeaterItemVisibility,
} from "../../../../foundation/documentComponentOperations.ts";
import {
  detachNodeStyle,
  renameNode,
  setNodeVisibility,
  updateNode,
  updateNodeStyle,
} from "../../../../foundation/documentTransactions.ts";
import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";
import { Input } from "@/shared/ui/input";
import {
  Select as SelectRoot,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { DocumentSelection } from "./documentSelection.ts";
import { repeaterItemLabel } from "./repeaterItemPresentation.ts";
import type { GenericDocumentChange } from "./useGenericDocumentSession.ts";

export function PropertyInspector({
  document,
  selection,
  onSelectionChange,
  onChange,
}: {
  document: DocumentData;
  selection?: DocumentSelection;
  onSelectionChange?: (selection?: DocumentSelection) => void;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const node = selection ? document.nodes[selection.nodeId] : undefined;
  if (!node || node.archivedFrom) {
    return (
      <aside className="border-l border-border bg-background p-4" aria-label="Properties">
        <h2 className="text-sm font-semibold">속성</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">문서나 레이어에서 요소를 선택하세요.</p>
      </aside>
    );
  }

  if (selection?.kind === "repeater-item") {
    if (node.type !== "repeater") return null;
    const itemIndex = node.items.findIndex((item) => item.id === selection.itemId);
    const item = node.items[itemIndex];
    if (!item) return null;
    const definitions = document.components[node.itemComponentId].propDefinitions;
    return (
      <aside className="min-h-0 overflow-y-auto border-l border-border bg-background" aria-label="Properties">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <h2 className="text-sm font-semibold">속성</h2>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">REPEATER ITEM</p>
        </div>
        <InspectorSection title="반복 항목">
          <p className="truncate text-sm font-medium">{repeaterItemLabel(document, node, item, itemIndex)}</p>
          <p className="text-xs text-muted-foreground">{node.name || "Repeater"}의 {itemIndex + 1}번째 항목</p>
          <ToggleField
            label="표시"
            checked={item.visible}
            onCheckedChange={(visible) => onChange((current) => (
              setRepeaterItemVisibility(current, node.id, item.id, visible)
            ))}
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => {
              onChange((current) => removeRepeaterItem(current, node.id, item.id));
              onSelectionChange?.(undefined);
            }}
          >
            <Trash2Icon aria-hidden="true" />
            항목 삭제
          </Button>
          <p className="text-[11px] leading-4 text-muted-foreground">
            즉시 삭제되며 Ctrl/Cmd+Z로 실행 취소할 수 있습니다.
          </p>
        </InspectorSection>
        <ComponentPropsSection
          title="항목 값"
          definitions={definitions}
          values={item.props}
          assets={document.assets}
          onSet={(propId, value) => onChange((current) => setRepeaterItemProp(
            current,
            node.id,
            item.id,
            propId,
            value,
          ))}
          onClear={(propId) => onChange((current) => clearRepeaterItemProp(
            current,
            node.id,
            item.id,
            propId,
          ))}
        />
      </aside>
    );
  }

  const style = node.styleId ? document.styles[node.styleId] : undefined;
  const layoutDirection = style?.layout?.direction ?? "column";
  const changeStyle = (update: (style: StyleDefinition) => StyleDefinition) => {
    onChange((current) => updateNodeStyle(current, node.id, update));
  };

  return (
    <aside className="min-h-0 overflow-y-auto border-l border-border bg-background" aria-label="Properties">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <h2 className="text-sm font-semibold">속성</h2>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{node.type}</p>
      </div>

      <InspectorSection title="요소">
        <Field label="이름">
          <Input
            value={node.name}
            onChange={(event) => onChange((current) => renameNode(current, node.id, event.target.value))}
          />
        </Field>
        {node.id !== document.rootNodeId && (
          <ToggleField
            label="표시"
            checked={node.visible}
            onCheckedChange={(visible) => onChange((current) => setNodeVisibility(current, node.id, visible))}
          />
        )}
        {isDirectlyEditable(node) && (
          <p className="rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
            내용은 문서 화면에서 직접 편집합니다.
          </p>
        )}
      </InspectorSection>

      {node.id === document.rootNodeId && (
        <InspectorSection title="문서 스타일">
          <p className="text-xs leading-5 text-muted-foreground">
            글자 크기, 줄 높이와 내용 간격을 한 번에 적용합니다. 적용 후 각 속성을 따로 바꿀 수 있습니다.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DOCUMENT_STYLE_PRESETS.map((preset) => (
              <Button
                type="button"
                variant={matchesDocumentStylePreset(style, preset.id) ? "secondary" : "outline"}
                key={preset.id}
                onClick={() => changeStyle((current) => applyDocumentStylePreset(current, preset.id))}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </InspectorSection>
      )}

      {node.type === "image" && (
        <InspectorSection title="이미지">
          <Field label="대체 텍스트">
            <Input
              value={node.alt}
              onChange={(event) => {
                const alt = event.target.value;
                onChange((current) => updateNode(current, node.id, (entry) => (
                  entry.type === "image" ? { ...entry, alt } : entry
                )));
              }}
            />
          </Field>
          <Field label="Asset">
            <Select
              value={node.assetId ?? ""}
              onChange={(assetId) => onChange((current) => updateNode(current, node.id, (entry) => {
                if (entry.type !== "image") return entry;
                const next = { ...entry };
                if (assetId) next.assetId = assetId;
                else delete next.assetId;
                return next;
              }))}
              options={[
                { value: "", label: "없음" },
                ...Object.values(document.assets).map((asset) => ({ value: asset.id, label: asset.name || asset.id })),
              ]}
            />
          </Field>
        </InspectorSection>
      )}

      {node.type === "component-instance" && (
        <ComponentPropsSection
          definitions={document.components[node.componentId].propDefinitions}
          values={node.props}
          assets={document.assets}
          onSet={(propId, value) => onChange((current) => setComponentInstanceProp(
            current,
            node.id,
            propId,
            value,
          ))}
          onClear={(propId) => onChange((current) => clearComponentInstanceProp(current, node.id, propId))}
        />
      )}

      {node.type === "repeater" && (
        <RepeaterItemsSection
          document={document}
          node={node}
          onChange={onChange}
        />
      )}

      {node.type === "container" && (
        <>
          <InspectorSection title="오토레이아웃">
            <ControlField label="흐름">
              <IconSegmentedControl
                value={layoutDirection}
                onChange={(direction) => changeStyle((current) => ({
                  ...current,
                  layout: { ...current.layout, direction },
                }))}
                options={[
                  { value: "column", label: "세로 흐름", icon: <ArrowDownIcon /> },
                  { value: "row", label: "가로 흐름", icon: <ArrowRightIcon /> },
                ]}
              />
            </ControlField>

            <div className="grid grid-cols-2 gap-3">
              <ControlField label="교차축 정렬">
                <IconSegmentedControl
                  value={style?.layout?.align ?? "stretch"}
                  onChange={(align) => changeStyle((current) => ({
                    ...current,
                    layout: { ...current.layout, align },
                  }))}
                  options={[
                    { value: "start", label: "시작 정렬", icon: <AlignStartVerticalIcon /> },
                    { value: "center", label: "가운데 정렬", icon: <AlignCenterVerticalIcon /> },
                    { value: "end", label: "끝 정렬", icon: <AlignEndVerticalIcon /> },
                    { value: "stretch", label: "늘려서 정렬", icon: <StretchHorizontalIcon /> },
                  ]}
                />
              </ControlField>
              <ControlField label="주축 정렬">
                <IconSegmentedControl
                  value={style?.layout?.justify ?? "start"}
                  onChange={(justify) => changeStyle((current) => ({
                    ...current,
                    layout: { ...current.layout, justify },
                  }))}
                  options={layoutDirection === "row" ? [
                    { value: "start", label: "시작 정렬", icon: <AlignHorizontalJustifyStartIcon /> },
                    { value: "center", label: "가운데 정렬", icon: <AlignHorizontalJustifyCenterIcon /> },
                    { value: "end", label: "끝 정렬", icon: <AlignHorizontalJustifyEndIcon /> },
                    { value: "between", label: "사이 간격", icon: <AlignHorizontalSpaceBetweenIcon /> },
                  ] : [
                    { value: "start", label: "시작 정렬", icon: <AlignVerticalJustifyStartIcon /> },
                    { value: "center", label: "가운데 정렬", icon: <AlignVerticalJustifyCenterIcon /> },
                    { value: "end", label: "끝 정렬", icon: <AlignVerticalJustifyEndIcon /> },
                    { value: "between", label: "사이 간격", icon: <AlignVerticalSpaceBetweenIcon /> },
                  ]}
                />
              </ControlField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="간격 (pt)"
                value={style?.layout?.gapPt}
                min={0}
                onChange={(gapPt) => changeStyle((current) => {
                  const layout = { ...current.layout };
                  if (gapPt === undefined) delete layout.gapPt;
                  else layout.gapPt = gapPt;
                  return { ...current, layout };
                })}
              />
              <NumberField
                label="높이 (pt)"
                value={style?.layout?.heightPt}
                min={0.01}
                onChange={(heightPt) => changeStyle((current) => {
                  const layout = { ...current.layout };
                  if (heightPt === undefined) delete layout.heightPt;
                  else layout.heightPt = heightPt;
                  return { ...current, layout };
                })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="폭">
                <Select
                  value={style?.layout?.width?.mode ?? "auto"}
                  onChange={(mode) => changeStyle((current) => ({
                    ...current,
                    layout: {
                      ...current.layout,
                      width: mode === "fixed"
                        ? { mode, valuePt: current.layout?.width?.mode === "fixed" ? current.layout.width.valuePt : 240 }
                        : { mode } as WidthValue,
                    },
                  }))}
                  options={[
                    { value: "auto", label: "자동" },
                    { value: "fill", label: "채우기" },
                    { value: "fixed", label: "고정" },
                  ]}
                />
              </Field>
              {style?.layout?.width?.mode === "fixed" ? (
                <NumberField
                  label="고정 폭 (pt)"
                  value={style.layout.width.valuePt}
                  min={0.01}
                  onChange={(valuePt) => {
                    if (valuePt === undefined) return;
                    changeStyle((current) => ({
                      ...current,
                      layout: { ...current.layout, width: { mode: "fixed", valuePt } },
                    }));
                  }}
                />
              ) : <div />}
            </div>

            <PaddingFields
              value={style?.layout?.paddingPt}
              onChange={(paddingPt) => changeStyle((current) => ({
                ...current,
                layout: { ...current.layout, paddingPt },
              }))}
            />
          </InspectorSection>
          <InspectorSection title="위치">
            <PositionFields style={style} onChange={changeStyle} />
          </InspectorSection>
        </>
      )}

      {node.type !== "container" && (
        <InspectorSection title="위치">
          <PositionFields style={style} onChange={changeStyle} />
        </InspectorSection>
      )}

      <InspectorSection title="글자">
        <Field label="글꼴">
          <Input
            key={style?.typography?.fontFamily ?? "font-empty"}
            defaultValue={style?.typography?.fontFamily ?? ""}
            placeholder="기본값"
            onBlur={(event) => {
              const fontFamily = event.currentTarget.value.trim();
              changeStyle((current) => {
                const typography = { ...current.typography };
                if (fontFamily) typography.fontFamily = fontFamily;
                else delete typography.fontFamily;
                return { ...current, typography };
              });
            }}
            onKeyDown={blurOnEnter}
          />
        </Field>
        <NumberField
          label="크기 (pt)"
          value={style?.typography?.fontSizePt}
          min={0.01}
          onChange={(fontSizePt) => changeStyle((current) => {
            const typography = { ...current.typography };
            if (fontSizePt === undefined) delete typography.fontSizePt;
            else typography.fontSizePt = fontSizePt;
            return { ...current, typography };
          })}
        />
        <NumberField
          label="줄 높이"
          value={style?.typography?.lineHeight}
          min={0.01}
          step={0.1}
          onChange={(lineHeight) => changeStyle((current) => {
            const typography = { ...current.typography };
            if (lineHeight === undefined) delete typography.lineHeight;
            else typography.lineHeight = lineHeight;
            return { ...current, typography };
          })}
        />
        <NumberField
          label="굵기"
          value={style?.typography?.fontWeight}
          min={100}
          max={1000}
          step={100}
          onChange={(fontWeight) => changeStyle((current) => {
            const typography = { ...current.typography };
            if (fontWeight === undefined) delete typography.fontWeight;
            else typography.fontWeight = fontWeight;
            return { ...current, typography };
          })}
        />
        <ColorField
          label="색상"
          value={style?.typography?.color?.kind === "hex" ? style.typography.color.value : ""}
          onChange={(value) => changeStyle((current) => {
            const typography = { ...current.typography };
            if (value) typography.color = { kind: "hex", value };
            else delete typography.color;
            return { ...current, typography };
          })}
        />
      </InspectorSection>

      <DecorationSection style={style} onChange={changeStyle} />

      {node.type === "markdown" && (
        <InspectorSection title="Markdown">
          <NumberField
            label="목록 항목 간격 (pt)"
            value={style?.markdown?.listItemGapPt}
            min={0}
            onChange={(listItemGapPt) => changeStyle((current) => {
              const markdown = { ...current.markdown };
              if (listItemGapPt === undefined) delete markdown.listItemGapPt;
              else markdown.listItemGapPt = listItemGapPt;
              return { ...current, markdown };
            })}
          />
        </InspectorSection>
      )}

      <InspectorSection title="페이지">
        <ToggleField
          label="한 덩어리로 유지"
          checked={style?.pagination?.keepTogether ?? false}
          onCheckedChange={(keepTogether) => changeStyle((current) => ({
            ...current,
            pagination: { ...current.pagination, keepTogether },
          }))}
        />
        <ToggleField
          label="다음 요소와 유지"
          checked={style?.pagination?.keepWithNext ?? false}
          onCheckedChange={(keepWithNext) => changeStyle((current) => ({
            ...current,
            pagination: { ...current.pagination, keepWithNext },
          }))}
        />
        <ToggleField
          label="앞에서 페이지 나누기"
          checked={style?.pagination?.forcePageBreakBefore ?? false}
          onCheckedChange={(forcePageBreakBefore) => changeStyle((current) => ({
            ...current,
            pagination: { ...current.pagination, forcePageBreakBefore },
          }))}
        />
      </InspectorSection>

      {style && (
        <div className="border-t border-border p-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onChange((current) => detachNodeStyle(current, node.id))}
          >
            스타일 초기화
          </Button>
        </div>
      )}
    </aside>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-border p-4">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ControlField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function IconSegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon: React.ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <ButtonGroup className="grid w-full auto-cols-fr grid-flow-col rounded-lg bg-muted/70 p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            size="icon-sm"
            variant="ghost"
            className={`h-8 w-full border-0 ${selected ? "bg-background text-foreground shadow-xs hover:bg-background" : "text-muted-foreground"}`}
            aria-label={option.label}
            aria-pressed={selected}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <SelectRoot
      items={options}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(nextValue);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </SelectRoot>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value?: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        key={`${label}-${value ?? "empty"}`}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        placeholder="기본값"
        onBlur={(event) => {
          const source = event.currentTarget.value.trim();
          if (!source) {
            onChange(undefined);
            return;
          }
          const next = Number(source);
          if (!Number.isFinite(next) || (min !== undefined && next < min) || (max !== undefined && next > max)) {
            event.currentTarget.value = value === undefined ? "" : String(value);
            return;
          }
          onChange(next);
        }}
        onKeyDown={blurOnEnter}
      />
    </Field>
  );
}

function PaddingFields({
  value = [0, 0, 0, 0],
  onChange,
}: {
  value?: [number, number, number, number];
  onChange: (value: [number, number, number, number]) => void;
}) {
  const labels = ["위", "오른쪽", "아래", "왼쪽"];
  return (
    <div className="grid gap-1.5 text-xs">
      <span className="text-muted-foreground">안쪽 여백 (pt)</span>
      <div className="grid grid-cols-2 gap-2">
        {value.map((entry, index) => (
          <label className="grid grid-cols-[auto_1fr] items-center gap-2" key={labels[index]}>
            <span className="text-muted-foreground">{labels[index]}</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={entry}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next) || next < 0) return;
                const padding = [...value] as [number, number, number, number];
                padding[index] = next;
                onChange(padding);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function PositionFields({
  style,
  onChange,
}: {
  style?: StyleDefinition;
  onChange: (update: (style: StyleDefinition) => StyleDefinition) => void;
}) {
  const position = style?.layout?.position;
  return (
    <>
      <ControlField label="배치 방식">
        <IconSegmentedControl
          value={position ?? "flow"}
          onChange={(value) => onChange((current) => {
            const layout = { ...current.layout };
            if (value === "flow") {
              delete layout.position;
              delete layout.topPt;
              delete layout.rightPt;
              delete layout.bottomPt;
              delete layout.leftPt;
            } else {
              layout.position = value as NonNullable<StyleDefinition["layout"]>["position"];
            }
            return { ...current, layout };
          })}
          options={[
            { value: "flow", label: "오토레이아웃", icon: <Rows3Icon /> },
            { value: "relative", label: "상대 위치", icon: <MoveIcon /> },
            { value: "absolute", label: "자유 위치", icon: <CrosshairIcon /> },
          ]}
        />
      </ControlField>
      {position && (
        <div className="grid grid-cols-2 gap-2">
          {(["leftPt", "topPt", "rightPt", "bottomPt"] as const).map((property) => (
            <NumberField
              key={property}
              label={`${{ topPt: "Y", rightPt: "오른쪽", bottomPt: "아래", leftPt: "X" }[property]} (pt)`}
              value={style?.layout?.[property]}
              onChange={(value) => onChange((current) => {
                const layout = { ...current.layout };
                if (value === undefined) delete layout[property];
                else layout[property] = value;
                return { ...current, layout };
              })}
            />
          ))}
        </div>
      )}
    </>
  );
}

type BorderEdge = NonNullable<NonNullable<StyleDefinition["decoration"]>["borderEdges"]>[number];

function DecorationSection({
  style,
  onChange,
}: {
  style?: StyleDefinition;
  onChange: (update: (style: StyleDefinition) => StyleDefinition) => void;
}) {
  const decoration = style?.decoration;
  const borderEdges = decoration?.borderEdges ?? [];
  const edgeOptions: Array<{ value: BorderEdge; label: string; icon: React.ReactNode }> = [
    { value: "top", label: "위쪽 선", icon: <PanelTopIcon /> },
    { value: "right", label: "오른쪽 선", icon: <PanelRightIcon /> },
    { value: "bottom", label: "아래쪽 선", icon: <PanelBottomIcon /> },
    { value: "left", label: "왼쪽 선", icon: <PanelLeftIcon /> },
  ];
  const changeDecoration = (update: (current: NonNullable<StyleDefinition["decoration"]>) => NonNullable<StyleDefinition["decoration"]>) => {
    onChange((current) => withDecoration(current, update({ ...current.decoration })));
  };

  return (
    <InspectorSection title="장식">
      <ColorField
        label="배경색"
        value={decoration?.background?.kind === "hex" ? decoration.background.value : ""}
        onChange={(value) => changeDecoration((current) => {
          if (value) current.background = { kind: "hex", value };
          else delete current.background;
          return current;
        })}
      />
      <ColorField
        label="선 색상"
        value={decoration?.borderColor?.kind === "hex" ? decoration.borderColor.value : ""}
        onChange={(value) => changeDecoration((current) => {
          if (value) current.borderColor = { kind: "hex", value };
          else delete current.borderColor;
          return current;
        })}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="선 두께 (pt)"
          value={decoration?.borderWidthPt}
          min={0}
          step={0.25}
          onChange={(borderWidthPt) => changeDecoration((current) => {
            if (borderWidthPt === undefined) delete current.borderWidthPt;
            else current.borderWidthPt = borderWidthPt;
            return current;
          })}
        />
        <NumberField
          label="모서리 (pt)"
          value={decoration?.radiusPt}
          min={0}
          step={0.5}
          onChange={(radiusPt) => changeDecoration((current) => {
            if (radiusPt === undefined) delete current.radiusPt;
            else current.radiusPt = radiusPt;
            return current;
          })}
        />
      </div>
      <ControlField label="선 방향">
        <ButtonGroup className="grid w-full grid-cols-4 rounded-lg bg-muted/70 p-0.5">
          {edgeOptions.map((option) => {
            const selected = borderEdges.includes(option.value);
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger
                  render={(
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className={`h-8 w-full border-0 ${selected ? "bg-background text-foreground shadow-xs hover:bg-background" : "text-muted-foreground"}`}
                      aria-label={option.label}
                      aria-pressed={selected}
                      onClick={() => changeDecoration((current) => {
                        const edges = current.borderEdges ?? [];
                        const next = edges.includes(option.value)
                          ? edges.filter((edge) => edge !== option.value)
                          : [...edges, option.value];
                        if (next.length) current.borderEdges = next;
                        else delete current.borderEdges;
                        return current;
                      })}
                    />
                  )}
                >
                  {option.icon}
                </TooltipTrigger>
                <TooltipContent>{option.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </ButtonGroup>
      </ControlField>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={!decoration}
        onClick={() => onChange((current) => {
          const next = { ...current };
          delete next.decoration;
          return next;
        })}
      >
        장식 전체 초기화
      </Button>
    </InspectorSection>
  );
}

function withDecoration(
  style: StyleDefinition,
  decoration: NonNullable<StyleDefinition["decoration"]>,
): StyleDefinition {
  const next = { ...style };
  if (Object.keys(decoration).length > 0) next.decoration = decoration;
  else delete next.decoration;
  return next;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value?: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-[2.25rem_1fr] gap-2">
        <input
          className="h-9 w-9 rounded-md border border-input bg-background p-1"
          type="color"
          value={value || "#000000"}
          aria-label={`${label} 선택`}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <Input
          key={`${label}-${value || "empty"}`}
          defaultValue={value}
          placeholder="#000000"
          onBlur={(event) => {
            const next = event.currentTarget.value.trim().toUpperCase();
            if (!next) {
              onChange(undefined);
              return;
            }
            if (!/^#[0-9A-F]{6}$/.test(next)) {
              event.currentTarget.value = value;
              return;
            }
            onChange(next);
          }}
          onKeyDown={blurOnEnter}
        />
      </div>
    </Field>
  );
}

function ComponentPropsSection({
  title = "컴포넌트 값",
  definitions,
  values,
  assets,
  onSet,
  onClear,
}: {
  title?: string;
  definitions: ComponentPropDefinition[];
  values: Record<string, ComponentPropValue>;
  assets: DocumentData["assets"];
  onSet: (propId: string, value: ComponentPropValue) => void;
  onClear: (propId: string) => void;
}) {
  return (
    <InspectorSection title={title}>
      {definitions.length === 0 && <p className="text-xs text-muted-foreground">노출된 prop이 없습니다.</p>}
      {definitions.map((definition) => {
        const overridden = Object.hasOwn(values, definition.id);
        const value = overridden ? values[definition.id] : definition.defaultValue;
        return (
          <div className="space-y-2 rounded-md border border-border bg-background p-2" key={definition.id}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{definition.name}</span>
              {definition.status === "archived" ? (
                <span className="text-[10px] text-muted-foreground">보관됨 · 값 유지</span>
              ) : overridden ? (
                <Button type="button" variant="ghost" size="xs" onClick={() => onClear(definition.id)}>기본값</Button>
              ) : (
                <span className="text-[10px] text-muted-foreground">기본값</span>
              )}
            </div>
            {definition.status === "active" && (
              <PropValueEditor
                definition={definition}
                value={value}
                assets={assets}
                onChange={(next) => onSet(definition.id, next)}
              />
            )}
          </div>
        );
      })}
    </InspectorSection>
  );
}

function RepeaterItemsSection({
  document,
  node,
  onChange,
}: {
  document: DocumentData;
  node: Extract<DocumentNode, { type: "repeater" }>;
  onChange: (change: GenericDocumentChange) => void;
}) {
  const definitions = document.components[node.itemComponentId].propDefinitions;
  return (
    <InspectorSection title="반복 항목">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onChange((current) => addRepeaterItemFromDefaults(current, node.id).document)}
      >
        항목 추가
      </Button>
      {node.items.length === 0 && <p className="text-xs text-muted-foreground">반복 항목이 없습니다.</p>}
      {node.items.map((item, index) => (
        <details className="rounded-md border border-border bg-background p-2" key={item.id} open={index === 0}>
          <summary className="cursor-pointer text-xs font-medium">항목 {index + 1}</summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={index === 0}
                onClick={() => onChange((current) => moveRepeaterItem(current, node.id, item.id, index - 1))}
              >위로</Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={index === node.items.length - 1}
                onClick={() => onChange((current) => moveRepeaterItem(current, node.id, item.id, index + 1))}
              >아래로</Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onChange((current) => duplicateRepeaterItem(current, node.id, item.id).document)}
              >복제</Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onChange((current) => setRepeaterItemVisibility(current, node.id, item.id, !item.visible))}
              >{item.visible ? "숨기기" : "표시"}</Button>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() => onChange((current) => removeRepeaterItem(current, node.id, item.id))}
              >삭제</Button>
            </div>
            <RepeaterItemProps
              item={item}
              definitions={definitions}
              assets={document.assets}
              onSet={(propId, value) => onChange((current) => setRepeaterItemProp(
                current,
                node.id,
                item.id,
                propId,
                value,
              ))}
              onClear={(propId) => onChange((current) => clearRepeaterItemProp(
                current,
                node.id,
                item.id,
                propId,
              ))}
            />
          </div>
        </details>
      ))}
    </InspectorSection>
  );
}

function RepeaterItemProps({
  item,
  definitions,
  assets,
  onSet,
  onClear,
}: {
  item: ComponentInstanceValue;
  definitions: ComponentPropDefinition[];
  assets: DocumentData["assets"];
  onSet: (propId: string, value: ComponentPropValue) => void;
  onClear: (propId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {definitions.map((definition) => {
        const overridden = Object.hasOwn(item.props, definition.id);
        const value = overridden ? item.props[definition.id] : definition.defaultValue;
        return (
          <div className="space-y-1.5" key={definition.id}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span>{definition.name}</span>
              {definition.status === "archived" ? (
                <span className="text-[10px] text-muted-foreground">보관됨</span>
              ) : overridden ? (
                <Button type="button" variant="ghost" size="xs" onClick={() => onClear(definition.id)}>기본값</Button>
              ) : null}
            </div>
            {definition.status === "active" && (
              <PropValueEditor
                definition={definition}
                value={value}
                assets={assets}
                onChange={(next) => onSet(definition.id, next)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PropValueEditor({
  definition,
  value,
  assets,
  onChange,
}: {
  definition: ComponentPropDefinition;
  value: ComponentPropValue;
  assets: DocumentData["assets"];
  onChange: (value: ComponentPropValue) => void;
}) {
  if (definition.valueType === "text" || definition.valueType === "markdown") {
    return (
      <textarea
        className="min-h-20 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (definition.valueType === "rich-text" && typeof value === "object" && "runs" in value) {
    return (
      <textarea
        className="min-h-20 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value.runs.map((run) => run.text).join("")}
        onChange={(event) => onChange({ runs: [{ text: event.target.value }] })}
      />
    );
  }
  if (definition.valueType === "image" && typeof value === "object" && "alt" in value) {
    return (
      <div className="space-y-2">
        <Input value={value.alt} placeholder="대체 텍스트" onChange={(event) => onChange({ ...value, alt: event.target.value })} />
        <Select
          value={value.assetId ?? ""}
          onChange={(assetId) => {
            const next = { ...value };
            if (assetId) next.assetId = assetId;
            else delete next.assetId;
            onChange(next);
          }}
          options={[
            { value: "", label: "이미지 없음" },
            ...Object.values(assets).map((asset) => ({ value: asset.id, label: asset.name || asset.id })),
          ]}
        />
      </div>
    );
  }
  if (definition.valueType === "boolean" && typeof value === "boolean") {
    return <ToggleField label="값" checked={value} onCheckedChange={onChange} />;
  }
  if (definition.valueType === "number" && typeof value === "number") {
    return (
      <NumberField
        label="값"
        value={value}
        min={Number.MIN_SAFE_INTEGER}
        max={Number.MAX_SAFE_INTEGER}
        onChange={(next) => {
          if (next !== undefined) onChange(next);
        }}
      />
    );
  }
  return <p className="text-xs text-destructive">지원하지 않는 prop 값입니다.</p>;
}

function isDirectlyEditable(node: DocumentNode): boolean {
  return node.type === "text" || node.type === "rich-text" || node.type === "markdown";
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}
