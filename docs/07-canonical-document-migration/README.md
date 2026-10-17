# 07. Canonical Document migration

## 상태

완료

## 문제

과거 v1/v2 문서는 범용 `DocumentData`로 import된 뒤에도 node, component, style, asset과 repeater item에 `legacy-*` identity를 유지한다. 또한 일반 문서 load가 과거 원본을 다시 찾아 최신 importer 결과와 비교·보강하므로 최신 저장 데이터가 과거 입력 파일에 의존한다.

## 사용자 경험

사용자는 과거 문서를 처음 열거나 앱을 처음 시작할 때 한 번만 최신 schema로 변환한다. 변환된 문서는 이후 과거 원본 없이 같은 내용과 시각 결과로 열리고 저장되며 PDF로 출력된다. migration 실패 시 기존 `.backup`에서 복구할 수 있고 과거 원본 파일은 삭제하지 않는다.

## 목표

- schemaVersion 4를 도입하고 v3 문서를 명시적인 one-way migration으로 변환한다.
- 최신 문서와 component library package의 내부 identity에서 `legacy-*`를 제거한다.
- 일반 load 경로에서 legacy 원본 탐색과 `upgradeLegacyVisuals()`를 제거한다.
- 과거 v1/v2 ingestion이 처음부터 canonical v4 문서를 생성하게 한다.
- 내용, component props, 순서, visibility, render tree 의미와 PDF 출력을 보존한다.

## 포함 범위

- active와 trash의 모든 v3 문서
- component library item과 package
- node, component, style, asset, repeater item ID 및 모든 관련 참조
- 기존 load-time 시각 보강의 one-way migration 이전
- 기존 `.backup`과 원자적 저장을 이용한 실패 복구
- 실제 사용자 데이터 migration, 재실행, 재오픈과 PDF 검증

## 제외 범위

- Document ID 변경
- component prop ID 변경
- Electron app data directory 이름 변경
- pagination의 `layout-placeholder:*`와 Markdown fragment selection 문제
- document-owned Markdown style 전환
- 과거 사용자 데이터와 legacy 원본 삭제
- 별도 `pre-v4` snapshot 또는 장기 backup 체계 도입

## 완료 조건

- [x] schemaVersion 4와 v3 → v4 migration chain이 정의된다.
- [x] 결정적 ID 생성이 기존 canonical ID와 충돌하지 않도록 검사된다.
- [x] active, trash와 component library package의 legacy 내부 ID가 canonical ID로 변환된다.
- [x] 모든 참조와 내용, component props, 순서와 visibility가 보존된다.
- [x] 보존 가능한 기존 시각 보강이 one-way migration에 포함된다.
- [x] 시각 보강을 재현할 수 없는 조건이 문서화되고 기존 데이터는 손상 없이 유지된다.
- [x] migration 전 정상 파일이 기존 `.backup`으로 보존되고 결과가 원자적으로 저장된다.
- [x] migration 실패와 손상 파일 fallback 테스트가 통과한다.
- [x] 일반 load가 legacy 원본 경로와 `upgradeLegacyVisuals()`를 사용하지 않는다.
- [x] migration을 반복해도 결과가 바뀌지 않는다.
- [x] typecheck, 전체 테스트, production build가 통과한다.
- [x] 실제 과거 사용자 데이터의 migration, 재실행, 재오픈과 PDF 결과를 Electron에서 확인한다.
- [x] backlog에 완료 결과와 app data directory 후속 과제가 기록된다.

## 완료 결과

- 실제 사용자 workspace의 별도 복사본에서 활성 v3 문서 2개를 v4로 변환했다. 내부 legacy identity 246개가 0개가 되었고 각 문서의 v3 원본이 `.backup`으로 남았다.
- 비어 있는 component library도 index schemaVersion 1에서 2로 앱 시작 시 함께 전환했다. item이 있는 경우의 package rekey는 repository 테스트로 검증했다.
- migration 전 load-time 시각 보강 결과와 v4 render tree를 identity만 정규화해 비교했고 두 문서가 일치했다.
- Electron production build에서 두 문서를 8페이지와 3페이지로 열었다. 실제 PDF 버튼으로 각각 같은 페이지 수의 PDF를 생성했고 첫 문서 PDF를 시각 확인했다.
- 앱 재시작 뒤 v4 문서들의 aggregate hash가 동일했고 다시 연 문서도 8페이지였다.
- 검증은 실제 데이터의 임시 복사본에서 수행했으며 원래 사용자 workspace와 legacy 원본은 변경하거나 삭제하지 않았다.

## 관련 문서

- [구현 계획](plan.md)
- [기술 설계](design.md)
- [세션 인수인계](handoff.md)
- [원본 backlog](../backlog/canonical-document-migration.md)

