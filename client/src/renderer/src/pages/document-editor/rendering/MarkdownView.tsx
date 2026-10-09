import type {
  Definition,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
} from "mdast";
import { Fragment, createElement, useMemo, type ReactNode } from "react";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { safeHref } from "./safeHref.ts";

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

type MarkdownContext = {
  definitions: Map<string, Pick<Definition, "url" | "title">>;
};

export function MarkdownView({ source }: { source: string }) {
  const tree = useMemo(() => parseMarkdown(source), [source]);
  const context = useMemo(() => ({ definitions: collectDefinitions(tree) }), [tree]);
  const footnotes = tree.children.filter((node) => node.type === "footnoteDefinition");
  return (
    <div className="document-markdown">
      {tree.children.map((node, index) => renderBlock(node, `block-${index}`, context))}
      {footnotes.length > 0 && (
        <section className="document-markdown-footnotes" aria-label="Footnotes">
          <ol>
            {footnotes.map((footnote, index) => (
              <li id={`footnote-${encodeURIComponent(footnote.identifier)}`} key={footnote.identifier}>
                {footnote.children.map((child, childIndex) =>
                  renderBlock(child, `footnote-${index}-${childIndex}`, context),
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export function parseMarkdown(source: string): Root {
  const normalized = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  return markdownProcessor.runSync(markdownProcessor.parse(normalized)) as Root;
}

function collectDefinitions(tree: Root): MarkdownContext["definitions"] {
  const definitions = new Map<string, Pick<Definition, "url" | "title">>();
  tree.children.forEach((node) => {
    if (node.type !== "definition") return;
    definitions.set(normalizeIdentifier(node.identifier), { url: node.url, title: node.title });
  });
  return definitions;
}

function renderBlock(node: RootContent, key: string, context: MarkdownContext): ReactNode {
  if (node.type === "paragraph") {
    return <p key={key}>{renderInlineNodes(node.children, key, context)}</p>;
  }
  if (node.type === "heading") {
    return createElement(
      `h${node.depth}`,
      { key },
      renderInlineNodes(node.children, key, context),
    );
  }
  if (node.type === "thematicBreak") return <hr key={key} />;
  if (node.type === "blockquote") {
    return (
      <blockquote key={key}>
        {node.children.map((child, index) => renderBlock(child, `${key}-${index}`, context))}
      </blockquote>
    );
  }
  if (node.type === "list") {
    const Tag = node.ordered ? "ol" : "ul";
    return (
      <Tag key={key} start={node.ordered ? node.start ?? undefined : undefined}>
        {node.children.map((item, index) => (
          <li key={`${key}-${index}`}>
            {item.children.map((child, childIndex) =>
              renderBlock(child, `${key}-${index}-${childIndex}`, context),
            )}
          </li>
        ))}
      </Tag>
    );
  }
  if (node.type === "code") {
    return <pre key={key}><code>{node.value}</code></pre>;
  }
  if (node.type === "html") {
    return <pre className="document-markdown-raw" key={key}><code>{node.value}</code></pre>;
  }
  if (node.type === "table") return renderTable(node, key, context);
  if (node.type === "definition" || node.type === "footnoteDefinition") return null;
  return null;
}

function renderTable(table: Table, key: string, context: MarkdownContext): ReactNode {
  const [head, ...body] = table.children;
  return (
    <table key={key}>
      {head && (
        <thead>
          <tr>{head.children.map((cell, index) => renderCell(cell, `${key}-head-${index}`, context, true))}</tr>
        </thead>
      )}
      {body.length > 0 && (
        <tbody>
          {body.map((row, rowIndex) => renderRow(row, `${key}-row-${rowIndex}`, context))}
        </tbody>
      )}
    </table>
  );
}

function renderRow(row: TableRow, key: string, context: MarkdownContext): ReactNode {
  return <tr key={key}>{row.children.map((cell, index) => renderCell(cell, `${key}-${index}`, context, false))}</tr>;
}

function renderCell(
  cell: TableCell,
  key: string,
  context: MarkdownContext,
  heading: boolean,
): ReactNode {
  const Tag = heading ? "th" : "td";
  return <Tag key={key}>{renderInlineNodes(cell.children, key, context)}</Tag>;
}

function renderInlineNodes(
  nodes: PhrasingContent[],
  keyPrefix: string,
  context: MarkdownContext,
): ReactNode[] {
  return nodes.map((node, index) => renderInline(node, `${keyPrefix}-inline-${index}`, context));
}

function renderInline(node: PhrasingContent, key: string, context: MarkdownContext): ReactNode {
  if (node.type === "text") return <Fragment key={key}>{renderTextWithUnderline(node.value, key)}</Fragment>;
  if (node.type === "break") return <br key={key} />;
  if (node.type === "inlineCode") return <code key={key}>{node.value}</code>;
  if (node.type === "html") return <code key={key}>{node.value}</code>;
  if (node.type === "strong") return <strong key={key}>{renderInlineNodes(node.children, key, context)}</strong>;
  if (node.type === "emphasis") return <em key={key}>{renderInlineNodes(node.children, key, context)}</em>;
  if (node.type === "delete") return <del key={key}>{renderInlineNodes(node.children, key, context)}</del>;
  if (node.type === "link") {
    return renderLink(node.url, node.title, renderInlineNodes(node.children, key, context), key);
  }
  if (node.type === "linkReference") {
    const definition = context.definitions.get(normalizeIdentifier(node.identifier));
    if (!definition) return <Fragment key={key}>{renderInlineNodes(node.children, key, context)}</Fragment>;
    return renderLink(
      definition.url,
      definition.title,
      renderInlineNodes(node.children, key, context),
      key,
    );
  }
  if (node.type === "image" || node.type === "imageReference") {
    return <span className="document-markdown-image-alt" key={key}>{node.alt ?? ""}</span>;
  }
  if (node.type === "footnoteReference") {
    return <sup key={key}>{node.label ?? node.identifier}</sup>;
  }
  return null;
}

function renderTextWithUnderline(value: string, key: string): ReactNode[] {
  const result: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  while (cursor < value.length) {
    const opening = value.indexOf("++", cursor);
    const closing = opening < 0 ? -1 : value.indexOf("++", opening + 2);
    if (opening < 0 || closing < 0) {
      result.push(<Fragment key={`${key}-${index}`}>{value.slice(cursor)}</Fragment>);
      break;
    }
    if (opening > cursor) {
      result.push(<Fragment key={`${key}-${index}`}>{value.slice(cursor, opening)}</Fragment>);
      index += 1;
    }
    result.push(<u key={`${key}-${index}`}>{value.slice(opening + 2, closing)}</u>);
    index += 1;
    cursor = closing + 2;
  }
  return result;
}

function renderLink(
  href: string,
  title: string | null | undefined,
  children: ReactNode,
  key: string,
): ReactNode {
  const safe = safeHref(href);
  if (!safe) return <span data-invalid-link={href} key={key}>{children}</span>;
  return <a href={safe} key={key} rel="noreferrer" title={title ?? undefined}>{children}</a>;
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
