# Canonical Document migration 기술 설계

## 변경 전 구조

`DocumentData` schemaVersion은 3이다. legacy importer는 `legacy-*` ID를 생성하고, `DocumentRepository.load()`는 최신 파일을 읽은 뒤에도 legacy 원본을 다시 import해 `upgradeLegacyImportedDocument()`를 적용한다. 저장은 파일별 `.backup` 한 개와 `.tmp` → rename 방식이며 active와 trash 문서, document index, component library item과 index가 각각 독립적으로 저장된다.

실제 사용자 workspace에는 활성 v3 문서 2개가 있다. 하나는 조사한 내부 entity ID 전체가 legacy identity이고, 다른 하나는 legacy와 canonical identity가 섞여 있다. 현재 trash와 component library item은 비어 있지만 migration 구현과 테스트 범위에는 모두 포함한다.

## 변경 구조

```text
초기화
├─ 저장 문서 schema 조사
├─ v3가 있을 때만 legacy 원본 후보 조사
├─ active와 trash: v3 → 시각 보강 → canonical rekey → v4 validation
├─ component library: 이전 version → canonical package → 최신 validation
├─ 기존 파일 .backup
└─ 최신 파일 원자적 저장

일반 load
└─ 최신 파일 읽기 → 최신 schema validation → 반환
```

## 데이터 흐름

v3 문서는 먼저 schemaVersion을 제외한 기존 구조를 검증한다. legacy 원본과 document ID가 일치하고 기존 importer 세대의 식별 가능한 시각 구조라면 현재 `upgradeLegacyImportedDocument()`의 보강을 적용한다. 그 결과에서 legacy node, component, style, asset과 repeater item ID를 결정적으로 변환하고 모든 참조를 함께 갱신한다. 최종 v4 validation이 통과한 경우에만 원본을 `.backup`으로 복사하고 새 파일을 원자적으로 저장한다.

결정적 ID는 `documentId 또는 library item ID`, entity kind, 이전 ID와 충돌 재시도 번호를 hash 입력으로 사용한다. 종류별 prefix와 UUID 형식으로 생성하며, 변경하지 않는 canonical ID와 앞서 생성한 ID를 reserved set으로 관리한다. 충돌하면 같은 입력 순서에서 동일한 다음 후보를 선택한다.

## 사용자 흐름

앱 시작 → 필요한 파일만 한 번 migration → 문서 목록과 문서 열기 → 자동 저장 → 앱 재실행 → legacy 원본 접근 없이 동일한 문서와 PDF 확인

## 영향받는 코드

| 영역 | 파일 또는 모듈 | 변경 책임 |
|---|---|---|
| document model | `client/src/foundation/documentModel.ts` | schemaVersion 4 계약 |
| validation | `client/src/foundation/documentValidation.ts` | 최신 canonical validation과 v3 migration 입력 검증 |
| migration | `client/src/main/document/documentMigration.ts` | 결정적 rekey와 참조 변환 |
| repository | `client/src/main/document/documentRepository.ts` | 초기 one-way migration, backup과 최신-only load |
| legacy boundary | `client/src/main/document/legacy/importLegacyDocument.ts` | canonical v4 ingestion과 migration 전용 호환 import |
| visual upgrade | `client/src/main/document/legacy/upgradeLegacyImportedDocument.ts` | load-time이 아닌 v3 migration 단계에서만 적용 |
| component library | `client/src/foundation/componentLibrary.ts`, `client/src/main/document/componentLibraryRepository.ts` | package migration과 최신-only load |
| tests | `client/test/*.test.mjs` | canonical 결과, idempotency, 복구와 의미 보존 검증 |

## 저장과 복구

별도 `pre-v4` snapshot은 만들지 않는다. 사용자가 승인한 단일 사용자 환경 전제에서 기존 파일별 `.backup`을 사용한다. migration 계산과 최신 validation이 모두 끝날 때까지 파일을 변경하지 않으며, 정상 v3 원본을 `.backup`으로 복사한 뒤 `.tmp` 파일을 rename한다. 현재 파일이 손상되어 `.backup`에서 읽은 경우 정상 backup을 덮어쓰지 않는다.

