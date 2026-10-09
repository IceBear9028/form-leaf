# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 범용 core·renderer·구조 편집·component 재사용·preview 직접 편집 완료
- 현재 단계: 8. 저장소·library·IPC와 앱 전환
- 완료 커밋: `e6542b4` 계약·계획, `2e80fbe` 범용 core, `04ac9fc` 레거시 importer, `325fc4d` 범용 renderer, `b11bed9` 구조 편집기, `39116ba` component 재사용
- 커밋 정책: 각 계획 단계 완료 후 검증·문서 갱신과 함께 커밋

## 완료된 작업

- `schemaVersion: 3` document model, strict validator와 불변 transaction을 구현했다.
- v1/v2 입력을 범용 graph로 바꾸는 원본 비변경 legacy importer를 구현했다.
- component active prop의 override·default를 binding target에 적용하는 pure render tree resolver를 구현했다.
- component instance와 repeater item마다 이름과 무관한 stable render path를 만든다.
- screen·measure·print mode가 같은 `NodeRenderer`와 style adapter를 사용한다.
- container, text, rich-text, Markdown, image, component와 repeater를 읽기 전용 DOM으로 렌더링한다.
- raw HTML과 외부 Markdown image를 실행하지 않고 위험 URL protocol을 비활성화한다.
- root child subtree 기반 pagination unit, keep·break·overflow와 page reconcile을 구현했다.
- 하나의 node property에 여러 component prop binding을 연결하는 모호한 계약을 validator에서 거부한다.
- 범용 document selection과 local fixture session을 추가하고 node ID를 기준으로 tree와 preview 선택을 동기화했다.
- 빈 root에서 container, text, rich-text, Markdown과 image node를 추가할 수 있다.
- node 이름 변경, 같은 parent 내 drag·버튼 이동, 표시, 복제, 보관과 복원을 구현했다.
- inspector에서 container layout, image 참조, typography와 pagination을 검증된 transaction으로 편집한다.
- 직접 편집 대상인 text, rich-text와 Markdown 본문은 inspector에 중복 입력 UI를 두지 않았다.
- 독립 `GenericDocumentEditorHarness`에 structure panel, preview와 inspector를 연결했으며 앱 route는 변경하지 않았다.
- 선택 subtree를 definition으로 옮기고 같은 위치를 새 instance로 교체하는 transaction을 구현했다.
- text, rich-text, Markdown과 image binding을 prop으로 노출하고 definition 이름 draft와 prop 보관을 지원한다.
- component instance별 override와 기본값 복원 UI를 inspector에 연결했다.
- repeater item 추가, override, 복제, 이동과 표시 변경을 inspector에 연결했다.
- component dependency package export와 모든 ID를 재생성하는 독립 import를 구현했다.
- 최종 document validation으로 component 직접·간접 cycle을 transaction commit 전에 거부한다.
- node, component instance prop과 repeater item prop을 하나의 `DocumentEditTarget`으로 읽고 쓰는 transaction을 구현했다.
- renderer는 document tree node와 active prop에만 edit target을 주며 definition 내부의 비노출 값은 읽기 전용으로 유지한다.
- text와 rich-text의 `beforeinput`, paste, grapheme 삭제, 줄바꿈과 IME 조합 완료를 값 transaction에 연결했다.
- rich-text 선택 toolbar와 굵게·기울임·밑줄·취소선·링크·hex 색상·색상 제거 mark를 연결했다.
- Markdown 렌더링 DOM을 기존 source range 편집, IME, inline format과 link transaction에 연결했다.
- 직접 편집 후 target range로 selection을 복원하고 measure·print renderer에는 편집 callback을 전달하지 않는다.
- 독립 harness에서 직접 편집 snapshot undo·redo와 dirty 상태를 유지한다.

## 변경 파일

- `client/src/foundation/document.ts`
- `client/src/foundation/documentEditing.ts`
- `client/src/renderer/src/pages/document-editor/GenericDocumentEditorHarness.tsx`
- `client/src/renderer/src/pages/document-editor/RichTextSelectionToolbar.tsx`
- `client/src/renderer/src/pages/document-editor/markdown/parser.ts`
- `client/src/renderer/src/pages/document-editor/markdown/MarkdownContent.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/renderTree.ts`
- `client/src/renderer/src/pages/document-editor/rendering/EditableTextValue.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/EditableMarkdownValue.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/NodeRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/DocumentRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/document.css`
- `client/test/document-direct-edit.test.mjs`
- `client/package.json`
- `docs/README.md`
- `docs/05-document-components/README.md`
- `docs/05-document-components/design.md`
- `docs/05-document-components/plan.md`
- `docs/05-document-components/handoff.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `npm run test:direct-edit` | 통과, 4개 |
| `npm run test:markdown` | 통과, 16개 |
| `npm test` | 통과, 전체 60개 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| direct editing core·renderer 목적별 domain token 검색 | 결과 없음 |
| `git diff --check`와 새 파일 공백 검사 | 통과 |

## 현재 제한

- 새 renderer는 독립 모듈로 구현됐으며 현재 앱 route에는 아직 연결하지 않았다.
- pagination은 root child subtree를 atomic unit으로 취급한다. 긴 subtree 내부 분할은 이후 실제 측정 결과를 근거로 확장한다.
- component package는 pure export/import까지만 구현했으며 실제 library 파일과 IPC는 8단계 범위다.
- 새 editor는 독립 harness이며 현재 앱 route, repository와 autosave는 아직 기존 stack을 사용한다.
- 실제 Electron에서 장문 pagination 이동 중 caret·IME 검증은 8단계 route 전환 후 수행한다.

## 다음 작업

범용 `DocumentData` repository와 summary index를 구현하고 기존 파일은 legacy importer를 거쳐 별도 범용 파일로 저장한다. 이어서 component library item 저장·가져오기 IPC, 범용 autosave session과 `GenericDocumentEditorPage`를 연결한 뒤 앱 route를 새 stack으로 전환한다.
