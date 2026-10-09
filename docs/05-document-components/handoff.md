# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 계약·전환 정책 확정
- 현재 단계: 2. 범용 document core 구현
- 작업 트리: 작업 문서 변경
- 기준 커밋: `c59f33b refactor: rename app branding to document`
- 커밋 정책: 각 계획 단계 완료 후 검증·문서 갱신과 함께 커밋

## 완료된 작업

- 현재 저장 계약, editor, renderer, repository와 목록의 domain 결합 지점을 조사했다.
- 특정 문서 목적을 모르는 `DocumentData`, node·component·style·asset 계약을 확정했다.
- category 전용 schema를 제거하고 root node tree와 repeater 조합으로 설계했다.
- 오른쪽 DOM 문서를 주 편집 화면으로, 왼쪽을 node tree와 inspector로 정의했다.
- Canvas가 아닌 DOM flow, 문서 내부 component와 개인 library 독립 복사 정책을 확정했다.
- 앱 내부 legacy importer, 최소 layout, prop archive, Markdown 색상 범위와 library 저장 기준을 확정했다.
- 기존 앱을 유지한 채 새 core·renderer·editor를 병렬 구축한 뒤 8단계에서 전환하는 9단계 계획을 작성했다.

## 변경 파일

- `docs/README.md`
- `docs/05-document-components/README.md`
- `docs/05-document-components/design.md`
- `docs/05-document-components/ux.md`
- `docs/05-document-components/plan.md`
- `docs/05-document-components/handoff.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| 작업 문서 간 제품 원칙·용어 비교 | 완료 |
| 목적별 target schema·starter 잔존 검색 | 완료 |
| `git diff --check`와 문서 공백 검사 | 통과 |

## 다음 작업

목적과 무관한 빈 root fixture부터 작성하고 `schemaVersion: 3` model, strict validator와 불변 transaction을 구현한다. 완료 후 전체 typecheck와 build를 통과시키고 2단계 문서 상태를 갱신해 별도 커밋한다.
