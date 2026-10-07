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
import { Accordion, AddButton, Field, ItemActions } from "./EditorPrimitives";
import { RichTextEditor } from "./RichTextEditor";
import { listResumeStyleSheets } from "../../style/registry";

type Props = {
  document: ResumeDocument;
  onChange: (document: ResumeDocument) => void;
};

const fieldGridClass = "mb-3 grid grid-cols-2 gap-[11px]";
const itemListClass = "my-3 flex flex-col gap-[9px]";
const collapsibleCardClass = "overflow-hidden rounded-[9px] border border-[#e1e5eb] bg-[#fbfcfd]";
const cardSummaryClass = "flex cursor-pointer list-none justify-between gap-3 px-3 py-[11px] text-xs font-[680] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3178ff] [&::-webkit-details-marker]:hidden [&>span:first-child]:min-w-0 [&>span:first-child]:overflow-hidden [&>span:first-child]:text-ellipsis [&>span:first-child]:whitespace-nowrap [&>span:last-child]:whitespace-nowrap [&>span:last-child]:text-[10px] [&>span:last-child]:font-medium [&>span:last-child]:text-[#929aa6]";
const cardBodyClass = "border-t border-[#edf0f3] px-3 pb-3.5 pt-0 [&>.item-actions]:mt-[9px]";
const checkFieldClass = "mb-[11px] flex items-center gap-1.5 text-[11px] text-[#626e7e] [&_input]:accent-[#1768e5]";
const textButtonClass = "cursor-pointer border-0 bg-transparent p-1 text-[11px] font-[650] text-[#1768e5] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]";
const iconButtonClass = "h-[25px] min-w-[25px] cursor-pointer rounded-md border border-[#dde2e8] bg-white p-0 text-[15px] text-[#697486] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]";
const smallInputClass = "h-8 w-full rounded-[7px] border border-[#dce1e7] bg-white px-2.5 text-xs text-[#1d2735] placeholder:text-[#b3bac4] focus:border-[#73a4ec] focus:outline-2 focus:outline-[rgba(49,120,255,0.12)]";
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
    <aside className="editor-panel overflow-y-auto overscroll-contain border-r border-[#dbe0e7] bg-[#f8f9fb] px-[18px] pb-[60px] pt-5" aria-label="이력서 편집">
      <div className="px-1 pb-[18px] [&_input]:text-[15px] [&_input]:font-bold">
        <Field
          label="문서 이름"
          value={document.name}
          onChange={(name) => onChange({ ...document, name })}
        />
        <label className="mt-3 flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-[650] text-[#687384]">이력서 스타일</span>
          <select
            className="h-[35px] w-full rounded-[7px] border border-[#dce1e7] bg-white px-2.5 text-xs text-[#1d2735] focus:border-[#73a4ec] focus:outline-2 focus:outline-[rgba(49,120,255,0.12)]"
            value={document.styleSheetId}
            onChange={(event) => onChange({ ...document, styleSheetId: event.target.value })}
          >
            {resumeStyleSheets.map((styleSheet) => (
              <option key={styleSheet.id} value={styleSheet.id}>{styleSheet.name}</option>
            ))}
          </select>
        </label>
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
      <div className="mb-3.5 flex items-center gap-[9px]">
        <div className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-full border border-[#e0e4e9] bg-[#eff2f5] text-[10px] text-[#a1a9b4]">
          {section.photoDataUrl ? <img className="h-full w-full object-cover" src={section.photoDataUrl} alt="프로필 미리보기" /> : <span>사진</span>}
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-[#d8dee7] bg-white px-2.5 py-[7px] text-xs font-[650] text-[#344154] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#3178ff]">
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
        </label>
        {section.photoDataUrl && <button type="button" className={textButtonClass} onClick={() => onChange({ ...section, photoDataUrl: undefined })}>사진 제거</button>}
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
          <details className={collapsibleCardClass} key={item.id} open>
            <summary className={cardSummaryClass}>
              <span>{plainText(item.title) || item.organization || `항목 ${index + 1}`}</span>
              <span>{item.visible ? "표시" : "숨김"}</span>
            </summary>
            <div className={cardBodyClass}>
              <ItemActions
                onUp={index ? () => onChange({ ...section, items: move(section.items, index, index - 1) }) : undefined}
                onDown={index < section.items.length - 1 ? () => onChange({ ...section, items: move(section.items, index, index + 1) }) : undefined}
                onDelete={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}
              />
              <label className={checkFieldClass}>
                <input type="checkbox" checked={item.visible} onChange={(event) => updateItem(item.id, { visible: event.target.checked })} />
                미리보기에 표시
              </label>
              <DateRangeEditor item={item} onChange={(period) => updateItem(item.id, { period })} />
              <Field label={labels.organization} value={item.organization} onChange={(organization) => updateItem(item.id, { organization })} />
              <RichTextEditor className="mt-[11px]" label={labels.title} multiline={false} value={item.title} onChange={(title) => updateItem(item.id, { title })} />
              <LinksEditor links={item.links} onChange={(links) => updateItem(item.id, { links })} />
              <MarkdownEditor value={item.bodyMarkdown} onChange={(bodyMarkdown) => updateItem(item.id, { bodyMarkdown })} />
            </div>
          </details>
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
          <details className={collapsibleCardClass} key={item.id} open>
            <summary className={cardSummaryClass}>
              <span>{plainText(item.title) || `프로젝트 ${index + 1}`}</span>
              <span>{item.visible ? "표시" : "숨김"}</span>
            </summary>
            <div className={cardBodyClass}>
              <ItemActions
                onUp={index ? () => onChange({ ...section, items: move(section.items, index, index - 1).map((entry, order) => ({ ...entry, order })) }) : undefined}
                onDown={index < section.items.length - 1 ? () => onChange({ ...section, items: move(section.items, index, index + 1).map((entry, order) => ({ ...entry, order })) }) : undefined}
                onDelete={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}
              />
              <label className={checkFieldClass}>
                <input type="checkbox" checked={item.visible} onChange={(event) => updateItem(item.id, { visible: event.target.checked })} />
                미리보기에 표시
              </label>
              <DateRangeEditor item={item} onChange={(period) => updateItem(item.id, { period })} />
              <Field label="소속" value={item.organization} onChange={(organization) => updateItem(item.id, { organization })} />
              <RichTextEditor className="mt-[11px]" label="프로젝트명" multiline={false} value={item.title} onChange={(title) => updateItem(item.id, { title })} />
              <Field className="mt-[11px]" label="기술 스택" value={item.techStack.join(",")} placeholder="React, TypeScript" onChange={(value) => updateItem(item.id, { techStack: value.split(",") })} />
              <LinksEditor links={item.links} onChange={(links) => updateItem(item.id, { links })} />
              <MarkdownEditor value={item.bodyMarkdown} onChange={(bodyMarkdown) => updateItem(item.id, { bodyMarkdown })} />
            </div>
          </details>
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
    <label className="mt-[13px] flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-[650] text-[#687384]">본문</span>
      <textarea
        className="min-h-[150px] w-full resize-y rounded-[7px] border border-[#dce1e7] bg-white px-2.5 py-2 font-mono text-[11px] leading-[1.55] text-[#1d2735] placeholder:text-[#b3bac4] focus:border-[#73a4ec] focus:outline-2 focus:outline-[rgba(49,120,255,0.12)]"
        value={value}
        placeholder={"Markdown으로 본문을 작성하세요.\n\n### 소제목\n\n- 주요 내용"}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-[10px] leading-[1.45] text-[#929aa6]">H1~H6, 목록, 강조, 링크, 인용문, 코드와 표를 사용할 수 있습니다.</span>
    </label>
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
    <div className="mt-[13px]">
      <div className="flex min-h-[25px] items-center justify-between text-[11px] font-[680] text-[#687384]">
        <span>링크</span>
        <button type="button" className={textButtonClass} onClick={() => onChange([...links, createLink()])}>＋ 추가</button>
      </div>
      {links.map((link) => (
        <div className="mt-1.5 grid grid-cols-[0.7fr_1.3fr_28px] gap-1.5" key={link.id}>
          <input className={smallInputClass} aria-label="링크 이름" value={link.label} placeholder="링크 이름" onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, label: event.target.value } : entry))} />
          <input className={smallInputClass} aria-label="링크 URL" type="url" value={link.href} placeholder="https://" onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, href: event.target.value } : entry))} />
          <button type="button" className={iconButtonClass} aria-label="링크 삭제" onClick={() => onChange(links.filter((entry) => entry.id !== link.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
