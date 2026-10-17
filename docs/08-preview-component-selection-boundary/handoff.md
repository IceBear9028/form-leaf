# Preview와 Component 선택 경계 분리 세션 인수인계

## 현재 상태

- 상태: 완료 — 2026-10-18
- 현재 단계: 9. Preview 단일 활성 요소와 공통 편집 표시 완료
- 관련 커밋: `ccb5b25 fix: unify preview element selection`
- 마지막 커밋: `3febb4f feat: migrate legacy documents to canonical schema`
- 실행 상태: interaction debug를 켠 production build가 CDP port `9333`에서 실행 중

## 확정한 제품 규칙

- 내용 preview에는 활성 요소가 정확히 하나만 존재한다.
- 비편집 영역은 document node 또는 repeater item의 데이터 소유 단위를 선택한다.
- Text, rich text와 Markdown은 타입별 선택 시스템을 만들지 않고 같은 직접 편집 선택 표시를 사용한다.
- 직접 편집 요소를 클릭하면 기존 구조 selection을 해제한다.
- 구조 요소를 클릭하면 기존 직접 편집 활성 상태와 caret·범위 선택을 종료한다.
- component definition 내부 구조 선택은 component 편집 화면의 structure mode에서만 제공한다.

## 구현 결과

- renderer에 `content`와 `structure` 선택 mode를 추가했다.
- content mode의 component 내부 비편집 클릭은 외부 component instance 또는 repeater item으로 접는다.
- structure mode는 내부 `component-node` 선택과 레이어 연결을 유지한다.
- 내용 화면 레이어에서 component definition 내부 tree를 숨겼다.
- direct edit DOM 내부 click은 `preserve-direct-edit`로 처리해 외부 owner selection을 요청하지 않는다.
- preview가 `activeEditRenderId` 하나를 소유한다. Text, rich text와 Markdown click은 edit target과 개별 pagination fragment의 `renderId`를 함께 전달한다.
- 활성 fragment 하나에만 `data-document-edit-active="true"`를 부여하고 공통 outline을 그린다.
- 직접 편집 활성화는 click 단계에서 처리한다. focus 단계에서 구조 selection을 먼저 지우면 React 재렌더로 원래 click target이 외부 owner에 재지정되는 문제가 있어 이 순서를 사용한다.
- Markdown 전용 portal focus ring, source별 ring 상태, 4px 좌표 기반 active boundary를 제거했다.
- interaction debug에 content/component scope, selection mode, `preserve-direct-edit`, `select-owner`, `select-structure`, `activate-single-edit-target`을 기록한다.
- 저장 schema와 direct edit transaction은 변경하지 않았다.

## 실제 기존 데이터 검증

2026-10-18 실제 기존 사용자 문서를 production build와 신뢰된 CDP 마우스 입력으로 열어 다음 순서를 확인했다. 문서 내용은 변경하지 않았다.

| 전환 | 활성 edit | 구조 selection | 계산된 outline | 핵심 이벤트 |
|---|---:|---:|---:|---|
| repeater item 여백 | 0 | item 1 | item 1 | `select-owner` |
| item → Text | Text 1 | 0 | Text 1 | `preserve-direct-edit` → `replace-structure-selection-with-edit-target` → `activate-single-edit-target` |
| Text → Markdown | Markdown 1 | 0 | Markdown 1 | `activate-single-edit-target`, `preserve-direct-edit` |
| 선택된 Markdown의 불릿 `LI` | Markdown 1 | 0 | Markdown 1 | `activate-single-edit-target`, `preserve-direct-edit`; `select-owner` 없음 |
| Markdown → rich text | rich text 1 | 0 | rich text 1 | `preserve-direct-edit`, `activate-single-edit-target` |
| rich text → repeater item 여백 | 0 | item 1 | item 1 | `select-owner` |

pagination에 렌더된 Markdown element 113개의 `renderId`가 모두 고유함도 실제 DOM에서 확인했다. 따라서 하나의 source가 여러 fragment로 나뉘어도 active render ID는 정확히 한 fragment만 표시한다.

## 주요 변경 파일

- `client/src/renderer/src/pages/document-editor/GenericDocumentEditorPage.tsx`
- `client/src/renderer/src/pages/document-editor/documentSelection.ts`
- `client/src/renderer/src/pages/document-editor/DocumentStructurePanel.tsx`
- `client/src/renderer/src/pages/document-editor/interactionDebug.ts`
- `client/src/renderer/src/pages/document-editor/rendering/NodeRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/DocumentRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/PaginatedDocumentRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/EditableTextValue.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/EditableMarkdownValue.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/document.css`
- `client/test/document-editor.test.mjs`
- `docs/06-restore-document-visual-system/references/interaction-event-debug-mode.md`
- `docs/08-preview-component-selection-boundary/`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `npm run test:editor` | 통과 |
| `npm run test:direct-edit` | 통과 |
| `npm run test:markdown` | 통과 |
| `npm test` | 전체 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | production build 통과 |
| `git diff --check` | 통과 |
| 실제 Preview 전환 시퀀스 | 활성 표시가 모든 단계에서 정확히 하나 |
| 실제 Markdown 불릿 click | 외부 selection 0건, Markdown 활성 유지 |

## 남은 작업

- 없음. 후속 Markdown 작성 편의 개선은 별도 backlog에서 기획한다.

## 제외 범위

- prop별 inspector 자동 스크롤
- component 편집 화면의 drag/layout 재설계
- pagination의 layout placeholder와 Markdown fragment selection 자체 재설계
