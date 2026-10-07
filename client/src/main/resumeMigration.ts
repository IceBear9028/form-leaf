import {
  contentBlocksToMarkdown,
  textContentToMarkdown,
} from "../foundation/markdownSerialization.ts";
import { plainText } from "../foundation/resume.ts";
import type {
  ContentBlock,
  ProfileSection,
  ProjectItem,
  ResumeDocument,
  ResumeLink,
  TextContent,
  TimelineItem,
  V1ProjectItem,
  V1ResumeDocument,
} from "../foundation/resume";

export function migrateResumeDocumentV1(document: V1ResumeDocument): ResumeDocument {
  return {
    schemaVersion: 2,
    documentId: document.documentId,
    name: document.name,
    styleSheetId: document.styleSheetId,
    pagination: { ...document.pagination },
    updatedAt: document.updatedAt,
    sections: document.sections.map((section) => {
      if (section.type === "profile") return cloneProfile(section);
      if (section.type === "introduction") {
        return {
          id: section.id,
          type: section.type,
          title: section.title,
          visible: section.visible,
          bodyMarkdown: joinMarkdown(
            section.paragraphs
              .filter((paragraph) => hasText(paragraph.content))
              .map((paragraph) => textContentToMarkdown(paragraph.content)),
          ),
        };
      }
      if (section.type === "timeline") {
        return {
          id: section.id,
          type: section.type,
          timelineKind: section.timelineKind,
          title: section.title,
          annotation: section.annotation,
          visible: section.visible,
          items: section.items.map((item): TimelineItem => ({
            id: item.id,
            visible: item.visible,
            period: { ...item.period },
            organization: item.organization,
            title: cloneText(item.title),
            links: cloneLinks(item.links),
            bodyMarkdown: contentBlocksToMarkdown(item.blocks),
          })),
        };
      }
      if (section.type === "project-group") {
        return {
          id: section.id,
          type: section.type,
          groupKind: section.groupKind,
          title: section.title,
          visible: section.visible,
          items: section.items.map(migrateProjectItem),
        };
      }
      return {
        id: section.id,
        type: section.type,
        title: section.title,
        visible: section.visible,
        bodyMarkdown: contentBlocksToMarkdown(section.blocks),
      };
    }),
  };
}

function migrateProjectItem(item: V1ProjectItem): ProjectItem {
  const contentBlocks = item.blocks.filter((block) => block.type !== "tech-stack");
  const techStack = item.blocks
    .filter((block): block is Extract<ContentBlock, { type: "tech-stack" }> => block.type === "tech-stack")
    .flatMap((block) => block.items);
  return {
    id: item.id,
    visible: item.visible,
    order: item.order,
    period: { ...item.period },
    organization: item.organization,
    title: cloneText(item.title),
    links: cloneLinks(item.links),
    techStack,
    bodyMarkdown: joinMarkdown([
      hasText(item.summary) ? textContentToMarkdown(item.summary) : "",
      contentBlocksToMarkdown(contentBlocks),
    ]),
  };
}

function cloneProfile(section: ProfileSection): ProfileSection {
  return {
    ...section,
    links: cloneLinks(section.links),
  };
}

function cloneLinks(links: ResumeLink[]): ResumeLink[] {
  return links.map((link) => ({ ...link }));
}

function cloneText(content: TextContent): TextContent {
  return {
    runs: content.runs.map((run) => ({
      ...run,
      marks: run.marks ? [...run.marks] : undefined,
    })),
  };
}

function hasText(content: TextContent): boolean {
  return plainText(content).trim().length > 0;
}

function joinMarkdown(parts: string[]): string {
  return parts.filter((part) => part.trim().length > 0).join("\n\n");
}
