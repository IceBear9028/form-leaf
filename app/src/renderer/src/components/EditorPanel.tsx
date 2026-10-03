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
    <aside className="editor-panel" aria-label="이력서 편집">
      <div className="document-name-field">
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
      <div className="photo-field">
        <div className="photo-thumbnail">
          {section.photoDataUrl ? <img src={section.photoDataUrl} alt="프로필 미리보기" /> : <span>사진</span>}
        </div>
        <label className="secondary-button">
          사진 선택
          <input
            className="visually-hidden"
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
          <button type="button" className="text-button" onClick={() => onChange({ ...section, photoDataUrl: undefined })}>
            사진 제거
          </button>
        )}
      </div>
      <div className="field-grid">
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
      <div className="item-list">
        {section.paragraphs.map((paragraph, index) => (
          <div className="editor-card" key={paragraph.id}>
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
      <div className="field-grid">
        <Field label="섹션 제목" value={section.title} onChange={(title) => onChange({ ...section, title })} />
        <Field label="제목 옆 보조 문구" value={section.annotation ?? ""} placeholder="선택 입력" onChange={(annotation) => onChange({ ...section, annotation })} />
      </div>
      <div className="item-list">
        {section.items.map((item, index) => (
          <details className="editor-card collapsible-card" key={item.id} open>
            <summary>
              <span>{plainText(item.title) || item.organization || `항목 ${index + 1}`}</span>
              <span>{item.visible ? "표시" : "숨김"}</span>
            </summary>
            <div className="editor-card-body">
              <ItemActions
                onUp={index ? () => onChange({ ...section, items: move(section.items, index, index - 1) }) : undefined}
                onDown={index < section.items.length - 1 ? () => onChange({ ...section, items: move(section.items, index, index + 1) }) : undefined}
                onDelete={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}
              />
              <label className="check-field">
                <input type="checkbox" checked={item.visible} onChange={(event) => updateTimelineItem(section, item.id, { visible: event.target.checked }, onChange)} />
                미리보기에 표시
              </label>
              <DateRangeEditor item={item} onChange={(period) => updateTimelineItem(section, item.id, { period }, onChange)} />
              <Field label={labels.organization} value={item.organization} onChange={(organization) => updateTimelineItem(section, item.id, { organization }, onChange)} />
              <RichTextEditor label={labels.title} multiline={false} value={item.title} onChange={(title) => updateTimelineItem(section, item.id, { title }, onChange)} />
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
      <div className="item-list">
        {section.items.map((item, index) => (
          <details className="editor-card collapsible-card" key={item.id} open>
            <summary>
              <span>{plainText(item.title) || `프로젝트 ${index + 1}`}</span>
              <span>{item.visible ? `${item.blocks.length}개 블록` : "숨김"}</span>
            </summary>
            <div className="editor-card-body">
              <ItemActions
                onUp={index ? () => onChange({ ...section, items: move(section.items, index, index - 1).map((entry, order) => ({ ...entry, order })) }) : undefined}
                onDown={index < section.items.length - 1 ? () => onChange({ ...section, items: move(section.items, index, index + 1).map((entry, order) => ({ ...entry, order })) }) : undefined}
                onDelete={() => onChange({ ...section, items: section.items.filter((entry) => entry.id !== item.id) })}
              />
              <label className="check-field">
                <input type="checkbox" checked={item.visible} onChange={(event) => updateItem(item.id, { visible: event.target.checked })} />
                미리보기에 표시
              </label>
              <DateRangeEditor item={item} onChange={(period) => updateItem(item.id, { period })} />
              <Field label="소속" value={item.organization} onChange={(organization) => updateItem(item.id, { organization })} />
              <RichTextEditor label="프로젝트명" multiline={false} value={item.title} onChange={(title) => updateItem(item.id, { title })} />
              <RichTextEditor label="프로젝트 소개" value={item.summary} onChange={(summary) => updateItem(item.id, { summary })} />
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
    <div className="field-grid field-grid--three">
      <Field label="시작" value={item.period.start} placeholder="2023. 01" onChange={(start) => onChange({ ...item.period, start })} />
      <Field label="종료" value={item.period.end} placeholder="현재" onChange={(end) => onChange({ ...item.period, end })} />
      <Field label="기간 표기" value={item.period.label ?? ""} placeholder="1년 2개월" onChange={(label) => onChange({ ...item.period, label })} />
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: ResumeLink[]; onChange: (links: ResumeLink[]) => void }) {
  return (
    <div className="sub-editor">
      <div className="sub-editor-header">
        <span>링크</span>
        <button type="button" className="text-button" onClick={() => onChange([...links, createLink()])}>＋ 추가</button>
      </div>
      {links.map((link) => (
        <div className="link-editor-row" key={link.id}>
          <input aria-label="링크 이름" value={link.label} placeholder="링크 이름" onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, label: event.target.value } : entry))} />
          <input aria-label="링크 URL" type="url" value={link.href} placeholder="https://" onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, href: event.target.value } : entry))} />
          <button type="button" className="icon-button" aria-label="링크 삭제" onClick={() => onChange(links.filter((entry) => entry.id !== link.id))}>×</button>
        </div>
      ))}
    </div>
  );
}

function BlocksEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (blocks: ContentBlock[]) => void }) {
  return (
    <div className="blocks-editor">
      <div className="sub-editor-header"><span>콘텐츠 블록</span></div>
      {blocks.map((block, index) => (
        <div className="block-card" key={block.id}>
          <div className="block-card-header">
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
      <div className="block-add-row">
        {(["paragraph", "bullet-list", "detail", "link-list", "tech-stack"] as const).map((type) => (
          <button key={type} type="button" onClick={() => onChange([...blocks, createBlock(type)])}>＋ {blockLabel(type)}</button>
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
      <div className="repeated-fields">
        {block.items.map((item, index) => (
          <div className="repeat-row" key={index}>
            <RichTextEditor label={`항목 ${index + 1}`} value={item} onChange={(content) => onChange({ ...block, items: block.items.map((entry, itemIndex) => itemIndex === index ? content : entry) })} />
            <button type="button" className="icon-button" aria-label="항목 삭제" onClick={() => onChange({ ...block, items: block.items.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
          </div>
        ))}
        <button type="button" className="text-button" onClick={() => onChange({ ...block, items: [...block.items, emptyText()] })}>＋ bullet 추가</button>
      </div>
    );
  }
  if (block.type === "detail") {
    return (
      <div className="stack-fields">
        <RichTextEditor label="성과 제목" multiline={false} value={block.title} onChange={(title) => onChange({ ...block, title })} />
        <RichTextEditor label="문제·배경" value={block.context} onChange={(context) => onChange({ ...block, context })} />
        {block.actions.map((action, index) => (
          <div className="repeat-row" key={index}>
            <RichTextEditor label={`해결 과정 ${index + 1}`} value={action} onChange={(content) => onChange({ ...block, actions: block.actions.map((entry, actionIndex) => actionIndex === index ? content : entry) })} />
            <button type="button" className="icon-button" aria-label="해결 과정 삭제" onClick={() => onChange({ ...block, actions: block.actions.filter((_, actionIndex) => actionIndex !== index) })}>×</button>
          </div>
        ))}
        <button type="button" className="text-button" onClick={() => onChange({ ...block, actions: [...block.actions, emptyText()] })}>＋ 해결 과정 추가</button>
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
