# Canonical Document migration 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 검증 |
|---|---|---|---|
| 1 | schema v4와 결정적 rekey migration 구현 | 완료 | migration 단위 테스트 통과 |
| 2 | document repository의 one-way migration과 load 분리 | 완료 | active·trash·backup·재실행 테스트 통과 |
| 3 | legacy importer와 component library canonical 전환 | 완료 | importer·component package 테스트 통과 |
| 4 | load-time 시각 보강 제거와 회귀 검증 | 완료 | renderer 의미·전체 테스트·build 통과 |
| 5 | 실제 사용자 데이터와 Electron/PDF 검증 | 완료 | 실제 복사본 migration·reopen·8/3페이지 PDF 확인 |
| 6 | 문서와 backlog 완료 처리 | 완료 | diff·handoff 검토 완료 |

상태는 `대기`, `진행 중`, `완료`, `차단` 중 하나만 사용한다. 동시에 하나의 단계만 `진행 중`으로 둔다.

## 구현 순서

### 1. schema v4와 결정적 rekey migration 구현

- v3 raw JSON을 최신 구조와 분리해 판별한다.
- `documentId + entity kind + 이전 ID`를 입력으로 결정적 UUID를 생성한다.
- node, component, style, asset과 repeater item을 rekey하고 모든 참조를 갱신한다.
- 기존 canonical ID와 생성 ID의 충돌을 검사하고 결정적인 재시도로 해소한다.
- prop ID와 Document ID는 유지한다.

### 2. document repository의 one-way migration과 load 분리

- 초기화 시 active와 trash의 v3 파일만 migration한다.
- 필요한 v3 문서에 한해 legacy 원본을 찾아 마지막 시각 보강을 먼저 적용한다.
- 최신 validation이 성공한 뒤 기존 `.backup`을 만들고 원자적으로 v4를 저장한다.
- migration이 끝난 일반 `load()`는 v4 읽기와 validation만 수행한다.

### 3. legacy importer와 component library canonical 전환

- v1/v2 importer의 공개 결과가 처음부터 canonical v4가 되게 한다.
- 기존 v3 시각 보강에만 필요한 legacy-ID import는 migration 내부 경계로 격리한다.
- component library index, item과 package를 최신 version으로 올리고 내부 참조를 함께 rekey한다.

### 4. load-time 시각 보강 제거와 회귀 검증

- `upgradeLegacyVisuals()`를 normal load에서 제거한다.
- legacy identity를 전제로 한 테스트를 canonical 결과와 의미 보존 기준으로 바꾼다.
- 손상 파일, fallback, 부분 완료 후 재실행과 idempotency를 검증한다.

### 5. 실제 사용자 데이터와 Electron/PDF 검증

- 실제 workspace를 별도 임시 복사본에서 먼저 migration한다.
- backup, schema, legacy ID 부재와 두 번째 실행 시 불변을 확인한다.
- Electron에서 문서를 열고 재실행한 뒤 PDF를 출력해 기존 결과와 비교한다.
- 검증된 뒤 실제 workspace migration을 수행한다.

### 6. 문서와 backlog 완료 처리

- 구현 근거와 실제 검증 결과를 문서에 반영한다.
- canonical migration backlog를 완료 처리하고 app data directory migration을 후속 과제로 기록한다.
- 커밋하지 않은 worktree 상태로 handoff한다.

## 회귀 검증

- [x] migration 및 저장소 관련 targeted test
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Electron 실제 open/migration/reopen/PDF
- [x] `git diff --check`
- [x] 개인정보와 로컬 사용자 데이터가 Git diff에 없는지 확인

