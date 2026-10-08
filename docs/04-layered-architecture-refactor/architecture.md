# 구조안

## 현재까지 확정한 결정

- 저장소 루트의 애플리케이션 디렉터리 이름을 `app`에서 `client`로 변경했다.
- `client/src` 아래 실행 환경은 `main`, `preload`, `renderer`로 구분한다.
- 여러 실행 환경이 같은 소스를 import해야 할 때만 `client/src/foundation`을 사용한다.
- `renderer/index.html`과 `renderer/src`로 나뉜 현재 electron-vite 구조는 유지한다.
- `client/src/foundation`은 프로세스 공용 타입·계약·직렬화 규칙을, `renderer/src/shared`는 Renderer 페이지 사이의 재사용 코드를 관리한다.
- Renderer의 `main.tsx`와 `App.tsx`는 `renderer/src/app`에서 함께 관리한다.
- `renderer/src/app`은 Renderer 실행, 초기화, 전역 설정과 페이지 조립만 담당한다.
- Renderer 화면은 `pages`에서 페이지별로 관리하고, 둘 이상의 페이지가 사용하는 범용 UI와 helper만 `renderer/src/shared`에 둔다.
- 저장·목록·CRUD·휴지통·편집 진입점처럼 문서 종류와 무관한 이름은 `resume` 대신 `document`를 사용한다.
- 경력·학력·프로젝트·A4 이력서 출력처럼 실제 이력서 형식에 종속된 이름에는 `resume`을 유지한다.
- 구조 리팩터링이 모두 끝난 뒤 마지막 코드 변경으로 애플리케이션 UI primitive를 shadcn/ui로 교체한다.
- shadcn/ui는 앱 chrome에만 적용하며 document preview, A4/PDF와 Markdown 본문 스타일은 변경하지 않는다.
- 현재 규모에서 FSD나 기능별 `domain/application/adapter/ui` 폴더를 강제하지 않는다.
- main의 상세 내부 구조와 테스트 배치는 현재 저장소 규모에 맞춰 책임별 파일과 평평한 테스트 구조로 확정했다.

이 문서는 목표 구조와 12단계 적용 결과를 함께 기록한다.

## 최상위 소스 구조

기준 경로는 `client/src`다.

```text
client/src/
├─ main/
├─ preload/
├─ renderer/
│  ├─ index.html
│  └─ src/
└─ foundation/
```

각 디렉터리의 의미는 다음과 같다.

| 경로 | 의미 |
|---|---|
| `main` | Electron main process, 파일 시스템, 창, PDF, 저장소 |
| `preload` | renderer에 허용할 API를 `contextBridge`로 노출하는 보안 경계 |
| `renderer` | React, HTML, CSS, DOM과 사용자 입력 |
| `foundation` | 둘 이상의 실행 환경이 import하는 환경 독립 기반 소스 |

## Preload와 foundation의 차이

`preload`가 main과 renderer를 실제로 연결한다. `foundation`은 연결 계층이 아니다.

```text
실행 흐름
renderer → preload → IPC → main

소스 의존 관계
main ─────┐
preload ──┼→ foundation
renderer ─┘
```

`foundation` 파일은 하나의 런타임 메모리를 공유하지 않는다. 빌드할 때 main, preload, renderer의 각 bundle에 필요한 코드가 별도로 포함된다. 프로세스 사이에서는 직렬화된 데이터만 IPC를 통해 이동한다.

`foundation`이 main·preload·renderer와 같은 디렉터리 깊이에 있는 이유는 어느 한 실행 환경의 소유물로 만들지 않기 위해서다. 파일 시스템상의 형제 관계가 동일한 아키텍처 레이어라는 의미는 아니다.

## foundation 배치 조건

파일은 다음 조건을 모두 만족할 때만 `foundation`에 둔다.

