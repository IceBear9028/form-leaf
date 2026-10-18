# Preview Markdown 사용자 흐름 테스트

## 목적

기능별 source transaction만 확인하지 않고, 사용자가 실제 Preview에서 문서를 작성하고 저장·재열기·출력하는 전체 흐름을 검증한다. 테스트는 실제 사용자 데이터와 분리한 임시 `DOCUMENT_USER_DATA_DIRECTORY`에서 실행하며 node, component prop, repeater item prop을 한 문서에 배치한다.

## 테스트 원칙

- 사용자는 Preview에 렌더된 내용을 클릭해 편집을 시작한다.
- 한 번에 하나의 문서 데이터 소유 단위만 선택·편집 상태여야 한다.
- Playwright가 표시하지 않은 Electron window를 직접 조작해 사용자의 실제 키보드·마우스 focus를 가져가지 않는다.
- 키 입력, 단축키, 빠른 삽입과 checkbox 조작은 hidden Electron renderer 이벤트로 실행한다.
- 화면 결과와 저장된 canonical Markdown source를 함께 확인한다.
- 저장 후 앱을 종료하고 같은 userData로 다시 열어 지속성을 확인한다.
- PDF는 native 저장창을 열지 않고 테스트 안에서 저장 경로 응답만 임시 경로로 대체한다. 이후 제품의 `PDF 내보내기` handler와 `webContents.printToPDF()`가 만든 실제 파일을 확인한다.
- 실패는 우회해 성공으로 기록하지 않고 재현 조건과 실제 결과를 남긴다.

## 테스트 문서 구성

| 영역 | 데이터 소유 단위 | 초기 내용 | 확인 목적 |
|---|---|---|---|
| 직접 Markdown | `node` | 빈 값 | 일반 작성, 선택 전환, 빠른 삽입, 단축키, undo |
| 연속 공백 Markdown | `node` | 빈 값 | Space keydown 3회의 source·화면 보존 |
| 빈 중첩 불릿 Markdown | `node` | 2단계 빈 불릿과 다음 제목 | Tab 직후 빈 3단계 불릿이 Setext 제목으로 오인되지 않는지 확인 |
| 단축키 Markdown | `node` | 빈 값 | 빈 caret inline 단축키 확인 |
| 붙여넣기 Markdown | `node` | 빈 값 | OS clipboard를 바꾸지 않는 literal paste 확인 |
| 컴포넌트 Markdown | `component-prop` | `컴포넌트 시작` | instance override만 변경되는지 확인 |
| 반복 항목 A | `repeater-item-prop` | `반복 A 시작` | 첫 항목 override와 목록 작성 확인 |
| 반복 항목 B | `repeater-item-prop` | `반복 B 유지` | 다른 항목 변경이 전파되지 않는지 확인 |
| 긴 Markdown | `node` | 여러 문단 | pagination 경계의 단일 caret·편집 유지 확인 |

## 종단 사용자 흐름

### UF-01 문서 열기와 단일 선택

1. 보관함에서 테스트 문서를 연다.
2. 직접 Markdown을 클릭한다.
3. component Markdown을 클릭한다.
4. repeater 항목 A를 클릭한다.

기대 결과:

- 클릭할 때마다 이전 요소의 선택 표시와 편집 focus가 해제된다.
- 마지막으로 클릭한 데이터 소유 단위 하나만 선택·편집 상태다.
- component definition 내부 node와 외부 owner가 동시에 선택되지 않는다.

### UF-02 직접 Markdown 연속 작성

1. 빈 직접 Markdown에서 `- `를 순차 입력한다.
2. `첫 항목`을 입력하고 Enter를 누른다.
3. `둘째 항목`을 입력하고 Tab으로 하위 불릿을 만든다.
4. Shift+Tab으로 원래 단계로 돌아간 뒤 Enter를 누른다.
5. 빈 항목에서 Enter를 눌러 목록을 종료한다.
6. `/h2`를 입력하고 Enter로 제목 2를 선택한다.
7. `사용자 흐름`을 입력한다.

기대 결과:

