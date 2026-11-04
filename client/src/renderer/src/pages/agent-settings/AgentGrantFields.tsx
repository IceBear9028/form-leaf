import { useId, useState } from "react";
import { FileTextIcon, SearchIcon } from "lucide-react";
import type { AgentGrants } from "../../../../foundation/agentConnection.ts";
import type { DocumentSummary } from "../../../../foundation/documentLibrary.ts";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { FieldSet, FieldLegend } from "@/shared/ui/field";
import { Label } from "@/shared/ui/label";

export const blankAgentGrants = (): AgentGrants => ({ documentIds: [], write: false, create: false, libraryRead: false, render: false });
export function AgentGrantFields({ value, onChange, documents, disabled = false }: {
  value: AgentGrants; onChange: (grants: AgentGrants) => void; documents: DocumentSummary[]; disabled?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const visible = documents.filter((document) => document.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const toggle = (key: Exclude<keyof AgentGrants, "documentIds">, checked: boolean) => onChange({
    ...value, [key]: checked,
    ...(key === "create" && checked ? { write: true } : {}),
    ...(key === "write" && !checked ? { create: false } : {}),
  });
  return <div className="flex flex-col gap-6">
    <FieldSet disabled={disabled} className="m-0 min-w-0 gap-3 border-0 p-0">
      <FieldLegend variant="label" className="m-0 p-0">읽기를 허용할 문서</FieldLegend>
      <p className="m-0 text-xs text-muted-foreground">선택하지 않은 문서는 이 연결에 표시되지 않습니다.</p>
      {documents.length > 4 && <div className="relative"><SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label="허용할 문서 검색" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="문서 이름으로 검색" /></div>}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border px-3">
        {visible.map((document) => <label key={document.id} className="flex cursor-pointer items-center gap-3 border-b border-border py-3 last:border-0">
          <input type="checkbox" className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring" aria-label={document.name} checked={value.documentIds.includes(document.id)} onChange={(event) => onChange({ ...value, documentIds: event.target.checked ? [...value.documentIds, document.id] : value.documentIds.filter((item) => item !== document.id) })} />
          <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words text-sm">{document.name}</span>
        </label>)}
        {!visible.length && <p className="m-0 py-5 text-center text-sm text-muted-foreground">{documents.length ? "검색 결과가 없습니다." : "문서를 먼저 만들거나, 아래에서 새 문서 생성을 허용하세요."}</p>}
      </div><p className="m-0 text-xs text-muted-foreground">{value.documentIds.length}개 문서 선택됨</p>
    </FieldSet>
    <FieldSet disabled={disabled} className="m-0 min-w-0 gap-4 border-0 p-0">
      <FieldLegend variant="label" className="m-0 mb-3 p-0">추가로 허용할 작업</FieldLegend>
      {([
        ["write", "허용 문서 수정", "선택한 문서의 내용과 구성을 변경합니다."],
        ["create", "새 문서 생성", "문서 수정 권한이 함께 필요합니다. 만든 문서는 이 연결에 허용됩니다."],
        ["render", "미리보기와 PDF 출력", "허용한 문서의 저장본을 출력합니다."],
        ["libraryRead", "개인 컴포넌트 라이브러리 읽기", "허용 문서와 별도로 개인 라이브러리 전체를 조회합니다."],
      ] as const).map(([key, title, description]) => <div key={key} className="flex items-center justify-between gap-4">
        <div className="min-w-0"><Label htmlFor={`${id}-${key}`}>{title}</Label><p className="m-0 mt-1 text-xs text-muted-foreground">{description}</p></div>
        <Switch id={`${id}-${key}`} disabled={disabled} checked={value[key]} onCheckedChange={(checked) => toggle(key, checked)} />
      </div>)}
    </FieldSet>
  </div>;
}