1. main, preload, renderer 중 최소 두 곳에서 사용한다.
2. React, DOM, Electron API, Node 파일 시스템에 의존하지 않는다.
3. 특정 실행 환경의 구현 세부사항이 아니다.
4. 양쪽에서 동일해야 하는 모델, 직렬화 규칙 또는 IPC 계약이다.

테스트에서 import한다는 사실만으로는 `foundation`에 둘 이유가 되지 않는다.

## 공용 소스 사용 조사와 3단계 적용 결과

이동 전 `client/src/shared`의 production import를 조사한 결과다.

| 파일 | main | preload | renderer | 판단 |
|---|:---:|:---:|:---:|---|
| `resume.ts` | 사용 | type 사용 | 사용 | 공통 document 계약과 resume content로 분리 |
| `resumeLibrary.ts` | 사용 | type 사용 | 사용 | `documentLibrary.ts`로 변경 |
| `ipc.ts` | 사용 | 사용 | 미사용 | foundation 이동 |
| `markdownSerialization.ts` | migration에서 사용 | 미사용 | `markdown.ts`를 통해 간접 사용 | foundation 이동 |
| `markdown.ts` | 미사용 | 미사용 | 사용 | renderer 이동 후보 |
| `markdownEdits.ts` | 미사용 | 미사용 | 사용 | renderer 이동 후보 |
| `resumeMigration.ts` | repository에서 사용 | 미사용 | 미사용 | main 이동 후 `documentMigration.ts`로 변경 |

Renderer는 이동 전에 다음 `client/src/shared` 소스를 사용했다.

- `resume.ts`: `App`, 편집 패널, 미리보기, 텍스트 편집에서 현재 이력서 문서 모델과 순수 helper 사용
- `resumeLibrary.ts`: 목록 화면과 현재 `window.resumeStudio` API 타입 사용
- `markdown.ts`: Markdown 렌더링과 미리보기에서 parser 사용
- `markdownEdits.ts`: Markdown 직접 편집과 선택 툴바에서 source edit 사용

이 중 `markdown.ts`와 `markdownEdits.ts`는 renderer에서만 사용하므로 프로세스 공용 `foundation`의 배치 조건을 만족하지 않는다.

3단계에서 실제 사용 환경에 따라 다음과 같이 이동했다. 이 단계에서는 public type과 함수 이름은 바꾸지 않았다.

```text
client/src/
├─ foundation/
│  ├─ ipc.ts
│  ├─ markdownSerialization.ts
│  ├─ resume.ts
│  └─ resumeLibrary.ts
├─ main/
│  └─ resumeMigration.ts
└─ renderer/src/markdown/
   ├─ markdown.ts
   └─ markdownEdits.ts
```

최종 `document` 명칭과 세부 폴더로 바꾸는 작업은 4~6단계에 나누어 진행한다.

4단계에서는 저장 schema를 바꾸지 않고 공통 표면을 다음과 같이 변경했다.

- `resumeLibrary.ts` → `documentLibrary.ts`
- `ResumeSummary`/`DeletedResumeSummary` → `DocumentSummary`/`DeletedDocumentSummary`
- `ResumeStudioApi`/`window.resumeStudio` → `DocumentApi`/`window.documents`
- 목록·CRUD IPC key와 channel → `document:*`
- `resumeRepository.ts`/`ResumeRepository` → `documentRepository.ts`/`DocumentRepository`
- `resume.ts` → 공통 facade `document.ts`와 이력서 전용 `content/resume.ts`

`WorkspaceDocument`는 현재 `ResumeDocument`의 type alias로만 두었다. `library.json`의 `resumes` 필드, `.resume.json` 경로와 `ResumeDocument` schemaVersion 2는 그대로이므로 이 단계는 저장 migration을 만들지 않는다.

## foundation 적용 결과

```text
client/src/foundation/
├─ document.ts
├─ documentLibrary.ts
├─ ipc.ts
├─ markdownSerialization.ts
└─ content/
   └─ resume.ts
```

