# Markdown 편집 DOM 단일 소유권 기술 설계

## 현재 구조

현재 `EditableMarkdownValue`는 Markdown source를 local buffer에 두고 `parseMarkdownBlocks()` 결과를 `MarkdownContent`의 React JSX로 렌더한다. 편집 대상 block에는 `contentEditable`이 붙는다.

한 번의 입력은 다음 경계를 왕복한다.

```text
Chromium/IME가 React 소유 DOM 변경
→ beforeinput/composition event를 source range로 변환
→ Markdown 문자열 transaction
→ useBufferedStringEdit local state
→ React가 Markdown DOM 재렌더
→ source offset으로 DOM selection 수동 복원
→ requestAnimationFrame + setTimeout(0) 뒤 DocumentData publish
→ render tree/pagination 갱신
→ 활성 fragment와 selection 재조정
```

`MarkdownContent`와 `EditableMarkdownValue`에는 이 경쟁을 줄이기 위해 composition target range, final echo 억제, pending source selection, transient block render와 active fragment 유지 로직이 존재한다. 그러나 editable DOM의 자식은 계속 React가 만들고, IME도 조합 문자열을 표시하기 위해 같은 자식을 변경한다. 따라서 이벤트 순서와 render timing을 보정해도 소유권 충돌 자체는 사라지지 않는다.

## 변경 구조

Markdown의 읽기와 쓰기를 별도 renderer로 나눈다.

```text
                       ┌─ read-only MarkdownPreview
DocumentData Markdown ─┤   React/remark 소유, pagination/PDF/measure 사용
                       │
                       └─ active MarkdownEditorHost
                           React는 stable mount만 소유
                           editor가 하위 DOM·IME·selection·history 소유
                                      │
                                      └─ committed Markdown snapshot
                                          → DocumentData → autosave
```

핵심 추상화는 다음 세 가지다.

1. `MarkdownPreview`: canonical Markdown을 표시하는 기존 read-only React renderer다.
2. `MarkdownEditorSession`: target, top-level block source range, 최초 snapshot, editor state, session revision, dirty와 flush 상태를 소유한다.
3. `MarkdownEditorHost`: editor view를 한 번 mount하고 session 종료 전까지 같은 instance를 유지하는 imperative boundary다.

React는 `MarkdownEditorHost`의 위치, 선택 outline과 session lifecycle만 관리한다. 활성 host의 하위 DOM element, text node와 browser selection은 직접 만들거나 갱신하지 않는다.

초기 editor engine은 Tiptap core 3.32.0을 사용한다. React용 Tiptap adapter는 사용하지 않고 framework-independent `Editor`를 직접 mount한다. 내부 ProseMirror `EditorView`가 DOM·selection·transaction을 관리하고, Resume Studio의 `MarkdownEditorSession`은 최초 Markdown, snapshot revision, flush와 destroy만 노출한다.

문서 selection과 editor session 범위는 구분한다. 문서 selection identity는 하나의 `DocumentEditTarget` 전체다. editor session은 클릭한 top-level Markdown block group의 source range 하나를 소유한다. 현재 pagination이 top-level block을 page unit으로 나누기 때문에 이 범위는 분리된 page DOM을 하나의 contenteditable로 연결하지 않으면서도 list·blockquote·code block 내부 구조 편집을 유지한다.

## 데이터 흐름

### 편집 시작

```text
Preview block click
→ DocumentEditTarget 하나 선택
→ 현재 DocumentData Markdown과 클릭한 top-level block range 읽기
→ 해당 논리 block group의 source slice를 parse
→ MarkdownEditorSession과 EditorState 생성
→ stable host에 editor view mount
```

문서 selection의 identity는 기존 `DocumentEditTarget`을 유지한다. pagination 때문에 동일 source가 여러 fragment에 보이더라도 editor session과 editable owner는 하나뿐이다. 같은 target의 다른 block을 클릭하면 현재 block snapshot을 canonical source range에 반영한 다음 새 block session을 연다.

`anchorRenderId`는 pagination된 fragment 중 editor host를 mount할 위치를 찾는 내부 좌표일 뿐, 문서 selection identity가 아니다. editor를 활성화할 때 기존 문서 selection을 비우거나, anchor fragment에만 문서 selection과 같은 outline을 표시하면 사용자는 Markdown 내부 문단·제목·목록이 별도 요소로 선택된 것으로 인식한다. 문단, 제목, 인용문과 목록 중 어느 곳을 클릭하더라도 외부 selection은 같은 `DocumentEditTarget`을 유지하고, 달라지는 것은 active block session과 그 내부 caret뿐이어야 한다.

