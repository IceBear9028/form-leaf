import { useId, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Accordion as UiAccordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { Button } from "@/shared/ui/button";
import { Field as UiField, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

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
  const id = useId();
  return (
    <UiField className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </UiField>
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
    <UiAccordion className="mb-2.5 rounded-xl bg-card ring-1 ring-foreground/10" defaultValue={defaultOpen ? ["content"] : []}>
      <AccordionItem value="content" className="border-0">
        <div className="flex items-center gap-2 px-3">
          <AccordionTrigger className="min-h-12 flex-1 hover:no-underline">
            <span>{title}</span>
            {meta && <span className="ml-1 text-xs font-normal text-muted-foreground">{meta}</span>}
          </AccordionTrigger>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={visible} onCheckedChange={onVisibleChange} aria-label={`${title} 표시`} />
            <span>{visible ? "표시" : "숨김"}</span>
          </label>
        </div>
        <AccordionContent className="border-t px-3.5 pb-4 pt-3.5">
          {children}
        </AccordionContent>
      </AccordionItem>
    </UiAccordion>
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
      <Tooltip>
        <TooltipTrigger render={<Button type="button" variant="outline" size="icon-xs" disabled={!onUp} onClick={onUp} />}>
          <ArrowUpIcon aria-hidden="true" />
          <span className="sr-only">위로 이동</span>
        </TooltipTrigger>
        <TooltipContent>위로 이동</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<Button type="button" variant="outline" size="icon-xs" disabled={!onDown} onClick={onDown} />}>
          <ArrowDownIcon aria-hidden="true" />
          <span className="sr-only">아래로 이동</span>
        </TooltipTrigger>
        <TooltipContent>아래로 이동</TooltipContent>
      </Tooltip>
      <Button type="button" variant="destructive" size="xs" onClick={onDelete}>
        <Trash2Icon aria-hidden="true" /> 삭제
      </Button>
    </div>
  );
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className="w-full border-dashed" onClick={onClick}>
      <PlusIcon aria-hidden="true" /> {children}
    </Button>
  );
}
