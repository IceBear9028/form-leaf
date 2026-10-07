import type { ReactNode } from "react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
  className?: string;
}) {
  return (
    <label className={`field flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-[650] text-[#687384]">{label}</span>
      <input
        className={inputClass}
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
    <details className="group mb-2.5 overflow-hidden rounded-[11px] border border-[#e1e5ea] bg-white shadow-[0_2px_5px_rgba(24,32,45,0.025)]" open={defaultOpen}>
      <summary className="flex min-h-[49px] cursor-pointer list-none select-none items-center gap-2 px-[13px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3178ff] [&::-webkit-details-marker]:hidden">
        <span className="text-[23px] leading-none text-[#8993a2] transition-transform duration-160 group-open:rotate-90" aria-hidden="true">›</span>
        <span className="text-[13px] font-[720]">{title}</span>
        {meta && <span className="text-[11px] text-[#9199a6]">{meta}</span>}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-[5px] text-[11px] text-[#7b8492]" onClick={(event) => event.stopPropagation()}>
          <input
            className="accent-[#1768e5]"
            type="checkbox"
            checked={visible}
            onChange={(event) => onVisibleChange(event.target.checked)}
          />
          <span>{visible ? "표시" : "숨김"}</span>
        </label>
      </summary>
      <div className="border-t border-[#edf0f3] px-3.5 pb-4 pt-[15px]">{children}</div>
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
    <div className="item-actions mb-2 flex justify-end gap-1">
      <button type="button" className={itemActionClass} disabled={!onUp} onClick={onUp} aria-label="위로 이동">↑</button>
      <button type="button" className={itemActionClass} disabled={!onDown} onClick={onDown} aria-label="아래로 이동">↓</button>
      <button type="button" className={`${itemActionClass} text-[#bd4848]`} onClick={onDelete}>삭제</button>
    </div>
  );
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="h-[35px] w-full cursor-pointer rounded-lg border border-dashed border-[#bdc8d6] bg-[#f9fbfd] text-[11px] font-[650] text-[#416083] hover:border-[#6f9ee2] hover:bg-[#f3f7fe] hover:text-[#1768e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff]" onClick={onClick}>＋ {children}</button>;
}

const inputClass = "h-[35px] w-full rounded-[7px] border border-[#dce1e7] bg-white px-2.5 text-xs text-[#1d2735] placeholder:text-[#b3bac4] focus:border-[#73a4ec] focus:outline-2 focus:outline-[rgba(49,120,255,0.12)]";
const itemActionClass = "h-[25px] min-w-[25px] cursor-pointer rounded-md border border-[#dde2e8] bg-white px-[7px] text-[10px] text-[#697486] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff] disabled:cursor-default disabled:opacity-35";
