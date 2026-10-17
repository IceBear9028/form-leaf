# Engineering Backlog

현재 문제는 확인했지만 아직 구현하지 않은 구조 개선 작업을 관리한다.

## 운영 규칙

- 새로 확인한 구조적 문제는 독립된 Markdown 문서로 기록한다.
- 아래 표의 체크박스는 구현, 데이터 migration, 테스트와 실제 앱 검증까지 끝난 경우에만 완료 처리한다.
- 부분 구현이나 설계 문서 작성만으로 완료 표시하지 않는다.
- 작업을 시작할 때 해당 문서의 결정 사항과 완료 조건을 먼저 확정한다.
- 완료된 항목은 문서를 삭제하지 않고 결과와 관련 커밋을 남긴다.
- 미완료 항목은 등록 시간이 빠른 순서대로 표 위쪽에 둔다.
- 완료한 항목은 `☐`를 `☑`로 바꾸고 모든 미완료 항목 아래로 이동한다.
- 완료 항목끼리는 완료 시간이 빠른 순서대로 정렬한다.

## Backlog items

| 완료 | 등록일 | 항목 | 요약 | 완료일 |
|---|---|---|---|---|
| ☐ | 2026-10-17 | [Document-owned Markdown styles](document-owned-markdown-styles.md) | Markdown의 시각값을 전역 `document.css`가 아니라 Document 데이터가 소유하도록 변경한다. | — |
| ☐ | 2026-10-18 | [App data directory migration](app-data-directory-migration.md) | `Resume Studio`에 고정된 Electron userData 위치를 제품 이름과 일치시키되 기존 데이터를 안전하게 이관한다. | — |
| ☐ | 2026-10-18 | [Preview Markdown authoring experience](preview-markdown-authoring-experience.md) | Preview에서 Markdown 문법 입력, 목록 연속 작성과 블록 전환을 일반 문서 편집기처럼 사용할 수 있게 한다. | — |
| ☑ | 2026-10-17 | [Canonical Document migration](canonical-document-migration.md) | 최신 문서에서 legacy identity와 load-time legacy 원본 의존성을 제거한다. | 2026-10-18 |
