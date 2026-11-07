# 정적 분석 구현 설계 요약

2026-11-08 · 설계 확정·구현 대기 · As-Is 코드 `989a7f6`

[전체 기획](../features/README.md) · [실행 계획](../plan.md) · [현재 상태](../handoff.md)

## 1. 목표와 구조

**기능별로 코드·검증·커밋 경계를 나누고 편집·저장 계약을 유지한다.**

- 이 README는 기술 요약과 목차이며 상세 변경은 같은 번호의 구현 설계가, 테스트 절차·실행 결과는 tests가 소유한다.
- `policy.md`는 기능들이 공유하는 확정 규칙·예외, `audit.md`는 기존 측정 근거의 단일 원본이다.
- React 재현과 후보 설계는 F06 문서에 함께 보존한다.
- 모든 To-Be는 미구현이며 이번 요청은 문서 구조 수정이다.

| 영역 | As-Is | To-Be | 상세 |
|---|---|---|---|
| 검사 도구 | 제품 typecheck, lint 없음 | 지원 도구·파일별 lint·severity 계약 | F01 |
| 환경 경계 | 혼합 DOM/Node와 main→renderer import | 환경별 project·공통 파서·import 제한 | F02 |
| 비동기 호출 | void 호출의 책임 검토 필요 | 완료·결과·실패 소유자별 수정 | F03 |
| 타입·제어 흐름 | 부재·외부 입력·반환의 추가 진단 | 검사·narrowing·명시적 반환 | F04 |
| 테스트 | .mjs unit, E2E 검사 범위 누락 | TS unit·fixture와 별도 검사 | F05 |
| React | 핵심 진단·권한 동기화 문제 | 핵심 오류 수정·편집 수명 보존 | F06 |
| 접근성·Refresh | 별도 검사 없음 | 확정한 오류·경고와 wrapper 검토 | F07 |

## 2. 기능별 설계 목록

| 기능 | 구현 설계 | 대응 기획 | 선행 기능 | 테스트 |
|---|---|---|---|---|
| F01 | [검사 기반과 오류·경고 운영](01-analysis-tooling.md) | [기획](../features/01-analysis-tooling.md) | 없음 | [계획·결과](../tests/01-analysis-tooling.md) |
| F02 | [실행 환경과 레이어 경계](02-runtime-boundaries.md) | [기획](../features/02-runtime-boundaries.md) | F01 | [계획·결과](../tests/02-runtime-boundaries.md) |
| F03 | [Promise 완료와 실패 책임](03-promise-ownership.md) | [기획](../features/03-promise-ownership.md) | F02 | [계획·결과](../tests/03-promise-ownership.md) |
| F04 | [타입 안전성과 제어 흐름](04-type-safety.md) | [기획](../features/04-type-safety.md) | F03 | [계획·결과](../tests/04-type-safety.md) |
| F05 | [테스트 TS 전환과 검사 범위](05-typescript-tests.md) | [기획](../features/05-typescript-tests.md) | F04 | [계획·결과](../tests/05-typescript-tests.md) |
| F06 | [React 규칙과 편집·초안 보존](06-react-behavior.md) | [기획](../features/06-react-behavior.md) | F05 | [계획·결과](../tests/06-react-behavior.md) |
| F07 | [접근성과 Fast Refresh 검사](07-accessibility-refresh.md) | [기획](../features/07-accessibility-refresh.md) | F06 | [계획·결과](../tests/07-accessibility-refresh.md) |

- 표 순서대로 구현·검증·문서 갱신·기능별 커밋을 마친 뒤 다음 기능에 착수한다.
- package/config를 여러 기능이 수정하므로 F01에서 기반만 만들고 규칙은 해당 기능에서 활성화한다.
- config의 제품 환경은 F02, 일반 엄격 옵션은 F04, 테스트 연결은 F05가 소유한다.
- 최종 명령 계약은 F01이 소유하며 각 기능이 자기 검사 범위를 연결한다.
- 세부 도식은 해당 기능 문서에 두고 이 목차에 복제하지 않는다.

## 3. 공통 결정과 미확정 검증

| ID | 내용 | 소유 기능·통과 기준 |
|---|---|---|
| O01 | 지원되는 도구 조합 | F01: install·peer 호환·typed lint 실행 |
| O02 | import 우회와 환경 유입 | F02: 상대·alias·동적 import fixture와 단독 project 검사 |
| O03 | 직접 TS 테스트 실행 | F05: module·extension·erasable 문법과 unit 전체 실행 |
| O04 | 편집 동작 보존 | F06: R01–R05·native IME 확인 범위 기록 |

- 허용 수준은 [정책](policy.md)에서 확정했으며 위 항목은 구현 검증이다.
- 사용자 데이터·schema·저장 commit 경계는 유지한다.
- 실패하면 해당 기능에서 재개하고 다음 기능 완료로 진행하지 않는다.
- 필수 제품 검사와 최종 파일 누락 검증은 [계획](../plan.md), 상세 결과는 [테스트](../tests/README.md), 요약은 [인수인계](../handoff.md)에 기록한다.
