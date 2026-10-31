# 10. Markdown 편집 DOM 단일 소유권

## 상태

제품 Preview 통합·기존 DOM 보정 제거·자동 검증 완료 (2026-10-24)

## 문제

현재 Preview Markdown 편집은 React가 Markdown source를 JSX로 렌더한 DOM에 `contentEditable`을 붙이고, Chromium IME가 같은 하위 DOM을 직접 변경하는 구조다. 입력 결과는 `useBufferedStringEdit()`를 거쳐 `DocumentData`로 반영되고, 이 변경이 render tree와 pagination을 다시 계산해 활성 editable DOM과 selection을 다시 건드린다.

09 작업에서 composition range, final input echo, selection 복원과 pagination fragment 경쟁을 보정했지만, React와 브라우저가 같은 DOM을 서로 다른 시점의 값으로 수정할 수 있다는 근본 조건은 남아 있다. 이 조건에서는 빠른 한글 입력, Space로 조합 확정, 자동 저장이나 페이지 재계산이 겹칠 때 중복 입력과 caret 이동이 다시 발생할 수 있다.

## 사용자 경험

사용자는 Preview에서 Markdown 영역을 클릭해 곧바로 작성한다. 편집 중에는 브라우저와 전용 editor가 현재 editable DOM, IME composition과 내부 text selection을 독점한다. React 문서 렌더링과 자동 저장이 동시에 일어나도 입력 중인 글자와 caret은 움직이지 않는다.

`- `, Enter, Tab, Shift+Tab, Backspace, inline format과 `/` 명령은 editor transaction으로 처리한다. 다른 문서 요소를 클릭하면 현재 transaction을 먼저 확정하고, Markdown 편집 표시를 하나만 해제한 뒤 클릭한 요소 하나를 선택한다. 저장·재열기와 PDF는 기존 Markdown 의미와 출력을 유지한다.

## 목표

- 활성 Markdown editor의 DOM·IME composition·selection 소유자를 하나로 만든다.
- Markdown 문자열을 canonical 저장 형식으로 유지하면서 editor state와 저장 snapshot의 책임을 분리한다.
- 입력 중 DocumentData 갱신, 자동 저장과 pagination이 활성 editor DOM으로 역주입되지 않게 한다.
- 09에서 구현한 Jira형 작성 명령을 editor transaction 위로 이전한다.
- 기존 source-range composition 보정과 React selection 복원 경로를 최종적으로 제거한다.

## 포함 범위

- read-only `MarkdownPreview`와 active `MarkdownEditor` 렌더 경계 분리
- `DocumentEditTarget`별 editor session, dirty state, flush와 종료 계약
- Markdown parse/serialize 또는 source replacement 경계
- 한글 IME, caret, native undo/redo를 editor가 소유하는 입력 흐름
- heading, paragraph, bullet/ordered/task list, blockquote, code, divider, link와 inline format
- node, component prop, repeater item prop의 동일한 편집 session
- Preview 문서 selection과 editor 내부 text selection의 분리
- pagination 중 활성 editor instance 보존과 편집 종료 후 최종 재배치
- 자동 저장, 명시적 저장, 대상 전환과 앱 종료 전 editor flush
- hidden Electron 회귀와 실제 기존 문서 read-only 기반 검증

## 제외 범위

- `DocumentData` schema 변경과 Markdown 이외의 canonical 저장 형식 도입
- 협업 편집, 원격 동기화와 다중 작성자 충돌 해결
- Markdown document-owned theme 재설계
- component definition 구조 편집 정책 변경
- 일반 text와 rich text editor의 동시 전면 교체
- 기존 사용자 문서나 backup의 삭제·재작성

## 완료 조건

- [x] 활성 editable root의 하위 DOM은 editor만 변경하고 React는 session 동안 자식 구조를 reconcile하지 않는다.
- [x] 애플리케이션 코드가 `compositionend.data`를 Markdown 문자열에 직접 합치거나 composition selection을 수동 복원하지 않는다.
- [x] 빠른 한글 입력과 반복 Space에서도 글자 중복, 분리와 caret 후퇴가 발생하지 않는다.
- [x] 이전 입력의 DocumentData publish와 pagination이 다음 composition을 중단하거나 editor instance를 재생성하지 않는다.
- [x] `- ` 자동 목록, 연속 목록 Enter, Tab/Shift+Tab과 Backspace가 editor transaction으로 동작한다.
- [x] 이미 적용된 제목의 첫 글자 앞에서 `# `부터 `###### `를 다시 입력하면 내용은 유지한 채 heading level만 변경된다.
- [x] toolbar, shortcut, `/` 메뉴와 keyboard input rule이 같은 editor command를 사용한다.
- [x] 다른 요소 클릭 시 현재 editor를 동기적으로 flush한 뒤 편집을 종료하고 클릭한 요소 하나만 선택한다.
- [x] node, component prop과 repeater item prop에서 동일한 session lifecycle을 사용한다.
- [x] 저장·재열기와 PDF에서 기존 Markdown 의미·순서·visibility·출력이 보존된다.
- [x] 기존 source-range IME 보정과 pending DOM selection 복원 코드가 제거된다.
- [x] 관련 단위 테스트, hidden Electron E2E, 전체 테스트, typecheck와 production build가 통과한다.
- [x] 실제 기존 문서의 안전한 복사본에서 한글 작성·저장·재열기·PDF를 확인하고 원본 불변을 검증한다.

## 관련 문서

- [구현 계획](plan.md)
- [기술 설계](design.md)
- [세션 인수인계](handoff.md)
- [이전 Preview Markdown 작성 작업](../09-preview-markdown-authoring/README.md)
