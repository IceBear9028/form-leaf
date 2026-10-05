# 미리보기 Markdown 직접 편집 세션 인수인계

## 현재 상태

- 상태: 1차 구현 완료, 사용자 검증 대기
- 구현: source range 편집·선택 toolbar·페이지 선택 복원 연결 완료
- 선행 작업: `01`의 Markdown v2 저장·렌더링·스타일 레지스트리 구현 완료
- 기준 커밋: `66b24f5 feat: migrate resume content to markdown`

## 사용자 요구

- 텍스트를 오른쪽 preview에서도 편집할 수 있어야 한다.
- preview에서 텍스트를 드래그하면 스타일을 변경할 수 있어야 한다.
- 스타일 변경 범위는 Markdown 본문으로 제한한다.

## 이번 문서에서 정한 1차 범위

- 직접 편집 대상은 `bodyMarkdown`을 가진 본문이다.
- 정형 필드는 기존 왼쪽 편집기에서 유지한다.
- 선택 서식은 굵게·기울임·밑줄·취소선·인라인 코드·링크다.
- 하나의 Markdown 원문과 하나의 최상위 블록 안의 선택만 지원한다.
- DOM을 Markdown으로 직렬화하지 않고 source range 트랜잭션으로 원문을 수정한다.
- 한글 IME, 선택 복원과 페이지네이션 이동을 필수 검증 범위로 둔다.

## 중요한 기술 결정

1. 저장 원본은 계속 `bodyMarkdown` 하나다.
2. remark/mdast의 source position을 렌더링 DOM까지 전달한다.
3. 브라우저 Selection을 Markdown source range로 변환한다.
4. 모든 변경은 `{ sourceId, revision, range, replacement }` 트랜잭션으로 적용한다.
5. 왼쪽 입력과 오른쪽 preview는 동일한 문서 갱신 함수를 사용한다.
6. 편집 UI는 인쇄와 PDF에서 제거한다.

## 구현 결과

- `shared/markdown.ts`: 이스케이프·entity·`++밑줄++`을 고려한 텍스트/source 경계 생성
- `shared/markdownEdits.ts`: 텍스트 치환, 인라인 서식 토글, 링크 적용·수정·제거 순수 함수
- `MarkdownContent.tsx`: Markdown 블록 하나를 단일 편집 host로 사용하고, 인라인 노드는 source metadata만 제공
- `MarkdownContent.tsx`: native `beforeinput`, 한글 조합 수명 주기와 줄바꿈 source anchor 처리
- `MarkdownContent.tsx`: 공백이 섞인 블록 사이 빈 줄을 leading source anchor로 렌더링하고, IME 확정 시 caret placeholder 제거
- `MarkdownContent.tsx`: 문단·인라인 wrapper의 outer source range를 노출해 부모 DOM 경계 caret 처리
- `shared/markdown.ts`: soft break 생성 시 분리된 text·break 노드의 source position 보존
- `ResumePreview.tsx`: 안정적인 section/item source ID, grapheme 삭제, 문서 갱신과 재페이지네이션 후 선택 복원
- `ResumePreview.tsx`: 연속 타이핑 병합 기반 undo/redo history와 Enter 문단 생성 처리
- `ResumePreview.tsx`: Enter 후 단일 collapsed caret을 새 블록 시작에 복원하고, 현재 unit을 보이는 page slot에 즉시 반영해 비동기 페이지 측정 중의 오래된 DOM 제거
- `ResumePreview.tsx`: Enter는 `\n\n`으로 블록을 분리하고 Shift+Enter는 `<br>`로 현재 블록 내부 강제 줄바꿈 처리
- `ResumePreview.tsx`: 블록 분리 직후 기존 page slot에 없던 신규 unit도 즉시 렌더링해 새 블록으로 caret 복원
- `MarkdownContent.tsx`: 허용된 `<br>`만 source-mapped 편집 줄바꿈으로 렌더링하고 Backspace로 문법 전체 삭제
- `MarkdownContent.tsx`: Enter가 만든 줄바꿈 두 개마다 기존 host 밖에 독립적인 `.markdown-empty-block-host` `contentEditable` 형제를 합성해 실제 포커스 분리
- `ResumePreview.tsx`: 삭제 후 정확한 DOM boundary가 없는 trailing space·marker offset을 가장 가까운 이전 화면 경계로 보정
- `MarkdownContent.tsx`: 빈 제목·굵게·밑줄·취소선 marker를 편집 가능한 빈 서식 anchor로 표시
- `MarkdownContent.tsx`: parser가 생략한 문장 끝 공백을 실제 폭과 source boundary를 가진 편집 segment로 표시
- `ResumePreview.tsx`: 서식 마지막에서 입력한 공백을 닫는 marker 바깥 source offset에 삽입
- `MarkdownSelectionToolbar.tsx`: 굵게·기울임·밑줄·취소선·코드·링크 도구와 단축키 연결
- `resume.css`: 편집 focus와 toolbar UI, 인쇄 제외 규칙

검증 결과:

