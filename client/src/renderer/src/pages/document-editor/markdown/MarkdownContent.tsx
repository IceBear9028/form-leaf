import type {
  FootnoteDefinition,
  List,
  PhrasingContent,
  RootContent,
  Table,
} from "mdast";
import { useId, type ReactNode } from "react";
import { collectMarkdownDefinitions, parseMarkdownBlocks, type MarkdownBlock, type MarkdownDefinition } from "./parser";

export type MarkdownContext = "document";

type MarkdownRenderContext = {
  definitions: Map<string, MarkdownDefinition>;
  footnoteNumbers: Map<string, number>;
  idPrefix: string;
};

export function MarkdownContent({
  source,
  context,
  blockIndexes,
  showFootnotes = true,
}: {
  source: string;
  context: MarkdownContext;
  blockIndexes?: number[];
  showFootnotes?: boolean;
}) {
  const generatedId = useId();
  const blocks = parseMarkdownBlocks(source);
  const renderedBlocks = blockIndexes
    ? blockIndexes.flatMap((index) => blocks[index] ? [blocks[index]] : [])
    : blocks;
  const footnotes = getFootnotes(blocks);
  const renderContext = createRenderContext(blocks, `markdown-${generatedId.replaceAll(":", "")}`);

  return (
    <div className={`markdown-body markdown-body--${context}`}>
      {renderedBlocks.map((block) => (
        <MarkdownBlockView
          key={block.id}
          block={block}
          renderContext={renderContext}
        />
      ))}
      {showFootnotes && footnotes.length > 0 && (
        <MarkdownFootnotes footnotes={footnotes} renderContext={renderContext} />
      )}
    </div>
  );
}

export function MarkdownBlockContent({ block, documentBlocks, context, idPrefix, lead = false }: {
  block: MarkdownBlock;
  documentBlocks: MarkdownBlock[];
  context: MarkdownContext;
  idPrefix: string;
  lead?: boolean;
}) {
  return <div className={`markdown-body markdown-body--${context}`}>
    <MarkdownBlockView block={block} lead={lead} renderContext={createRenderContext(documentBlocks, idPrefix)} />
  </div>;
}

export function MarkdownFootnotesContent({
  documentBlocks,
  context,
  idPrefix,
}: {
  documentBlocks: MarkdownBlock[];
  context: MarkdownContext;
  idPrefix: string;
}) {
  const footnotes = getFootnotes(documentBlocks);
  if (!footnotes.length) return null;
  const renderContext = createRenderContext(documentBlocks, idPrefix);
  return (
    <div className={`markdown-body markdown-body--${context}`}>
      <MarkdownFootnotes footnotes={footnotes} renderContext={renderContext} />
    </div>
  );
}

