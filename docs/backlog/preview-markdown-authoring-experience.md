# Preview Markdown authoring experience

## 상태

자동 검증 완료·사용자 실제 앱 확인 대기 — `docs/09-preview-markdown-authoring/`

## 문제

Preview의 Markdown은 렌더된 결과를 직접 수정할 수 있지만, 긴 문서를 처음부터 작성하거나 목록 구조를 계속 편집하기에는 일반 문서 편집기보다 불편하다. 사용자는 Markdown 원문 문법을 외워 입력하는 것이 아니라, `-` 뒤에 Space를 누르면 불릿이 되고 Enter로 다음 항목을 이어 쓰는 것처럼 작성 의도가 즉시 구조로 반영되기를 기대한다.

현재 코드에는 빈 줄 시작에서 다음 접두어 뒤 Space를 입력하면 블록 문법으로 전환하는 로직이 이미 있다.

- `#`~`######`: 제목
- `-`: 불릿 목록
- `1.` 같은 숫자 접두어: 순서 목록
- `>`: 인용문

그러나 접두어 전환 하나만으로는 실제 작성 흐름이 완성되지 않는다. 목록 항목 생성 이후 Enter·빈 항목·들여쓰기·Backspace의 동작, pagination 재렌더 뒤 caret 복원, 한글 IME와 undo 단위까지 하나의 작성 계약으로 정해야 한다. 현재 기능이 실제 Preview에서 동작하지 않는 입력 위치나 문서 형태가 있는지도 구현 전에 재현해야 한다.

## 기획 기준: Jira 편집 경험

이 작업은 Jira의 리치 텍스트 편집 경험을 주요 제품 레퍼런스로 사용한다. 후속 기획과 구현을 시작할 때 sibling repository `../jira-rea`의 분석 문서를 먼저 읽고, Jira에서 확인된 사용자 동작과 Resume Studio의 현재 Markdown source 기반 구조를 대조한다.

참조 순서는 다음과 같다.

1. `../jira-rea/README.md` — 조사 범위와 문서 지도
2. `../jira-rea/01-product-spec.md` — 사용자 과업, 기능 우선순위와 수용 기준
3. `../jira-rea/01a-keyboard-input-spec.md` — Markdown 문법, 단축키, 입력 이벤트와 경계 사례
4. `../jira-rea/02-input-render-pipeline.md` — 키 입력부터 즉시 구조 전환과 화면 갱신까지의 흐름
5. `../jira-rea/03-architecture.md` — 입력 규칙, 명령, 선택과 undo 상태의 책임 분리
6. `../jira-rea/evidence.md` — 공개 Atlaskit 관찰, Jira 공식 계약과 재구현 설계안의 증거 수준

레퍼런스를 사용할 때는 다음 경계를 지킨다.

- 문서에서 `REA 관찰`, `공식`, `설계안`으로 구분한 증거 수준을 그대로 유지한다.
- 공개 Atlaskit 예제에서 확인한 동작을 실제 Jira 운영 화면의 내부 구현으로 단정하지 않는다.
- Jira의 ADF 데이터 모델을 Resume Studio에 도입하는 근거로 사용하지 않는다. Resume Studio는 기존 Markdown source와 source map transaction을 유지한다.
- Jira에서 참조할 대상은 입력 문법, 즉시 변환, caret, 단축키, toolbar, undo, IME와 붙여넣기 경험이다.
- Jira 이슈의 실제 내용이나 사용자 데이터를 테스트 fixture 또는 제품 기본값으로 복사하지 않는다.

## Jira 참조로 추가한 필요 기능

