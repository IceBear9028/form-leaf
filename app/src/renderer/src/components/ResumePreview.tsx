import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ProfileSection,
  ProjectItem,
  ResumeDocument,
  ResumeLink,
  TextContent,
  TimelineItem,
  TimelineKind,
} from "../../../shared/resume";
import { plainText } from "../../../shared/resume";
import { parseResumeMarkdown, type ResumeMarkdownBlock } from "../../../shared/markdown";
import { getResumeStyleSheet } from "../styles/resumeStyleSheets";
import {
  MarkdownBlockContent,
  MarkdownFootnotesContent,
  type MarkdownContext,
} from "./MarkdownContent";

type MarkdownOwner = "introduction" | "project" | "career" | "education" | "activity" | "free-text";

type MarkdownLayoutUnit = {
  id: string;
  type: "markdown-block" | "markdown-footnotes";
  block?: ResumeMarkdownBlock;
  documentBlocks: ResumeMarkdownBlock[];
  context: MarkdownContext;
  owner: MarkdownOwner;
  sourceId: string;
  lead?: boolean;
  keepWithNext?: boolean;
  lineSegment?: boolean;
  lineStart?: boolean;
  lineEnd?: boolean;
};

type LayoutUnit =
  | { id: string; type: "profile"; section: ProfileSection; keepWithNext?: boolean }
  | { id: string; type: "section-heading"; title: string; annotation?: string; sectionKind: "introduction" | TimelineKind | "project" | "side-project" | "free-text"; separator: boolean; keepWithNext: true; forceNewPage?: boolean }
  | { id: string; type: "timeline"; item: TimelineItem; timelineKind: TimelineKind; keepWithNext?: boolean; lineSegment?: boolean; lineStart?: boolean; lineEnd?: boolean }
  | { id: string; type: "project-header"; item: ProjectItem; keepWithNext?: boolean; lineSegment: true; lineStart: true; lineEnd?: boolean }
  | { id: string; type: "tech-stack"; items: string[]; lineSegment: true; lineStart?: boolean; lineEnd: boolean }
  | MarkdownLayoutUnit;

type Page = { id: string; units: LayoutUnit[]; overflow: boolean };

export function ResumePreview({ document, zoom }: { document: ResumeDocument; zoom: number }) {
  const styleSheet = getResumeStyleSheet(document.styleSheetId);
  const units = useMemo(() => buildUnits(document), [document]);
  const [pages, setPages] = useState<Page[]>(() => [{ id: "page-1", units, overflow: false }]);
  const measureRef = useRef<HTMLDivElement>(null);
  const capacityRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => {
      const container = measureRef.current;
      const capacity = capacityRef.current?.clientHeight ?? 0;
      if (!container || !capacity) return;

      const heights = new Map<string, number>();
      container.querySelectorAll<HTMLElement>("[data-measure-id]").forEach((element) => {
        heights.set(element.dataset.measureId ?? "", element.getBoundingClientRect().height);
      });
      setPages(paginate(units, heights, capacity));
    });

    const fonts = documentFontsReady();
    void fonts.then(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const container = measureRef.current;
        const capacity = capacityRef.current?.clientHeight ?? 0;
        if (!container || !capacity) return;
        const heights = new Map<string, number>();
        container.querySelectorAll<HTMLElement>("[data-measure-id]").forEach((element) => {
          heights.set(element.dataset.measureId ?? "", element.getBoundingClientRect().height);
        });
        setPages(paginate(units, heights, capacity));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [units]);

  const visiblePages = pages.length ? pages : [{ id: "page-1", units: [], overflow: false }];

  return (
    <main className="preview-panel min-w-0 overflow-auto overscroll-contain bg-[#e9edf2] px-10 pb-[100px] pt-[34px] max-[1180px]:px-6" aria-label="A4 미리보기">
      <div className="measurement-root" aria-hidden="true">
        <div className={`resume-page measurement-page ${styleSheet.className}`} style={styleSheet.variables}>
          <div className="resume-page-body measurement-body" ref={capacityRef}>
            <div ref={measureRef}>
              {units.map((unit) => <LayoutUnitView key={unit.id} unit={unit} measure />)}
            </div>
          </div>
        </div>
      </div>
      <div className="preview-stack mx-auto w-max [zoom:var(--preview-zoom)]" style={{ "--preview-zoom": zoom } as React.CSSProperties}>
        {visiblePages.map((page, pageIndex) => (
          <article className={`resume-page ${styleSheet.className}${page.overflow ? " resume-page--overflow" : ""}`} style={styleSheet.variables} key={page.id}>
            <div className="resume-page-body">
              {page.units.map((unit, unitIndex) => <LayoutUnitView key={unit.id} unit={unit} firstOnPage={unitIndex === 0} />)}
              {!page.units.length && pageIndex === 0 && (
                <div className="empty-resume-hint">왼쪽 편집기에서 이력서 내용을 입력하세요.</div>
              )}
            </div>
            <footer className="resume-page-number">{pageIndex + 1} / {visiblePages.length}</footer>
          </article>
        ))}
      </div>
    </main>
  );
}

