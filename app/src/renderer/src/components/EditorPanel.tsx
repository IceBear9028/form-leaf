import type {
  ContentBlock,
  FreeTextSection,
  IntroductionSection,
  ProfileSection,
  ProjectGroupSection,
  ProjectItem,
  ResumeDocument,
  ResumeLink,
  ResumeSection,
  TextContent,
  TimelineItem,
  TimelineSection,
} from "../../../shared/resume";
import {
  createId,
  createParagraphBlock,
  emptyText,
  plainText,
} from "../../../shared/resume";
import { Accordion, AddButton, Field, ItemActions } from "./EditorPrimitives";
import { RichTextEditor } from "./RichTextEditor";

type Props = {
  document: ResumeDocument;
  onChange: (document: ResumeDocument) => void;
};

const fieldGridClass = "mb-3 grid grid-cols-2 gap-[11px]";
const itemListClass = "my-3 flex flex-col gap-[9px]";
const editorCardClass = "rounded-[9px] border border-[#e1e5eb] bg-[#fbfcfd] p-3";
const collapsibleCardClass = "overflow-hidden rounded-[9px] border border-[#e1e5eb] bg-[#fbfcfd]";
const cardSummaryClass = "flex cursor-pointer list-none justify-between gap-3 px-3 py-[11px] text-xs font-[680] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3178ff] [&::-webkit-details-marker]:hidden [&>span:first-child]:min-w-0 [&>span:first-child]:overflow-hidden [&>span:first-child]:text-ellipsis [&>span:first-child]:whitespace-nowrap [&>span:last-child]:whitespace-nowrap [&>span:last-child]:text-[10px] [&>span:last-child]:font-medium [&>span:last-child]:text-[#929aa6]";
const cardBodyClass = "border-t border-[#edf0f3] px-3 pb-3.5 pt-0 [&>.item-actions]:mt-[9px]";
const checkFieldClass = "mb-[11px] flex items-center gap-1.5 text-[11px] text-[#626e7e] [&_input]:accent-[#1768e5]";
const textButtonClass = "cursor-pointer border-0 bg-transparent p-1 text-[11px] font-[650] text-[#1768e5] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]";
const iconButtonClass = "h-[25px] min-w-[25px] cursor-pointer rounded-md border border-[#dde2e8] bg-white p-0 text-[15px] text-[#697486] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]";
const smallInputClass = "h-8 w-full rounded-[7px] border border-[#dce1e7] bg-white px-2.5 text-xs text-[#1d2735] placeholder:text-[#b3bac4] focus:border-[#73a4ec] focus:outline-2 focus:outline-[rgba(49,120,255,0.12)]";

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
  blocks: [],
});

const createProjectItem = (order: number): ProjectItem => ({
  id: createId("project"),
  visible: true,
  order,
  period: { start: "", end: "" },
  organization: "",
  title: emptyText(),
  summary: emptyText(),
  links: [],
  blocks: [],
});

function createBlock(type: ContentBlock["type"]): ContentBlock {
  if (type === "paragraph") return createParagraphBlock();
  if (type === "bullet-list") {
    return { id: createId("bullets"), type, items: [emptyText()] };
  }
  if (type === "detail") {
    return {
      id: createId("detail"),
      type,
      title: emptyText(),
      context: emptyText(),
      actions: [emptyText()],
      result: emptyText(),
    };
  }
  if (type === "link-list") return { id: createId("links"), type, links: [createLink()] };
  return { id: createId("tech"), type: "tech-stack", items: [] };
}

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
      </div>
      {document.sections.map((section, index) => {
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
        return (
          <FreeTextEditor
            key={section.id}
            section={section}
            onChange={replaceSection}
            defaultOpen={index === 0}
          />
        );
      })}
    </aside>
  );
}

function ProfileEditor({ section, onChange }: { section: ProfileSection; onChange: (section: ProfileSection) => void }) {
  return (
    <Accordion
      title="프로필"
      visible={section.visible}
      onVisibleChange={(visible) => onChange({ ...section, visible })}
      defaultOpen
    >
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
        {section.photoDataUrl && (
          <button type="button" className={textButtonClass} onClick={() => onChange({ ...section, photoDataUrl: undefined })}>
            사진 제거
          </button>
        )}
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
    <Accordion
      title="소개글"
      meta={`${section.paragraphs.length}개 문단`}
      visible={section.visible}
      onVisibleChange={(visible) => onChange({ ...section, visible })}
    >
      <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
      <div className={itemListClass}>
        {section.paragraphs.map((paragraph, index) => (
          <div className={editorCardClass} key={paragraph.id}>
            <ItemActions
              onUp={index ? () => onChange({ ...section, paragraphs: move(section.paragraphs, index, index - 1) }) : undefined}
              onDown={index < section.paragraphs.length - 1 ? () => onChange({ ...section, paragraphs: move(section.paragraphs, index, index + 1) }) : undefined}
              onDelete={() => onChange({ ...section, paragraphs: section.paragraphs.filter((item) => item.id !== paragraph.id) })}
            />
            <RichTextEditor
              label={`문단 ${index + 1}`}
              value={paragraph.content}
              onChange={(content) => onChange({
                ...section,
                paragraphs: section.paragraphs.map((item) => item.id === paragraph.id ? { ...item, content } : item),
              })}
            />
          </div>
        ))}
      </div>
      <AddButton onClick={() => onChange({
        ...section,
        paragraphs: [...section.paragraphs, { id: createId("intro"), content: emptyText() }],
      })}>문단 추가</AddButton>
    </Accordion>
  );
}