export function MarkdownBlockView({
  block,
  lead = false,
  renderContext = emptyRenderContext,
  showExtraBlankLines = true,
}: {
  block: MarkdownBlock;
  lead?: boolean;
  renderContext?: MarkdownRenderContext;
  showExtraBlankLines?: boolean;
}) {
  if (block.node.type === "definition" || block.node.type === "footnoteDefinition") return null;
  return (
    <>
      {showExtraBlankLines && block.extraBlankLinesBefore > 0 && (
        <div className="markdown-extra-blank-lines" aria-hidden="true">
          {Array.from({ length: block.extraBlankLinesBefore }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      <MarkdownNodeView node={block.node} lead={lead} renderContext={renderContext} />
    </>
  );
}

function MarkdownNodeView({
  node,
  lead = false,
  compact = false,
  renderContext,
}: {
  node: RootContent;
  lead?: boolean;
  compact?: boolean;
  renderContext: MarkdownRenderContext;
}): ReactNode {
  if (node.type === "heading") {
    const HeadingTag = `h${node.depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <HeadingTag
        className={`markdown-block markdown-heading markdown-heading--h${node.depth}`}
        data-markdown-block="heading"
      >
        <MarkdownInline nodes={node.children} renderContext={renderContext} />
      </HeadingTag>
    );
  }

  if (node.type === "paragraph") {
    return (
      <p
        className={[
          "markdown-block",
          "markdown-paragraph",
          lead ? "markdown-paragraph--lead" : "",
          compact ? "markdown-paragraph--compact" : "",
        ].filter(Boolean).join(" ")}
        data-markdown-block="paragraph"
      >
        <MarkdownInline nodes={node.children} renderContext={renderContext} />
      </p>
    );
  }

  if (node.type === "list") {
    return <MarkdownList node={node} renderContext={renderContext} />;
  }

  if (node.type === "blockquote") {
    return (
      <blockquote className="markdown-block markdown-blockquote" data-markdown-block="blockquote">
        {node.children.map((child, index) => (
          <MarkdownNodeView
            key={index}
            node={child}
            compact
            renderContext={renderContext}
          />
        ))}
      </blockquote>
    );
  }

  if (node.type === "code") {
    return <pre className="markdown-block markdown-code-block" data-markdown-block="code">
      <code className={node.lang ? `language-${node.lang}` : undefined}>{node.value}</code>
    </pre>;
  }
  if (node.type === "thematicBreak") {
    return <hr className="markdown-block markdown-thematic-break" data-markdown-block="separator" />;
  }

  if (node.type === "table") {
    return <MarkdownTable node={node} renderContext={renderContext} />;
  }

  if (node.type === "html") {
    return (
      <div className="markdown-block markdown-raw-html" data-markdown-block="html">
        {node.value}
      </div>
    );
  }

  if (node.type === "definition" || node.type === "footnoteDefinition") return null;

  if (isPhrasingContent(node)) {
    return (
      <p className="markdown-block markdown-paragraph" data-markdown-block="paragraph">
        <MarkdownInline nodes={[node]} renderContext={renderContext} />
      </p>
    );
  }

  return null;
}

function MarkdownList({
  node,
  renderContext,
}: {
  node: List;
  renderContext: MarkdownRenderContext;
}) {
  const className = [
    "markdown-block",
    "markdown-list",
    node.ordered ? "markdown-list--ordered" : "markdown-list--unordered",
    node.children.some((item) => item.checked !== null && item.checked !== undefined)
      ? "markdown-list--task"
      : "",
  ].filter(Boolean).join(" ");
  const items = node.children.map((item, index) => (
    <li
      key={index}
      className={item.checked !== null && item.checked !== undefined ? "markdown-task-item" : undefined}
    >
      {item.checked !== null && item.checked !== undefined && (
        <input
          className="markdown-task-checkbox"
          type="checkbox"
          checked={item.checked}
          disabled
          readOnly
          tabIndex={-1}
          aria-label={item.checked ? "작업 완료 해제" : "작업 완료"}
        />
      )}
      <div className="markdown-list-item-content">
        {item.children.length === 0 && <p className="markdown-paragraph markdown-empty-list-item"><br /></p>}
        {item.children.map((child, childIndex) => (
          <MarkdownNodeView
            key={childIndex}
            node={child}
            compact
            renderContext={renderContext}
          />
        ))}
      </div>
    </li>
  ));

  if (node.ordered) {
    return (
      <ol className={className} start={node.start ?? undefined} data-markdown-block="list">
        {items}
      </ol>
    );
  }
  return <ul className={className} data-markdown-block="list">{items}</ul>;
}

function MarkdownTable({
  node,
  renderContext,
}: {
  node: Table;
  renderContext: MarkdownRenderContext;
}) {
  const [head, ...body] = node.children;
  return (
    <div className="markdown-block markdown-table-wrap" data-markdown-block="table">
      <table className="markdown-table">
        {head && (
          <thead>
            <tr>
              {head.children.map((cell, index) => (
                <th key={index} style={{ textAlign: node.align?.[index] ?? undefined }}>
                  <MarkdownInline nodes={cell.children} renderContext={renderContext} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        {body.length > 0 && (
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.children.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{ textAlign: node.align?.[cellIndex] ?? undefined }}>
                    <MarkdownInline nodes={cell.children} renderContext={renderContext} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

function MarkdownInline({
  nodes,
  renderContext,
}: {
  nodes: PhrasingContent[];
  renderContext: MarkdownRenderContext;
}) {
  return <>{nodes.map((node, index) => (
    <MarkdownInlineNode
      key={index}
      node={node}
      keyPrefix={index}
      renderContext={renderContext}
    />
  ))}</>;
}

function MarkdownInlineNode({
  node,
  keyPrefix,
  renderContext,
}: {
  node: PhrasingContent;
  keyPrefix: number;
  renderContext: MarkdownRenderContext;
}): ReactNode {
  if (node.type === "text") return textWithUnderline(node.value, keyPrefix);
  if (node.type === "break") return <br />;
  if (node.type === "strong") {
    return <strong><MarkdownInline nodes={node.children} renderContext={renderContext} /></strong>;
  }
  if (node.type === "emphasis") {
    return <em><MarkdownInline nodes={node.children} renderContext={renderContext} /></em>;
  }
  if (node.type === "delete") {
    return <del><MarkdownInline nodes={node.children} renderContext={renderContext} /></del>;
  }
  if (node.type === "inlineCode") return <code className="markdown-inline-code">{node.value}</code>;
  if (node.type === "html") {
    return /^<br\s*\/?>$/i.test(node.value)
      ? <br /> : <span className="markdown-inline-html">{node.value}</span>;
  }
  if (node.type === "link") {
    return renderLink(node.url, node.title, node.children, renderContext);
  }
  if (node.type === "linkReference") {
    const definition = renderContext.definitions.get(normalizeIdentifier(node.identifier));
    return definition
      ? renderLink(definition.url, definition.title, node.children, renderContext)
      : <MarkdownInline nodes={node.children} renderContext={renderContext} />;
  }
  if (node.type === "image") return renderImage(node.url, node.alt, node.title);
  if (node.type === "imageReference") {
    const definition = renderContext.definitions.get(normalizeIdentifier(node.identifier));
    return definition
      ? renderImage(definition.url, node.alt, definition.title)
      : <span>{node.alt}</span>;
  }
  if (node.type === "footnoteReference") {
    const identifier = normalizeIdentifier(node.identifier);
    const number = renderContext.footnoteNumbers.get(identifier);
    if (!number) return <sup>[{node.label ?? node.identifier}]</sup>;
    const anchorId = `${renderContext.idPrefix}-footnote-${encodeURIComponent(identifier)}`;
    return <sup className="markdown-footnote-reference"><a href={`#${anchorId}`}>{number}</a></sup>;
  }
  return null;
}

function MarkdownFootnotes({
  footnotes,
  renderContext,
}: {
  footnotes: FootnoteDefinition[];
  renderContext: MarkdownRenderContext;
}) {
  return (
    <section className="markdown-block markdown-footnotes" aria-label="각주">
      <ol>
        {footnotes.map((footnote) => {
          const identifier = normalizeIdentifier(footnote.identifier);
          const anchorId = `${renderContext.idPrefix}-footnote-${encodeURIComponent(identifier)}`;
          return (
            <li key={identifier} id={anchorId}>
              {footnote.children.map((child, index) => (
                <MarkdownNodeView
                  key={index}
                  node={child}
                  compact
                  renderContext={renderContext}
                />
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function renderLink(
  value: string,
  title: string | null | undefined,
  children: PhrasingContent[],
  renderContext: MarkdownRenderContext,
): ReactNode {
  const href = safeHref(value);
  const content = <MarkdownInline nodes={children} renderContext={renderContext} />;
  return href
    ? (
        <a
          href={href}
          title={title ?? undefined}
        >
          {content}
        </a>
      )
    : <span>{content}</span>;
}

function renderImage(
  value: string,
  alt: string | null | undefined,
  title: string | null | undefined,
): ReactNode {
  const src = safeImageSrc(value);
  return src
    ? <img className="markdown-image" src={src} alt={alt ?? ""} title={title ?? undefined} />
    : <span className="markdown-image-alt">{alt ?? value}</span>;
}

function textWithUnderline(value: string, keyPrefix: number): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let partIndex = 0;
  while (cursor < value.length) {
    const opening = value.indexOf("++", cursor);
    const closing = opening < 0 ? -1 : value.indexOf("++", opening + 2);
    if (opening < 0 || closing < 0) {
      parts.push(<span key={`${keyPrefix}-${partIndex}`}>{value.slice(cursor)}</span>);
      break;
    }
    if (opening > cursor) {
      parts.push(<span key={`${keyPrefix}-${partIndex}`}>{value.slice(cursor, opening)}</span>);
      partIndex += 1;
    }
    parts.push(<u key={`${keyPrefix}-${partIndex}`}>{value.slice(opening + 2, closing)}</u>);
    partIndex += 1;
    cursor = closing + 2;
  }
  return parts.length ? parts : value;
}

function isPhrasingContent(node: RootContent): node is PhrasingContent {
  return [
    "break",
    "delete",
    "emphasis",
    "footnoteReference",
    "html",
    "image",
    "imageReference",
    "inlineCode",
    "link",
    "linkReference",
    "strong",
    "text",
  ].includes(node.type);
}

function safeHref(value: string): string | undefined {
  const trimmed = value.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : undefined;
}

function safeImageSrc(value: string): string | undefined {
  const trimmed = value.trim();
  return /^(https?:|data:image\/(?:avif|gif|jpeg|png|webp);base64,)/i.test(trimmed)
    ? trimmed
    : undefined;
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getFootnotes(blocks: MarkdownBlock[]): FootnoteDefinition[] {
  return blocks
    .map(({ node }) => node)
    .filter((node): node is FootnoteDefinition => node.type === "footnoteDefinition");
}

function createRenderContext(
  blocks: MarkdownBlock[],
  idPrefix: string,
): MarkdownRenderContext {
  const footnotes = getFootnotes(blocks);
  return {
    definitions: collectMarkdownDefinitions(blocks),
    footnoteNumbers: new Map(
      footnotes.map((footnote, index) => [normalizeIdentifier(footnote.identifier), index + 1]),
    ),
    idPrefix,
  };
}

const emptyRenderContext: MarkdownRenderContext = {
  definitions: new Map(),
  footnoteNumbers: new Map(),
  idPrefix: "markdown",
};
