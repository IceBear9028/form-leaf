import type {
  FreeTextSection,
  IntroductionSection,
  ProfileSection,
  ProjectGroupSection,
  ProjectItem,
  ResumeDocument,
  ResumeLink,
  ResumeSection,
  TimelineItem,
  TimelineSection,
} from "../../../../../../foundation/content/resume";
import { createId, emptyText, plainText } from "../../../../../../foundation/content/resume";
import { ChevronDownIcon, ImageIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  Field as UiField,
  FieldDescription,
  FieldLabel,
} from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Accordion, AddButton, Field, ItemActions } from "./EditorPrimitives";
import { RichTextEditor } from "./RichTextEditor";
import { listResumeStyleSheets } from "../../style/registry";

type Props = {
  document: ResumeDocument;
  onChange: (document: ResumeDocument) => void;
};

const fieldGridClass = "mb-3 grid grid-cols-2 gap-3";
const itemListClass = "my-3 flex flex-col gap-2.5";
const cardBodyClass = "border-t px-3 pb-3.5 pt-0 [&>.item-actions]:mt-3";
const resumeStyleSheets = listResumeStyleSheets();

const move = <T,>(items: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const createLink = (): ResumeLink => ({ id: createId("link"), label: "", href: "" });

const createTimelineItem = (): TimelineItem => ({
  id: createId("timeline-item"),
  visible: true,
  period: { start: "", end: "" },
  organization: "",
  title: emptyText(),
  links: [],
  bodyMarkdown: "",
});

const createProjectItem = (order: number): ProjectItem => ({
  id: createId("project"),
  visible: true,
  order,
  period: { start: "", end: "" },
  organization: "",
  title: emptyText(),
  links: [],
  techStack: [],
  bodyMarkdown: "",
});

export function EditorPanel({ document, onChange }: Props) {
  const replaceSection = (nextSection: ResumeSection) => {
    onChange({
      ...document,
      sections: document.sections.map((section) =>
        section.id === nextSection.id ? nextSection : section,
      ),
    });
  };

  return (
    <aside className="editor-panel overflow-y-auto overscroll-contain border-r bg-muted/30 px-4 pb-15 pt-5" aria-label="이력서 편집">
      <div className="px-1 pb-5 [&_input]:text-sm [&_input]:font-medium">
        <Field
          label="문서 이름"
          value={document.name}
          onChange={(name) => onChange({ ...document, name })}
        />
        <UiField className="mt-3">
          <FieldLabel>이력서 스타일</FieldLabel>
          <Select
            value={document.styleSheetId}
            onValueChange={(styleSheetId) => onChange({ ...document, styleSheetId: styleSheetId ?? document.styleSheetId })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {resumeStyleSheets.map((styleSheet) => (
                <SelectItem key={styleSheet.id} value={styleSheet.id}>{styleSheet.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </UiField>
      </div>
      {document.sections.map((section) => {
        if (section.type === "profile") {
          return <ProfileEditor key={section.id} section={section} onChange={replaceSection} />;
        }
        if (section.type === "introduction") {
          return <IntroductionEditor key={section.id} section={section} onChange={replaceSection} />;
        }
        if (section.type === "timeline") {
          return <TimelineEditor key={section.id} section={section} onChange={replaceSection} />;
        }
        if (section.type === "project-group") {
          return <ProjectGroupEditor key={section.id} section={section} onChange={replaceSection} />;
        }
        return <FreeTextEditor key={section.id} section={section} onChange={replaceSection} />;
      })}
    </aside>
  );
}

function ProfileEditor({ section, onChange }: { section: ProfileSection; onChange: (section: ProfileSection) => void }) {
  return (
    <Accordion title="프로필" visible={section.visible} onVisibleChange={(visible) => onChange({ ...section, visible })} defaultOpen>
      <div className="mb-4 flex items-center gap-2">
        <div className="grid size-12 flex-none place-items-center overflow-hidden rounded-full border bg-muted text-muted-foreground">
          {section.photoDataUrl ? <img className="h-full w-full object-cover" src={section.photoDataUrl} alt="프로필 미리보기" /> : <ImageIcon aria-hidden="true" className="size-4" />}
        </div>
        <Button variant="outline" size="sm" render={<label />}>
          사진 선택
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onChange({ ...section, photoDataUrl: String(reader.result) });
              reader.readAsDataURL(file);
            }}
          />
        </Button>
        {section.photoDataUrl && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...section, photoDataUrl: undefined })}>사진 제거</Button>}
      </div>
      <div className={fieldGridClass}>
        <Field label="직무명" value={section.role} onChange={(role) => onChange({ ...section, role })} />
        <Field label="이름" value={section.name} onChange={(name) => onChange({ ...section, name })} />
        <Field label="전화번호" type="tel" value={section.phone} onChange={(phone) => onChange({ ...section, phone })} />
        <Field label="이메일" type="email" value={section.email} onChange={(email) => onChange({ ...section, email })} />
      </div>
      <LinksEditor links={section.links} onChange={(links) => onChange({ ...section, links })} />
    </Accordion>
  );
}

function IntroductionEditor({ section, onChange }: { section: IntroductionSection; onChange: (section: IntroductionSection) => void }) {
  return (
    <Accordion title="소개글" meta="Markdown" visible={section.visible} onVisibleChange={(visible) => onChange({ ...section, visible })}>
      <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
      <MarkdownEditor value={section.bodyMarkdown} onChange={(bodyMarkdown) => onChange({ ...section, bodyMarkdown })} />
    </Accordion>
  );
}

function TimelineEditor({ section, onChange }: { section: TimelineSection; onChange: (section: TimelineSection) => void }) {
  const labels = timelineLabels(section.timelineKind);
  const updateItem = (id: string, patch: Partial<TimelineItem>) => {
    onChange({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  return (
    <Accordion title={section.title} meta={`${section.items.length}개`} visible={section.visible} onVisibleChange={(visible) => onChange({ ...section, visible })}>
      <div className={fieldGridClass}>
        <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
        <Field label="제목 옆 보조 문구" value={section.annotation ?? ""} placeholder="선택 입력" onChange={(annotation) => onChange({ ...section, annotation })} />
      </div>
      <div className={itemListClass}>
        {section.items.map((item, index) => (
          <Collapsible className="overflow-hidden rounded-lg border bg-card" key={item.id} defaultOpen>
            <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="min-w-0 flex-1 truncate">{plainText(item.title) || item.organization || `항목 ${index + 1}`}</span>
              <span className="text-xs font-normal text-muted-foreground">{item.visible ? "표시" : "숨김"}</span>
              <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className={cardBodyClass}>
              <ItemActions
                onUp={index ? () => onChange({ ...section, items: move(section.items, index, index - 1) }) : undefined}
                onDown={index < section.items.length - 1 ? () => onChange({ ...section, items: move(section.items, index, index + 1) }) : undefined}
                onDelete={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}
              />
              <label className="mb-3 flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-sm">
                <span>미리보기에 표시</span>
                <Switch checked={item.visible} onCheckedChange={(visible) => updateItem(item.id, { visible })} />
              </label>
              <DateRangeEditor item={item} onChange={(period) => updateItem(item.id, { period })} />
              <Field label={labels.organization} value={item.organization} onChange={(organization) => updateItem(item.id, { organization })} />
              <RichTextEditor className="mt-[11px]" label={labels.title} multiline={false} value={item.title} onChange={(title) => updateItem(item.id, { title })} />
              <LinksEditor links={item.links} onChange={(links) => updateItem(item.id, { links })} />
              <MarkdownEditor value={item.bodyMarkdown} onChange={(bodyMarkdown) => updateItem(item.id, { bodyMarkdown })} />
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
      <AddButton onClick={() => onChange({ ...section, items: [...section.items, createTimelineItem()] })}>항목 추가</AddButton>
    </Accordion>
  );
}

function ProjectGroupEditor({ section, onChange }: { section: ProjectGroupSection; onChange: (section: ProjectGroupSection) => void }) {
  const updateItem = (id: string, patch: Partial<ProjectItem>) => {
    onChange({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  return (
    <Accordion title={section.title} meta={`${section.items.length}개`} visible={section.visible} onVisibleChange={(visible) => onChange({ ...section, visible })}>
      <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
      <div className={itemListClass}>
        {section.items.map((item, index) => (
          <Collapsible className="overflow-hidden rounded-lg border bg-card" key={item.id} defaultOpen>
            <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="min-w-0 flex-1 truncate">{plainText(item.title) || `프로젝트 ${index + 1}`}</span>
              <span className="text-xs font-normal text-muted-foreground">{item.visible ? "표시" : "숨김"}</span>
              <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className={cardBodyClass}>
              <ItemActions
                onUp={index ? () => onChange({ ...section, items: move(section.items, index, index - 1).map((entry, order) => ({ ...entry, order })) }) : undefined}
                onDown={index < section.items.length - 1 ? () => onChange({ ...section, items: move(section.items, index, index + 1).map((entry, order) => ({ ...entry, order })) }) : undefined}
                onDelete={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}
              />
              <label className="mb-3 flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-sm">
                <span>미리보기에 표시</span>
                <Switch checked={item.visible} onCheckedChange={(visible) => updateItem(item.id, { visible })} />
              </label>
              <DateRangeEditor item={item} onChange={(period) => updateItem(item.id, { period })} />
              <Field label="소속" value={item.organization} onChange={(organization) => updateItem(item.id, { organization })} />
              <RichTextEditor className="mt-[11px]" label="프로젝트명" multiline={false} value={item.title} onChange={(title) => updateItem(item.id, { title })} />
              <Field className="mt-[11px]" label="기술 스택" value={item.techStack.join(",")} placeholder="React, TypeScript" onChange={(value) => updateItem(item.id, { techStack: value.split(",") })} />
              <LinksEditor links={item.links} onChange={(links) => updateItem(item.id, { links })} />
              <MarkdownEditor value={item.bodyMarkdown} onChange={(bodyMarkdown) => updateItem(item.id, { bodyMarkdown })} />
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
      <AddButton onClick={() => onChange({ ...section, items: [...section.items, createProjectItem(section.items.length)] })}>프로젝트 추가</AddButton>
    </Accordion>
  );
}

function FreeTextEditor({ section, onChange }: { section: FreeTextSection; onChange: (section: FreeTextSection) => void }) {
  return (
    <Accordion title="프리텍스트" meta="Markdown" visible={section.visible} onVisibleChange={(visible) => onChange({ ...section, visible })}>
      <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
      <MarkdownEditor value={section.bodyMarkdown} onChange={(bodyMarkdown) => onChange({ ...section, bodyMarkdown })} />
    </Accordion>
  );
}

function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <UiField className="mt-3">
      <FieldLabel>본문</FieldLabel>
      <Textarea
        className="min-h-36 resize-y font-mono text-xs leading-relaxed"
        value={value}
        placeholder={"Markdown으로 본문을 작성하세요.\n\n### 소제목\n\n- 주요 내용"}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldDescription>H1~H6, 목록, 강조, 링크, 인용문, 코드와 표를 사용할 수 있습니다.</FieldDescription>
    </UiField>
  );
}

function timelineLabels(kind: TimelineSection["timelineKind"]): { organization: string; title: string } {
  if (kind === "career") return { organization: "회사명", title: "직무·고용 형태" };
  if (kind === "education") return { organization: "교육 기관", title: "교육·학위" };
  return { organization: "기관·주최", title: "활동명·수상명" };
}

function DateRangeEditor({ item, onChange }: { item: { period: { start: string; end: string; label?: string } }; onChange: (period: { start: string; end: string; label?: string }) => void }) {
  return (
    <div className={`${fieldGridClass} grid-cols-3`}>
      <Field label="시작" value={item.period.start} placeholder="2023. 01" onChange={(start) => onChange({ ...item.period, start })} />
      <Field label="종료" value={item.period.end} placeholder="현재" onChange={(end) => onChange({ ...item.period, end })} />
      <Field label="기간 표기" value={item.period.label ?? ""} placeholder="1년 2개월" onChange={(label) => onChange({ ...item.period, label })} />
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: ResumeLink[]; onChange: (links: ResumeLink[]) => void }) {
  return (
    <div className="mt-3">
      <div className="flex min-h-7 items-center justify-between text-sm font-medium">
        <span>링크</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...links, createLink()])}>
          <PlusIcon aria-hidden="true" /> 추가
        </Button>
      </div>
      {links.map((link) => (
        <div className="mt-1.5 grid grid-cols-[0.7fr_1.3fr_auto] gap-1.5" key={link.id}>
          <Input aria-label="링크 이름" value={link.label} placeholder="링크 이름" onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, label: event.target.value } : entry))} />
          <Input aria-label="링크 URL" type="url" value={link.href} placeholder="https://" onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, href: event.target.value } : entry))} />
          <Tooltip>
            <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="링크 삭제" onClick={() => onChange(links.filter((entry) => entry.id !== link.id))} />}>
              <XIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>링크 삭제</TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}