2026-10-18 실제 화면 기록에서는 입력 중인 문단의 줄 수에 맞춰 파란 outline 높이만 변하고 같은 Markdown source의 다른 block은 outline에서 제외되는 현재 동작을 확인했다. 이는 `targetKey + anchorRenderId`로 활성 fragment를 정한 뒤 document selection을 해제하고, 활성 fragment 자체에 outline을 그리는 기존 구현에서 발생한다. 새 editor 통합에서는 `anchorRenderId`를 mount anchor로만 사용하고 document selection 표시와 분리한다.

### 입력 중

```text
keyboard / IME / paste
→ editor input handling
→ editor transaction
→ EditorState와 editable DOM 반영
→ 안전한 transaction 경계에서 block Markdown snapshot 생성
→ 원본 full source의 session range를 snapshot으로 교체
→ DocumentData publish
```

IME composition 중 임시 DOM과 caret은 editor가 관리한다. 애플리케이션은 `compositionend.data`를 source에 직접 추가하지 않고, DOM range를 Markdown offset으로 복원하지 않는다.

DocumentData publish는 저장과 read-only consumer를 위한 snapshot이다. 같은 session에서 publish한 값이 React prop으로 돌아와도 active EditorState나 DOM에 다시 적용하지 않는다. editor는 session revision과 마지막 published snapshot으로 자신의 acknowledgement를 구분한다.

### 편집 종료

```text
다른 문서 요소 click / 명시적 저장 / 페이지 이탈
→ active editor transaction flush
→ 최종 Markdown 직렬화
→ DocumentData 동기 반영
→ editor view destroy
→ 최신 MarkdownPreview 렌더
→ 필요 시 repagination
→ 다음 문서 selection 적용
```

클릭 전환은 이 순서를 하나의 application command로 실행해 이전 editor와 새 target이 동시에 활성화되지 않게 한다.

## 사용자 흐름

사용자가 Markdown의 불릿을 클릭하면 외부 문서 selection은 해당 Markdown 데이터 target 하나를 가리키고, 내부 caret은 editor가 해당 list item에 둔다. 빠르게 한글을 입력하거나 Space로 조합을 확정해도 DocumentData publish와 저장 상태 변경은 editor DOM을 다시 만들지 않는다.

이미 heading으로 렌더된 block도 첫 글자 앞에 caret을 두고 `## `처럼 새 marker를 입력하면 기존 source marker를 새 level로 교체한다. 제목 내용은 그대로 유지하고 marker 입력을 본문 literal text로 남기지 않는다.

다른 text, rich text, container 또는 repeater item을 클릭하면 현재 Markdown session이 먼저 flush된다. Markdown의 내부 caret과 toolbar가 닫힌 뒤 클릭한 요소 하나만 새로운 문서 selection이 된다. 다시 Markdown을 클릭하면 최신 canonical snapshot에서 새 session을 시작한다.

## 영향받는 코드

| 영역 | 파일 또는 모듈 | 변경 책임 |
|---|---|---|
| current editor | `rendering/EditableMarkdownValue.tsx` | source-range DOM 편집기를 session host로 교체 |
| Markdown render | `markdown/MarkdownContent.tsx` | editable 책임 제거, read-only preview 책임 유지 |
| editor session | 새 `markdown/editor/` 모듈 | EditorState, view lifecycle, command와 codec 소유 |
| local publish | `rendering/useBufferedEditValue.ts` | active editor DOM과 분리된 snapshot publish 경계로 축소 |
| document update | `GenericDocumentEditorPage.tsx` | activate·flush·target switch 순서 보장 |
| selection | `markdown/sourceSelection.ts` | preview source map과 editor selection 책임 분리 |
| render tree | `rendering/NodeRenderer.tsx` | target 하나에 editor owner 하나만 mount |
| pagination | `rendering/PaginatedDocumentRenderer.tsx`, `rendering/pagination.ts` | active unit pinning과 안전한 repagination 경계 |
| persistence | `useGenericDocumentSession.ts` | 명시적 저장·이탈 전 active editor flush 연결 |
| tests | `client/e2e/markdown-user-flow.spec.ts`, Markdown 단위 테스트 | IME·rerender·전환·저장 회귀 고정 |

## 저장과 복구

canonical 저장 값은 계속 Markdown 문자열이므로 `DocumentData` schema migration은 필요하지 않다. editor의 구조화 state는 활성 편집 session에만 존재하며 디스크에 별도 저장하지 않는다.

자동 저장은 editor가 publish한 마지막 완결 snapshot만 저장한다. composition 중 브라우저 DOM을 읽어 저장하지 않는다. `Cmd/Ctrl+S`, target 전환과 정상적인 editor unmount는 먼저 session을 flush한 뒤 기존 `saveNow()` 경로를 호출한다.

저장 실패 시 editor state와 DocumentData의 dirty snapshot을 메모리에 유지하고 기존 save error UI를 사용한다. 디스크 저장은 기존 repository의 backup과 atomic write 계약을 그대로 사용한다. 이번 작업은 실제 사용자 파일이나 backup을 삭제·정규화하지 않는다.