function documentFontsReady(): Promise<FontFaceSet> {
  return document.fonts.ready;
}

function paginate(units: LayoutUnit[], heights: Map<string, number>, capacity: number): Page[] {
  if (!units.length) return [{ id: "page-1", units: [], overflow: false }];
  const pages: Page[] = [];
  let current: LayoutUnit[] = [];
  let used = 0;
  let overflow = false;

  const flush = () => {
    pages.push({ id: `page-${pages.length + 1}`, units: current, overflow });
    current = [];
    used = 0;
    overflow = false;
  };

  units.forEach((unit, index) => {
    if (unit.type === "section-heading" && unit.forceNewPage && current.length) flush();
    const height = heights.get(unit.id) ?? 0;
    let required = height;
    let lookaheadIndex = index;
    let lookahead = unit;
    while ("keepWithNext" in lookahead && lookahead.keepWithNext && lookaheadIndex + 1 < units.length) {
      lookaheadIndex += 1;
      lookahead = units[lookaheadIndex];
      required += heights.get(lookahead.id) ?? 0;
    }
    if (current.length && used + required > capacity) flush();
    current.push(unit);
    used += height;
    if (height > capacity || used > capacity + 1) overflow = true;
  });
  if (current.length || !pages.length) flush();
  return pages;
}

function hasText(content: TextContent): boolean {
  return plainText(content).trim().length > 0;
}

function safeHref(value: string): string | undefined {
  const trimmed = value.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : undefined;
}

function buildUnits(document: ResumeDocument): LayoutUnit[] {
  const units: LayoutUnit[] = [];
  document.sections.forEach((section) => {
    if (!section.visible) return;
    if (section.type === "profile") {
      units.push({ id: section.id, type: "profile", section, keepWithNext: true });
      return;
    }
    if (section.type === "introduction") {
      const bodyUnits = markdownUnits({
        source: section.bodyMarkdown,
        sourceId: section.id,
        context: "introduction",
        owner: "introduction",
      });
      if (!bodyUnits.length) return;
      units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, sectionKind: "introduction", separator: false, keepWithNext: true });
      units.push(...bodyUnits);
      return;
    }
    if (section.type === "timeline") {
      const items = section.items.filter((item) => item.visible);
      if (!items.length) return;
      units.push({
        id: `${section.id}-heading`,
        type: "section-heading",
        title: section.title,
        annotation: section.annotation,
        sectionKind: section.timelineKind,
        separator: true,
        keepWithNext: true,
        forceNewPage: section.timelineKind === "activity",
      });
      items.forEach((item) => {
        const usesDivider = section.timelineKind !== "education";
        const bodyUnits = markdownUnits({
          source: item.bodyMarkdown,
          sourceId: item.id,
          context: section.timelineKind,
          owner: section.timelineKind,
          lineSegment: usesDivider,
        });
        units.push({
          id: item.id,
          type: "timeline",
          item,
          timelineKind: section.timelineKind,
          keepWithNext: bodyUnits.length > 0,
          lineSegment: usesDivider,
          lineStart: usesDivider,
          lineEnd: usesDivider && bodyUnits.length === 0,
        });
        units.push(...bodyUnits);
      });
      return;
    }
    if (section.type === "project-group") {
      const items = section.items.filter((item) => item.visible).sort((a, b) => a.order - b.order);
      if (!items.length) return;
      units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, sectionKind: section.groupKind, separator: true, keepWithNext: true });
      items.forEach((item) => {
        const bodyUnits = markdownUnits({
          source: item.bodyMarkdown,
          sourceId: item.id,
          context: section.groupKind,
          owner: "project",
          lineSegment: true,
          leadFirstParagraph: true,
        });
        const techStack = item.techStack.map((value) => value.trim()).filter(Boolean);
        const hasFollowingContent = bodyUnits.length > 0 || techStack.length > 0;
        if (techStack.length && bodyUnits.length) {
          bodyUnits[bodyUnits.length - 1].lineEnd = false;
        }
        units.push({ id: item.id, type: "project-header", item, keepWithNext: hasFollowingContent, lineSegment: true, lineStart: true, lineEnd: !hasFollowingContent });
        units.push(...bodyUnits);
        if (techStack.length) {
          units.push({ id: `${item.id}-tech-stack`, type: "tech-stack", items: techStack, lineSegment: true, lineEnd: true });
        }
      });
      return;
    }
    const bodyUnits = markdownUnits({
      source: section.bodyMarkdown,
      sourceId: section.id,
      context: "free-text",
      owner: "free-text",
      lineSegment: true,
      lineStart: true,
    });
    if (!bodyUnits.length) return;
    units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, sectionKind: "free-text", separator: true, keepWithNext: true });
    units.push(...bodyUnits);
  });
  return units;
}

