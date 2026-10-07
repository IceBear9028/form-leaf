import { useState } from "react";
import type {
  DeletedDocumentSummary,
  DocumentSummary,
} from "../../../../foundation/documentLibrary";

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

  const beginRename = (resume: DocumentSummary) => {
    setRenameTarget(resume);
    setRenameValue(resume.title);
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
      <main className="min-h-0 flex-1 overflow-y-auto px-8 pb-16 pt-9 max-sm:px-5">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="m-0 text-[26px] font-bold tracking-[-0.025em] text-[#18202d]">내 이력서</h1>
              <p className="mb-0 mt-1.5 text-[13px] text-[#758092]">최근 수정한 순서로 표시됩니다.</p>
            </div>
            {documents.length > 0 && <span className="text-xs text-[#8a94a3]">총 {documents.length}개</span>}
          </div>
          {error && <ErrorBanner message={error} onRetry={onRetry} />}
          {documents.length === 0 ? (
            <EmptyLibrary onCreate={onCreate} creating={busyId === "create"} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {documents.map((resume) => (
                <article key={resume.id} className="group relative flex min-h-[170px] flex-col rounded-[14px] border border-[#dfe4eb] bg-white shadow-[0_3px_14px_rgba(24,32,45,0.05)] transition hover:-translate-y-0.5 hover:border-[#b9c9df] hover:shadow-[0_8px_24px_rgba(24,32,45,0.09)]">
                  <button
                    type="button"
                    className="flex min-h-0 flex-1 cursor-pointer flex-col items-start border-0 bg-transparent px-5 pb-4 pt-5 text-left focus-visible:rounded-[14px] focus-visible:outline-2 focus-visible:outline-[#3178ff]"
                    disabled={Boolean(busyId)}
                    onClick={() => void onOpen(resume.id)}
                  >
                    <span className="mb-4 grid h-10 w-10 place-items-center rounded-[10px] bg-[#edf4ff] text-[#1768e5]"><DocumentIcon /></span>
                    <strong className="line-clamp-2 text-[16px] leading-[1.35] tracking-[-0.015em] text-[#202a38]">{resume.title}</strong>
                    <span className="mt-1.5 text-xs text-[#737f90]">{resume.profileName || "프로필 이름 없음"}</span>
                    <span className="mt-auto pt-4 text-[11px] text-[#98a1af]">{formatUpdatedAt(resume.updatedAt)}</span>
                  </button>
                  <div className="absolute right-3 top-3 flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <CardAction label="이름 변경" onClick={() => beginRename(resume)} disabled={Boolean(busyId)}><EditIcon /></CardAction>
                    <CardAction label="삭제" onClick={() => setDeleteTarget(resume)} disabled={Boolean(busyId)} danger><TrashIcon /></CardAction>
                  </div>
                  {busyId === resume.id && <BusyOverlay label="처리 중…" />}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {renameTarget && (
        <Modal title="이력서 이름 변경" onClose={() => !submitting && setRenameTarget(undefined)}>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[#5f6b7c]">
            이력서 제목
            <input
              autoFocus
              className="h-10 rounded-lg border border-[#d7dde6] px-3 text-sm font-normal text-[#1f2937] outline-none focus:border-[#6c9ee9] focus:ring-2 focus:ring-[#dceaff]"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitRename();
              }}
            />
          </label>
          <ModalActions
            confirmLabel={submitting ? "변경 중…" : "변경"}
            disabled={submitting}
            onCancel={() => setRenameTarget(undefined)}
            onConfirm={() => void submitRename()}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="이력서를 삭제할까요?" onClose={() => !submitting && setDeleteTarget(undefined)}>
          <p className="m-0 text-[13px] leading-6 text-[#697586]">
            <strong className="font-semibold text-[#263142]">{deleteTarget.title}</strong>을(를) 목록에서 삭제합니다.<br />삭제한 이력서는 휴지통에서 복원할 수 있습니다.
          </p>
          <ModalActions
            confirmLabel={submitting ? "삭제 중…" : "휴지통으로 이동"}
            disabled={submitting}
            danger
            onCancel={() => setDeleteTarget(undefined)}
            onConfirm={() => void submitDelete()}
          />
        </Modal>
      )}
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
  const [restored, setRestored] = useState<DocumentSummary>();
  const [deleteTarget, setDeleteTarget] = useState<DeletedDocumentSummary>();
  const [deleting, setDeleting] = useState(false);

  const restore = async (resume: DeletedDocumentSummary) => {
    if (await onRestore(resume.id)) {
      const { deletedAt: _deletedAt, ...summary } = resume;
      setRestored(summary);
    }
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
      <header className="flex h-16 flex-none items-center border-b border-[#dfe3e9] bg-white/[0.97] px-[22px] shadow-[0_1px_8px_rgba(26,34,48,0.04)] [-webkit-app-region:drag]">
        <button type="button" className={secondaryButtonClass} onClick={onBack}><BackIcon /> 이력서 목록</button>
        <strong className="ml-4 text-sm">휴지통</strong>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-8 pb-16 pt-9 max-sm:px-5">
        <div className="mx-auto max-w-[960px]">
          <div className="mb-6">
            <h1 className="m-0 text-[26px] font-bold tracking-[-0.025em] text-[#18202d]">휴지통</h1>
            <p className="mb-0 mt-1.5 text-[13px] text-[#758092]">최근 삭제한 순서입니다. 필요한 이력서를 원래 목록으로 복원할 수 있습니다.</p>
          </div>
          {error && <ErrorBanner message={error} onRetry={onRetry} />}
          {restored && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] border border-[#cce7d9] bg-[#f4fbf7] px-4 py-3 text-xs text-[#256343]" role="status">
              <span><strong>{restored.title}</strong>을(를) 복원했습니다.</span>
              <button type="button" className="cursor-pointer border-0 bg-transparent font-semibold text-[#1768e5]" onClick={() => void onOpenRestored(restored.id)}>바로 열기</button>
            </div>
          )}
          {documents.length === 0 ? (
            <div className="grid min-h-[320px] place-items-center rounded-[16px] border border-dashed border-[#d4dbe5] bg-white/70 px-6 text-center">
              <div><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#f0f3f7] text-[#8090a5]"><TrashIcon /></div><strong className="text-[16px] text-[#303b4a]">휴지통이 비어 있습니다.</strong><p className="mb-0 mt-2 text-[13px] text-[#7b8797]">삭제한 이력서가 여기에 표시됩니다.</p></div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {documents.map((resume) => (
                <article key={resume.id} className="relative flex items-center gap-4 rounded-[12px] border border-[#e0e5ec] bg-white px-5 py-4 shadow-[0_2px_10px_rgba(24,32,45,0.04)]">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-[#f1f3f6] text-[#758195]"><DocumentIcon /></span>
                  <div className="min-w-0 flex-1"><strong className="block truncate text-[14px] text-[#273241]">{resume.title}</strong><span className="mt-1 block text-[11px] text-[#8a94a3]">{resume.profileName || "프로필 이름 없음"} · {formatDeletedAt(resume.deletedAt)}</span></div>
                  <div className="flex flex-none gap-2">
                    <button type="button" className={secondaryButtonClass} disabled={Boolean(busyId)} onClick={() => void restore(resume)}>복원</button>
                    <button type="button" className={outlineDangerButtonClass} disabled={Boolean(busyId)} onClick={() => setDeleteTarget(resume)}>완전 삭제</button>
                  </div>
                  {busyId === resume.id && <BusyOverlay label="처리 중…" />}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      {deleteTarget && (
        <Modal title="이력서를 완전히 삭제할까요?" onClose={() => !deleting && setDeleteTarget(undefined)}>
          <p className="m-0 text-[13px] leading-6 text-[#697586]">
            <strong className="font-semibold text-[#263142]">{deleteTarget.title}</strong>과(와) 저장된 백업을 영구 삭제합니다.<br />이 작업은 취소하거나 복원할 수 없습니다.
          </p>
          <ModalActions
            confirmLabel={deleting ? "삭제 중…" : "완전 삭제"}
            disabled={deleting}
            danger
            onCancel={() => setDeleteTarget(undefined)}
            onConfirm={() => void permanentlyDelete()}
          />
        </Modal>
      )}
    </LibraryShell>
  );
}

function LibraryShell({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col bg-[#f4f6f9]">{children}</div>;
}

function LibraryHeader({ deletedCount, creating, onCreate, onOpenTrash }: { deletedCount: number; creating: boolean; onCreate: () => Promise<void>; onOpenTrash: () => void }) {
  return (
    <header className="grid h-16 flex-none grid-cols-[1fr_auto] items-center border-b border-[#dfe3e9] bg-white/[0.97] px-[22px] shadow-[0_1px_8px_rgba(26,34,48,0.04)] [-webkit-app-region:drag]">
      <div className="flex items-center gap-[11px]"><div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[#1768e5] text-[17px] font-extrabold text-white shadow-[0_4px_12px_rgba(23,104,229,0.24)]">R</div><div className="flex flex-col gap-0.5"><strong className="text-sm tracking-[-0.01em]">Resume Studio</strong><span className="text-[11px] text-[#8992a1]">로컬 이력서 보관함</span></div></div>
      <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
        <button type="button" className={secondaryButtonClass} onClick={onOpenTrash}><TrashIcon /> 휴지통{deletedCount > 0 && <span className="rounded-full bg-[#edf0f4] px-1.5 py-0.5 text-[10px]">{deletedCount}</span>}</button>
        <button type="button" className={primaryButtonClass} disabled={creating} onClick={() => void onCreate()}>{creating ? "만드는 중…" : "+ 새 이력서"}</button>
      </div>
    </header>
  );
}

function EmptyLibrary({ onCreate, creating }: { onCreate: () => Promise<void>; creating: boolean }) {
  return <div className="grid min-h-[420px] place-items-center rounded-[18px] border border-dashed border-[#cfd8e5] bg-white/75 px-6 text-center"><div><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[18px] bg-[#eaf2ff] text-[#1768e5]"><DocumentIcon /></div><strong className="text-[18px] text-[#263142]">아직 작성한 이력서가 없습니다.</strong><p className="mb-6 mt-2 text-[13px] text-[#7b8797]">첫 이력서를 만들고 내용을 작성해 보세요.</p><button type="button" className={primaryButtonClass} disabled={creating} onClick={() => void onCreate()}>{creating ? "만드는 중…" : "첫 이력서 만들기"}</button></div></div>;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] border border-[#f0caca] bg-[#fff7f7] px-4 py-3 text-xs text-[#a33f3f]" role="alert"><span>{message}</span><button type="button" className="cursor-pointer border-0 bg-transparent font-semibold text-[#b33434]" onClick={onRetry}>다시 시도</button></div>;
}

function CardAction({ label, children, disabled, danger, onClick }: { label: string; children: React.ReactNode; disabled: boolean; danger?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[#e1e6ed] bg-white shadow-sm hover:bg-[#f5f7fa] focus-visible:outline-2 focus-visible:outline-[#3178ff] disabled:cursor-default disabled:opacity-50 ${danger ? "text-[#bd4a4a]" : "text-[#687586]"}`} onClick={onClick}>{children}</button>;
}

function BusyOverlay({ label }: { label: string }) {
  return <div className="absolute inset-0 grid place-items-center rounded-[inherit] bg-white/75 text-xs font-semibold text-[#526174]" aria-live="polite">{label}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-100 grid place-items-center bg-[#111827]/35 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="w-full max-w-[420px] rounded-[14px] border border-white/70 bg-white p-5 shadow-[0_20px_60px_rgba(17,24,39,0.24)]" role="dialog" aria-modal="true" aria-labelledby="library-modal-title"><h2 id="library-modal-title" className="mb-5 mt-0 text-[17px] tracking-[-0.015em] text-[#202a38]">{title}</h2>{children}</section></div>;
}

function ModalActions({ confirmLabel, disabled, danger, onCancel, onConfirm }: { confirmLabel: string; disabled: boolean; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="mt-6 flex justify-end gap-2"><button type="button" className={secondaryButtonClass} disabled={disabled} onClick={onCancel}>취소</button><button type="button" className={danger ? dangerButtonClass : primaryButtonClass} disabled={disabled} onClick={onConfirm}>{confirmLabel}</button></div>;
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

const primaryButtonClass = "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent bg-[#1768e5] px-3.5 text-xs font-semibold text-white shadow-[0_3px_10px_rgba(23,104,229,0.18)] hover:bg-[#0d5dce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff] disabled:cursor-progress disabled:opacity-60 [-webkit-app-region:no-drag]";
const secondaryButtonClass = "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#dce2ea] bg-white px-3 text-xs font-semibold text-[#536174] hover:bg-[#f5f7fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3178ff] disabled:cursor-progress disabled:opacity-60 [-webkit-app-region:no-drag]";
const dangerButtonClass = "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-[#c84d4d] px-3.5 text-xs font-semibold text-white hover:bg-[#b53f3f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c84d4d] disabled:cursor-progress disabled:opacity-60";
const outlineDangerButtonClass = "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-[#e9caca] bg-white px-3 text-xs font-semibold text-[#b74848] hover:bg-[#fff5f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c84d4d] disabled:cursor-progress disabled:opacity-60";

function DocumentIcon() { return <svg className="h-5 w-5 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5M9.5 13h5M9.5 17h5" /></svg>; }
function TrashIcon() { return <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" /></svg>; }
function EditIcon() { return <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.8 6.7l3.5 3.5" /></svg>; }
function BackIcon() { return <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>; }
