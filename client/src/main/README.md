# Main Process

Electron 앱 생명주기, BrowserWindow, 로컬 파일 저장, 파일 선택과 PDF 내보내기를 담당한다.

`document/DocumentRepository`가 CRUD 순서, 목록 정합성, 휴지통과 복원을 조합한다. `documentPaths.ts`는 기존 저장 경로를, `atomicJsonStore.ts`는 원자적 JSON 저장과 정상 직전본 복구를 담당하며 renderer에는 실제 파일 경로를 노출하지 않는다.

저장 데이터의 v1→v2 변환은 main 전용 `documentMigration.ts`가 담당한다. 문서 CRUD IPC와 PDF·shell IPC는 각각 `registerDocumentHandlers.ts`, `registerPdfHandlers.ts`에서 등록한다.
