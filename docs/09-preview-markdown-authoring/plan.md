# Preview Markdown 작성 사용성 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 검증 |
|---|---|---|---|
| 1 | Jira 기능과 현재 editor gap 고정 | 완료 | 현재 지원 gap과 4개 Jira source transition 테스트 고정 |
| 2 | 공통 Markdown edit command와 입력 규칙 | 완료 | block·inline·paste·command 단위 테스트 |
| 3 | 목록 구조 키보드 동작 | 완료 | Enter·Backspace·Tab·task source transition 테스트와 Electron 입력 |
| 4 | shortcut·toolbar·빠른 삽입 통합 | 완료 | 공통 command 결과와 `/` keyboard 탐색 Electron 검증 |
| 5 | DOM event·IME·caret 통합 | 완료 | composition·undo/redo·pagination 실제 입력 검증 |
| 6 | 전체 회귀와 실제 기존 문서 검증 | 완료 | hidden Playwright Electron에서 전체 사용자 흐름·prop target·저장/재열기·실제 PDF 확인 |
| 7 | 실제 Space·Tab·IME 입력 회귀 수정 | 진행 중 | 표준 composition 흐름과 hidden Playwright 반복 검증 통과, 사용자 실제 앱 확인 대기 |

상태는 `대기`, `진행 중`, `완료`, `차단` 중 하나만 사용한다. 동시에 하나의 단계만 `진행 중`으로 둔다.

## 구현 순서

### 1. Jira 기능과 현재 editor gap 고정

- `jira-rea`의 공식·관찰·설계안 요구를 현재 parser, edit function, DOM event와 toolbar에 매핑한다.
- 이미 지원하는 렌더 문법과 실제 작성 가능한 문법을 구분한다.
- 현재 실패하는 Jira 수용 시나리오를 pure source edit test로 먼저 고정한다.

### 2. 공통 Markdown edit command와 입력 규칙

- block prefix와 inline closing marker를 현재 문맥에서만 판정한다.
- 순차 입력과 붙여넣기를 다른 intent로 처리한다.
- toolbar, shortcut과 input rule이 공유할 typed command를 정의한다.

### 3. 목록 구조 키보드 동작

- 현재 목록 항목의 marker, indentation, source range와 빈 상태를 해석한다.
- Enter로 다음 항목을 생성하고 빈 항목은 outdent 또는 목록 종료한다.
- Backspace와 Tab/Shift+Tab을 source transaction으로 구현한다.

### 4. shortcut·toolbar·빠른 삽입 통합

- Jira 텍스트 서식 shortcut을 편집 focus 안에서만 처리한다.
- 선택 toolbar가 같은 command dispatcher를 사용하게 한다.
- `/` 메뉴는 Markdown 텍스트 block command만 제공하고 keyboard로 탐색·확정·취소한다.

### 5. DOM event·IME·caret 통합

- `keydown`, `beforeinput`, `composition`과 paste의 우선순위를 명시한다.
- 입력 규칙 실행 뒤 source range로 caret을 복원한다.
- pagination fragment가 바뀌어도 현재 active render와 selection이 중복되지 않게 한다.

### 6. 전체 회귀와 실제 기존 문서 검증

- 실제 사용자의 문서 열기·선택·작성·저장·재열기·출력 흐름을 `user-flow-test.md`에 고정한다.
- node, component prop과 repeater item prop에서 같은 입력 시퀀스를 검증한다.
- 저장·재열기·undo/redo·PDF와 기존 문서 출력을 확인한다.
- backlog와 handoff에 구현 결과와 제외 범위를 반영한다.

### 7. 실제 Space·Tab 입력 회귀 수정

- 기존 E2E가 `keyboard.insertText()`로 Space 입력 경로를 우회한 문제를 회귀로 기록한다.
- Markdown 편집 focus 안의 일반 Space는 상위 container/repeater가 가로채지 않고 Chromium의 `beforeinput`으로 처리한다.
- `-` 다음 Space의 불릿 전환, 두 번째 목록 항목의 Tab/Shift+Tab과 연속 Space 3회 보존을 hidden Playwright에서 확인한다.
- 일반 편집은 `beforeinput.getTargetRanges()`의 DOM 범위를 Markdown source range로 변환한다.
- IME는 조합 중 DOM 변경을 허용하고, 첫 `insertCompositionText.getTargetRanges()`를 실제 source 교체 범위로 고정한 뒤 `compositionend.data`를 한 번만 반영한다. 조합 확정 직후 같은 `inputType`·`data`로 오는 final echo만 one-shot으로 제거하며, `setTimeout(0)` 보정은 사용하지 않는다.
- `ㅎ`을 target range로 교체해 `하`를 만드는 회귀에서 `ㅎ하`가 아니라 `하`만 저장되는지 검증한다.
- Space `keydown`이 final composition `beforeinput`보다 먼저 오는 순서를 고정하고, 여러 단어를 Space로 연속 확정해도 직전 한글이 중복되지 않는지 검증한다.
- 이전 음절의 buffered publish가 다음 한글 composition 도중 반영되는 순서를 고정하고, composition 상태와 현재 caret을 유지한 뒤 최종 source가 중복 없이 저장되는지 검증한다.
- 사용자의 실제 앱 확인 전에는 작업을 완료 처리하지 않는다.

## 회귀 검증

- [x] Jira 기능 matrix와 수용 테스트
- [x] Markdown source edit 단위 테스트
- [x] 관련 기능 실제 키 입력 확인
- [x] 한글 IME·붙여넣기·undo/redo 확인
- [x] node·component prop·repeater item prop 확인
- [x] 저장·재열기와 PDF 확인
- [x] hidden Playwright Electron 사용자 흐름 테스트
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `git diff --check`
- [x] 개인정보와 로컬 사용자 데이터가 Git diff에 없는지 확인
