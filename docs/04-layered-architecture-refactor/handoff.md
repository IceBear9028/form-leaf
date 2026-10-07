# 구조 설계 인수인계

## 현재 상태

- 기준 커밋: `8633580 feat: add multi-resume library`
- 12단계 실행 계획을 승인했고 1~5단계를 완료했다.
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

## 다음 작업

6단계에서 Renderer를 `app/pages/shared` 구조로 이동한다. 이 단계는 컴포넌트 책임 분리보다 파일 소유권과 import 방향 정리에 집중한다.

승인 후에도 main과 renderer의 큰 파일을 동시에 분리하지 않는다. 각 단계에서 기존 동작을 테스트하고 production build를 확인한 뒤 다음 단계로 이동한다.

1단계 기준선은 자동 테스트 27개와 production build 통과다. 2~4단계도 같은 테스트와 production build를 통과했고, 5단계는 storage 단위 테스트 2개를 추가해 총 29개 테스트와 production build를 통과했다.