## 오류와 경계 조건

- 같은 `DocumentEditTarget`의 pagination fragment가 여러 개여도 editable host는 하나만 존재해야 한다.
- composition 중에는 active editor를 다른 page로 이동하거나 destroy하지 않는다.
- unrelated node update, save state update와 selection outline 갱신은 editor instance를 재생성하지 않는다.
- 같은 session이 publish한 Markdown prop은 acknowledgement이며 active editor에 재적용하지 않는다.
- active session의 기준 snapshot과 다른 실제 외부 변경이 들어오면 조용히 덮어쓰지 않는다. 로컬 단독 앱의 첫 구현에서는 active edit을 먼저 flush하고 외부 변경 적용을 보류한다.
- parse/serialize가 지원하지 않는 Markdown을 손실시키지 않는다. 지원 범위 밖 문법은 read-only로 유지하거나 원문 보존 fallback을 사용한다.
- paste와 drop은 확정 transaction 하나이며 keyboard input rule sequence로 재생하지 않는다.
- heading level 변경은 block 첫 content 위치에서 Space로 marker가 완성될 때만 실행하고, 제목 중간의 `#`는 literal text로 유지한다.
- editor 내부 text selection은 문서 node selection outline을 추가로 만들지 않는다.
- active block 또는 pagination fragment는 별도의 문서 selection outline을 만들지 않는다. 문서 선택 표시는 동일 `DocumentEditTarget`의 논리적 소유 범위를 나타낸다.
- 측정용 renderer와 print renderer에는 editable host를 mount하지 않는다.
- 비정상 종료 직전 아직 publish되지 않은 composition 임시값은 저장 대상이 아니다. 확정 transaction은 지연 없이 publish 가능해야 한다.

## 결정과 근거

| 결정 | 근거 | 대안 |
|---|---|---|
| Markdown 문자열을 canonical 저장 형식으로 유지한다. | 기존 문서·component prop·PDF renderer와 호환되며 schema migration이 필요 없다. | 구조화 editor JSON을 저장하면 migration과 이중 renderer가 필요하다. |
| active editor가 editable DOM과 browser selection을 단독 소유한다. | React와 IME의 동시 DOM mutation이 중복 입력과 caret 이동의 근본 원인이다. | 이벤트 순서별 보정을 계속 추가하면 새로운 Chromium/IME 순서에 취약하다. |
| React에는 stable imperative host만 노출한다. | session 동안 React reconciliation이 editor 내부 DOM을 교체하지 못하게 한다. | React JSX에 `contentEditable`을 유지하면 현재 충돌 조건이 남는다. |
| DocumentData는 editor의 committed snapshot을 소비하고 active editor로 역주입하지 않는다. | 저장 지연과 React render timing이 입력 DOM 소유권에 영향을 주지 않게 한다. | controlled value 방식은 매 publish마다 stale DOM overwrite 가능성이 있다. |
| Tiptap core를 React adapter 없이 imperative editor engine으로 사용한다. | ProseMirror의 DOM·selection·transaction 소유권과 Tiptap의 Markdown/GFM command를 사용하면서 React reconciliation을 editor 내부에서 배제할 수 있다. | ProseMirror core 직접 조합은 task list·Markdown codec·Jira형 command를 더 많이 자체 구현해야 한다. |
| editor session은 선택한 top-level block group을 소유하고 문서 selection은 전체 target을 유지한다. | 현재 pagination은 top-level block을 서로 다른 page DOM으로 나누므로 full source editor는 단일 contiguous DOM과 충돌한다. | full source overlay editor는 page gap·좌표·selection을 별도로 재현해야 한다. |
| 첫 구현은 Markdown에 한정한다. | 현재 재현된 중복과 source-map 복잡성이 Markdown 경로에 집중되어 있다. | text/rich text를 동시에 교체하면 회귀 범위와 완료 조건이 불필요하게 커진다. |

## Editor engine spike 결과

Tiptap 3.32.0의 framework-independent `Editor`, `StarterKit`, `Markdown`과 task list extension을 `element: null` session으로 검증했다.

| Markdown 범위 | 결과 | 정책 |
|---|---|---|
| heading, paragraph, strong, emphasis, strike, inline code, link | 의미 왕복 | editor 활성화 가능 |
| bullet·ordered·nested list, task list | 구조 왕복 | indentation 4칸으로 직렬화 |
| blockquote, divider, fenced code | 구조 왕복 | editor 활성화 가능 |
| underline `++text++`, hard break, 추가 빈 문단 | 의미 왕복 | 회귀 fixture 유지 |
| reference link, `2)` ordered marker | 의미는 유지하지만 inline link와 `2.`로 normalize | 허용 가능한 canonical normalization인지 실제 문서 검증 필요 |
| raw HTML | literal text로 escape되어 source 표기가 바뀜 | 원문 보존 정책 확정 전 fallback |
| table | extension 없이 drop | table extension 또는 read-only fallback 필수 |
| image | extension 없이 URL이 손실되고 alt text만 남음 | image extension 또는 read-only fallback 필수 |
| footnote | link 형태로 잘못 normalize | 전용 codec 전까지 read-only fallback 필수 |