function markdownUnits({
  source,
  sourceId,
  context,
  owner,
  lineSegment = false,
  lineStart = false,
  leadFirstParagraph = false,
}: {
  source: string;
  sourceId: string;
  context: MarkdownContext;
  owner: MarkdownOwner;
  lineSegment?: boolean;
  lineStart?: boolean;
  leadFirstParagraph?: boolean;
}): MarkdownLayoutUnit[] {
  if (!source.trim()) return [];
  const documentBlocks = parseResumeMarkdown(source);
  const visibleBlocks = documentBlocks.filter(({ node }) =>
    node.type !== "definition" && node.type !== "footnoteDefinition",
  );
  const firstParagraphId = visibleBlocks.find(({ node }) => node.type === "paragraph")?.id;
  const result: MarkdownLayoutUnit[] = visibleBlocks.map((block, index) => ({
    id: `${sourceId}-${block.id}`,
    type: "markdown-block",
    block,
    documentBlocks,
    context,
    owner,
    sourceId,
    lead: leadFirstParagraph && block.id === firstParagraphId,
    keepWithNext: block.node.type === "heading",
    lineSegment,
    lineStart: lineSegment && lineStart && index === 0,
  }));
  if (documentBlocks.some(({ node }) => node.type === "footnoteDefinition")) {
    result.push({
      id: `${sourceId}-footnotes`,
      type: "markdown-footnotes",
      documentBlocks,
      context,
      owner,
      sourceId,
      lineSegment,
      lineStart: lineSegment && lineStart && result.length === 0,
    });
  }
  if (lineSegment && result.length) result[result.length - 1].lineEnd = true;
  return result;
}

