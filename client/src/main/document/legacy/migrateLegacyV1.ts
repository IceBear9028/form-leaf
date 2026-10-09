import {
  contentBlocksToMarkdown,
  textContentToMarkdown,
} from "../../../foundation/markdownSerialization.ts";
import { plainText } from "../../../foundation/content/resume.ts";
import type {
  LegacyContentBlock,
  LegacyProfileSection,
  LegacyProjectItem,
  LegacyLink,
  LegacyTextContent,
  LegacyTimelineItem,
  LegacyV1Document,
  LegacyV1ProjectItem,
  LegacyV2Document,
} from "./legacySchema.ts";

export function migrateLegacyV1(document: LegacyV1Document): LegacyV2Document {
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
          items: section.items.map((item): LegacyTimelineItem => ({
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

function migrateProjectItem(item: LegacyV1ProjectItem): LegacyProjectItem {
  const contentBlocks = item.blocks.filter((block) => block.type !== "tech-stack");
  const techStack = item.blocks
    .filter((block): block is Extract<LegacyContentBlock, { type: "tech-stack" }> => block.type === "tech-stack")
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

function cloneProfile(section: LegacyProfileSection): LegacyProfileSection {
  return {
    ...section,
    links: cloneLinks(section.links),
  };
}

function cloneLinks(links: LegacyLink[]): LegacyLink[] {
  return links.map((link) => ({ ...link }));
}

function cloneText(content: LegacyTextContent): LegacyTextContent {
  return {
    runs: content.runs.map((run) => ({
      ...run,
      marks: run.marks ? [...run.marks] : undefined,
    })),
  };
}

function hasText(content: LegacyTextContent): boolean {
  return plainText(content).trim().length > 0;
}

function joinMarkdown(parts: string[]): string {
  return parts.filter((part) => part.trim().length > 0).join("\n\n");
}
