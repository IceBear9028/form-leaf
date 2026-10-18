# Preview Markdown 작성 사용성 세션 인수인계

## 현재 상태

- 상태: 실제 Space·Tab 입력 회귀 수정 및 자동 검증 완료, 사용자 실제 앱 확인 대기
- 현재 단계: 7. hidden Playwright 검증 완료, 실제 앱 확인 대기
- 작업 트리: Jira 레퍼런스 backlog 보강과 09 문서가 미커밋 상태
- 마지막 커밋: `7e9d4d9 docs: plan preview markdown authoring`

## 완료된 작업

- `../jira-rea`의 제품 명세, keyboard spec, pipeline, architecture와 evidence를 읽었다.
- Jira의 Markdown 텍스트 작성 경험을 구현 목표로 확정하고 ADF·멘션·서버 기능은 제외했다.
- 현재 editor의 일부 block shortcut, generic Enter, inline toolbar와 source map 구조를 조사했다.
- 09 작업의 범위, 단계, 데이터 경계와 완료 조건을 문서화했다.
- `* `, `2) `와 task item block shortcut을 source input rule에 추가했다.
- 순차 입력 strong·emphasis·delete·link와 literal paste를 구분했다.
- 목록 Enter·빈 목록 종료, 시작 Backspace와 Tab/Shift+Tab source transaction을 추가했다.
- 실제 DOM input, delete와 keydown 경로를 새 source transaction에 연결했다.
- 제목·불릿·번호·작업·인용·구분선·code block input rule과 inline strong·emphasis·delete·code·link 순차 입력을 구현했다.
- 목록 Enter·빈 항목 종료·Tab/Shift+Tab·시작 Backspace와 작업 checkbox 변경을 source transaction으로 구현했다.
- toolbar, Jira keyboard shortcut, native `beforeinput` format intent와 `/` 빠른 삽입이 `MarkdownCommand`를 공유한다.
- `/` 메뉴는 제목 1~3, 글머리·번호·작업 목록, 인용문, 구분선과 코드 블록을 검색·방향키·Enter·Escape로 조작한다.
- Markdown 편집 전용 undo/redo history를 source identity 단위로 공유해 fragment가 바뀌어도 자동 변환을 한 번에 되돌린다.
- pagination으로 Markdown이 여러 render fragment로 바뀔 때 정확한 source offset을 가진 fragment에만 caret을 복원한다.
- inline code와 fenced code block을 source-map 편집 대상으로 확장했다.
- 빈 선택에서 inline shortcut을 켜면 다음 입력부터 서식이 적용되고, 빈 선택 링크는 편집 가능한 기본 label을 만든다.
- Playwright Electron E2E를 추가해 hidden window에서 node·component prop·repeater item prop, pagination, IME, 저장·재열기와 PDF를 한 사용자 흐름으로 검증한다.
- `DOCUMENT_E2E_HEADLESS=1`에서는 app window를 표시하지 않아 테스트가 사용자의 실제 키보드·마우스 focus를 가져가지 않는다.
- PDF E2E는 native 저장창을 자동 조작하지 않고 임시 저장 경로 응답만 대체하며 production `printToPDF` handler를 실행한다.
- 기존 E2E가 `keyboard.insertText()`로 Space keydown을 우회해 실제 회귀를 놓친 원인을 확인했다.
- 일반 Space를 Markdown 편집기의 명시적 keydown command로 연결해 `- ` 블록 전환과 연속 공백 입력을 같은 source transaction으로 처리한다.
- 두 번째 목록 항목의 Tab 들여쓰기와 Shift+Tab 내어쓰기를 hidden Playwright 흐름에 추가했다.
- Tab을 고정 2칸 추가에서 논리적 한 단계 중첩으로 바꿨다. 기본은 4칸이며 긴 번호 목록은 marker 폭에 맞추고, Shift+Tab·빈 항목 Enter·시작 Backspace는 부모 깊이로 한 번에 복귀한다.
- 첫 Tab 뒤 바로 아래 제목이 대신 렌더되던 보고를 `불릿 → 하위 불릿 → 다음 최상위 항목 → 제목` fixture로 고정해, 한 번의 Tab 뒤 하위 불릿과 제목 DOM이 동시에 유지됨을 확인했다.
- 실제 앱 재현을 위해 interaction debug에 `markdown-key`, `markdown-input`, `markdown-transaction`, `markdown-render`를 추가했다. 본문은 기록하지 않고 줄 종류·indent·block type·selection만 terminal로 전달한다.
- 실제 문서 로그에서 빈 2단계 불릿을 Tab으로 3단계로 만들 때 source transaction은 정상인데 `        - `를 remark가 앞 텍스트의 Setext 제목으로 해석하는 것을 확인했다.
- 빈 목록 marker는 파서 입력에서만 placeholder로 명확하게 만든 뒤 AST position을 원본 offset으로 복원한다. 원본·저장 source에는 숨은 문자를 넣지 않는다.
- 편집 fragment가 canonical pagination보다 먼저 새 source를 렌더하는 구간에는 pending range 소유 block을 유지하고, 정확한 fragment 하나만 selection을 복원하게 했다.
- 실제 사용자 문서의 저장 source를 수정하지 않고 구조 정보만 read-only로 대조했으며, 기존 문제 줄이 새 파서에서 빈 3단계 list item으로 해석되고 다음 제목은 별도 block으로 유지됨을 확인했다.

