# Markdown 편집 DOM 단일 소유권 세션 인수인계

## 현재 상태

- 상태: 제품 Preview 통합·기존 DOM 보정 제거·자동 검증 완료
- 현재 단계: 6. 기존 DOM 보정 제거와 전체 검증 완료
- 브랜치: `feat/10-markdown-editor-ownership` (`main@7c65d15`에서 분기)
- 작업 시작 HEAD: `7c65d15 docs: add Formleaf project README`
- 관련 구현 커밋: `8bc3644 feat: establish markdown editor ownership foundation`
- 변경 범위: 시작 시 있던 Preview 선택 경계 문서 3개의 변경을 보존하고 제품 통합 변경을 추가했다. 2026-10-31 사용자 요청으로 전체 변경을 커밋하고 `main` 대상 PR을 제출한다.

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

## 추가로 확인된 Preview 선택 경계 (통합 전 조사 기록)

- 2026-10-18 실제 화면 기록에서 Markdown 전체가 아니라 입력 중인 한 문단에만 파란 outline이 표시되고, 줄바꿈에 따라 그 문단의 outline 높이만 증가하는 동작을 확인했다.
- 현재 `activateDirectEdit()`는 활성 상태를 `targetKey + anchorRenderId`로 정한 뒤 document selection을 비우고, `NodeRenderer`와 CSS는 해당 anchor fragment에만 편집 outline을 그린다.
- 이 동작은 내부 문단·제목·목록이 별도 문서 요소로 선택된 것처럼 보이게 한다. 새 구조에서는 document selection을 전체 `DocumentEditTarget`으로 유지하고, `anchorRenderId`는 editor host 위치에만 사용해야 한다.
- 클릭한 top-level block과 caret은 바뀔 수 있지만 문서 selection identity는 바뀌지 않아야 하며, active block에 별도의 문서 selection outline을 추가하지 않는다.

## 기반 구현의 변경 파일

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

## 기반 구현 당시 검증 결과

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

## 2026-10-24 제품 통합 결과

- `MarkdownEditorSession`은 지연 acknowledgement와 실제 외부 snapshot을 구분한다. 조합 중에는 마지막 확정 snapshot만 저장하며, target 전환·종료는 editor state를 flush한다. 클릭만 하고 종료하면 원문을 정규화해 publish하지 않는다.
- `EditableMarkdownValue`는 클릭한 top-level block 하나에만 stable `MarkdownEditorHost`를 mount한다. React는 editor 하위 DOM을 렌더하지 않는다.
- block codec과 lifecycle은 full canonical source의 해당 range만 교체한다. 앞 block이 여러 block으로 늘어난 뒤 다른 block을 클릭해도 누적 delta로 올바른 range를 찾는다. CRLF offset도 보존한다.
- compatibility gate는 full source의 block AST를 검사한다. table·image·footnote·reference·raw HTML은 읽기 전용이며 다른 block 편집 때문에 원문이 손실되지 않는다.
- `DocumentSelection.editTarget`에 full target을 유지하고, `NodeRenderer`/page outline은 target key로 범위를 표시한다. `anchorRenderId`는 mount 위치에만 사용한다. 문단·제목·인용·불릿을 클릭해도 같은 target이다.
- 입력 중 preview range와 페이지 위치를 고정한다. 화면 페이지 높이는 임시로 늘어나 footer가 본문 클릭을 가로채지 않으며 편집 종료 후 재측정한다.
- toolbar·shortcut·quick insert는 `executeMarkdownEditorCommand()`를 공유한다. input rule은 editor transaction이며 heading level 재입력·`2)`·밑줄·즉시 code fence도 지원한다. literal paste는 input/paste rule로 재생하지 않는다.
- 외부 변경은 editor state를 교체하지 않고 UI에 보류한다. 현재 값을 유지하거나 보류한 변경을 적용할 수 있다.
- 외부 pointer 선택은 session 종료와 flush 뒤 확정한다. repagination이 pointerdown과 click 사이에 DOM을 이동해도 배경 click이 그 선택을 지우지 않는다.
- main/preload 종료 handshake를 추가해 앱 종료 전에 renderer가 flush·save를 마치도록 했다. PDF와 문서 목록 이동도 먼저 종료·저장한다.
- `MarkdownContent`에서 editable/IME listener를 제거하고 `sourceSelection.ts`와 source transaction `edits.ts`를 삭제했다. parser의 preview·저장 의미 처리와 공용 command type만 남겼다.