- Space 순간 bullet이 되고 caret은 첫 항목에 남는다.
- 두 번째 항목은 Tab 한 번에 논리적 하위 불릿이 되고 Shift+Tab 한 번에 원래 단계로 복원된다.
- Enter가 같은 목록을 이어가고 빈 항목 Enter가 일반 문단으로 빠져나온다.
- `/` 문자열은 명령 확정 시 제거되고 제목 2가 삽입된다.
- source 의미는 `- 첫 항목\n- 둘째 항목\n\n## 사용자 흐름`과 동등하다.

### UF-02A 연속 공백 입력

1. 빈 연속 공백 Markdown에 `앞`을 입력한다.
2. Space keydown을 세 번 보낸다.
3. `뒤`를 입력하고 다른 요소를 클릭해 저장한다.

기대 결과:

- canonical source는 `앞   뒤`로 공백 세 개를 보존한다.
- Preview 편집 화면에서도 공백 세 개가 축약되지 않는다.

### UF-02B Tab 변경 범위와 다음 제목 보존

1. `- 첫째`, `- 둘째`, `- h` 세 항목과 바로 다음 `# 아래 제목`을 만든다.
2. 둘째 항목에서 Tab을 누른다.

기대 결과:

- source는 `- 첫째\n    - 둘째\n- h\n# 아래 제목`이 된다.
- 둘째 항목만 중첩되고 아래 `h` 항목은 최상위 계층을 유지한다.
- 바로 아래 제목은 목록 내용으로 흡수되지 않고 제목으로 유지된다.

### UF-02C 빈 중첩 불릿과 다음 제목 보존

1. 2단계 목록의 내용 없는 불릿 바로 아래에 제목을 둔다.
2. 빈 불릿에서 Tab을 한 번 눌러 3단계로 들여쓴다.

기대 결과:

- source는 공백 8칸의 빈 불릿으로 바뀐다.
- CommonMark의 Setext 제목 문법으로 오인되지 않고 빈 목록 항목으로 렌더된다.
- 활성 contenteditable과 caret은 그 목록 fragment에 남는다.
- 바로 다음 제목은 별도 제목 fragment로 유지된다.

### UF-03 인라인 서식·단축키·undo

1. 새 문단에 `**굵게**`를 순차 입력한다.
2. undo 한 번, redo 한 번을 실행한다.
3. 별도의 빈 Markdown caret에서 굵게 단축키를 켜고 `단축키`를 입력한다.
4. 붙여넣기 검증용 빈 Markdown에 완성된 Markdown 문자열을 붙여넣는다.

기대 결과:

- 마지막 `*`에서 즉시 strong으로 보인다.
- undo 한 번은 자동 변환 전 원문으로, redo 한 번은 strong으로 복원한다.
- 빈 선택 단축키 뒤 입력은 strong으로 저장된다.
- 붙여넣기는 순차 입력 규칙을 재생하지 않고 literal 정책을 따른다.

### UF-04 component prop 편집

1. Preview의 component Markdown을 클릭한다.
2. 줄 끝에서 Enter를 누르고 `- 컴포넌트 항목`을 입력한다.
3. 직접 Markdown을 클릭해 편집을 종료한다.

기대 결과:

- 화면에는 component instance 내용만 바뀐다.
- 저장 source는 instance의 해당 prop에만 기록된다.
- component prop definition의 기본값과 직접 Markdown은 바뀌지 않는다.

### UF-05 repeater item prop 독립 편집

1. 반복 항목 A의 Markdown을 클릭한다.
2. 줄 끝에서 Enter를 누르고 `[] `를 입력해 task item으로 바꾼다.
3. `확인 항목`을 입력하고 checkbox를 클릭한다.
4. 반복 항목 B를 클릭한다.

기대 결과:

- 항목 A source만 `[x] 확인 항목`으로 갱신된다.
- 항목 B와 component 기본값은 그대로다.
- 항목 B를 클릭하면 항목 A의 편집 focus와 선택 표시가 해제된다.

### UF-06 pagination 경계 편집

1. 여러 페이지로 나뉜 긴 Markdown의 다음 페이지 fragment를 클릭한다.
2. caret 위치에 `경계확인`을 입력한다.
3. 이전 페이지와 다음 페이지의 선택·편집 표시를 확인한다.

기대 결과:

- 입력한 fragment의 논리 source 위치에 한 번만 반영된다.
- caret을 다른 fragment가 가로채지 않는다.
- 같은 source의 여러 fragment가 동시에 편집 focus를 표시하지 않는다.

### UF-07 한글 IME