- `document.ts`: 문서 ID, 종류, 공통 metadata와 직렬화 가능한 문서 경계를 정의한다.
- `documentLibrary.ts`: main, preload, renderer가 목록 DTO와 `DocumentApi` 계약을 공유한다.
- `ipc.ts`: main과 preload의 채널 이름이 서로 달라지는 것을 방지한다.
- `markdownSerialization.ts`: main migration과 Markdown 변환 경계에서 같은 직렬화 규칙을 사용한다.
- `content/resume.ts`: 프로필, 경력, 학력, 프로젝트처럼 이력서에만 존재하는 content schema와 helper를 정의한다.

이번 작업은 사용자 style 값 저장을 구현하지 않으므로 `foundation/documentStyle.ts`는 만들지 않았다. 현재 built-in preset의 schema·registry·CSS 변환은 renderer의 `pages/document-editor/style`에 둔다. 다음 style 설정 기능에서 값이 저장 schema와 main validation에도 필요해지는 시점에만 공통 계약을 foundation으로 올린다.

## Renderer 이동 결과

```text
client/src/renderer/src/pages/document-editor/markdown/
├─ parser.ts
└─ edits.ts
```

기존 `markdown.ts`와 `markdownEdits.ts`는 production 코드에서 renderer만 사용하므로 각각 `parser.ts`와 `edits.ts`로 이름을 구체화해 문서 편집 페이지 내부로 이동했다.

## Main 이동 결과

```text
client/src/main/document/
└─ documentMigration.ts
```

기존 `resumeMigration.ts`는 저장된 구버전 문서를 읽을 때 repository만 사용하므로 main으로 이동하고 `documentMigration.ts`로 변경했다. 저장된 문서의 공통 버전 migration을 담당하며, 이력서 content 자체의 변환이 필요하면 내부에서 이력서 전용 migration을 별도 함수로 호출한다.

## Main 내부 분리 기준

Main은 반복 레이어 폴더를 만들지 않고 책임이 드러나는 파일로 분리한다.

```text
client/src/main/
├─ index.ts
├─ registerDocumentHandlers.ts
├─ registerPdfHandlers.ts
└─ document/
   ├─ documentRepository.ts
   ├─ documentMigration.ts
   ├─ documentPaths.ts
   └─ atomicJsonStore.ts
```

- handler 파일은 IPC 입력을 application 함수로 전달한다.
- repository는 CRUD 흐름과 transaction 순서를 조합한다.
- main과 renderer가 함께 쓰는 index 정렬·정규화 규칙은 `foundation/documentLibrary.ts`에 두고, 파일 목록과 index를 대조하는 I/O 흐름은 repository가 조합한다.
- 경로 계산과 atomic JSON I/O는 각각 독립 파일로 둔다.
- migration은 기존 파일을 새 계약으로 읽는 변환만 담당한다.

5단계에서 위 구조를 적용했다. `atomicJsonStore.ts`와 `documentPaths.ts`는 각각 직접 단위 테스트하며, 기존 repository 통합 테스트로 CRUD 순서와 백업·복원 동작을 함께 검증한다.

## Renderer 내부 구조

Renderer는 페이지를 기준으로 나눈다. `app`은 페이지가 아니며 Renderer 프로세스를 시작하고 최상위 화면을 조립하는 경계다.