| 영역 | 필요한 동작 | 우선순위 |
|---|---|---|
| 블록 자동 서식 | 줄 시작의 `#`~`######`, `-`, `*`, `1.`, `2)`, `>` 뒤 Space에서 제목·목록·인용문으로 즉시 전환 | P0 |
| 인라인 자동 서식 | 순차 입력으로 `**굵게**`, `*기울임*`, `~~취소선~~`, `` `코드` ``와 링크 문법을 완성하면 marker를 소비하고 서식을 유지 | P0 |
| 연속 작성 | 목록 Enter, 빈 항목 종료, Tab/Shift+Tab 들여쓰기·내어쓰기, 블록 시작 Backspace를 하나의 예측 가능한 계약으로 제공 | P0 |
| 명령 통합 | Markdown 문법, keyboard shortcut과 toolbar가 서로 다른 변환 코드를 갖지 않고 같은 편집 명령을 실행 | P0 |
| 단축키 | 굵게·기울임·밑줄, 글머리·번호 목록, 인용문, 링크, 코드, 서식 지우기와 undo/redo를 편집기 focus 안에서 제공 | P0 |
| 입력 안정성 | 자동 서식 변환과 selection 복원을 하나의 transaction과 undo 단위로 처리 | P0 |
| IME | 한글 조합 중간값에서는 규칙을 실행하지 않고 조합 완료 텍스트를 한 번만 반영 | P0 |
| 붙여넣기 | 순차 키 입력과 붙여넣기를 구분하고, 붙여넣은 Markdown을 자동 변환할지 명시적인 정책으로 결정 | P0 |
| 문맥 보호 | 문장 중간, 인라인 코드와 코드 블록의 Markdown marker는 잘못된 자동 서식으로 바꾸지 않음 | P0 |
| 확장 블록 | 작업 항목 `[] `, 구분선, 코드 블록과 서식 없는 붙여넣기 지원 | P1 |
| 빠른 삽입 | `/` 메뉴에서 Markdown 문법을 모르는 사용자도 블록을 선택하고 keyboard로 탐색·취소 | P1 |
| 기타 Jira 기능 | 이모지 `:`, 멘션 `@`, 이미지와 파일 삽입 | 별도 제품 필요성이 생길 때 검토 |

Jira 레퍼런스에서 특히 중요한 동작은 완성 문자열을 나중에 일괄 파싱하는 것이 아니라, 마지막 Space나 닫는 marker가 실제 키 입력으로 들어오는 순간 현재 문맥만 구조로 전환하고 이어서 입력할 caret을 유지하는 것이다. 순차 입력, 붙여넣기와 프로그램에 의한 일괄 입력은 서로 다른 수용 시나리오로 검증한다.

## 사용자 경험 목표

- 빈 문단에서 `-`와 Space를 입력하면 같은 위치가 즉시 불릿 항목으로 보이고 이어서 입력할 수 있다.
- 목록 항목 끝에서 Enter를 누르면 같은 종류의 다음 항목이 생성된다.
- 빈 목록 항목에서 Enter를 누르면 목록을 끝내고 일반 문단으로 돌아간다.
- 목록 시작에서 Backspace를 누르면 내용을 잃지 않고 일반 문단으로 되돌아간다.
- Tab과 Shift+Tab의 목록 들여쓰기·내어쓰기 규칙이 예측 가능하다.
- 제목, 인용문과 순서 목록도 동일한 블록 전환 원칙을 따른다.
- 모든 전환 뒤 caret, 한글 조합, undo/redo와 저장 결과가 안정적이다.
- 화면에는 렌더 결과를 보여 주되 저장되는 Markdown source의 의미와 사용자가 입력한 내용은 보존한다.
- 내용 없는 중첩 불릿은 CommonMark Setext 제목 문법과 충돌해도 제목으로 바뀌지 않고 목록 계층과 caret을 유지한다.

## 우선 기획할 입력 규칙

| 입력 상황 | 제안 동작 | 결정 필요 |
|---|---|---|
| 빈 문단 시작에서 `- ` | 불릿 목록으로 즉시 전환 | 기본 포함 |
| 빈 문단 시작에서 `1. ` | 순서 목록으로 즉시 전환 | 기본 포함 |
| 빈 문단 시작에서 `# `, `> ` | 제목 또는 인용문으로 즉시 전환 | 기본 포함 |
| 불릿·순서 항목 끝에서 Enter | 같은 단계의 다음 항목 생성 | 기본 포함 |
| 빈 목록 항목에서 Enter | 목록 종료 후 일반 문단 생성 | 기본 포함 |
| 목록 항목에서 Tab / Shift+Tab | 들여쓰기 / 내어쓰기 | 중첩 가능 범위 결정 필요 |
| 목록 항목 시작에서 Backspace | marker 제거 후 일반 문단 전환 | 기본 포함 |
| 일반 블록 시작에서 Backspace | 이전 블록과 병합 | 블록 종류별 규칙 필요 |
| `* `, `+ ` | `- `와 같은 불릿 shortcut | 허용 문법 결정 필요 |
| `[ ] `, `[x] ` | task list 항목 전환 | 1차 범위 여부 결정 필요 |
| `/` 명령 또는 블록 toolbar | 문법을 모르는 사용자용 블록 선택 | shortcut 안정화 이후 검토 |

Jira 공식 문법과 맞추려면 최소한 `* ` 불릿과 `2) ` 형태의 번호 목록도 검토해야 한다. `+ `, `[ ]`·`[x]` 표기와 체크 상태 토글은 Jira 공식 표기 및 Resume Studio Markdown parser 지원 범위를 확인한 뒤 최종 계약을 정한다.

