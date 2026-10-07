import { useState } from "react";
import type { ResumeDocument } from "../../../foundation/content/resume";
import { DocumentEditorPage } from "../pages/document-editor/DocumentEditorPage";
import {
  DocumentLibraryPage,
  DocumentTrashPage,
} from "../pages/document-library/DocumentLibraryPage";
import { useDocumentLibrary } from "../pages/document-library/useDocumentLibrary";
import { Spinner } from "@/shared/ui/spinner";
import { Toaster } from "@/shared/ui/toast";
import { TooltipProvider } from "@/shared/ui/tooltip";

type AppView =
  | { type: "library" }
  | { type: "trash" }
  | { type: "editor"; document: ResumeDocument };

export function App() {
  return (
    <TooltipProvider>
      <Toaster>
        <AppContent />
      </Toaster>
    </TooltipProvider>
  );
}

function AppContent() {
  const [view, setView] = useState<AppView>({ type: "library" });
  const library = useDocumentLibrary();

  const openDocument = async (id: string) => {
    const document = await library.open(id);
    if (document) setView({ type: "editor", document });
  };

  if (library.loading) {
    return <LoadingScreen label="이력서 목록을 불러오는 중…" />;
  }

  if (view.type === "editor") {
    return (
      <DocumentEditorPage
        key={view.document.documentId}
        initialDocument={view.document}
        onSummaryChange={library.updateSummary}
        onBack={async () => {
          await library.load(false);
          setView({ type: "library" });
        }}
      />
    );
  }

  if (view.type === "trash") {
    return (
      <DocumentTrashPage
        documents={library.deletedDocuments}
        busyId={library.busyId}
        error={library.error}
        onBack={() => setView({ type: "library" })}
        onRestore={library.restore}
        onPermanentlyDelete={library.permanentlyDelete}
        onOpenRestored={openDocument}
        onRetry={() => void library.load(false)}
      />
    );
  }

  return (
    <DocumentLibraryPage
      documents={library.documents}
      deletedCount={library.deletedDocuments.length}
      busyId={library.busyId}
      error={library.error}
      onCreate={async () => {
        const document = await library.create();
        if (document) setView({ type: "editor", document });
      }}
      onOpen={openDocument}
      onRename={library.rename}
      onDelete={library.moveToTrash}
      onOpenTrash={() => setView({ type: "trash" })}
      onRetry={() => void library.load()}
    />
  );
}

function LoadingScreen({ label }: { label: string }) {
  return <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 text-sm text-muted-foreground"><Spinner className="size-5" /><span>{label}</span></div>;
}