```text
client/src/renderer/
├─ index.html
└─ src/
   ├─ app/
   │  ├─ main.tsx                  # React DOM 진입점
   │  ├─ App.tsx                   # 전역 상태와 페이지 조립
   │  └─ global.css                # Tailwind 진입점과 최소 전역 기반 스타일
   │
   ├─ pages/
   │  ├─ document-library/
   │  │  ├─ DocumentLibraryPage.tsx
   │  │  └─ useDocumentLibrary.ts
   │  │
   │  └─ document-editor/
   │     ├─ DocumentEditorPage.tsx # 문서 종류에 맞는 편집기 선택
   │     ├─ useDocumentSession.ts
   │     ├─ MarkdownPrototype.tsx  # URL hash 기반 수동 검증 fixture
   │     ├─ markdown/
   │     │  ├─ MarkdownContent.tsx
   │     │  ├─ MarkdownSelectionToolbar.tsx
   │     │  ├─ parser.ts
   │     │  ├─ edits.ts
   │     │  └─ sourceSelection.ts # DOM Selection↔Markdown offset adapter
   │     ├─ style/
   │     │  ├─ schema.ts           # style token과 runtime 계약
   │     │  ├─ presets.ts          # 제공하는 스타일 preset
   │     │  ├─ registry.ts          # ID 조회와 fallback
   │     │  └─ toCssVariables.ts    # 스타일 값에서 CSS 변수 생성
   │     └─ resume/
   │        ├─ components/
   │        │  ├─ EditorPanel.tsx
   │        │  ├─ EditorPrimitives.tsx
   │        │  └─ RichTextEditor.tsx
   │        └─ preview/
   │           ├─ ResumePreview.tsx
   │           ├─ pagination.ts    # 높이 입력 기반 순수 페이지 계산
   │           └─ resumeDocument.css # 이력서 구조·인쇄·편집 상태 규칙
   │
   ├─ shared/
   │  ├─ ui/                       # shadcn CLI가 추가한 UI primitive
   │  ├─ components/               # 둘 이상의 페이지가 사용하는 조합 UI
   │  ├─ hooks/                    # 둘 이상의 페이지가 사용하는 React hook
   │  └─ lib/                      # Renderer 공용 순수 함수와 기술 helper
   │     └─ utils.ts               # shadcn cn helper
   └─ env.d.ts
```

`app`에는 다음 책임만 둔다.

- React root 생성과 전역 CSS 로드
- 앱 시작 시 필요한 초기화
- 목록, 휴지통, 편집 페이지 사이의 최상위 화면 전환
- 추후 필요해질 전역 provider, router, error boundary 조립

이력서 CRUD, 자동 저장, Markdown 편집처럼 특정 페이지에 속한 규칙은 `app`에 두지 않는다. 현재 `App.tsx`가 가진 이러한 책임은 해당 페이지와 페이지 전용 hook으로 이동시킨다.

`renderer/src/shared/ui`에는 shadcn CLI가 추가한 Button, Dialog, Empty 같은 UI primitive를 둔다. `renderer/src/shared/components`에는 둘 이상의 페이지가 실제로 공유하는 조합 UI만 둔다. 한 페이지에서만 쓰는 컴포넌트는 해당 페이지의 `components`에 둔다. shadcn의 기본 `components/ui` 관례를 그대로 중첩하지 않고 `components.json`의 `ui` alias를 `@/shared/ui`로 지정한다.

`shared/ui`, `shared/components`, `shared/hooks`, `shared/lib`는 목표 분류를 나타내며 빈 디렉터리를 미리 만들지는 않는다. 실제 공유 대상이 생길 때 해당 디렉터리를 만든다.

shadcn 적용 범위, 필요한 컴포넌트, document 스타일 보호 규칙과 마지막 적용 순서는 [shadcn/ui 적용 계획](shadcn-ui.md)을 따른다.

`methods`와 `functions`는 별도 폴더로 나누지 않는다. 둘은 구현 문법에 따른 구분이라 파일의 책임을 설명하지 못하고, JavaScript에서 method는 보통 객체나 class에 소속되므로 독립 모듈 분류로도 적합하지 않다. React hook은 `hooks`, 그 외 환경 독립 함수와 Renderer 기술 helper는 `lib`에서 책임이 드러나는 파일명으로 관리한다.

Tailwind를 사용해도 CSS 진입 파일은 필요하다. 현재 `app.css`가 Tailwind layer를 import하고 `html`, `body`, `#root` 크기와 기본 동작을 정의하므로 이를 `app/global.css`로 이동한다. 별도의 최상위 `styles` 폴더는 만들지 않는다.

