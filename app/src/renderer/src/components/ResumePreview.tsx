import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ContentBlock,
  FreeTextSection,
  IntroductionSection,
  ProfileSection,
  ProjectItem,
  ResumeDocument,
  ResumeLink,
  TextContent,
  TimelineItem,
  TimelineKind,
} from "../../../shared/resume";
import { plainText } from "../../../shared/resume";
import { getResumeStyleSheet } from "../styles/resumeStyleSheets";

type LayoutUnit =
  | { id: string; type: "profile"; section: ProfileSection; keepWithNext?: boolean }
  | { id: string; type: "section-heading"; title: string; annotation?: string; separator: boolean; keepWithNext: true }
  | { id: string; type: "introduction"; content: TextContent }
  | { id: string; type: "timeline"; item: TimelineItem; timelineKind: TimelineKind }
  | { id: string; type: "project-header"; item: ProjectItem; keepWithNext?: boolean }
  | { id: string; type: "content-block"; block: ContentBlock; owner: "project" | "timeline" | "education" | "free-text" };

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
        <div className={`resume-page measurement-page ${styleSheet.className}`}>
          <div className="resume-page-body measurement-body" ref={capacityRef}>
            <div ref={measureRef}>
              {units.map((unit) => <LayoutUnitView key={unit.id} unit={unit} measure />)}
            </div>
          </div>
        </div>
      </div>
      <div className="preview-stack mx-auto w-max [zoom:var(--preview-zoom)]" style={{ "--preview-zoom": zoom } as React.CSSProperties}>
        {visiblePages.map((page, pageIndex) => (
          <article className={`resume-page ${styleSheet.className}${page.overflow ? " resume-page--overflow" : ""}`} key={page.id}>
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
    const height = heights.get(unit.id) ?? 0;
    const nextHeight = "keepWithNext" in unit && unit.keepWithNext
      ? heights.get(units[index + 1]?.id ?? "") ?? 0
      : 0;
    const required = height + nextHeight;
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

function blockHasContent(block: ContentBlock): boolean {
  if (block.type === "paragraph") return hasText(block.content);
  if (block.type === "bullet-list") return block.items.some(hasText);
  if (block.type === "detail") {
    return hasText(block.title) || hasText(block.context) || block.actions.some(hasText) || hasText(block.result);
  }
  if (block.type === "link-list") return block.links.some((link) => link.label || link.href);
  return block.items.length > 0;
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
      const paragraphs = section.paragraphs.filter((paragraph) => hasText(paragraph.content));
      if (!paragraphs.length) return;
      units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, separator: false, keepWithNext: true });
      paragraphs.forEach((paragraph) => units.push({ id: paragraph.id, type: "introduction", content: paragraph.content }));
      return;
    }
    if (section.type === "timeline") {
      const items = section.items.filter((item) => item.visible);
      if (!items.length) return;
      units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, annotation: section.annotation, separator: true, keepWithNext: true });
      items.forEach((item) => {
        units.push({ id: item.id, type: "timeline", item, timelineKind: section.timelineKind });
        item.blocks.filter(blockHasContent).forEach((block) => {
          units.push({ id: `${item.id}-${block.id}`, type: "content-block", block, owner: section.timelineKind === "education" ? "education" : "timeline" });
        });
      });
      return;
    }
    if (section.type === "project-group") {
      const items = section.items.filter((item) => item.visible).sort((a, b) => a.order - b.order);
      if (!items.length) return;
      units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, separator: true, keepWithNext: true });
      items.forEach((item) => {
        const visibleBlocks = item.blocks.filter(blockHasContent);
        units.push({ id: item.id, type: "project-header", item, keepWithNext: visibleBlocks.length > 0 });
        visibleBlocks.forEach((block) => units.push({ id: `${item.id}-${block.id}`, type: "content-block", block, owner: "project" }));
      });
      return;
    }
    const freeText = section as FreeTextSection;
    const blocks = freeText.blocks.filter(blockHasContent);
    if (!blocks.length) return;
    units.push({ id: `${section.id}-heading`, type: "section-heading", title: section.title, separator: true, keepWithNext: true });
    blocks.forEach((block) => units.push({ id: `${section.id}-${block.id}`, type: "content-block", block, owner: "free-text" }));
  });
  return units;
}

