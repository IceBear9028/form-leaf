# 09. Preview Markdown 작성 사용성

## 상태

구현 및 자동 검증 완료·사용자 실제 앱 확인 대기

## 문제

Preview의 Markdown은 source range 기반 직접 편집과 일부 블록 shortcut을 지원하지만 Jira형 문서 작성 흐름에는 미치지 못한다. 현재 `#`, `-`, `>`, 숫자와 `.` 뒤 Space만 제한적으로 처리하고, 목록 Enter·빈 항목 종료·Tab 들여쓰기·Backspace 구조 해제·순차 입력 인라인 Markdown·Jira 단축키와 빠른 삽입을 하나의 편집 계약으로 제공하지 않는다.

그 결과 사용자는 렌더된 Markdown을 수정할 수는 있어도 새 문서를 연속해서 작성할 때 marker와 블록 경계를 직접 관리해야 한다.

## 사용자 경험

사용자는 Preview의 Markdown을 일반적인 Jira 리치 텍스트 필드처럼 작성한다. 줄 시작에서 `- `, `## ` 또는 `> `를 입력하면 마지막 Space 순간에 구조가 즉시 전환되고 같은 위치에서 입력을 계속한다. 목록에서는 Enter·Tab·Backspace가 목록 구조를 자연스럽게 이어가거나 해제한다. 인라인 Markdown, keyboard shortcut, 선택 toolbar와 `/` 빠른 삽입은 같은 편집 명령과 결과를 사용한다.

## Jira 레퍼런스

기능과 수용 기준은 sibling repository `../jira-rea`의 문서를 기준으로 한다.

- `01-product-spec.md`: 사용자 과업과 P0/P1 기능
- `01a-keyboard-input-spec.md`: 공식 Markdown 문법, 단축키, 입력 이벤트와 수용 테스트
- `02-input-render-pipeline.md`: 마지막 trigger 입력에서 즉시 구조를 바꾸고 caret을 복원하는 흐름
- `03-architecture.md`: 입력 규칙·명령·selection·undo 책임 분리
- `evidence.md`: REA 관찰, Jira 공식 계약과 설계안의 증거 수준

Jira의 ADF나 서버 저장 모델을 복제하지 않는다. Resume Studio는 기존 Markdown source를 canonical 데이터로 유지하고 Jira의 작성 경험을 source transaction으로 구현한다.

## 목표

- Jira 분석 문서의 Markdown 텍스트 입력 문법과 keyboard 작성 경험을 Preview에 제공한다.
- 자동 서식, toolbar와 단축키가 같은 source edit command를 사용하게 한다.
- 모든 구조 전환 뒤 caret, IME, undo/redo와 pagination selection을 안정적으로 유지한다.

## 포함 범위

- 제목 1~6, 불릿·번호 목록, 인용문, 작업 항목, 구분선과 코드 블록 입력 규칙
- 굵게, 기울임, 취소선, 인라인 코드와 링크의 순차 입력 자동 서식
- 목록 Enter·빈 항목 종료·Tab/Shift+Tab·Backspace 구조 해제
- Jira 문서에 정의된 텍스트 서식 keyboard shortcut
- 선택 toolbar와 shortcut의 공통 command
- Markdown 텍스트 블록용 `/` 빠른 삽입
- 순차 입력, 붙여넣기, 한글 IME와 source selection 복원
- node, component prop과 repeater item prop의 동일 동작

## 제외 범위

- Jira ADF 데이터 모델과 Jira 서버 저장·충돌 처리
- 멘션 사용자 검색, 이모지 검색, 파일 업로드와 Jira 전용 entity
- 원격 이미지 업로드·보안 proxy
- Markdown 문서 고유 시각 theme 설계
- component 구조 편집이나 Preview 선택 정책 재설계

## 완료 조건

- [x] `## `, `- `, `* `, `1. `, `2) `와 `> `가 Space 키 명령 순간 즉시 블록으로 전환된다.
- [x] `**굵게**`, `*기울임*`, `~~취소선~~`, 인라인 코드와 링크가 순차 입력 완료 시 즉시 서식으로 보인다.
- [x] 목록 Enter, 빈 항목 종료, Tab/Shift+Tab과 Backspace가 확정된 구조 규칙대로 동작한다.
- [x] 작업 항목, 구분선과 코드 블록 입력 규칙을 지원한다.
- [x] Markdown 문법, keyboard shortcut, toolbar와 `/` 메뉴가 같은 command 결과를 만든다.
- [x] 문장 중간·코드 문맥·미완성 marker와 붙여넣기는 내용을 잘못 자동 변환하지 않는다.
- [x] 한글 IME 조합 중간값을 변환하지 않고 완료 텍스트를 한 번만 반영한다.
- [x] 각 자동 변환은 예측 가능한 한 번의 undo로 되돌아가며 caret도 복원된다.
- [x] node, component prop과 repeater item prop에서 같은 결과를 만든다.
- [x] pagination 이후에도 활성 fragment와 source caret이 하나만 유지된다.
- [x] 저장·재열기와 PDF 출력에서 Markdown 의미와 표시가 유지된다.
- [x] Space 연속 입력을 보존하고 hidden Playwright의 편집기 keydown 경로 회귀 테스트가 통과한다.
- [ ] 관련 테스트, typecheck, 전체 테스트, production build와 실제 앱 검증이 통과한다.

## 관련 문서

- [구현 계획](plan.md)
- [기술 설계](design.md)
- [사용자 흐름 테스트](user-flow-test.md)
- [세션 인수인계](handoff.md)
- [Backlog 원문](../backlog/preview-markdown-authoring-experience.md)