현재 `resume.css`는 일반 애플리케이션 UI 스타일이 아니다. A4의 `mm`·`pt` 단위, `@page`와 `@media print`, 페이지 분할, 동적으로 생성되는 Markdown DOM의 자식 선택자, `contentEditable` 상태를 담당한다. 이런 규칙을 JSX의 Tailwind class로 옮기면 출력 규칙이 여러 컴포넌트에 흩어지고 동적 Markdown DOM을 표현하기 어려워진다. 따라서 이 파일은 유지하되 `preview/resumeDocument.css`로 이름과 위치를 바꿔 문서 출력 엔진의 일부임을 명확히 한다. 버튼·패널·목록 같은 일반 UI는 계속 Tailwind로 작성한다.

향후 사용자가 변경할 스타일 값은 CSS 파일에 고정하지 않는다. 색상, 글꼴, 글자 크기, 굵기, 줄 높이, 간격과 같이 저장할 값은 직렬화 가능한 공통 데이터 계약으로 정의하고 renderer의 `style/toCssVariables.ts`에서 CSS 변수로 변환한다. `resumeDocument.css`는 그 변수를 소비하면서 이력서 구조와 인쇄 동작만 제공한다. 저장과 migration을 담당하는 main도 validation해야 하는 기능이 추가되면 그 계약을 foundation에 둔다.

```text
사용자 스타일 설정
→ validation/default 적용
→ toCssVariables
→ ResumePreview와 측정용 DOM에 동일한 CSS 변수 적용
→ 다시 페이지 측정 및 렌더링
```

현재 구현은 `style/{schema,presets,registry,toCssVariables}.ts`가 Markdown 색상·크기·간격을 CSS 변수로 변환하고 실제 페이지와 측정용 페이지 양쪽에 적용한다. 다만 페이지 padding, grid 폭, 일부 색상과 간격은 아직 고정값이므로 실제 사용자 편집 범위가 정해지면 해당 값도 schema와 CSS 변수로 이동해야 한다. 사용자가 임의 CSS 문자열을 직접 저장하거나 삽입하게 하지는 않는다.

`MarkdownPrototype.tsx`를 위해 별도 `dev` 폴더를 만들지 않는다. 이 파일은 일반 navigation에 노출되지 않고 URL hash로만 진입하는 수동 검증 fixture이므로 `document-editor` 바로 아래에 유지한다. 자동 테스트가 같은 범위를 충분히 대체하게 되면 별도 작업에서 제거할 수 있다.

이 구조는 FSD 전체를 도입한 것이 아니다. `app`, `pages`, `shared`라는 경계를 선택적으로 사용하되 `features`, `entities` 같은 추가 레이어는 현재 규모에서 만들지 않는다.

6단계에서 Renderer 파일을 이 구조로 이동했다. `app`만 페이지를 조립하며, `pages`는 `app`을 import하지 않고 `shared`는 `app`과 `pages`를 import하지 않는 방향을 typecheck와 정적 검색으로 확인했다. 상태와 대형 컴포넌트의 함수 분리는 7~8단계에서 별도로 진행한다.

## document와 resume 이름 경계

`document`는 앱이 저장하고 관리하는 최상위 단위다. 목록, 생성, 로드, 저장, 이름 변경, 휴지통, 복원, 완전 삭제는 문서 종류와 무관하므로 `Document` 이름을 사용한다.

브라우저 전역 타입인 `Document`와 충돌하지 않도록 TypeScript의 최상위 문서 타입은 `WorkspaceDocument`로 명명한다. 파일과 기능 이름에는 `document`를 그대로 사용한다.

```ts
type DocumentKind = "resume" | "note";

type WorkspaceDocument = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  content: DocumentContent;
};

type DocumentContent =
  | { kind: "resume"; value: ResumeContent }
  | { kind: "note"; value: NoteContent };
```