여러 파일은 하나의 filesystem transaction으로 묶지 않는다. 중간 중단 시 이미 저장된 파일은 v4로 남고 나머지 v3는 다음 초기화에서 다시 처리한다. 결정적이고 idempotent한 파일별 migration으로 재실행을 복구 경로로 사용한다. legacy 원본 파일은 삭제하거나 이동하지 않는다.

## 오류와 경계 조건

- canonical ID 후보가 기존 ID와 충돌하면 결정적인 다음 후보를 사용한다.
- v3 record key와 내부 ID가 다르거나 참조가 손상된 문서는 저장하지 않는다.
- legacy 원본이 없는 v3 문서는 현재 저장 상태를 rekey할 수 있지만, 원본 비교가 필요한 과거 시각 보강은 재현할 수 없다. 이 경우 데이터를 임의 변경하지 않고 해당 보강만 생략한다.
- 사용자가 기존 style이나 구조를 수정해 시각 보강 대상 signature와 달라진 경우 기존 동작과 같이 보강하지 않고 사용자 상태를 보존한다.
- fallback backup에서 migration한 경우 손상된 현재 파일로 정상 backup을 덮어쓰지 않는다.
- Document ID와 prop ID는 rekey하지 않는다.
- component prop의 image value 내부 `assetId`도 asset map으로 갱신한다.

## 결정과 근거

| 결정 | 근거 | 대안 |
|---|---|---|
| active, trash와 component library를 한 번에 전환 | 최신 runtime의 identity 계약을 저장 영역 전체에서 일관되게 만든다. | active만 먼저 바꾸면 이동·복원·package import 시 legacy identity가 재유입된다. |
| importer는 처음부터 canonical v4 생성 | 새 ingestion이 다시 migration 대상 데이터를 만들지 않는다. | v3 legacy import 후 즉시 rekey는 불필요한 중간 계약을 유지한다. |
| Document ID와 prop ID 유지 | 파일/index identity와 component API identity를 보존한다. | 함께 rekey하면 저장 경로와 instance prop key까지 불필요하게 바뀐다. |
| 기존 `.backup`만 사용 | 현재 단일 사용자 데이터와 사용자가 승인한 복구 수준에 맞춘다. | 별도 `pre-v4` snapshot은 장기 rollback에는 유리하지만 이번 범위에는 과하다. |
| app data directory migration 분리 | 저장 위치 호환성과 문서 schema migration은 실패·rollback 단위가 다르다. | 동시에 바꾸면 원인 분리와 복구가 어려워진다. |

## 검증 전략

먼저 pure migration 테스트로 모든 identity와 참조, 결정성, 충돌 처리와 idempotency를 검증한다. 저장소 테스트에서 active·trash·component package, backup fallback, migration 실패 시 원본 불변과 재실행을 확인한다. importer 테스트는 구체적인 legacy ID 문자열 대신 구조·내용·style 의미와 canonical ID invariant를 검사한다. 이후 typecheck, 전체 테스트와 production build를 실행한다. 실제 사용자 workspace는 임시 복사본에서 migration과 두 번째 실행의 byte-level 불변을 확인한 뒤 Electron에서 문서 열기, 재실행과 PDF 출력을 검증한다.

## 구현 결과

- `DocumentRepository`와 `ComponentLibraryRepository`가 앱 창을 열기 전에 함께 초기화되어 active, trash와 component library migration을 한 번에 시도한다. 파일별 완료 단위와 재실행 복구 방식은 유지한다.
- v3 문서가 이미 있지만 legacy marker가 없는 상태에서도 저장 문서를 먼저 v4로 올린 뒤 과거 ingestion을 수행한다.
- migration 실패 오류에는 대상 파일 경로와 validation 원인이 포함되며, 계산 또는 validation 실패 전에는 파일이나 backup을 변경하지 않는다.
- 과거 원본이 없거나 손상되었거나 사용자가 변경한 graph가 시각 보강 signature와 다른 경우에는 importer 기반 시각 보강을 재현할 수 없다. 이때 현재 v3 내용과 style을 그대로 canonical rekey하며 임의로 덮어쓰지 않는다.
- schemaVersion 2 component package도 저장 입력에 legacy identity가 있으면 즉시 canonicalize해 최신 library에 다시 유입되지 않게 한다.