1. 빈 문단에서 `한글 입력`을 한글 IME 조합으로 입력한다.
2. 조합 도중과 확정 뒤 화면 및 source를 확인한다.

기대 결과:

- 조합 중간 자모가 자동 서식 규칙을 실행하지 않는다.
- 확정 문자열이 중복 없이 한 번만 저장된다.

### UF-08 저장과 재열기

1. 다른 요소를 클릭해 현재 편집 buffer를 flush한다.
2. 보관함으로 돌아가 저장을 완료한다.
3. 앱을 종료하고 같은 임시 userData로 다시 실행한다.
4. 테스트 문서를 다시 연다.

기대 결과:

- node, component prop, repeater item prop의 변경이 모두 유지된다.
- 재열기 직후에는 편집 focus가 중복되지 않는다.
- 저장 파일은 schemaVersion 4 canonical 문서로 유효하다.

### UF-09 PDF 내보내기

1. `PDF 내보내기`를 누른다.
2. 임시 경로에 저장한다.
3. print DOM의 의미 구조와 생성된 PDF의 signature·파일 크기를 확인한다.

기대 결과:

- PDF 파일이 생성되고 0바이트가 아니다.
- 제목, strong, bullet, checked task와 한글 입력의 의미가 출력에 유지된다.
- 편집 focus, 선택 outline, quick insert menu는 출력되지 않는다.

## 실행 결과

| ID | 결과 | 증거 또는 실제 결과 |
|---|---|---|
| UF-01 | 통과 | 직접 Markdown → component prop → repeater item prop 클릭 뒤 `data-document-edit-active` 1개, 구조 선택 0개 |
| UF-02 | 통과 | `-` 뒤 Space에서 `- `로 전환, 둘째 항목은 Tab 한 번에 `    - `로 중첩되고 Shift+Tab 뒤 최종 source가 기대값과 일치 |
| UF-02A | 통과 | Space keydown 3회 뒤 저장 source와 Preview text가 모두 `앞   뒤`와 일치 |
| UF-02B | 통과 | 둘째 항목 Tab 뒤 source는 `- 첫째\n    - 둘째\n- h\n# 아래 제목`, DOM의 최상위 항목 2개와 다음 `h1` 유지 |
| UF-02C | 통과 | 빈 2단계 불릿의 Tab 뒤 source는 8칸 들여쓰기이며 활성 fragment에는 빈 list item만, 다음 fragment에는 기존 `h1`만 유지 |
| UF-03 | 통과 | strong 생성, undo 시 해제, redo 시 복원. 빈 caret 단축키 source는 `**단축키**`, paste source는 escaped literal 유지 |
| UF-04 | 통과 | instance prop만 `컴포넌트 시작\n\n- 컴포넌트 항목`으로 변경되고 기본값·직접 node는 불변 |
| UF-05 | 통과 | 항목 A만 `- [x] 확인 항목`으로 변경되고 항목 B·기본값은 불변 |
| UF-06 | 통과 | 두 번째 이후 pagination fragment 입력이 canonical source에 정확히 한 번 반영되고 활성 편집 target은 1개 |
| UF-07 | 통과 | CDP IME composition `ㅎ` → `한` 뒤 `한글 입력` 확정값만 source에 한 번 저장 |
| UF-08 | 통과 | 앱 종료·동일 userData 재실행 뒤 heading, strong, checked task가 유지되고 초기 활성 편집 target은 0개 |
| UF-09 | 통과 | print DOM의 제목·component·task·한글과 checked 상태 확인, 편집 UI 미포함 확인, 실제 `%PDF-` 파일 생성 및 1KB 초과 확인 |

실행 명령과 결과: `npm run build && npx playwright test e2e/markdown-user-flow.spec.ts` — 1개 통과. `-`는 Playwright keyboard로 입력하고 Space·Tab은 활성 contenteditable의 제품 keydown handler에 Playwright가 직접 전달했다. 테스트 window는 `DOCUMENT_E2E_HEADLESS=1`로 표시하지 않았으며 OS native 입력과 native 저장창을 사용하지 않았다.

## 테스트 산출물 처리

임시 userData와 PDF는 각 Playwright 실행의 `finally`에서 해당 `mkdtemp` 경로만 제거한다. 실패 screenshot·trace는 `client/test-results/`에 생성되며 검토 후 저장소에 추가하지 않는다.