## 이번 변경의 주요 파일

- `markdown/editor/MarkdownEditorHost.tsx`, `MarkdownEditorSession.ts`, `markdownEditorLifecycle.ts`
- `markdown/editor/markdownEditorCommands.ts`, `markdownEditorBlockCodec.ts`, `markdownEditorCompatibility.ts`
- `markdown/MarkdownContent.tsx`, `commandTypes.ts`, `parser.ts`
- `rendering/EditableMarkdownValue.tsx`, `NodeRenderer.tsx`, `PaginatedDocumentRenderer.tsx`, `document.css`
- `GenericDocumentEditorPage.tsx`, `documentSelection.ts`, `useGenericDocumentSession.ts`
- main/preload/IPC의 close guard와 save acknowledgement
- `client/test/markdown-editor-session.test.mjs`, `client/test/markdown.test.mjs`
- `client/e2e/markdown-user-flow.spec.ts`, `client/e2e/markdown-existing-document.spec.ts`

## 이번 검증 결과

| 검증 | 결과 |
|---|---|
| session/codec/command 단위 테스트 | 14개 통과 |
| read-only Markdown parser·legacy serialization | 12개 통과 |
| `npm test` | 전체 107개 통과. 삭제한 source-DOM 전용 테스트는 editor command/E2E 검증으로 대체 |
| `npm run typecheck` | 통과 |
| `npm run build` | production build 통과 |
| hidden Electron ownership spike | composition 중 parent rerender·동일 root·caret 검증 통과 |
| hidden Electron 제품 흐름 | 실제 Space·Enter·Tab/Shift+Tab·Backspace·IME·undo/redo·toolbar·quick insert·literal paste·fallback·저장·재열기·PDF·조합 중 앱 종료 저장 통과 |
| node/component/repeater selection | 클릭한 글자 위치·full target 유지·단일 editor·독립 prop·page outline 검증 통과 |
| 기존 사용자 문서 임시 복사본 | 실제 렌더된 prop 본문에서 한글 작성·저장·재열기·PDF 통과, 원본 SHA-256 불변 |
| `git diff --check` | 통과 |

2026-10-25 최종 확인: ownership spike와 제품 흐름을 각각 2회 반복해 총 4회 통과했다. 이후 제품 흐름에 조합 중 속성 변경으로 실제 DocumentData publish를 발생시키는 검증을 추가했고 재실행도 통과했다. editor root·focus·조합 텍스트를 유지하며 저장에는 완료된 텍스트만 반영하고, 조합 완료 후 caret 위치를 확인한다.

기존 문서 검증은 `FORMLEAF_EXISTING_DOCUMENT_FIXTURE`에 원본 경로를 명시해 실행한다. 테스트는 원본을 읽고 checksum만 확인하며, 독립 임시 userData에 복사한 문서만 편집한다. 원본 경로·개인정보·문서 본문·PDF는 repository에 넣지 않는다.

## 남은 확인과 경계

- 구현과 자동 회귀 검증은 완료했다. 사용자 실기기 입력기 자체의 수동 수용 확인은 별도이며 CDP composition 검증과 혼동하지 않는다.
- Tiptap Markdown은 Beta다. 지원하지 않는 문법은 계속 원문 read-only fallback으로 유지하며 extension 추가 전 의미 보존 fixture가 필요하다.
- session은 클릭한 top-level block group만 소유한다. 서로 다른 block session 사이의 text selection/history 통합은 이번 범위가 아니다.
- 2026-10-31 사용자가 전체 변경 커밋과 PR 제출을 요청했다.

## 다음 세션

현재 브랜치의 PR diff를 검토한다. 사용자 실기기 입력 보고가 있으면 이 10번 작업의 회귀로 추가한다. 문서나 editor 구조를 처음부터 다시 설계하지 않는다.