이번 리팩터링은 저장 schema 변경이 비목표이므로 `kind`와 `NoteContent`를 즉시 추가하지 않는다. 대신 공통 CRUD와 파일 이름을 `document` 기준으로 먼저 정리하고, 현재 데이터는 `resume` content 한 종류로 취급할 수 있는 경계를 만든다. 실제 다중 문서 종류를 추가할 때 schema version과 migration을 별도 기능 작업으로 진행한다.

이름 변경 기준은 다음과 같다.

| 현재 이름 | 목표 이름 | 이유 |
|---|---|---|
| `resumeRepository` | `documentRepository` | 모든 문서 종류의 영속성 담당 |
| `resumeLibrary.ts` | `documentLibrary.ts` | 공통 목록·CRUD 계약 |
| `ResumeStudioApi` | `DocumentApi` | preload가 노출하는 공통 문서 API |
| `window.resumeStudio` | `window.documents` | 특정 문서 종류에 종속되지 않는 API 진입점 |
| `ResumeSummary` | `DocumentSummary` | 문서 종류와 무관한 목록 metadata |
| `ResumeLibraryPage` | `DocumentLibraryPage` | 모든 문서의 시작 화면 |
| `ResumeTrashPage` | `DocumentTrashPage` | 모든 문서의 휴지통 |
| `ResumeEditorPage` | `DocumentEditorPage` | 문서 종류에 맞는 편집기 선택 |
| `ResumeDocument` | `WorkspaceDocument` 경계와 `ResumeContent`로 분리 | 공통 envelope와 이력서 content 구분 |

`ResumeEditor`, `ResumePreview`, `ResumeContent`, `resumeDocument.css`처럼 이력서의 필드나 A4 출력 형식에 직접 의존하는 이름은 유지한다. 이후 노트 기능은 `NoteEditor`, `NotePreview`, `NoteContent`로 나란히 추가한다.

## 현재 합의를 반영한 목표 구조

합의한 실행 환경 경계와 Renderer의 페이지 중심 구조를 함께 표시한다.

```text
client/
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ registerDocumentHandlers.ts
│  │  ├─ registerPdfHandlers.ts
│  │  └─ document/
│  │     ├─ documentRepository.ts
│  │     ├─ documentMigration.ts
│  │     ├─ documentPaths.ts
│  │     └─ atomicJsonStore.ts
│  │
│  ├─ preload/
│  │  └─ index.ts
│  │
│  ├─ renderer/
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ main.tsx
│  │     │  ├─ App.tsx
│  │     │  └─ global.css
│  │     ├─ pages/
│  │     │  ├─ document-library/
│  │     │  │  ├─ DocumentLibraryPage.tsx
│  │     │  │  └─ useDocumentLibrary.ts
│  │     │  └─ document-editor/
│  │     │     ├─ DocumentEditorPage.tsx
│  │     │     ├─ useDocumentSession.ts
│  │     │     ├─ markdown/
│  │     │     ├─ resume/
│  │     │     │  ├─ components/
│  │     │     │  └─ preview/
│  │     │     └─ style/
│  │     ├─ shared/
│  │     │  ├─ ui/                 # shadcn CLI source
│  │     │  └─ lib/
│  │     │     ├─ text.ts
│  │     │     └─ utils.ts
│  │     └─ env.d.ts
│  │
│  └─ foundation/
│     ├─ document.ts
│     ├─ documentLibrary.ts
│     ├─ ipc.ts
│     ├─ markdownSerialization.ts
│     └─ content/
│        └─ resume.ts
│
├─ test/
├─ components.json
├─ package.json
└─ electron.vite.config.ts
```

## 의존 규칙

