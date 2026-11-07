# 테스트 계획과 실행 결과

2026-11-08 · 제품 구현 전 · 기능별 검증 미실행

[작업 안내](../README.md) · [기능 목록](../features/README.md) · [설계 목록](../implementation/README.md) · [계획](../plan.md) · [인수인계](../handoff.md)

## 1. 문서 책임과 목록

**tests/NN-name.md가 같은 번호 기능의 테스트 계획과 실행 결과를 소유한다.**

- 기획의 AC는 요구사항이며 테스트 문서는 그 조건을 재현할 입력·절차·기대 결과를 정의한다.
- 구현 설계는 영향 경계와 검증 이유를 설명하고 상세 시나리오를 이곳에 연결한다.
- plan은 기능의 실행 순서·완료 여부·커밋을 관리하고 handoff는 결과 요약·다음 시작점을 제공한다.
- 이 폴더는 문서이며 실행 테스트 코드는 client/test·client/e2e 등 기존 코드 영역에 둔다.

| 기능 | 테스트 계획·결과 | 관련 문서 |
|---|---|---|
| F01 | [01-analysis-tooling](01-analysis-tooling.md) | [기획](../features/01-analysis-tooling.md) · [설계](../implementation/01-analysis-tooling.md) |
| F02 | [02-runtime-boundaries](02-runtime-boundaries.md) | [기획](../features/02-runtime-boundaries.md) · [설계](../implementation/02-runtime-boundaries.md) |
| F03 | [03-promise-ownership](03-promise-ownership.md) | [기획](../features/03-promise-ownership.md) · [설계](../implementation/03-promise-ownership.md) |
| F04 | [04-type-safety](04-type-safety.md) | [기획](../features/04-type-safety.md) · [설계](../implementation/04-type-safety.md) |
| F05 | [05-typescript-tests](05-typescript-tests.md) | [기획](../features/05-typescript-tests.md) · [설계](../implementation/05-typescript-tests.md) |
| F06 | [06-react-behavior](06-react-behavior.md) | [기획](../features/06-react-behavior.md) · [설계](../implementation/06-react-behavior.md) |
| F07 | [07-accessibility-refresh](07-accessibility-refresh.md) | [기획](../features/07-accessibility-refresh.md) · [설계](../implementation/07-accessibility-refresh.md) |

## 2. 공통 환경과 기록 기준

- 실행 기준은 실제 검증한 commit과 미커밋 변경 범위로 적고 문서 기준 `989a7f6`을 자동으로 재사용하지 않는다.
- Node·npm·TypeScript·ESLint·plugin과 필요 시 Electron·Chrome·OS 버전을 기록한다.
- fixture와 Electron userData는 임시 격리 경로를 사용하고 실제 사용자 문서·토큰을 시험에 사용하지 않는다.
- 외부 CLI·계정이 필요한 E2E는 전제 조건과 실행 여부를 구분한다.
- 상태는 미실행·통과·실패·차단으로 기록하며 기대 결과와 관찰 결과를 섞지 않는다.
- 처음에는 모든 구현 후 테스트가 미실행이고, 기존 분석·격리 후보 시험은 별도 사전 근거다.
- 실패를 고친 뒤 재실행할 때 원래 결과와 대상 코드 차이를 남긴다.

## 3. 공통 검사와 최종 통합

**각 기능은 그 단계에 연결된 검사와 해당 시나리오를 실행하고, F07 완료 전에 전체 범위를 확인한다.**

| ID | 시점·입력 | 실행 방법 | 통과 기준 |
|---|---|---|---|
| G01 | 각 기능 변경 후 | 관련 테스트와 도입된 npm test·typecheck·build·lint | 해당 기능의 회귀와 현재 연결된 검사 통과; 미연결 범위 명시 |
| G02 | F07 완료 전 | effective config·project/lint 파일 목록을 정책과 대조 | 제품·unit·E2E·설정·JS 도구 누락 없음, 최종 규칙·severity 일치 |
| G03 | G02 후 | client에서 npm run check, npm test, npm run build와 관련 회귀 | 모두 통과, warning·예외·수동/외부 연동 한계 기록 |

- F01에서 처음 도입하는 명령은 실제 제공 시점·내용을 기록한다.
- 단계별 G01의 상세 결과는 해당 tests/NN-name.md에 기록한다.
- G02·G03은 여기서 한 번 기록하고 F07·plan·handoff에서 참조한다.

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 다음 행동 |
|---|---|---|---|---|
| G02·G03 | 미실행 | 실행 기록 없음 | 제품 구현 전 | F07 완료 검증 시 수행 |

## 4. 사전 분석과 문서 검사

- [기존 정적 분석](../implementation/audit.md)과 [React 사전 근거](../implementation/06-react-behavior.md)는 당시 조건을 유지하며 구현 후 통과 증거로 사용하지 않는다.
- 이번 문서 작성의 링크·구조·양식 검사는 [handoff](../handoff.md)에 기록한다.
- 문서 검사 통과는 위 제품 시나리오의 통과를 뜻하지 않는다.
