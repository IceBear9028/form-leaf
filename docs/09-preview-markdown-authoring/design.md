# Preview Markdown 작성 사용성 기술 설계

## 현재 구조

`EditableMarkdownValue`가 `beforeinput`을 source range edit로 바꾸고 `MarkdownContent`가 source map을 포함한 DOM을 다시 렌더한다. 일반 문자는 Markdown 의미가 생기지 않도록 escape하며 `replaceMarkdownTextWithBlockShortcut()`만 줄 시작의 일부 prefix를 다시 실제 marker로 전환한다.

현재 Enter는 문맥과 관계없이 `\n\n`, Shift+Enter는 `<br>`를 삽입한다. Tab과 구조 Backspace는 없고, inline marker 순차 입력은 일반 문자로 escape된다. toolbar는 선택 range에 marker를 붙이지만 입력 규칙 및 block shortcut과 공통 command abstraction을 사용하지 않는다.

## 변경 구조

```text
DOM input intent
├─ composition 중 → 브라우저 조합 유지
├─ paste/drop → paste policy
├─ key command → MarkdownCommand
└─ text input → context input rule
                 ↓
            MarkdownCommand
                 ↓
      source + selection transaction
                 ↓
    buffered document update + rerender
                 ↓
       source selection restore
```

입력 규칙은 전체 source를 매 키마다 재작성하지 않고 현재 caret 주변 문맥만 해석한다. 렌더러는 계속 remark AST를 사용하지만 편집 결과의 canonical 값은 Markdown source다.

## 데이터 흐름

순차 문자 입력 → 현재 source range 확인 → 일반 문자 삽입 → 마지막 trigger가 Space 또는 closing marker인지 검사 → 해당 문맥의 typed command 생성 → source와 selection을 한 결과로 갱신 → DOM 재렌더 → source offset으로 caret 복원.

붙여넣기는 순차 key rule을 재생하지 않고 plain text를 한 번 삽입한다. 명시적 Markdown paste 변환을 추가하기 전까지 자동 inline/block 변환을 실행하지 않는다.

## 사용자 흐름

사용자가 빈 문단에서 `-`와 Space를 순서대로 입력하면 `-`는 잠시 일반 텍스트이고 Space 순간 bullet list marker로 바뀐다. caret은 빈 첫 항목에 남는다. 내용을 쓰고 Enter를 누르면 같은 indentation의 다음 marker를 만들며, 빈 항목에서 Enter를 누르면 중첩 단계에서는 outdent하고 최상위에서는 목록을 종료한다.

## 영향받는 코드

| 영역 | 파일 또는 모듈 | 변경 책임 |
|---|---|---|
| source command | `markdown/edits.ts` 및 새 command module | block·inline·list source transaction |
| DOM input | `rendering/EditableMarkdownValue.tsx` | input intent 분류와 command 실행 |
| editing host | `markdown/MarkdownContent.tsx` | keydown·composition·paste 우선순위 |
| selection | `markdown/sourceSelection.ts` | 구조 변환 뒤 caret 복원 |
| toolbar/menu | `markdown/MarkdownSelectionToolbar.tsx`, 새 quick insert UI | 동일 command dispatch |
| tests | `client/test/markdown.test.mjs` | Jira 수용 시나리오와 경계 회귀 |

## 저장과 복구

Document schema는 변경하지 않는다. Markdown source 문자열과 기존 direct edit target을 그대로 저장한다. transaction 실패 시 현재 source를 반환하고 DOM 전체를 source로 역직렬화하지 않는다. buffered edit flush와 자동 저장 경로도 유지한다.

## 오류와 경계 조건

- 문장 중간의 marker는 자동 서식으로 바꾸지 않는다.
- 코드 블록과 인라인 코드 안에서는 다른 marker rule을 실행하지 않는다.
- 미완성 marker와 빈 inline content는 원문으로 보존한다.
- IME 조합 중간값과 조합 확정 뒤 중복 input을 한 번만 반영한다.
- 붙여넣기·자동 교정·drop을 순차 keyboard 입력으로 오인하지 않는다.
- 중첩 목록의 첫 항목은 이전 sibling이 없으면 더 들여쓰지 않는다.
- Tab은 source 공백을 고정 2칸씩 더하지 않고 논리적 목록 깊이를 한 단계 이동한다. 기본 중첩 폭은 4칸이며 긴 번호 marker는 CommonMark가 중첩으로 판정하는 데 필요한 marker 폭을 사용한다.
- Shift+Tab, 빈 중첩 항목의 Enter와 목록 시작 Backspace는 현재 공백 일부가 아니라 바로 위 부모 목록 깊이로 한 번에 돌아간다.
- 내용이 없는 중첩 `- `는 CommonMark가 앞 문단의 Setext 제목 underline으로 오인할 수 있다. 파서 입력에만 zero-width placeholder를 넣어 빈 list item AST를 만든 뒤 position을 원본 source offset으로 되돌린다. 저장 source에는 placeholder를 추가하지 않는다.
- pagination으로 현재 block DOM이 교체돼도 source selection이 가장 가까운 다른 fragment로 이동하지 않는다. 편집을 시작한 render fragment가 새 source를 먼저 받는 동안에는 pending source range가 속한 block을 임시로 렌더하고, canonical pagination이 갱신될 때까지 selection 복원 정보를 유지한다.

## 결정과 근거

| 결정 | 근거 | 대안 |
|---|---|---|
| Markdown source를 canonical 데이터로 유지한다. | 기존 저장·renderer·component prop 계약과 원문 보존을 유지한다. | Jira ADF 도입은 schema migration과 제품 범위를 불필요하게 확장한다. |
| input rule과 UI action을 typed command로 통합한다. | Jira reference처럼 문법·단축키·toolbar가 같은 결과를 내야 한다. | 경로별 문자열 조작은 caret과 undo 결과가 달라진다. |
| 변환은 현재 caret 문맥만 처리한다. | 마지막 trigger key에서 즉시 전환하고 긴 문서 전체 재파싱 편집을 피한다. | 매 입력마다 전체 source를 normalize하면 사용자 표기가 바뀔 수 있다. |
| paste는 우선 literal insertion으로 둔다. | Jira REA에서 일괄 입력과 순차 입력 결과가 달랐고 내용 손실 방지가 우선이다. | paste를 key sequence로 재생하면 의도하지 않은 대량 서식이 생긴다. |

## 검증 전략

순수 함수 테스트에서 Jira의 `MD`, `KB`, `IN`, `ED` 수용 시나리오를 Resume Studio source 결과로 변환해 검증한다. 이후 실제 Electron production build에서 신뢰된 key input으로 마지막 trigger 순간의 DOM 구조, active edit fragment, caret source offset과 undo를 확인한다. 기존 사용자 문서는 내용 수정 없이 복사본 또는 안전한 임시 문서로 작성·저장·재열기·PDF를 검증한다.

종단 사용자 흐름은 Playwright의 Electron 지원으로 `DOCUMENT_E2E_HEADLESS=1` window에서 실행한다. 이 모드는 window를 표시하지 않으므로 사용자의 실제 키보드·마우스 focus를 가져가지 않는다. PDF 검증은 native 저장창을 자동 조작하지 않고 테스트 process에서 `dialog.showSaveDialog()` 응답만 임시 경로로 대체한다. renderer의 print snapshot과 실제 `webContents.printToPDF()` handler는 production 경로 그대로 실행한다.