1. main과 renderer는 서로의 구현 파일을 import하지 않는다.
2. preload는 IPC 전달과 안전한 API 노출만 담당하며 제품 규칙을 소유하지 않는다.
3. renderer는 Node 파일 시스템과 Electron main API를 직접 사용하지 않는다.
4. `client/src/foundation`은 어느 실행 환경에서도 import 가능한 코드만 포함한다.
5. renderer 전용 parser·DOM·편집 로직은 renderer 안에 둔다.
6. 파일 저장·migration·운영체제 기능은 main 안에 둔다.
7. 순수 계산은 React 컴포넌트 내부에 숨기지 않고 직접 테스트할 수 있는 파일로 분리한다.
8. `renderer/src/app`은 `pages`를 조립할 수 있지만, `pages`는 `app`을 import하지 않는다.
9. 페이지 전용 코드는 해당 `pages/<page>` 안에 두며, 실제로 여러 페이지가 사용하는 코드만 `renderer/src/shared`로 올린다.
10. `renderer/src/shared`는 `app`과 `pages`를 import하지 않는다.
11. shadcn UI token과 primitive는 document 출력용 CSS 변수와 selector를 변경하지 않는다.

## 테스트 배치

테스트는 `client/test` 아래에서 성격별로 관리하고 대상 소스 경로가 드러나게 배치한다.

```text
client/test/
├─ document-library.test.mjs
├─ document-migration.test.mjs
├─ document-storage.test.mjs
├─ markdown.test.mjs
├─ pagination.test.mjs
└─ resume-style-sheets.test.mjs
```

- 현재 6개 테스트 파일은 작은 저장소 규모에 맞춰 `client/test` 바로 아래에서 대상 모듈 이름과 일대일로 대응한다.
- 순수 함수는 해당 모듈 테스트 파일에서 입력·출력을 검증한다.
- 파일 시스템, backup, migration과 repository 테스트는 같은 파일 안에서 임시 디렉터리를 사용한다.
- Selection, composition과 contentEditable의 실제 DOM 회귀는 격리한 Electron 검증으로 보완한다.
- 테스트 수가 늘어 탐색 비용이 생길 때만 `unit`, `integration/main`, `renderer/dom` 하위 폴더를 추가한다.
- 실제 사용자 문서 파일은 fixture로 사용하지 않는다.

## 구현 중 세부 원칙

- 7단계에서 `App.tsx`는 최상위 화면 전환만 남기고, 목록·휴지통 CRUD는 `useDocumentLibrary`, 자동 저장과 목록 복귀 전 flush는 `useDocumentSession`, 편집 화면 조합은 `DocumentEditorPage`로 분리했다.
- 8단계에서 Markdown source 순수 편집과 DOM Selection adapter, pagination 계산, style schema·preset·registry·CSS 변수 변환을 각각 분리했다.
- 9단계에서 자동 테스트 33개와 production build뿐 아니라 임시 Electron 저장소의 자동 저장, 다중 문서 독립성, 최근 수정 순 정렬, 휴지통·복원·완전 삭제, preview 페이지·overflow와 실제 PDF 생성까지 회귀 검증했다.
- 10단계에서 renderer alias와 shadcn semantic token을 설정하고, CLI로 생성한 primitive를 `shared/ui`에 배치했다. 초기 `base-nova`에서 후속 사용자 선택인 `base-vega`·Lime theme으로 교체했으며, Electron Vite의 framework 자동 판별 제약 때문에 설정은 공식 manual installation 절차를 따랐다.
- 11단계에서 library·trash·editor 앱 chrome을 `shared/ui` 조합으로 교체했다. 페이지는 제품 상태와 화면 조합을 계속 소유하고, focus trap·overlay·menu·tooltip·toast 같은 primitive 동작은 Base UI 기반 shadcn 소스가 담당한다.
- 12단계에서 신규 임시 저장소의 전체 CRUD, 자동 저장, 최근 수정 순, 재실행 영속성, Markdown 직접 편집, preview 기준값과 실제 PDF 출력을 최종 검증했다.
- `resumeDocument.css`는 출력 구조·Markdown 동적 DOM·인쇄 규칙을 계속 담당하고, 사용자가 변경할 값은 `toCssVariables.ts`가 생성하는 CSS 변수로 주입한다.
- 구조 이동 중 임시 re-export는 한 단계 안에서만 허용하며 해당 단계 커밋 전에 제거한다.
