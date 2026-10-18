import { useState } from "react";
import {
  ArrowLeftIcon,
  EllipsisIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import type {
  DeletedDocumentSummary,
  DocumentSummary,
} from "../../../../foundation/documentLibrary";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@/shared/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "@/shared/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

type LibraryProps = {
  documents: DocumentSummary[];
  deletedCount: number;
  busyId?: string;
  error?: string;
  onCreate: () => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onOpenTrash: () => void;
  onRetry: () => void;
};

export function DocumentLibraryPage({
  documents,
  deletedCount,
  busyId,
  error,
  onCreate,
  onOpen,
  onRename,
  onDelete,
  onOpenTrash,
  onRetry,
}: LibraryProps) {
  const [renameTarget, setRenameTarget] = useState<DocumentSummary>();
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary>();
  const [renameValue, setRenameValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const beginRename = (document: DocumentSummary) => {
    setRenameTarget(document);
    setRenameValue(document.name);
  };

  const submitRename = async () => {
    if (!renameTarget || submitting) return;
    setSubmitting(true);
    const completed = await onRename(renameTarget.id, renameValue);
    setSubmitting(false);
    if (completed) setRenameTarget(undefined);
  };

  const submitDelete = async () => {
    if (!deleteTarget || submitting) return;
    setSubmitting(true);
    const completed = await onDelete(deleteTarget.id);
    setSubmitting(false);
    if (completed) setDeleteTarget(undefined);
  };

  return (
    <LibraryShell>
      <LibraryHeader
        deletedCount={deletedCount}
        creating={busyId === "create"}
        onCreate={onCreate}
        onOpenTrash={onOpenTrash}
      />
      <main className="min-h-0 flex-1 overflow-y-auto px-8 py-9 max-sm:px-5">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">내 문서</h1>
              <p className="mt-1 text-sm text-muted-foreground">최근 수정한 순서로 표시됩니다.</p>
            </div>
            {documents.length > 0 && <Badge variant="secondary">총 {documents.length}개</Badge>}
          </div>
          {error && <ErrorAlert message={error} onRetry={onRetry} />}
          {documents.length === 0 ? (
            <EmptyLibrary onCreate={onCreate} creating={busyId === "create"} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {documents.map((document) => (
                <Card key={document.id} className="relative min-h-44 transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <FileTextIcon aria-hidden="true" className="size-4" />
                    </div>
                    <CardAction>
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon-sm" />}
                              />
                            }
                          >
                            <EllipsisIcon aria-hidden="true" />
                            <span className="sr-only">문서 작업</span>
                          </TooltipTrigger>
                          <TooltipContent>문서 작업</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={Boolean(busyId)}
                            onClick={() => beginRename(document)}
                          >
                            <PencilIcon aria-hidden="true" /> 이름 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={Boolean(busyId)}
                            onClick={() => setDeleteTarget(document)}
                          >
                            <Trash2Icon aria-hidden="true" /> 휴지통으로 이동
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      className="-m-2 h-auto flex-1 flex-col items-start whitespace-normal p-2 text-left"
                      disabled={Boolean(busyId)}
                      onClick={() => void onOpen(document.id)}
                    >
                      <CardTitle className="line-clamp-2">{document.name}</CardTitle>
                      <CardDescription className="mt-1.5">로컬 문서</CardDescription>
                      <span className="mt-auto pt-4 text-xs text-muted-foreground">
                        {formatUpdatedAt(document.updatedAt)}
                      </span>
                    </Button>
                  </CardContent>
                  {busyId === document.id && <BusyOverlay label="처리 중…" />}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open && !submitting) setRenameTarget(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서 이름 변경</DialogTitle>
            <DialogDescription>목록에서 구분할 문서 이름을 입력하세요.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="rename-document">문서 이름</FieldLabel>
            <Input
              id="rename-document"
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitRename();
              }}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setRenameTarget(undefined)}>
              취소
            </Button>
            <Button disabled={submitting} onClick={() => void submitRename()}>
              {submitting && <Spinner />} {submitting ? "변경 중…" : "변경"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !submitting) setDeleteTarget(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><Trash2Icon aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>문서를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="font-medium text-foreground">{deleteTarget?.name}</strong>을(를)
              휴지통으로 이동합니다. 휴지통에서 다시 복원할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={submitting} onClick={() => void submitDelete()}>
              {submitting && <Spinner />} {submitting ? "삭제 중…" : "휴지통으로 이동"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LibraryShell>
  );
}

type TrashProps = {
  documents: DeletedDocumentSummary[];
  busyId?: string;
  error?: string;
  onBack: () => void;
  onRestore: (id: string) => Promise<boolean>;
  onPermanentlyDelete: (id: string) => Promise<boolean>;
  onOpenRestored: (id: string) => Promise<void>;
  onRetry: () => void;
};

export function DocumentTrashPage({
  documents,
  busyId,
  error,
  onBack,
  onRestore,
  onPermanentlyDelete,
  onOpenRestored,
  onRetry,
}: TrashProps) {
  const [deleteTarget, setDeleteTarget] = useState<DeletedDocumentSummary>();
  const [deleting, setDeleting] = useState(false);

  const restore = async (document: DeletedDocumentSummary) => {
    if (!await onRestore(document.id)) return;
    toast.add({
      type: "success",
      title: `${document.name} 복원 완료`,
      description: "문서 목록으로 복원했습니다.",
      actionProps: {
        children: "바로 열기",
        onClick: () => void onOpenRestored(document.id),
      },
    });
  };

  const permanentlyDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const completed = await onPermanentlyDelete(deleteTarget.id);
    setDeleting(false);
    if (completed) setDeleteTarget(undefined);
  };

  return (
    <LibraryShell>
      <header className="flex h-16 flex-none items-center border-b border-border bg-background px-5 [-webkit-app-region:drag]">
        <Button variant="outline" className="[-webkit-app-region:no-drag]" onClick={onBack}>
          <ArrowLeftIcon aria-hidden="true" /> 문서 목록
        </Button>
        <strong className="ml-4 text-sm font-medium">휴지통</strong>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-8 py-9 max-sm:px-5">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">휴지통</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              최근 삭제한 순서입니다. 필요한 문서를 원래 목록으로 복원할 수 있습니다.
            </p>
          </div>
          {error && <ErrorAlert message={error} onRetry={onRetry} />}
          {documents.length === 0 ? (
            <Empty className="min-h-80 border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Trash2Icon aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>휴지통이 비어 있습니다.</EmptyTitle>
                <EmptyDescription>삭제한 문서가 여기에 표시됩니다.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {documents.map((document) => (
                <Card key={document.id} size="sm" className="relative flex-row items-center">
                  <CardContent className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted">
                      <FileTextIcon aria-hidden="true" className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate">{document.name}</CardTitle>
                      <CardDescription className="mt-1 truncate">
                        {formatDeletedAt(document.deletedAt)}
                      </CardDescription>
                    </div>
                    <div className="flex flex-none gap-2">
                      <Button variant="outline" disabled={Boolean(busyId)} onClick={() => void restore(document)}>
                        <RotateCcwIcon aria-hidden="true" /> 복원
                      </Button>
                      <Button variant="destructive" disabled={Boolean(busyId)} onClick={() => setDeleteTarget(document)}>
                        <Trash2Icon aria-hidden="true" /> 완전 삭제
                      </Button>
                    </div>
                  </CardContent>
                  {busyId === document.id && <BusyOverlay label="처리 중…" />}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><Trash2Icon aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>문서를 완전히 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="font-medium text-foreground">{deleteTarget?.name}</strong>과(와)
              저장된 백업을 영구 삭제합니다. 이 작업은 취소하거나 복원할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void permanentlyDelete()}>
              {deleting && <Spinner />} {deleting ? "삭제 중…" : "완전 삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LibraryShell>
  );
}

function LibraryShell({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col bg-muted/30 text-foreground">{children}</div>;
}

function LibraryHeader({
  deletedCount,
  creating,
  onCreate,
  onOpenTrash,
}: {
  deletedCount: number;
  creating: boolean;
  onCreate: () => Promise<void>;
  onOpenTrash: () => void;
}) {
  return (
    <header className="grid h-16 flex-none grid-cols-[1fr_auto] items-center border-b border-border bg-background px-5 [-webkit-app-region:drag]">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">F</div>
        <div>
          <strong className="block text-sm font-medium">Formleaf</strong>
          <span className="block text-xs text-muted-foreground">로컬 문서 보관함</span>
        </div>
      </div>
      <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
        <Button variant="outline" onClick={onOpenTrash}>
          <Trash2Icon aria-hidden="true" /> 휴지통
          {deletedCount > 0 && <Badge variant="secondary">{deletedCount}</Badge>}
        </Button>
        <Button disabled={creating} onClick={() => void onCreate()}>
          {creating ? <Spinner /> : <PlusIcon aria-hidden="true" />}
          {creating ? "만드는 중…" : "새 문서"}
        </Button>
      </div>
    </header>
  );
}

function EmptyLibrary({ onCreate, creating }: { onCreate: () => Promise<void>; creating: boolean }) {
  return (
    <Empty className="min-h-105 border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><FileTextIcon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>아직 작성한 문서가 없습니다.</EmptyTitle>
        <EmptyDescription>첫 문서를 만들고 내용을 작성해 보세요.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button disabled={creating} onClick={() => void onCreate()}>
          {creating ? <Spinner /> : <PlusIcon aria-hidden="true" />}
          {creating ? "만드는 중…" : "첫 문서 만들기"}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm" onClick={onRetry}>다시 시도</Button>
      </AlertAction>
    </Alert>
  );
}

function BusyOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] bg-background/80 text-sm font-medium" aria-live="polite">
      <Spinner /> {label}
    </div>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `오늘 ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 수정`
    : `${date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })} 수정`;
}

function formatDeletedAt(value: string): string {
  return `${new Date(value).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} 삭제`;
}
