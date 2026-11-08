# 정적 분석 정책 전체 기획

2026-11-08 · 정책 확정 · 코드 기준 `989a7f6` · 기능별 적용 진행

[작업 안내](../README.md) · [구현 설계](../implementation/README.md) · [계획](../plan.md) · [인수인계](../handoff.md)

## 1. 문제와 사용자

**현재 타입 검사 통과만으로는 비동기 실패 책임, 테스트의 타입 오류와 실행 환경 경계를 확인할 수 없다.**

- 기존 `npm run typecheck`는 오류 없이 통과했다.
- 검사 범위를 넓히거나 별도 규칙을 적용하면 추가 진단이 발생한다.
- 진단 개수는 실제 버그 개수와 같지 않으며, 적용 전에 정상 동작과 수정 위험을 구분해야 한다.
- 측정 조건과 수치는 [분석 근거](../implementation/audit.md)가 소유한다.

| 사용자 | 필요한 결과 | 이 작업의 책임 |
|---|---|---|
| 개발자 | 수정할 문제와 허용할 패턴을 구분 | 오류·경고·비활성·국소 예외 기준 제공 |
| 리뷰어 | 검사 통과를 위한 동작 훼손 방지 | 실패 책임·상태 소유권·회귀 검증 기준 제공 |
| 문서 편집 사용자 | 초안과 조합 중 입력 보존 | 기존 편집·저장 계약 유지 |

## 2. 기능과 흐름

**서로 다른 변경·검증 단위를 7개 기능으로 나누고 같은 번호·파일명의 구현 설계·테스트 문서와 연결한다.**

| 기능 | 정책·공통 AC | 기능 기획 | 구현 설계 | 테스트 |
|---|---|---|---|---|
| F01 검사 기반과 오류·경고 운영 | O01 도구 호환성, AC03·AC04 | [01-analysis-tooling](01-analysis-tooling.md) | [대응 설계](../implementation/01-analysis-tooling.md) | [계획·결과](../tests/01-analysis-tooling.md) |
| F02 실행 환경과 레이어 경계 | D04, O02, AC01·AC02 | [02-runtime-boundaries](02-runtime-boundaries.md) | [대응 설계](../implementation/02-runtime-boundaries.md) | [계획·결과](../tests/02-runtime-boundaries.md) |
| F03 Promise 완료와 실패 책임 | D01, AC02·AC03 | [03-promise-ownership](03-promise-ownership.md) | [대응 설계](../implementation/03-promise-ownership.md) | [계획·결과](../tests/03-promise-ownership.md) |
| F04 타입 안전성과 제어 흐름 | D02·D03·D07–D12, 추가 TS 규칙, AC02·AC03 | [04-type-safety](04-type-safety.md) | [대응 설계](../implementation/04-type-safety.md) | [계획·결과](../tests/04-type-safety.md) |
| F05 테스트 TS 전환과 검사 범위 | D05, O03, AC01·AC05 | [05-typescript-tests](05-typescript-tests.md) | [대응 설계](../implementation/05-typescript-tests.md) | [계획·결과](../tests/05-typescript-tests.md) |
| F06 React 규칙과 편집·초안 보존 | D06, O04, AC06·AC07 | [06-react-behavior](06-react-behavior.md) | [대응 설계](../implementation/06-react-behavior.md) | [계획·결과](../tests/06-react-behavior.md) |
| F07 접근성과 Fast Refresh 검사 | 추가 접근성·Refresh 정책, AC03·AC04·AC07 | [07-accessibility-refresh](07-accessibility-refresh.md) | [대응 설계](../implementation/07-accessibility-refresh.md) | [계획·결과](../tests/07-accessibility-refresh.md) |

1. 개발자가 제품 코드 또는 테스트를 수정한다.
2. 실행 환경별 타입 검사와 파일 범위별 lint를 실행한다.
3. 오류가 있으면 계약을 유지하는 수정 또는 사유가 있는 최소 예외를 적용한다.
4. 경고는 노출하고 검토하되, 합의한 경고만으로 검사를 실패시키지 않는다.
5. 영향을 받는 동작과 제품 필수 검사를 통과한 뒤 구현 완료로 판단한다.

## 3. 범위와 보존할 동작

**검사 범위에 제품·테스트·도구 설정을 포함하며, 엄격함 자체를 목표로 삼지 않는다.**

- 포함: TypeScript 옵션, 환경별 프로젝트, typed lint, import 경계, 테스트의 TS 전환.
- 포함: Promise·외부 입력·미사용 코드·React·기본 접근성·Fast Refresh 기준.
- 포함: 분석에서 재현한 권한 초안 동기화 문제의 후속 수정.
- 보존: 저장 성공 확인, 실패 시 초안 유지, editor 수명, IME DOM 소유권, 입력 buffer와 pagination.
- 제외: 전역 `exactOptionalPropertyTypes`, 선언 파일 전체 검사 강화, 스타일 선호 강제.
- 제외: 테스트 프레임워크 교체, 문서 schema 변경, 사용자 데이터 migration.
- 이번 요청 범위: 브랜치를 만들고 docs 작성까지 진행한다.
- 정책 상세와 예외의 단일 원본은 [policy.md](../implementation/policy.md)다.

## 4. 대안과 선택

| 대안 | 장점 | 비용·판단 |
|---|---|---|
| 현재 검사만 유지 | 즉시 수정 비용 없음 | 검사 밖의 테스트·환경 경계가 남아 채택하지 않음 |
| 모든 엄격 옵션·규칙 일괄 오류화 | 설정이 단순함 | 정상 패턴 변경과 편집 회귀 위험이 커 채택하지 않음 |
| 계약별 오류·경고·예외 적용 | 실제 책임에 맞게 검토 가능 | 예외 사유와 경고를 관리하는 비용을 감수하고 채택 |

## 5. 공통 인수 조건

기능별 Given/When/Then 조건은 위 번호별 기획 문서가 소유하며, 아래는 전체 결과의 추적 기준이다.

| ID | 관찰할 결과 | 확인 방법 |
|---|---|---|
| AC01 | 제품·unit·E2E·설정 파일이 지정 검사에 포함됨 | 파일 목록과 각 프로젝트의 실제 포함 범위 확인 |
| AC02 | 처리되지 않은 Promise·환경 위반·필수 타입 오류가 차단됨 | 정상·위반 최소 fixture와 실제 소스 검사 |
| AC03 | 의도한 예외는 사유가 있고 불필요한 disable은 실패함 | ESLint 유효 설정과 예외 검토 |
| AC04 | 경고는 보이며 오류만 검사 실패를 유발함 | 오류·경고 각각의 종료 코드 확인 |
| AC05 | unit 테스트가 TS로 실행되고 별도 타입 검사됨 | Node runner·타입 검사·lint 모두 통과 |
| AC06 | 권한 초안은 편집 중 보존되고 clean 전환 시 최신 원격값에 맞춰짐 | dirty·원격 갱신·수동 복원·저장 실패·접근 해제 검증 |
| AC07 | lint 수정 후 IME·선택·초안·저장·pagination 계약이 유지됨 | [React 회귀 항목](../implementation/06-react-behavior.md) 검증 |

**문서 완료와 제품 적용 완료는 별도로 판단한다.**

- 문서 완료: 정책 누락 없이 코드 근거·설계·계획을 연결하고 문서 검사를 통과한다.
- 제품 완료: 위 AC와 [계획의 필수 검사](../plan.md)를 통과하고 실제 결과를 기록한다.
