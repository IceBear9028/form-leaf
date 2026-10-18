# Markdown 편집 DOM 단일 소유권 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 검증 |
|---|---|---|---|
| 1 | 현재 ownership 경계 고정과 editor engine 검증 | 완료 | Tiptap session·Markdown snapshot·실제 DOM/IME parent rerender spike 통과 |
| 2 | Markdown editor session과 codec 계약 | 진행 중 | session revision·compatibility gate·block replacement/conflict 검증 완료, lifecycle 통합 필요 |
| 3 | read-only preview와 active editor island 분리 | 대기 | React 재렌더 중 editor instance·DOM·caret 유지 회귀 |
| 4 | Jira형 명령을 editor transaction으로 이전 | 대기 | 목록·inline·shortcut·toolbar·quick insert 명령 테스트 |
| 5 | selection·pagination·저장 lifecycle 통합 | 대기 | 대상 전환·페이지 재계산·저장·재열기 hidden Electron E2E |
| 6 | 기존 DOM 보정 제거와 전체 검증 | 대기 | dead path 제거, 전체 테스트·build·실제 문서·PDF 확인 |

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

- [ ] editor engine IME spike
- [ ] Markdown parse/serialize round-trip
- [ ] React rerender 중 editor DOM·selection 불변
- [ ] 빠른 한글·Space·Enter·Tab/Shift+Tab 입력
- [ ] node·component prop·repeater item prop session
- [ ] 대상 전환·저장·재열기·PDF
- [ ] hidden Playwright Electron 사용자 흐름
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] 개인정보와 로컬 사용자 데이터가 Git diff에 없는지 확인