- `npm test`: Markdown 13개, migration 3개, style 2개 통과
- `npm run build`: 타입 검사와 Electron production build 통과
- 실행 DOM: 보이는 preview에만 편집 segment가 생성되고 측정 DOM에는 생성되지 않음
- 같은 편집 그룹의 드래그 선택에서 6개 toolbar 버튼 표시 확인
- 실제 Electron 입력에서 일반 문자 입력·삭제 후 포커스와 원문 복구 확인
- Enter·Backspace 블록 분리·병합 왕복과 연속 신규 블록 작성 확인
- 한글 조합 중 원문 불변, 조합 완료 후 1회 반영과 undo 복구 확인
- 900자 입력으로 7→8페이지 재배치 중 포커스 유지, undo 후 7페이지·원문 복구 확인
- 굵게 적용 후 선택 유지와 undo/redo 왕복 확인
- 현재 문서의 편집 가능 블록 97개 전체에서 Space 입력·포커스 유지·undo 복구 통과
- 기존 줄바꿈 anchor 10곳의 Space 입력과 포커스 유지 확인
- 문단 끝 Enter에서 신규 블록이 생성되고 즉시 `다음` 입력이 새 블록에 반영되는 것 확인
- 문장 중간과 목록 항목 Enter에서도 collapsed caret이 해당 편집 그룹의 왼쪽에 놓이고 즉시 한글 입력되는 것 확인
- 실제 `출퇴근 데이터 모델링 개선을 통한 데이터 가공작업 최소화 및 공통 데이터 기반 구축` 제목 뒤에서 Backspace로 `\n` 하나가 삭제되고 커서가 제목 끝으로 합쳐지는 것 확인
- 같은 위치의 `Enter → Backspace` 왕복 후 원문이 byte 단위로 동일하고 제로폭 문자가 저장되지 않는 것 확인
- 실제 제목에서 연속 Backspace 15회 동안 매번 caret이 남은 텍스트 끝에 유지되고 source가 한 글자씩만 감소하는 것 확인
- 제목의 마지막 글자 삭제 후 빈 H3 유지 및 재입력, 빈 `strong`·`u` anchor에서 재입력 후 효과 유지 확인
- 블록 첫 콘텐츠가 H3 또는 strong인 실제 위치에서 Backspace 후 Markdown 원문 불변 확인
- 실제 H3 끝에서 Space 입력 후 trailing source map과 caret이 한 칸씩 증가하고, 이어서 한글 입력 후에도 커서가 유지되는 것 확인
- 실제 strong 마지막에서 Space가 `**...** ` 형태로 marker 바깥에 삽입되고 Backspace로 원문이 정확히 복원되는 것 확인
- 실제 문단·H3 중간에서 Enter 후 `\n\n새블록` 생성, 편집 unit 1개 증가와 포커스 유지 확인
- 실제 문단·H3에서 Shift+Enter 후 `<br>`가 같은 블록의 시각적 줄바꿈으로 표시되고 즉시 한글 입력되는 것 확인
- `<br>` 직후 Backspace로 강제 줄바꿈 문법 전체가 삭제되고 원문이 정확히 복원되는 것 확인
- 문단·H3 마지막에서 Shift+Enter 직후, 글자를 입력하기 전에도 caret의 Y 좌표가 다음 줄로 내려가고 X 좌표가 블록 왼쪽에 놓이는 것 확인
- Shift+Enter 직후 한글 composition을 확정했을 때 source와 화면에 글자가 각각 한 번만 남고 caret placeholder가 제로폭 문자로 복원되는 것 확인
- H3 마지막에서 Enter 직후 글자 입력 전부터 선택이 독립 `.markdown-empty-block`에 놓이고, 연속 Enter마다 서로 다른 빈 블록과 source `\n\n` 쌍이 하나씩 증가하는 것 확인
- 신규 빈 블록에서 Backspace 시 `\n\n` 쌍이 제거되어 원문이 byte 단위로 복원되고 caret이 직전 H3 끝으로 돌아가는 것 확인
- Enter 전후 `document.activeElement`가 서로 다른 편집 host이고, 신규 host가 기존 host의 자식이 아닌 DOM 형제이며 연속 Enter마다 새 host로 포커스가 이동하는 것 확인
- Cmd+Backspace에서 브라우저 `lineboundary`로 source range를 계산해 Shift+Enter 줄의 60자와 자동 줄바꿈된 마지막 줄의 5자만 각각 삭제되고 나머지 블록·문서·포커스가 유지되는 것 확인

## 후속 확인 사항

- 실제 한글 IME 입력과 긴 본문에서 커서·페이지 이동을 사용자 검증한다.
- 링크 URL 입력을 현재 dialog에서 toolbar popover로 바꿀지 결정한다.
- 왼쪽 textarea 편집과 프리뷰 history를 하나의 전역 history로 통합할지 결정한다.
- 목록의 들여쓰기·내어쓰기와 빈 목록 항목에서 Enter 처리 규칙을 후속으로 구체화한다.
- 지원하지 않는 블록에 읽기 전용 안내를 표시할지 결정한다.

표·코드 블록·인라인 코드·이미지·HTML·각주는 1차 구현에서 읽기 전용이다.

## 관련 문서

- [기능 범위](README.md)
- [구현 계획](plan.md)
- [기술 설계](design.md)
- [편집 사용성 계약](editing-ux.md)
- [01 Markdown 규칙](../01-resume-feature-improvement/markdown-spec.md)