function TimelineEditor({ section, onChange }: { section: TimelineSection; onChange: (section: TimelineSection) => void }) {
  const labels = timelineLabels(section.timelineKind);
  return (
    <Accordion
      title={section.title}
      meta={`${section.items.length}개`}
      visible={section.visible}
      onVisibleChange={(visible) => onChange({ ...section, visible })}
    >
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
                <input type="checkbox" checked={item.visible} onChange={(event) => updateTimelineItem(section, item.id, { visible: event.target.checked }, onChange)} />
                미리보기에 표시
              </label>
              <DateRangeEditor item={item} onChange={(period) => updateTimelineItem(section, item.id, { period }, onChange)} />
              <Field label={labels.organization} value={item.organization} onChange={(organization) => updateTimelineItem(section, item.id, { organization }, onChange)} />
              <RichTextEditor className="mt-[11px]" label={labels.title} multiline={false} value={item.title} onChange={(title) => updateTimelineItem(section, item.id, { title }, onChange)} />
              <LinksEditor links={item.links} onChange={(links) => updateTimelineItem(section, item.id, { links }, onChange)} />
              <BlocksEditor blocks={item.blocks} onChange={(blocks) => updateTimelineItem(section, item.id, { blocks }, onChange)} />
            </div>
          </details>
        ))}
      </div>
      <AddButton onClick={() => onChange({ ...section, items: [...section.items, createTimelineItem()] })}>항목 추가</AddButton>
    </Accordion>
  );
}

function timelineLabels(kind: TimelineSection["timelineKind"]): { organization: string; title: string } {
  if (kind === "career") return { organization: "회사명", title: "직무·고용 형태" };
  if (kind === "education") return { organization: "교육 기관", title: "교육·학위" };
  return { organization: "기관·주최", title: "활동명·수상명" };
}