## 변경 파일

- `docs/backlog/README.md`
- `docs/backlog/preview-markdown-authoring-experience.md`
- `docs/README.md`
- `docs/09-preview-markdown-authoring/`
- `client/src/renderer/src/pages/document-editor/markdown/edits.ts`
- `client/src/renderer/src/pages/document-editor/markdown/MarkdownContent.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/EditableMarkdownValue.tsx`
- `client/test/markdown.test.mjs`
- `client/e2e/markdown-user-flow.spec.ts`
- `client/playwright.config.ts`
- `client/.gitignore`
- `client/package.json`
- `client/package-lock.json`
- `client/src/main/index.ts`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| 기존 worktree 확인 | backlog 문서 2개만 미커밋 상태였으며 보존함 |
| Jira reference 조사 | 공식·관찰·설계안 범위 확인 |
| `npm run test:markdown` | 31개 통과: 빈 중첩 불릿의 Setext 제목 오인 회귀 포함 |
| `npm run typecheck` | 통과 |
| `npm test` | 112개 전체 통과 |
| `npm run build` | production build 통과 |
| Electron 순차 입력 | 목록 중첩·해제, `/` H2, `**굵게**`, caret shortcut, task checkbox 통과 |
| Electron composition | `ㅎ` → `한` 조합 후 `한글` 확정이 한 번만 저장됨 |
| undo/redo | 마지막 inline 자동 변환을 원문 상태로 되돌리고 다시 적용함 |
| 저장·재열기 | 임시 userData 재실행 뒤 heading·strong·list 의미 유지 |
| `npm run build && npx playwright test e2e/markdown-user-flow.spec.ts` | hidden Electron 사용자 흐름 1개 통과: Space 불릿 전환, 연속 공백, Tab/Shift+Tab, 빈 중첩 불릿과 다음 제목 보존 포함 |
| Playwright prop target | component instance prop과 repeater A만 변경되고 기본값·repeater B는 불변 |
| Playwright PDF | print DOM 의미·편집 UI 제외·checked 상태 확인, 실제 `%PDF-` 파일 1KB 초과 |

## 남은 작업

- 수정 build의 debug 앱이 실행 중이다. 사용자가 실제 문제 위치에서 빈 중첩 불릿과 Tab/Shift+Tab을 확인한다.
- 확인 뒤 단계 7과 backlog를 완료 처리한다.
- 변경은 아직 커밋하지 않았다. 사용자가 요청할 때만 커밋한다.

## 미결정 사항과 위험

- Jira 공식 기능 중 task item·divider·code block과 `/` 메뉴는 포함하지만 멘션·emoji·image upload는 Markdown 텍스트 범위에서 제외한다.
- table과 image는 이번 Markdown 텍스트 작성 범위에 포함하지 않았다.
- Markdown history는 source identity별 최대 100개 transaction을 보관한다. 앱 전체 document history와의 장기 통합은 별도 개선 여지가 있다.

## 다음 세션의 첫 작업

실제 앱 확인 결과를 반영한 뒤 단계 7과 backlog 상태를 확정하고, 사용자가 요청할 때만 커밋한다.
