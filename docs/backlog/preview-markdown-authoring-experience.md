# Preview Markdown authoring experience

## 상태

Backlog — 기획 논의 중

## 문제

Preview의 Markdown은 렌더된 결과를 직접 수정할 수 있지만, 긴 문서를 처음부터 작성하거나 목록 구조를 계속 편집하기에는 일반 문서 편집기보다 불편하다. 사용자는 Markdown 원문 문법을 외워 입력하는 것이 아니라, `-` 뒤에 Space를 누르면 불릿이 되고 Enter로 다음 항목을 이어 쓰는 것처럼 작성 의도가 즉시 구조로 반영되기를 기대한다.

현재 코드에는 빈 줄 시작에서 다음 접두어 뒤 Space를 입력하면 블록 문법으로 전환하는 로직이 이미 있다.

- `#`~`######`: 제목
- `-`: 불릿 목록
- `1.` 같은 숫자 접두어: 순서 목록
- `>`: 인용문

그러나 접두어 전환 하나만으로는 실제 작성 흐름이 완성되지 않는다. 목록 항목 생성 이후 Enter·빈 항목·들여쓰기·Backspace의 동작, pagination 재렌더 뒤 caret 복원, 한글 IME와 undo 단위까지 하나의 작성 계약으로 정해야 한다. 현재 기능이 실제 Preview에서 동작하지 않는 입력 위치나 문서 형태가 있는지도 구현 전에 재현해야 한다.

## 사용자 경험 목표

- 빈 문단에서 `-`와 Space를 입력하면 같은 위치가 즉시 불릿 항목으로 보이고 이어서 입력할 수 있다.
- 목록 항목 끝에서 Enter를 누르면 같은 종류의 다음 항목이 생성된다.
- 빈 목록 항목에서 Enter를 누르면 목록을 끝내고 일반 문단으로 돌아간다.
- 목록 시작에서 Backspace를 누르면 내용을 잃지 않고 일반 문단으로 되돌아간다.
- Tab과 Shift+Tab의 목록 들여쓰기·내어쓰기 규칙이 예측 가능하다.
- 제목, 인용문과 순서 목록도 동일한 블록 전환 원칙을 따른다.
- 모든 전환 뒤 caret, 한글 조합, undo/redo와 저장 결과가 안정적이다.
- 화면에는 렌더 결과를 보여 주되 저장되는 Markdown source의 의미와 사용자가 입력한 내용은 보존한다.

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

## 설계 원칙

- Preview의 단일 활성 요소 규칙과 공통 선택 표시는 유지한다.
- 편집 결과는 기존 Markdown source와 source map transaction을 통해 저장한다.
- 브라우저 `contenteditable` DOM을 그대로 source로 직렬화하지 않는다.
- 한 번의 사용자 의도는 한 번의 undo로 되돌릴 수 있어야 한다.
- 자동 전환은 줄 시작의 명확한 접두어에서만 수행하고 문장 중간의 기호는 바꾸지 않는다.
- 사용자가 입력한 내용을 자동 요약하거나 문장을 재작성하지 않는다.
- screen, measure, print의 Markdown 의미 구조는 동일하게 유지한다.

## 구현 전 조사

- 실제 Preview에서 기존 `- `, 제목, 인용문과 순서 목록 shortcut이 성공·실패하는 위치를 재현한다.
- node 직접 값, component prop과 repeater item prop에서 동작 차이가 있는지 확인한다.
- 일반 문단, 빈 문서, 기존 목록 끝, pagination fragment 경계에서 Enter 동작을 기록한다.
- 한글 IME 조합 중 Space·Enter와 macOS undo가 현재 transaction에서 어떻게 처리되는지 확인한다.
- source selection 복원이 블록 type 변경과 목록 중첩 뒤에도 같은 논리 위치를 가리키는지 확인한다.

## 완료 조건

- [ ] Preview Markdown 작성의 shortcut·Enter·Backspace·Tab 계약을 문서로 확정한다.
- [ ] 기존 shortcut의 실제 실패 조건을 재현 테스트로 고정한다.
- [ ] `- `와 `1. ` 전환 후 caret을 잃지 않고 즉시 입력을 계속할 수 있다.
- [ ] 목록 Enter, 빈 항목 종료, Backspace 해제와 들여쓰기·내어쓰기가 확정한 규칙대로 동작한다.
- [ ] 제목과 인용문 블록 전환이 같은 transaction·selection 원칙을 사용한다.
- [ ] node, component prop과 repeater item prop에 같은 작성 동작을 제공한다.
- [ ] pagination fragment가 바뀌어도 활성 요소와 caret이 중복되거나 사라지지 않는다.
- [ ] 한글 IME, 복사·붙여넣기와 undo/redo 회귀 테스트가 통과한다.
- [ ] 저장·재열기와 PDF 출력에서 source 의미와 렌더 결과가 유지된다.
- [ ] typecheck, 전체 테스트, production build와 실제 앱 검증이 통과한다.

## 별도 문제

- Markdown의 제목·목록·인용문 시각값을 문서 데이터가 소유하는 문제는 [Document-owned Markdown styles](document-owned-markdown-styles.md)에서 다룬다.
- component 구조 편집과 Preview 선택 경계는 `docs/08-preview-component-selection-boundary/`에서 완료했다.
