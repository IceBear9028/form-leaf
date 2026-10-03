import type { ReactNode } from "react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Accordion({
  title,
  meta,
  visible,
  onVisibleChange,
  children,
  defaultOpen = false,
}: {
  title: string;
  meta?: string;
  visible: boolean;
  onVisibleChange: (value: boolean) => void;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="editor-section" open={defaultOpen}>
      <summary>
        <span className="section-disclosure" aria-hidden="true">›</span>
        <span className="editor-section-title">{title}</span>
        {meta && <span className="editor-section-meta">{meta}</span>}
        <label className="visibility-toggle" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => onVisibleChange(event.target.checked)}
          />
          <span>{visible ? "표시" : "숨김"}</span>
        </label>
      </summary>
      <div className="editor-section-body">{children}</div>
    </details>
  );
}

export function ItemActions({
  onUp,
  onDown,
  onDelete,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="item-actions">
      <button type="button" disabled={!onUp} onClick={onUp} aria-label="위로 이동">↑</button>
      <button type="button" disabled={!onDown} onClick={onDown} aria-label="아래로 이동">↓</button>
      <button type="button" className="danger-button" onClick={onDelete}>삭제</button>
    </div>
  );
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="add-button" onClick={onClick}>＋ {children}</button>;
}
