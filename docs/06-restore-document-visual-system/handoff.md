# 범용 문서 시각 시스템 복구 세션 인수인계

## 현재 상태

- 상태: 시각 회귀 기준과 복구 계약 확정 완료
- 현재 단계: 2. A4 surface·Markdown·페이지 footer 복구
- 작업 트리: 단계 1 문서 커밋
- 마지막 커밋: `ba1fe33 refactor: remove legacy document runtime`

## 완료된 작업

- 작업 전 기준을 `c59f33b`로 확정했다.
- 삭제된 331줄 page/Markdown CSS와 style preset·registry·zoom 경로를 확인했다.
- 과거 목적별 runtime을 복원하지 않고 generic CSS와 embedded style 값으로 이전하는 방향을 정했다.

## 변경 파일

- `docs/06-restore-document-visual-system/README.md`
- `docs/06-restore-document-visual-system/plan.md`
- `docs/06-restore-document-visual-system/design.md`
- `docs/06-restore-document-visual-system/handoff.md`
- `docs/README.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `git show c59f33b:.../resumeDocument.css` | 작업 전 page·Markdown 스타일 수치 확인 |
| `git show c59f33b:.../style/presets.ts` | reference·compact preset 값 확인 |
| reference PDF 경로 | 파일 존재 확인 |

## 남은 작업

- 단계 2 A4 surface·Markdown·page footer 구현

## 미결정 사항과 위험

- 이미 범용 파일로 변환된 legacy 문서의 사용자 편집을 자동 style migration이 덮어쓰면 안 된다.
- 과거 목적별 grid를 그대로 복구하지 않고도 reference 수준의 hierarchy를 generic layout으로 표현해야 한다.

## 다음 세션의 첫 작업

작업 전 CSS에서 목적 중립적인 page·Markdown 규칙만 추출해 `document.css`로 옮기고, `PaginatedDocumentRenderer`에 page content와 footer를 추가한다.
