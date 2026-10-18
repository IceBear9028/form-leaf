import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckSquareIcon,
  CodeXmlIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
} from "lucide-react";
import type { MarkdownCommand } from "./edits.ts";

type QuickInsertItem = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  icon: React.ReactNode;
  command: MarkdownCommand;
};

const quickInsertItems: QuickInsertItem[] = [
  {
    id: "heading-1",
    label: "제목 1",
    description: "가장 큰 제목",
    keywords: "heading h1 title 제목",
    icon: <Heading1Icon aria-hidden="true" />,
    command: { type: "heading", level: 1 },
  },
  {
    id: "heading-2",
    label: "제목 2",
    description: "중간 제목",
    keywords: "heading h2 subtitle 제목",
    icon: <Heading2Icon aria-hidden="true" />,
    command: { type: "heading", level: 2 },
  },
  {
    id: "heading-3",
    label: "제목 3",
    description: "작은 제목",
    keywords: "heading h3 subtitle 제목",
    icon: <Heading3Icon aria-hidden="true" />,
    command: { type: "heading", level: 3 },
  },
  {
    id: "bullet-list",
    label: "글머리 목록",
    description: "순서 없는 목록",
    keywords: "bullet unordered list 목록 불릿",
    icon: <ListIcon aria-hidden="true" />,
    command: { type: "list", style: "unordered" },
  },
  {
    id: "ordered-list",
    label: "번호 목록",
    description: "순서가 있는 목록",
    keywords: "number ordered list 번호 목록",
    icon: <ListOrderedIcon aria-hidden="true" />,
    command: { type: "list", style: "ordered" },
  },
  {
    id: "task-list",
    label: "작업 항목",
    description: "체크할 수 있는 목록",
    keywords: "task checkbox check todo 작업 체크",
    icon: <CheckSquareIcon aria-hidden="true" />,
    command: { type: "list", style: "task" },
  },
  {
    id: "blockquote",
    label: "인용문",
    description: "강조할 인용 블록",
    keywords: "quote blockquote 인용",
    icon: <QuoteIcon aria-hidden="true" />,
    command: { type: "blockquote" },
  },
  {
    id: "divider",
    label: "구분선",
    description: "내용을 나누는 선",
    keywords: "divider rule horizontal 구분선",
    icon: <MinusIcon aria-hidden="true" />,
    command: { type: "divider" },
  },
  {
    id: "code-block",
    label: "코드 블록",
    description: "여러 줄 코드",
    keywords: "code block 코드",
    icon: <CodeXmlIcon aria-hidden="true" />,
    command: { type: "code-block" },
  },
];

export function MarkdownQuickInsertMenu({
  rect,
  query,
  onSelect,
  onClose,
}: {
  rect: DOMRect;
  query: string;
  onSelect: (command: MarkdownCommand) => void;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const items = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return quickInsertItems;
    return quickInsertItems.filter((item) =>
      `${item.label} ${item.description} ${item.keywords}`.toLocaleLowerCase().includes(normalized),
    );
  }, [query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        if (!items.length) return;
        setActiveIndex((current) => (
          event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length
        ));
        return;
      }
      if (event.key !== "Enter" || !items.length) return;
      event.preventDefault();
      event.stopPropagation();
      onSelect(items[Math.min(activeIndex, items.length - 1)].command);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeIndex, items, onClose, onSelect]);

  const left = Math.min(window.innerWidth - 296, Math.max(8, rect.left));
  const top = Math.min(window.innerHeight - 360, Math.max(8, rect.bottom + 8));

  return createPortal(
    <div
      className="fixed z-50 w-72 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
      role="listbox"
      aria-label="Markdown 빠른 삽입"
      style={{ left, top }}
      onPointerDown={(event) => event.preventDefault()}
    >
      <div className="border-b px-3 py-2 text-xs text-muted-foreground">
        블록 삽입{query ? ` · ${query}` : ""}
      </div>
      <div className="max-h-72 overflow-y-auto p-1">
        {items.length ? items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left ${
              index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
            }`}
            onPointerEnter={() => setActiveIndex(index)}
            onClick={() => onSelect(item.command)}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded border bg-background [&_svg]:size-4">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        )) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">일치하는 블록이 없습니다.</div>
        )}
      </div>
      <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        ↑↓ 이동 · Enter 삽입 · Esc 닫기
      </div>
    </div>,
    document.body,
  );
}
