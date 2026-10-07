# 구조 설계 인수인계

## 현재 상태

- 기준 커밋: `8633580 feat: add multi-resume library`
- 12단계 실행 계획을 승인했고 1~9단계를 완료했다.
- 루트 애플리케이션 디렉터리는 `app`에서 `client`로 이동했다.
- 루트 애플리케이션 디렉터리의 목표 이름은 `client`다.
- `client/src/main`, `preload`, `renderer`, `foundation` 경계를 사용한다.
- electron-vite의 `renderer/index.html`과 `renderer/src` 구조는 유지한다.
- Renderer 내부는 `app`, `pages`, `shared`로 나누며 `main.tsx`와 `App.tsx`는 `renderer/src/app`에서 관리한다.
- 저장·목록·CRUD·휴지통·편집 진입점은 `document`, 이력서 content·미리보기·출력은 `resume`로 명명한다.
- 모든 구조 이동과 회귀 검증이 끝난 뒤 마지막 코드 변경으로 앱 UI를 shadcn/ui 공식 스타일로 교체한다.
- shadcn/ui는 Renderer 앱 chrome에만 적용하고 document preview·A4/PDF·Markdown 본문 스타일은 변경하지 않는다.
- FSD나 반복적인 `domain/application/adapter/ui` 폴더는 현재 구조안에서 제외했다.
- 각 단계는 검증 후 별도 커밋으로 완료한다.

## 공용 소스 적용 결과

- `resume.ts`를 공통 facade `document.ts`와 이력서 전용 `content/resume.ts`로 분리했다.
- `resumeLibrary.ts`를 `documentLibrary.ts`로 변경했다.
- `DocumentApi`, `window.documents`, `DocumentSummary`, `DocumentRepository`로 공통 CRUD 명칭을 변경했다.
- 저장 호환성을 위해 `library.json` 내부 필드와 `.resume.json` 경로는 변경하지 않았다.
- renderer 전용 `markdown.ts`, `markdownEdits.ts`를 `renderer/src/markdown`으로 이동했다.
- main 전용 migration을 `main/document/documentMigration.ts`로 이동하고 저장 문서 판별과 v1 이력서 변환을 한 경계로 모았다.
- main은 `registerDocumentHandlers.ts`, `registerPdfHandlers.ts`와 `document/{documentRepository,documentMigration,documentPaths,atomicJsonStore}.ts`로 분리했다.
- 저장 경로와 JSON backup 규칙은 별도 모듈로 이동했으며 기존 `workspaces/resumes`, `trash`, `.resume.json`, `.backup`, `.v1.backup` 규칙을 유지한다.
- Renderer를 `app`, `pages/document-library`, `pages/document-editor`, `shared/lib`로 이동하고 `main.tsx`, `App.tsx`, `global.css`를 `app`에 모았다.
- `resumeDocument.css`는 앱 UI가 아니라 preview/인쇄 엔진의 일부로 `pages/document-editor/preview`에 유지했다.
- `App.tsx`는 화면 전환만 남기고, `useDocumentLibrary`가 목록·휴지통 CRUD를, `useDocumentSession`이 자동 저장과 저장 flush를, `DocumentEditorPage`가 편집 화면을 소유하도록 분리했다.
- Markdown은 `parser.ts`, 순수 source `edits.ts`, DOM Selection `sourceSelection.ts`로 분리했다.
- preview pagination을 `resume/preview/pagination.ts`로 분리하고 keep-with-next·강제 새 페이지·overflow·임시 페이지 유지 테스트를 추가했다.
- style은 `schema.ts`, `presets.ts`, `registry.ts`, `toCssVariables.ts`로 분리해 이후 사용자 style 입력이 preset registry와 CSS 변환에 섞이지 않도록 했다.
- `foundation`은 연결 계층이 아니다. 실제 renderer→main 연결은 preload와 IPC가 담당한다.
- `foundation`에는 둘 이상의 실행 환경이 사용하는 환경 독립 기반 코드만 둔다.

## 반드시 유지할 동작

- 현재 `ResumeDocument` schemaVersion 2와 기존 저장 경로
- 기존 Markdown source offset과 preview 직접 편집
- styleSheetId와 built-in preset ID
- 다중 이력서 CRUD, 최근 수정 순, 휴지통, 복원, 완전 삭제
- 자동 저장과 목록 복귀 시 저장 보장
- renderer가 파일 시스템에 직접 접근하지 않는 경계
- shadcn 적용 전후 document preview 페이지 수·overflow·typography와 PDF 결과

이번 구조 리팩터링에서는 현재 저장 schema를 바꾸지 않는다. `WorkspaceDocument`는 현재 `ResumeDocument`의 경계 alias이며, `DocumentKind`, `NoteContent`를 실제 데이터에 도입하는 작업은 이후 별도 migration이 포함된 기능 작업으로 진행한다.

shadcn/ui component inventory, `components.json`, alias, 적용 제외 대상과 검증 기준은 [shadcn/ui 적용 계획](shadcn-ui.md)에 기록했다. 구조 이동 중 일부 화면에 shadcn을 먼저 섞지 않는다.

## 9단계 회귀 검증 결과

- 자동 테스트 33개와 production build가 통과했다.
- 별도 임시 `user-data-dir`에서 Electron을 실행해 실제 사용자 저장소와 검증 데이터를 분리했다.
- 편집 화면에서 제목을 바꾼 뒤 자동 저장 완료 표시와 목록 복귀 후 저장된 제목을 확인했다.
- 서로 다른 두 문서에 제목·프로필·Markdown 본문을 저장해 데이터가 독립적으로 유지되는 것을 확인했다.
- 두 문서를 차례로 저장해 목록이 `updatedAt` 최신 순서로 바뀌는 것을 확인했다.
- 선택한 문서만 휴지통으로 이동하고, 복원 후 활성 목록으로 돌아오며, 완전 삭제 후 활성 목록과 휴지통 모두에서 제거되는 것을 확인했다.
- 휴지통·복원·완전 삭제 전 과정 후에도 나머지 문서의 제목과 Markdown 본문은 그대로 유지됐다.
- 저장된 문서를 다시 열었을 때 preview가 2페이지, overflow 0개로 렌더링되고 분리한 style preset의 글꼴과 배경이 적용되는 것을 확인했다.
- 앱의 실제 PDF IPC와 Electron `webContents.printToPDF` 경로로 39KB PDF 1페이지를 생성해 유효한 PDF 1.4 파일임을 확인했다.

## 다음 작업

10단계에서 공식 shadcn/ui 설정과 alias를 추가하고, 앱 chrome 교체에 필요한 primitive를 `renderer/src/shared/ui`에 준비한다. 이 단계에서는 아직 기존 화면을 교체하지 않는다.

승인 후에도 main과 renderer의 큰 파일을 동시에 분리하지 않는다. 각 단계에서 기존 동작을 테스트하고 production build를 확인한 뒤 다음 단계로 이동한다.

1단계 기준선은 자동 테스트 27개와 production build 통과다. 8단계는 storage·pagination·source map 테스트를 추가한 총 33개 테스트와 production build를 통과했다. 7단계는 임시 사용자 데이터 경로의 실제 Electron에서 빈 목록 화면과 `window.documents` 11개 API 노출도 확인했고, 9단계는 같은 격리 방식으로 전체 CRUD·자동 저장·정렬·휴지통·preview·PDF 회귀를 확인했다.