## 설계 원칙

- Preview의 단일 활성 요소 규칙과 공통 선택 표시는 유지한다.
- 편집 결과는 기존 Markdown source와 source map transaction을 통해 저장한다.
- 브라우저 `contenteditable` DOM을 그대로 source로 직렬화하지 않는다.
- 한 번의 사용자 의도는 한 번의 undo로 되돌릴 수 있어야 한다.
- Markdown 문법, 단축키와 toolbar는 같은 편집 command를 호출해야 한다.
- 자동 전환은 줄 시작의 명확한 접두어에서만 수행하고 문장 중간의 기호는 바꾸지 않는다.
- 순차 키 입력과 붙여넣기는 별도 입력 경로로 판정하고, 붙여넣기를 가짜 키 입력 열로 재생하지 않는다.
- 인라인 코드와 코드 블록 안에서는 다른 Markdown marker 자동 전환을 실행하지 않는다.
- 사용자가 입력한 내용을 자동 요약하거나 문장을 재작성하지 않는다.
- screen, measure, print의 Markdown 의미 구조는 동일하게 유지한다.

## 구현 전 조사

- 실제 Preview에서 기존 `- `, 제목, 인용문과 순서 목록 shortcut이 성공·실패하는 위치를 재현한다.
- node 직접 값, component prop과 repeater item prop에서 동작 차이가 있는지 확인한다.
- 일반 문단, 빈 문서, 기존 목록 끝, pagination fragment 경계에서 Enter 동작을 기록한다.
- 한글 IME 조합 중 Space·Enter와 macOS undo가 현재 transaction에서 어떻게 처리되는지 확인한다.
- 순차 입력과 완성된 Markdown 문자열 붙여넣기가 현재 서로 어떻게 처리되는지 확인한다.
- 기존 inline toolbar와 `Cmd/Ctrl+B`, `I`, `U`가 동일한 편집 command로 수렴하는지 확인한다.
- source selection 복원이 블록 type 변경과 목록 중첩 뒤에도 같은 논리 위치를 가리키는지 확인한다.

## 완료 조건

- [x] Preview Markdown 작성의 shortcut·Enter·Backspace·Tab 계약을 문서로 확정한다.
- [x] Jira 레퍼런스의 공식·관찰·설계안 기능을 Resume Studio의 포함·제외·후속 범위로 각각 매핑한다.
- [x] 기존 shortcut의 실제 실패 조건을 재현 테스트로 고정한다.
- [x] `- `와 `1. ` 전환 후 caret을 잃지 않고 즉시 입력을 계속할 수 있다.
- [x] 목록 Enter, 빈 항목 종료, Backspace 해제와 들여쓰기·내어쓰기가 확정한 규칙대로 동작한다.
- [x] 빈 중첩 불릿의 Tab 뒤 remark가 Setext 제목으로 오인하지 않고 다음 제목과 활성 caret을 분리해 유지한다.
- [x] 제목과 인용문 블록 전환이 같은 transaction·selection 원칙을 사용한다.
- [x] 순차 입력 인라인 Markdown과 toolbar·keyboard shortcut이 같은 편집 command와 결과를 사용한다.
- [x] node, component prop과 repeater item prop에 같은 작성 동작을 제공한다.
- [x] pagination fragment가 바뀌어도 활성 요소와 caret이 중복되거나 사라지지 않는다.
- [x] 한글 IME, 복사·붙여넣기와 undo/redo 회귀 테스트가 통과한다.
- [x] 순차 입력, 일괄 입력과 붙여넣기를 구분한 Jira 참조 수용 시나리오가 통과한다.
- [x] 저장·재열기와 PDF 출력에서 source 의미와 렌더 결과가 유지된다.
- [ ] typecheck, 전체 테스트와 production build는 통과했으며 사용자 실제 앱 검증을 마친다.

## 별도 문제

- Markdown의 제목·목록·인용문 시각값을 문서 데이터가 소유하는 문제는 [Document-owned Markdown styles](document-owned-markdown-styles.md)에서 다룬다.
- component 구조 편집과 Preview 선택 경계는 `docs/08-preview-component-selection-boundary/`에서 완료했다.


## 후속 구현 결과 (2026-10-24)

[10. Markdown 편집 DOM 단일 소유권](../10-markdown-editor-ownership/handoff.md)에서 작성 명령을 Tiptap/ProseMirror transaction으로 이전했다. source map 편집과 React selection 복원은 제거했고 hidden Electron의 Space·Tab·IME·저장·PDF 및 실제 문서 안전 복사본 검증을 완료했다. 사용자 실기기 수동 수용 확인은 별도로 남긴다.