function LayoutUnitView({ unit, measure = false, firstOnPage = false }: { unit: LayoutUnit; measure?: boolean; firstOnPage?: boolean }) {
  const attributes = measure ? { "data-measure-id": unit.id } : {};
  const lineClasses = "lineSegment" in unit && unit.lineSegment
    ? ` layout-unit--line-segment${unit.lineStart ? " layout-unit--line-start" : ""}${unit.lineEnd ? " layout-unit--line-end" : ""}`
    : "";
  if (unit.type === "profile") {
    return <div className={`layout-unit layout-unit--profile${firstOnPage ? " layout-unit--first" : ""}`} {...attributes}><ProfileView section={unit.section} /></div>;
  }
  if (unit.type === "section-heading") {
    return (
      <div className={`layout-unit layout-unit--heading layout-unit--heading-${unit.sectionKind}${firstOnPage ? " layout-unit--first" : ""}${unit.separator ? " layout-unit--separator" : ""}`} {...attributes}>
        <div className="resume-section-heading"><h2>{unit.title}</h2>{unit.annotation && <strong>{unit.annotation}</strong>}</div>
      </div>
    );
  }
  if (unit.type === "timeline") {
    return <div className={`layout-unit layout-unit--item layout-unit--item-${unit.timelineKind}${unit.keepWithNext ? " layout-unit--has-blocks" : ""}${lineClasses}`} {...attributes}><TimelineView item={unit.item} kind={unit.timelineKind} /></div>;
  }
  if (unit.type === "project-header") {
    return <div className={`layout-unit layout-unit--project${unit.keepWithNext ? " layout-unit--has-blocks" : ""}${lineClasses}`} {...attributes}><ProjectHeader item={unit.item} /></div>;
  }
  if (unit.type === "tech-stack") {
    return (
      <div className={`layout-unit layout-unit--block${lineClasses}`} {...attributes}>
        <div className="resume-grid-row resume-grid-row--continuation resume-grid-row--project">
          <div className="resume-meta-column" />
          <div className="resume-body-column"><div className="tech-stack"><ToolIcon /><strong>{unit.items.join(", ")}</strong></div></div>
        </div>
      </div>
    );
  }
  const markdownContent = unit.type === "markdown-block" && unit.block
    ? (
        <MarkdownBlockContent
          block={unit.block}
          documentBlocks={unit.documentBlocks}
          context={unit.context}
          idPrefix={`markdown-${unit.sourceId}`}
          lead={unit.lead}
        />
      )
    : (
        <MarkdownFootnotesContent
          documentBlocks={unit.documentBlocks}
          context={unit.context}
          idPrefix={`markdown-${unit.sourceId}`}
        />
      );
  if (unit.owner === "introduction") {
    return <div className="layout-unit layout-unit--paragraph layout-unit--markdown" {...attributes}>{markdownContent}</div>;
  }
  if (unit.owner === "education") {
    return <div className="layout-unit layout-unit--block layout-unit--markdown education-block" {...attributes}>{markdownContent}</div>;
  }
  return (
    <div className={`layout-unit layout-unit--block layout-unit--markdown${lineClasses}`} {...attributes}>
      <div className={`resume-grid-row resume-grid-row--continuation resume-grid-row--${unit.owner}`}>
        <div className="resume-meta-column" />
        <div className="resume-body-column">{markdownContent}</div>
      </div>
    </div>
  );
}

function ProfileView({ section }: { section: ProfileSection }) {
  return (
    <header className="resume-profile">
      <div className="profile-photo">
        {section.photoDataUrl ? <img src={section.photoDataUrl} alt="" /> : <ProfilePlaceholder />}
      </div>
      <div className="profile-identity">
        <p className="profile-role">{section.role || <span className="preview-placeholder">직무명</span>}</p>
        <h1>{section.name || <span className="preview-placeholder">이름</span>}</h1>
      </div>
      <div className="profile-contacts">
        {section.phone && <ContactRow label="Phone" value={section.phone} />}
        {section.email && <ContactRow label="Email" value={section.email} href={`mailto:${section.email}`} />}
        {section.links.some((link) => link.label || link.href) && (
          <div className="contact-row contact-row--links">
            <span>WebSite</span>
            <div>{section.links.filter((link) => link.label || link.href).map((link) => (
              <a key={link.id} href={safeHref(link.href)}><LinkGlyph label={link.label} href={link.href} />{link.label || link.href}</a>
            ))}</div>
          </div>
        )}
      </div>
    </header>
  );
}

function ProfilePlaceholder() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="프로필 사진 없음">
      <circle cx="32" cy="24" r="12" />
      <path d="M11 58c2-13 10-19 21-19s19 6 21 19" />
    </svg>
  );
}

function ContactRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="contact-row">
      <span>{label}</span>
      {safeHref(href ?? "") ? <a href={safeHref(href ?? "")}>{value}</a> : <strong>{value}</strong>}
    </div>
  );
}

