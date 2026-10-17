# Canonical Document migration

## 상태

완료 — 2026-10-18, `docs/07-canonical-document-migration/`

## 문제

과거 v1/v2 문서는 현재 `DocumentData` 구조로 import되지만 결과 ID에 `legacy-*` namespace가 남는다. 일반 문서를 열 때도 `upgradeLegacyVisuals()`가 과거 원본 파일을 다시 검색하고 import 결과와 현재 문서를 비교한다.

따라서 범용 renderer 전환은 완료됐지만 다음 조건은 충족되지 않았다.

- 최신 저장 파일의 canonical identity
- migration 이후 legacy 원본으로부터의 독립
- migration 결과의 즉시 영구 저장
- 일반 load 경로에서 legacy 처리 제거

## 변경 전 동작

```text
앱 초기화
→ legacy v1/v2 원본 검색
→ schemaVersion 3 DocumentData 생성
→ legacy-* ID가 포함된 활성 문서 저장

일반 문서 load
→ 현재 v3 파일 읽기
→ legacy 원본 다시 검색
→ legacy 원본 재-import
→ upgradeLegacyVisuals로 비교·보강
→ 메모리 결과 반환
```

`legacy-*`는 별도 node 타입이 아니며 현재 renderer도 전용 legacy pipeline을 사용하지 않는다. 그러나 과거 import provenance와 복구 전략이 최신 데이터 identity와 load lifecycle에 남아 있다.

## 목표

```text
Raw JSON 읽기
→ schemaVersion 판별
→ 순차 migration
→ 최신 schema validation
→ 기존 파일 backup
→ 최신 파일 원자적 저장
→ 최신 DocumentData 반환
```

migration이 완료된 이후 일반 load는 다음 과정만 수행해야 한다.

```text
최신 파일 읽기
→ 최신 schema validation
→ 반환
```

## Canonical migration 범위

- node ID와 `nodes` record key
- `rootNodeId`
- container `childIds`
- `archivedFrom.parentId`
- component ID와 `components` record key
- component `rootNodeId`
- prop binding `nodeId`
- component instance `componentId`
- repeater `itemComponentId`
- repeater item ID와 `componentId`
- style ID와 `styles` record key
- node `styleId`
- asset ID와 `assets` record key
- image node와 component prop 내부 `assetId`

Document ID는 파일과 library index의 영속 identity이므로 별도 결정 전에는 유지한다. prop ID도 component API이므로 단순 node rekey와 구분한다.

## 설계 시 결정할 사항

- schemaVersion 4 도입과 v3 → v4 migration 진입점
- canonical ID 생성 형식
- migration이 여러 번 실행돼도 결과가 바뀌지 않는 idempotency 보장
- 활성 문서, 휴지통 문서와 component library package의 적용 범위
- migration 실패 시 backup 복원과 library index 처리
- 과거 원본 보존 기간과 위치
- `upgradeLegacyVisuals()`에서 필요한 마지막 시각 보강을 명시적 migration으로 옮기는 방법
- legacy importer가 처음부터 canonical ID를 만들도록 변경하는 시점

## 완료 조건

- [x] schemaVersion 4와 명시적인 migration chain이 정의된다.
- [x] 기존 v3 문서의 모든 참조를 손실 없이 canonical ID로 재키잉한다.
- [x] migration 전에 복구 가능한 backup을 생성한다.
- [x] migration 결과를 검증한 뒤 최신 파일로 원자적 저장한다.
- [x] migration 전후 문서 내용, component prop, 순서와 visibility가 동일하다.
- [x] migration 전후 render tree의 의미와 PDF 결과가 동일하다.
- [x] 최신 활성 문서에 `legacy-*` ID가 남지 않는다.
- [x] 일반 `load()`가 legacy 원본 경로를 읽지 않는다.
- [x] `upgradeLegacyVisuals()`가 일반 load 경로에서 제거된다.
- [x] legacy importer가 canonical ID를 생성한다.
- [x] 새 문서와 migration된 문서가 동일한 renderer·transaction·selection 경로를 사용한다.
- [x] migration을 반복 실행해도 데이터가 다시 변경되지 않는다.
- [x] 손상 파일과 migration 실패 복구 테스트가 통과한다.
- [x] typecheck, 전체 테스트와 production build가 통과한다.
- [x] 실제 사용자 문서의 backup, migration, 재실행과 PDF 출력을 Electron에서 검증한다.

## 완료 결과

- schemaVersion 4, 결정적 충돌 재시도와 전체 내부 참조 rekey를 구현했다.
- active, trash와 component library migration을 앱 시작 시 함께 수행하며 normal load는 최신 validation만 사용한다.
- 실제 사용자 workspace 복사본의 v3 문서 2개에서 legacy internal ID 246개를 제거하고 v3 backup 2개를 보존했다.
- production Electron에서 8페이지와 3페이지 문서를 열고 같은 페이지 수의 PDF를 생성했으며 재시작 후 결과가 불변임을 확인했다.
- 원래 사용자 workspace와 legacy 원본은 변경하거나 삭제하지 않았다.
- 저장 위치 호환성은 [App data directory migration](app-data-directory-migration.md)으로 분리했다.

## 별도 문제

pagination이 생성하는 `layout-placeholder:*`와 Markdown fragment wrapper가 selection에 들어가는 문제는 canonical migration과 별개다. 저장 ID를 변경해도 자동으로 해결되지 않으므로 selection boundary 작업으로 별도 관리해야 한다.