function updateTimelineItem(
  section: TimelineSection,
  id: string,
  patch: Partial<TimelineItem>,
  onChange: (section: TimelineSection) => void,
) {
  onChange({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
}

function ProjectGroupEditor({ section, onChange }: { section: ProjectGroupSection; onChange: (section: ProjectGroupSection) => void }) {
  const updateItem = (id: string, patch: Partial<ProjectItem>) => {
    onChange({ ...section, items: section.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  return (
    <Accordion
      title={section.title}
      meta={`${section.items.length}개`}
      visible={section.visible}
      onVisibleChange={(visible) => onChange({ ...section, visible })}
    >
      <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
      <div className={itemListClass}>
        {section.items.map((item, index) => (
          <details className={collapsibleCardClass} key={item.id} open>
            <summary className={cardSummaryClass}>
              <span>{plainText(item.title) || `프로젝트 ${index + 1}`}</span>
              <span>{item.visible ? `${item.blocks.length}개 블록` : "숨김"}</span>
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
              <RichTextEditor className="mt-[11px]" label="프로젝트 소개" value={item.summary} onChange={(summary) => updateItem(item.id, { summary })} />
              <LinksEditor links={item.links} onChange={(links) => updateItem(item.id, { links })} />
              <BlocksEditor blocks={item.blocks} onChange={(blocks) => updateItem(item.id, { blocks })} />
            </div>
          </details>
        ))}
      </div>
      <AddButton onClick={() => onChange({ ...section, items: [...section.items, createProjectItem(section.items.length)] })}>
        프로젝트 추가
      </AddButton>
    </Accordion>
  );
}

function FreeTextEditor({ section, onChange }: { section: FreeTextSection; onChange: (section: FreeTextSection) => void; defaultOpen?: boolean }) {
  return (
    <Accordion
      title="프리텍스트"
      meta={`${section.blocks.length}개 블록`}
      visible={section.visible}
      onVisibleChange={(visible) => onChange({ ...section, visible })}
    >
      <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
      <BlocksEditor blocks={section.blocks} onChange={(blocks) => onChange({ ...section, blocks })} />
    </Accordion>
  );
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

function BlocksEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (blocks: ContentBlock[]) => void }) {
  return (
    <div className="mt-[13px]">
      <div className="flex min-h-[25px] items-center justify-between text-[11px] font-[680] text-[#687384]"><span>콘텐츠 블록</span></div>
      {blocks.map((block, index) => (
        <div className="mt-2 rounded-lg border border-[#e3e7ec] bg-[#fdfdfd] p-2.5" key={block.id}>
          <div className="mb-[9px] flex items-center justify-between text-[11px] font-bold text-[#4f5a6a] [&_.item-actions]:mb-0">
            <span>{blockLabel(block.type)}</span>
            <ItemActions
              onUp={index ? () => onChange(move(blocks, index, index - 1)) : undefined}
              onDown={index < blocks.length - 1 ? () => onChange(move(blocks, index, index + 1)) : undefined}
              onDelete={() => onChange(blocks.filter((entry) => entry.id !== block.id))}
            />
          </div>
          <BlockFields block={block} onChange={(next) => onChange(blocks.map((entry) => entry.id === block.id ? next : entry))} />
        </div>
      ))}
      <div className="mt-[9px] flex flex-wrap gap-[5px]">
        {(["paragraph", "bullet-list", "detail", "link-list", "tech-stack"] as const).map((type) => (
          <button className="cursor-pointer rounded-md border border-[#dce2e9] bg-white px-2 py-1.5 text-[10px] text-[#5d6a7c] hover:border-[#9ebdea] hover:text-[#1768e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" key={type} type="button" onClick={() => onChange([...blocks, createBlock(type)])}>＋ {blockLabel(type)}</button>
        ))}
      </div>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  if (block.type === "paragraph") {
    return <RichTextEditor label="문단" value={block.content} onChange={(content) => onChange({ ...block, content })} />;
  }
  if (block.type === "bullet-list") {
    return (
      <div>
        {block.items.map((item, index) => (
          <div className="mb-2 grid grid-cols-[1fr_27px] items-start gap-1.5" key={index}>
            <RichTextEditor label={`항목 ${index + 1}`} value={item} onChange={(content) => onChange({ ...block, items: block.items.map((entry, itemIndex) => itemIndex === index ? content : entry) })} />
            <button type="button" className={`${iconButtonClass} mt-[29px]`} aria-label="항목 삭제" onClick={() => onChange({ ...block, items: block.items.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
          </div>
        ))}
        <button type="button" className={textButtonClass} onClick={() => onChange({ ...block, items: [...block.items, emptyText()] })}>＋ bullet 추가</button>
      </div>
    );
  }
  if (block.type === "detail") {
    return (
      <div className="flex flex-col gap-[9px]">
        <RichTextEditor label="성과 제목" multiline={false} value={block.title} onChange={(title) => onChange({ ...block, title })} />
        <RichTextEditor label="문제·배경" value={block.context} onChange={(context) => onChange({ ...block, context })} />
        {block.actions.map((action, index) => (
          <div className="grid grid-cols-[1fr_27px] items-start gap-1.5" key={index}>
            <RichTextEditor label={`해결 과정 ${index + 1}`} value={action} onChange={(content) => onChange({ ...block, actions: block.actions.map((entry, actionIndex) => actionIndex === index ? content : entry) })} />
            <button type="button" className={`${iconButtonClass} mt-[29px]`} aria-label="해결 과정 삭제" onClick={() => onChange({ ...block, actions: block.actions.filter((_, actionIndex) => actionIndex !== index) })}>×</button>
          </div>
        ))}
        <button type="button" className={textButtonClass} onClick={() => onChange({ ...block, actions: [...block.actions, emptyText()] })}>＋ 해결 과정 추가</button>
        <RichTextEditor label="결과" value={block.result} onChange={(result) => onChange({ ...block, result })} />
      </div>
    );
  }
  if (block.type === "link-list") {
    return <LinksEditor links={block.links} onChange={(links) => onChange({ ...block, links })} />;
  }
  return (
    <Field
      label="기술 스택"
      value={block.items.join(", ")}
      placeholder="React, TypeScript, Electron"
      onChange={(value) => onChange({ ...block, items: value.split(",").map((item) => item.trim()).filter(Boolean) })}
    />
  );
}

function blockLabel(type: ContentBlock["type"]): string {
  return {
    paragraph: "문단",
    "bullet-list": "목록",
    detail: "성과 상세",
    "link-list": "링크 목록",
    "tech-stack": "기술 스택",
  }[type];
}