function TimelineView({ item, kind }: { item: TimelineItem; kind: TimelineKind }) {
  if (kind === "education") {
    const range = [item.period.start, item.period.end].filter(Boolean).join(" ~ ");
    return (
      <div className="education-item">
        {range && <span className="education-period">{range}</span>}
        <h3>{item.organization}{item.organization && hasText(item.title) ? " - " : ""}<RichText content={item.title} /></h3>
      </div>
    );
  }
  return (
    <div className="resume-grid-row">
      <MetaColumn period={item.period} organization={kind === "activity" ? item.organization : ""} links={item.links} />
      <div className="resume-body-column timeline-body">
        {kind === "career" && item.organization ? <h3>{item.organization}</h3> : <h3><RichText content={item.title} /></h3>}
        {kind === "career" && hasText(item.title) && <p className="timeline-subtitle"><RichText content={item.title} /></p>}
      </div>
    </div>
  );
}

function ProjectHeader({ item }: { item: ProjectItem }) {
  return (
    <div className="resume-grid-row">
      <MetaColumn period={item.period} organization={item.organization} links={item.links} />
      <div className="resume-body-column project-body">
        <h3><RichText content={item.title} /></h3>
      </div>
    </div>
  );
}

function MetaColumn({ period, organization, links }: { period: { start: string; end: string; label?: string }; organization: string; links: ResumeLink[] }) {
  const range = [period.start, period.end].filter(Boolean).join(" ~ ");
  return (
    <div className="resume-meta-column">
      {range && <strong className="meta-period">{range}</strong>}
      {period.label && <span className="meta-duration">{period.label}</span>}
      {organization && <span className="meta-organization">{organization}</span>}
      {links.filter((link) => link.label || link.href).map((link) => (
        <a className="meta-link" key={link.id} href={safeHref(link.href)}><span className="meta-link-icon"><LinkGlyph label={link.label} href={link.href} /></span><span>{link.label || link.href}</span></a>
      ))}
    </div>
  );
}

function LinkGlyph({ label, href }: { label: string; href: string }) {
  if (/github/i.test(label) || /github\.com/i.test(href)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.9 0C17.1 5.3 18 5.6 18 5.6c.6 1.6.2 2.9.1 3.2a4.7 4.7 0 0 1 1.2 3.2c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .7Z" /></svg>;
  }
  if (/app\s*store/i.test(label) || /apps\.apple\.com/i.test(href)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.7 12.8c0-2.4 2-3.6 2.1-3.7a4.5 4.5 0 0 0-3.5-1.9c-1.5-.2-2.9.9-3.6.9-.8 0-1.9-.9-3.1-.9A4.7 4.7 0 0 0 4.7 9.6c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3.1 2.4 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.8 2.2-1.2 3-2.4a10.4 10.4 0 0 0 1.4-2.9 4.1 4.1 0 0 1-3.1-3.5ZM14.3 5.6a4.2 4.2 0 0 0 1-3 4.2 4.2 0 0 0-2.8 1.4 4 4 0 0 0-1 2.9 3.5 3.5 0 0 0 2.8-1.3Z" /></svg>;
  }
  if (/홈페이지|home/i.test(label)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.7 12 3l9 7.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-5.2v-7H9.7v7H4.5A1.5 1.5 0 0 1 3 20.5v-9.8Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h11l5 5v15H4V2Zm10 2v5h4M9 10v7l6-3.5L9 10Z" /></svg>;
}

function ToolIcon() {
  return (
    <svg className="tech-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9.8 1.1a4.1 4.1 0 0 0-4.7 5.3L1.4 10a2.8 2.8 0 1 0 4 4l3.7-3.7a4.1 4.1 0 0 0 5.3-4.7l-2.6 2.6-2.3-.6-.6-2.3 2.6-2.6a4 4 0 0 0-1.7-1.6ZM3.4 13.8a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
    </svg>
  );
}

function RichText({ content }: { content: TextContent }) {
  return <>{content.runs.map((run, index) => {
    let node: React.ReactNode = run.text;
    if (run.marks?.includes("strong")) node = <strong>{node}</strong>;
    if (run.marks?.includes("underline")) node = <u>{node}</u>;
    if (run.marks?.includes("link") && run.href) node = <a href={safeHref(run.href)}>{node}</a>;
    return <span key={index}>{node}</span>;
  })}</>;
}