function LayoutUnitView({ unit, measure = false, firstOnPage = false }: { unit: LayoutUnit; measure?: boolean; firstOnPage?: boolean }) {
  const attributes = measure ? { "data-measure-id": unit.id } : {};
  if (unit.type === "profile") {
    return <div className={`layout-unit layout-unit--profile${firstOnPage ? " layout-unit--first" : ""}`} {...attributes}><ProfileView section={unit.section} /></div>;
  }
  if (unit.type === "section-heading") {
    return (
      <div className={`layout-unit layout-unit--heading${firstOnPage ? " layout-unit--first" : ""}${unit.separator ? " layout-unit--separator" : ""}`} {...attributes}>
        <div className="resume-section-heading"><h2>{unit.title}</h2>{unit.annotation && <strong>{unit.annotation}</strong>}</div>
      </div>
    );
  }
  if (unit.type === "introduction") {
    return <div className="layout-unit layout-unit--paragraph" {...attributes}><RichText content={unit.content} /></div>;
  }
  if (unit.type === "timeline") {
    return <div className="layout-unit layout-unit--item" {...attributes}><TimelineView item={unit.item} kind={unit.timelineKind} /></div>;
  }
  if (unit.type === "project-header") {
    return <div className="layout-unit layout-unit--project" {...attributes}><ProjectHeader item={unit.item} /></div>;
  }
  if (unit.owner === "education") {
    return <div className="layout-unit layout-unit--block education-block" {...attributes}><ContentBlockView block={unit.block} /></div>;
  }
  return (
    <div className="layout-unit layout-unit--block" {...attributes}>
      <div className={`resume-grid-row resume-grid-row--continuation resume-grid-row--${unit.owner}`}>
        <div className="resume-meta-column" />
        <div className="resume-body-column"><ContentBlockView block={unit.block} /></div>
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
              <a key={link.id} href={safeHref(link.href)}><LinkGlyph />{link.label || link.href}</a>
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
    const range = [item.period.start, item.period.end].filter(Boolean).join(" — ");
    return (
      <div className="education-item">
        {range && <span className="education-period">{range}</span>}
        <h3><RichText content={item.title} /></h3>
        {item.organization && <p>{item.organization}</p>}
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
        {hasText(item.summary) && <p className="project-summary"><RichText content={item.summary} /></p>}
      </div>
    </div>
  );
}

function MetaColumn({ period, organization, links }: { period: { start: string; end: string; label?: string }; organization: string; links: ResumeLink[] }) {
  const range = [period.start, period.end].filter(Boolean).join(" — ");
  return (
    <div className="resume-meta-column">
      {range && <strong className="meta-period">{range}</strong>}
      {period.label && <span className="meta-duration">{period.label}</span>}
      {organization && <span className="meta-organization">{organization}</span>}
      {links.filter((link) => link.label || link.href).map((link) => (
        <a className="meta-link" key={link.id} href={safeHref(link.href)}>↗ {link.label || link.href}</a>
      ))}
    </div>
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  if (block.type === "paragraph") {
    return <p className="content-paragraph"><RichText content={block.content} /></p>;
  }
  if (block.type === "bullet-list") {
    return <ul className="content-bullets">{block.items.filter(hasText).map((item, index) => <li key={index}><RichText content={item} /></li>)}</ul>;
  }
  if (block.type === "detail") {
    return (
      <div className="detail-block">
        {hasText(block.title) && <h4><span className="square-bullet" /><RichText content={block.title} /></h4>}
        <div className="detail-content">
          {hasText(block.context) && <p><RichText content={block.context} /></p>}
          {block.actions.filter(hasText).map((action, index) => <p className="detail-action" key={index}><span>→</span><RichText content={action} /></p>)}
          {hasText(block.result) && <p className="detail-action detail-result"><span>→</span><RichText content={block.result} /></p>}
        </div>
      </div>
    );
  }
  if (block.type === "link-list") {
    return <div className="resume-link-list">{block.links.filter((link) => link.label || link.href).map((link) => <a href={safeHref(link.href)} key={link.id}>↗ {link.label || link.href}</a>)}</div>;
  }
  return <div className="tech-stack"><ToolIcon /><strong>{block.items.join(", ")}</strong></div>;
}

function LinkGlyph() {
  return <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.8 7.2 7.2 4.8M4.1 4.4l.8-.8a2 2 0 0 1 2.8 2.8l-.8.8M7.9 7.6l-.8.8a2 2 0 0 1-2.8-2.8l.8-.8" /></svg>;
}

function ToolIcon() {
  return <svg className="tech-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 2 10 10-2 2L2 4V2h2ZM11.5 2a3 3 0 0 0-3.2 3.9l1.8 1.8a3 3 0 0 0 3.9-3.2l-1.7 1.7-1.5-1.5L12.5 3Z" /></svg>;
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
