# Markdown 편집 DOM 단일 소유권 세션 인수인계

## 현재 상태

- 상태: 1단계 완료·editor session/codec 구현 중
- 현재 단계: 2. Markdown editor session과 codec 계약
- 작업 트리: 10 작업 문서, Tiptap dependency, session·compatibility gate와 spike 테스트를 이번 커밋에 포함
- 기준 커밋: `a971b7e fix: stabilize preview markdown input`

## 완료된 작업

- 09의 Preview 선택·pagination·IME 회귀 수정 14개 파일을 `a971b7e`로 커밋했다.
- 현재 Markdown 입력 흐름이 React JSX `contentEditable`, source-range event 변환, buffered publish, DocumentData와 pagination rerender를 왕복함을 확인했다.
- 현재 dependency에는 전용 structured editor engine이 없고 remark/unified 기반 read-only Markdown parser가 존재함을 확인했다.
- 다음 구조의 원칙을 확정했다: active editor가 DOM·IME·selection을 단독 소유하고, React는 stable host와 외부 UI만 관리한다.
- Markdown canonical 저장 형식과 기존 backup·atomic save 경로를 유지하도록 범위를 정했다.
- read-only preview, editor session, persistence, selection과 pagination의 목표 경계를 문서화했다.
- 공식 ProseMirror/Tiptap 문서를 확인해 React adapter가 아닌 framework-independent Tiptap `Editor`를 imperative host에 mount하는 방향을 선택했다.
- Tiptap 3.32.0 core, ProseMirror bundle, StarterKit, Markdown과 list extension을 설치했다.
- `MarkdownEditorSession`을 추가해 초기 Markdown, structured editor state, revision snapshot, flush와 destroy 경계를 만들었다.
- 기본 Markdown/GFM fixture와 editor transaction publish 단위 테스트 2개를 추가했다.
- table·image·footnote가 extension 또는 codec 없이 손실되는 것을 spike로 확인해 read-only fallback 요구로 기록했다.
- remark AST 기반 compatibility gate를 추가해 손실 가능한 table·image·footnote·reference·raw HTML session을 생성 전에 거부한다.
- 기존 `<br>`는 hard break 의미를 보존하는 CommonMark 표기로 editor 입력 전에 정규화한다.
- test 전용 stable host에 editor를 실제 mount하고, `가` 확정 직후 `나` composition 중 parent React rerender를 강제로 발생시키는 hidden Electron spike를 통과했다.
- spike에서 editor root identity·focus·caret을 유지하고 최종 `경쟁: 가나 다` snapshot만 생성했다.
- document selection은 full `DocumentEditTarget`, editor session은 클릭한 top-level Markdown block group과 source range를 소유하도록 pagination 경계를 결정했다.
- top-level block slice를 생성하고 editor snapshot으로 full source의 해당 range만 교체하는 block codec을 추가했다.
- session 기준 full source가 달라지면 stale range를 적용하지 않고 conflict를 반환하도록 고정했다.
- 현재 Preview source editor에 기존 heading level 재입력 규칙을 추가했다. H1 첫 글자 앞 `## `는 H2, 이어서 `### `는 H3로 바뀌며 제목 내용은 유지된다.
- H1~H6와 최대 3칸 indent heading의 level 교체를 pure source transaction으로 검증하고 hidden Electron 실제 Preview에서 연속 변경을 확인했다.

## 변경 파일

- `docs/README.md`
- `docs/09-preview-markdown-authoring/handoff.md`
- `docs/10-markdown-editor-ownership/README.md`
- `docs/10-markdown-editor-ownership/plan.md`
- `docs/10-markdown-editor-ownership/design.md`
- `docs/10-markdown-editor-ownership/handoff.md`
- `client/package.json`
- `client/package-lock.json`
- `client/src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorSession.ts`
- `client/src/renderer/src/pages/document-editor/markdown/editor/markdownEditorCompatibility.ts`
- `client/src/renderer/src/pages/document-editor/markdown/editor/markdownEditorBlockCodec.ts`
- `client/src/renderer/src/pages/document-editor/markdown/editor/MarkdownEditorOwnershipSpike.tsx`
- `client/test/markdown-editor-session.test.mjs`
- `client/src/renderer/src/pages/document-editor/markdown/edits.ts`
- `client/test/markdown.test.mjs`
- `client/e2e/markdown-editor-ownership.spec.ts`
- `client/e2e/markdown-user-flow.spec.ts`
- `client/src/renderer/src/app/App.tsx`
- `client/src/main/index.ts`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `git status --short` | 09 변경 커밋 직후 clean 확인 |
| `git log -2 --oneline` | 기준 커밋 `a971b7e` 확인 |
| 현재 editor dependency 검색 | remark/unified 존재, 전용 editor engine 없음 |
| ownership 관련 코드 검색 | `MarkdownContent`, `EditableMarkdownValue`, buffer, session과 pagination 경로 확인 |
| Tiptap Markdown spike | 기본 block·inline·list·task 구조 왕복, unsupported 문법 손실 범위 확인 |
| `npm run test:markdown-editor-session` | 6개 통과: 기본 왕복·transaction revision·손실 문법 차단·`<br>` 정규화·block 교체·conflict |
| `npm run typecheck` | 통과 |
| `npm run build` | production build 통과 |
| `npm test` | 119개 전체 통과 |
| `npm audit --omit=dev --json` | 기존 direct `shadcn` 경로의 high 7건, 새 Tiptap dependency 경로 보고 없음 |
| `npx playwright test e2e/markdown-editor-ownership.spec.ts --workers=1` | hidden Electron 실제 DOM·IME·parent rerender spike 통과 |
| `npm run build && npx playwright test e2e/markdown-user-flow.spec.ts --workers=1` | 기존 heading에서 H1 → H2 → H3 연속 marker 입력 포함 전체 사용자 흐름 통과 |

## 남은 작업

- session acknowledgement와 실제 외부 snapshot을 구분하는 lifecycle 단위 테스트를 추가한다.
- test spike host를 제품 `EditableMarkdownValue`의 active block 경계로 옮긴다.

## 미결정 사항과 위험

- Tiptap Markdown extension은 Beta이며 table·image·footnote는 기본 extension 조합에서 손실된다. compatibility gate와 기능별 extension 검증 없이 기존 문서에 적용하면 안 된다.
- 동일 Markdown source가 여러 page fragment에 걸릴 때 하나의 editor view가 소유할 최소 논리 범위를 확정해야 한다.
- 지원 범위 밖 raw HTML·footnote 등 Markdown 문법을 parse/serialize할 때 원문 손실이 없어야 한다.
- 09의 보정 코드는 새 editor 경로가 모든 target에서 검증되기 전까지 fallback으로 유지해야 한다.

## 다음 세션의 첫 작업

`EditableMarkdownValue`에서 클릭한 top-level block 하나만 `MarkdownEditorHost`로 전환하고, 구현된 block codec으로 editor snapshot을 full Markdown source에 반영한다. 나머지 block과 measure/print renderer는 read-only로 유지한다.
