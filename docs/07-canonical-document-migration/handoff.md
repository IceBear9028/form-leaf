# Canonical Document migration 세션 인수인계

## 현재 상태

- 상태: 구현·검증 완료
- 작업 트리: 커밋하지 않은 변경 유지
- 기준 커밋: `06e2826 chore: add interaction diagnostics and architecture backlog`
- 사용자 요청 전에는 커밋하지 않는다.

## 완료된 작업

- `DocumentData` schemaVersion 4와 v3 → v4 one-way migration을 구현했다.
- document, node, component, style, asset과 repeater item의 legacy identity를 결정적이고 충돌 안전한 ID로 바꾼다. Document ID와 prop ID는 유지한다.
- active, trash와 component library를 앱 시작 시 함께 초기화하고 기존 `.backup`과 원자적 저장으로 변환한다.
- v1/v2 importer의 공개 결과가 처음부터 canonical v4가 되며 legacy-ID import는 v3 시각 보강 내부 경계에만 남는다.
- normal `load()`에서 legacy 원본 재탐색과 load-time 시각 보강을 제거했다.
- 손상된 current에서 v3 backup을 사용하는 경우 정상 backup을 덮어쓰지 않는다.
- migration 실패 메시지에 대상 파일과 validation 원인을 포함한다.
- canonical migration backlog를 완료 처리하고 app data directory migration을 별도 backlog로 등록했다.

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| targeted migration·repository test | 통과 |
| `npm test` | 전체 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | production build 통과 |
| `git diff --check` | 통과 |
| 실제 workspace 복사본 | v3 문서 2개 → v4 2개, legacy internal ID 246개 → 0개, v3 backup 2개 |
| component library | index v1 → v2, item migration은 fixture로 검증 |
| 의미 보존 | migration 전 시각 보강 render tree와 정규화 비교 2/2 일치 |
| Electron open | 두 문서 8페이지·3페이지 |
| Electron PDF | 실제 버튼으로 8페이지·3페이지 PDF 생성, 첫 PDF 시각 확인 |
| 재시작 | aggregate hash 불변, 재오픈 8페이지 |
| 원래 사용자 workspace | 변경하지 않음, v3 원본과 legacy 입력 유지 |

## 복구와 제한

- 별도 `pre-v4` snapshot은 없고 정상 직전본 한 개를 `.backup`으로 유지한다.
- 여러 파일을 묶는 transaction은 없다. 중단 시 완료 파일은 v4, 나머지는 v3로 남으며 다음 초기화가 결정적으로 이어서 처리한다.
- legacy 원본이 없거나 손상되었거나 현재 graph가 과거 importer signature와 달라진 경우 원본 비교 기반 시각 보강은 재현할 수 없다. 현재 저장 내용과 style은 그대로 rekey한다.
- 실제 원래 workspace는 다음 production 앱 실행 시 동일 migration 경로를 거친다. 검증에서는 안전을 위해 실제 데이터 복사본만 변경했다.
- Electron `userData`가 여전히 `Resume Studio` 디렉터리에 고정된 문제는 `docs/backlog/app-data-directory-migration.md`에서 별도로 다룬다.

## 커밋 전 확인

- 사용자의 커밋 요청 여부를 확인한다.
- `git status --short`, `git diff --check`, 개인정보 또는 실제 workspace 파일이 diff에 없는지 다시 확인한다.

