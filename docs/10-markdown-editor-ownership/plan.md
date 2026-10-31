# Markdown 편집 DOM 단일 소유권 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 검증 |
|---|---|---|---|
| 1 | 현재 ownership 경계 고정과 editor engine 검증 | 완료 | Tiptap session·Markdown snapshot·실제 DOM/IME parent rerender spike 통과 |
| 2 | Markdown editor session과 codec 계약 | 완료 | acknowledgement·외부 변경 보류·원문 유지·range 교체·CRLF·command 14개 단위 테스트 |
| 3 | read-only preview와 active editor island 분리 | 완료 | 제품 host root identity·composition·caret·measure/print read-only 검증 |
| 4 | Jira형 명령을 editor transaction으로 이전 | 완료 | 목록·inline·heading level·toolbar·shortcut·quick insert·undo/redo·literal paste 검증 |
| 5 | selection·pagination·저장 lifecycle 통합 | 완료 | node·component prop·repeater prop·같은 target block 전환·앱 종료 저장 검증 |
| 6 | 기존 DOM 보정 제거와 전체 검증 | 완료 | 09 DOM 보정 제거, 107개 단위 테스트·hidden Electron·기존 문서 복사본·PDF 검증 |

상태는 `대기`, `진행 중`, `완료`, `차단` 중 하나만 사용한다. 동시에 하나의 단계만 `진행 중`으로 둔다.

## 구현 순서

### 1. 현재 ownership 경계 고정과 editor engine 검증

- `MarkdownContent`, `EditableMarkdownValue`, `useBufferedStringEdit`, document update와 pagination 사이에서 DOM·selection·source를 쓰는 모든 경로를 표로 고정한다.
- editor가 IME, selection, history와 DOM mutation을 단독 소유하고 React에는 transaction snapshot만 전달할 수 있는지 최소 spike로 검증한다.
- 현재 지원 Markdown subset, GFM task list, 기존 CSS class와 source 보존 요구를 기준으로 editor engine 후보를 비교한다.
- full source와 paginated top-level block 중 editor session이 소유할 최소 단위를 실제 render tree로 검증한다.
- spike는 사용자 문서를 읽거나 수정하지 않는 전용 fixture와 hidden Electron에서 실행한다.

Tiptap core 3.32.0을 React adapter 없이 직접 사용하는 `MarkdownEditorSession`을 추가했다. 기본 heading·paragraph·inline mark·link·code·bullet/ordered/task list·blockquote·divider는 Markdown snapshot으로 왕복하고, editor transaction만 session revision을 전진시키는 단위 테스트가 통과했다. 실제 DOM에 editor를 mount한 hidden Electron spike에서 `가` 확정 직후 `나` composition 도중 parent React rerender를 강제로 발생시켜도 editor root, focus와 caret이 유지되고 최종 `경쟁: 가나 다` snapshot만 만들어짐을 확인했다.

pagination은 같은 Markdown source를 여러 분리된 page DOM으로 렌더하므로 editor view가 전체 source DOM을 소유하지 않는다. 문서 selection identity는 `DocumentEditTarget` 전체를 유지하되, 한 editor session은 사용자가 클릭한 top-level Markdown block group과 원본 source range를 소유한다. 같은 target의 다른 block을 클릭하면 기존 block session을 flush하고 다음 block session으로 전환한다.

### 2. Markdown editor session과 codec 계약

- `DocumentEditTarget`, 최초 Markdown snapshot과 session revision으로 editor session을 생성한다.
- session 내부 `EditorState`를 입력 중 source of truth로 두고, React prop은 초기화와 명시적 외부 교체에만 사용한다.
- editor transaction을 Markdown snapshot으로 직렬화해 `DocumentData`에 publish하되, 같은 session의 acknowledgement를 editor에 다시 적용하지 않는다.
- 다른 target 선택, `Cmd/Ctrl+S`, 페이지 이탈과 unmount 전에 pending transaction을 flush한다.
- Markdown parse/serialize가 지원 문법의 의미·순서·표시를 보존하는지 fixture로 고정한다.

### 3. read-only preview와 active editor island 분리

- `MarkdownPreview`는 기존 remark render와 PDF/measure 경로를 담당한다.
- `MarkdownEditorHost`는 빈 stable mount만 React로 만들고, editor가 그 하위 DOM과 selection을 수명 전체에 걸쳐 관리한다.
- 활성 session에는 외부 `source` 변경을 value prop처럼 재주입하지 않는다.
- 같은 `DocumentEditTarget`을 여러 pagination fragment가 표시하더라도 editable owner는 하나만 허용하고 나머지는 read-only로 유지한다.
- React document update와 unrelated node update 중 editor instance가 재생성되지 않는 회귀를 추가한다.

### 4. Jira형 명령을 editor transaction으로 이전