`@tiptap/markdown`은 현재 Beta이므로 라이브러리 성공 여부만 믿지 않고, 기존 remark AST로 source 기능을 분류한 뒤 손실 가능한 문법에는 editor session을 열지 않는다. 지원 extension을 추가하더라도 parse → serialize 의미 보존 fixture가 먼저 통과해야 한다.

현재 compatibility gate는 table, table row/cell, image, footnote, reference definition과 일반 raw HTML을 editor 진입 전에 거부한다. 기존 작성 명령이 저장한 `<br>`만 hard break로 인정해 editor 시작 시 CommonMark의 두 칸+newline으로 정규화한다. 이 gate는 integration에서 full source가 아니라 실제 session block slice에 적용한다.

block codec은 session 시작 시 full source, block index, source range와 block Markdown을 하나의 slice로 고정한다. snapshot 반영 시 현재 full source가 session 시작 또는 직전 publish source와 정확히 같을 때만 해당 range를 교체하고 새 range를 계산한다. full source가 예상과 다르면 stale offset으로 덮어쓰지 않고 conflict를 반환한다.

## 검증 전략

먼저 DOM mutation과 selection writer를 계측해 active editor 하위 DOM이 editor transaction 이외 경로에서 바뀌지 않는지 확인한다. editor engine spike는 hidden Electron에서 실제 `contenteditable`과 CDP composition을 사용하고, React parent rerender를 composition 사이에 강제로 삽입했다. spike에서 editor root identity, focus와 caret이 유지되고 확정 snapshot이 중복되지 않음을 확인했다. Preview integration에서는 같은 검증에 DocumentData publish와 pagination을 추가한다.

단위 테스트는 Markdown parse/serialize, supported syntax round-trip, command transaction과 session acknowledgement를 검증한다. Electron E2E는 빠른 한글, 단어마다 Space, 목록 Enter·Tab, unrelated React update, pagination, target switch, 저장·재열기와 PDF를 하나의 사용자 흐름으로 실행한다. 테스트 window는 사용자 키보드와 마우스를 가져가지 않도록 headless 모드를 유지한다.

마지막으로 실제 기존 문서는 내용과 저장 파일을 먼저 read-only로 확인하고, 앱의 기존 backup이 보존되는 조건에서 열기·작성·저장·재열기·PDF를 검증한다.


## 제품 통합 결과 (2026-10-24)

위 설계의 top-level block 소유 범위를 제품에 적용했다. `MarkdownEditorHost`의 React 자식은 비어 있으며 ProseMirror가 mount 이후 모든 editable DOM과 selection을 관리한다. 초기 클릭 위치만 preview text offset을 editor position으로 변환하고, 입력 이후에는 DOM/source selection을 복원하지 않는다.

`DocumentSelection`은 기존 layer owner와 함께 `editTarget`을 보관한다. page outline은 full target key가 같은 fragment의 합집합을 표시하며 component prop과 repeater item prop도 각각 구분한다. mount anchor와 문서 선택 identity는 분리되어 있다.

`markdownEditorLifecycle`은 한 활성 문서의 owner, 최초 preview source, 현재 canonical source, block별 range delta를 관리한다. 입력 중 target의 preview index와 페이지 위치를 고정하고, 완료된 block은 최신 snapshot의 read-only preview를 표시한다. 화면 페이지 높이는 임시 확장을 허용하며 editor 종료 후 최종 pagination을 수행한다. 측정·print에는 editor를 mount하지 않는다.

실제 외부 source 변경은 flush 뒤 보류하고 UI에서 적용/현재 값 유지로 해결한다. session acknowledgement는 view에 재적용하지 않는다. 클릭만 하고 편집하지 않은 session은 canonical normalization을 publish하지 않는다. 지원 문법 판정은 full source AST의 해당 block으로 수행하므로 reference definition이 slice 밖에 있어도 gate를 우회하지 않는다.

앱 종료는 main의 close guard → renderer session 종료/flush → 기존 saveUntilClean → main close acknowledgement 순서다. 저장 실패 시 창을 유지한다. source schema와 atomic save/backup 정책은 그대로다.

`MarkdownContent`의 React contentEditable, source-range composition/echo 처리와 selection 복원 경로는 제거했다. old source transaction 테스트는 editor command 및 hidden Chromium input 회귀로 대체했고, preview parser와 legacy serialization 테스트는 유지했다.