- 09의 heading·list·task·blockquote·divider·code input rule을 editor schema/transaction 명령으로 옮긴다.
- 기존 heading의 첫 글자 앞에서 새 `# `~`###### ` marker를 입력하면 같은 내용을 유지하며 level을 바꾸는 input rule을 옮긴다.
- Enter, Backspace, Tab과 Shift+Tab을 source 공백 조작이 아닌 구조 transaction으로 처리한다.
- strong, emphasis, strike, inline code와 link를 editor mark와 selection command로 처리한다.
- keyboard input, toolbar, shortcut과 `/` 메뉴가 동일 command dispatcher를 사용하게 한다.
- IME composition 중 input rule을 실행하지 않고 확정 transaction 이후 문맥에만 적용한다.

### 5. selection·pagination·저장 lifecycle 통합

- 문서 selection은 `DocumentEditTarget` 하나, editor selection은 session 내부 range 하나로 분리한다.
- `anchorRenderId`는 editor host의 mount 위치에만 사용하고 문서 selection identity나 selection outline의 범위로 사용하지 않는다.
- Markdown의 문단·제목·인용문·목록을 각각 클릭해도 같은 document target이 선택되고, active block과 caret만 전환되는지 검증한다.
- 외부 요소 클릭은 active session flush → editor 종료 → 새 문서 target 선택 순서로 처리한다.
- composition 중 repagination과 active unit 이동을 보류하고 editor 종료 또는 안전한 transaction 경계에서 재계산한다.
- 자동 저장은 마지막 published DocumentData snapshot을 저장하며 성공 응답을 active editor DOM에 반영하지 않는다.
- node, component prop과 repeater item prop에서 동일한 lifecycle을 hidden Electron으로 검증한다.

### 6. 기존 DOM 보정 제거와 전체 검증

- `compositionend.data` source 삽입, final echo 추정, pending source selection map과 React 기반 caret restoration을 제거한다.
- 기존 source edit pure function 중 저장 codec이나 non-editor 변환에 필요한 부분만 남긴다.
- 사용자 실제 문서는 read-only 조사 후 안전한 복사본 또는 앱 자체 backup이 보장된 상태에서만 검증한다.
- 빠른 한글, Space, 자동 저장, 대상 전환, 저장·재열기와 PDF 흐름을 반복 검증한다.
- 완료 결과를 09와 backlog/handoff에 연결한다.

## 회귀 검증

- [x] editor engine IME spike
- [x] Markdown parse/serialize round-trip
- [x] React rerender 중 editor DOM·selection 불변
- [x] 빠른 한글·Space·Enter·Tab/Shift+Tab 입력
- [x] node·component prop·repeater item prop session
- [x] Markdown 내부 block 클릭 시 document target 유지·caret만 이동·block별 중복 outline 없음
- [x] 대상 전환·저장·재열기·PDF
- [x] hidden Playwright Electron 사용자 흐름
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `git diff --check`
- [x] 개인정보와 로컬 사용자 데이터가 Git diff에 없는지 확인


## 2026-10-24 통합 결과

- `main@7c65d15`에서 `feat/10-markdown-editor-ownership`으로 분기했다. 기존 선택 경계 문서 3개의 변경을 보존했으며 커밋하지 않았다.
- 단일 `MarkdownEditorHost`가 빈 React mount 안에 Tiptap view를 만들며, 활성 session에 `setContent`나 source/DOM selection 역주입 경로는 없다.
- 문서 선택에 full `DocumentEditTarget`을 보관한다. outline은 같은 target의 페이지 내 fragment들을 합친 범위 하나이며, component prop과 repeater item prop도 구분한다.
- 편집 중에는 target의 최초 preview range와 페이지 배치를 고정한다. 완료된 block preview는 최신 snapshot을 표시하고 새 session은 누적 range delta를 적용한다. 화면 페이지는 입력 길이에 맞춰 임시 확장되며 종료 후 최종 pagination을 수행한다.
- 실제 외부 source 교체는 editor에 주입하지 않고 보류한다. 보류한 변경 적용 또는 현재 내용 유지를 사용자가 선택할 수 있다.
- 앱 종료는 renderer flush와 기존 저장 경로의 성공 응답을 기다린다. 저장 실패 시 창을 닫지 않는다.
- unsupported 문법 검사는 full source AST의 해당 block에서 실행해 외부 reference definition 문맥까지 유지한다. 읽기 전용 fallback의 원문과 편집 범위 밖 CRLF도 보존한다.
- 09의 `sourceSelection.ts`, source 기반 `edits.ts`, JSX contentEditable/IME echo/selection 복원을 제거했다. 동작 검증은 editor command 단위 테스트와 실제 Chromium input E2E로 옮겼다.
- 기존 사용자 문서는 임시 userData 복사본에서만 작성·저장·재열기·PDF를 검증했다. 원본 SHA-256 불변을 확인했고 실제 데이터와 backup은 수정하지 않았다.
- CDP IME와 hidden Electron을 사용했다. 사용자 실기기의 macOS 입력기 수동 수용 확인은 자동 검증과 별개다.
