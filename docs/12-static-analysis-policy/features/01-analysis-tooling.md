# F01. 검사 기반과 오류·경고 운영

2026-11-08 · 기획 확정 · 구현·검증 완료 · 코드 기준 `989a7f6`

[기능 목록](README.md) · [대응 구현 설계](../implementation/01-analysis-tooling.md) · [계획](../plan.md) · [테스트 계획·결과](../tests/01-analysis-tooling.md)

## 1. 문제와 사용자

**도구와 검사 명령이 없어 합의한 규칙을 반복 실행할 수 없다.**

- 목표: 개발자가 검사 결과의 오류·경고·예외를 구분하고 같은 명령으로 확인한다.
- 사용자: 제품·테스트를 수정하는 개발자와 리뷰어, 해당 동작을 사용하는 문서 편집 사용자.

## 2. 사용 흐름과 요구

**수정 후 검사를 실행하고 동작 계약까지 확인한다.**

1. 개발자가 수정한 파일 범위의 검사 명령을 실행한다.
2. 설정은 해당 파일의 타입 정보를 읽고 오류·경고를 출력한다.
3. 개발자는 종료 코드로 실패 여부를 확인하고 예외 사유를 검토한다.

- 지원되는 Node·TS·ESLint·plugin 조합을 선택한다.
- 생성물만 제외하고 제품·테스트·설정의 검사 소유자를 명시한다.
- 규칙별 예외에는 사유와 최소 위치를 남긴다.

## 3. 범위·대안·의존성

- 정책 추적: O01 도구 호환성, AC03·AC04; 정확한 설정값은 [공통 정책](../implementation/policy.md)이 소유한다.
- 선행 기능: 없음.
- 제외: 다른 기능의 규칙 수정과 사용자 데이터·schema migration.
- 선택 이유: 기존 검사만 유지하면 비용은 적지만 정책이 자동화되지 않는다. 도구 기반을 먼저 두고 규칙은 각 기능에서 적용한다.
- 실패 시: 기존 저장·편집 계약을 유지하고 이 기능의 수정 범위에서 재검토한다.

## 4. 인수 조건

| ID | Given — 전제 | When — 행동 | Then — 관찰 결과 |
|---|---|---|---|
| F01-AC1 | 정상 소스와 지원 도구 조합 | 범위별 lint와 typecheck 실행 | 누락 없이 종료 상태와 진단을 표시한다 |
| F01-AC2 | warning-only·error-only·미사용 disable fixture | lint 실행 | 경고만 있으면 성공하고 오류와 미사용 disable은 실패한다 |

- 영향 파일은 [구현 설계](../implementation/01-analysis-tooling.md), 테스트 절차·통과 기준·실행 결과는 [테스트 문서](../tests/01-analysis-tooling.md)가 소유한다.
- 기능 상태·커밋은 [계획](../plan.md), 결과 요약·재개 지점은 [인수인계](../handoff.md)에 기록한다.

## 적용 결과

ESLint 10.14.0·typescript-eslint 8.72.1·TypeScript 5.9.3·Node 26.7.0에서 기반 검사를 확인했다. `lint:app`은 src와 Vite 설정, `lint:tools`는 scripts와 ESLint 설정을 검사한다. `check`는 기존 typecheck와 두 lint 범위를 실행한다. 테스트 project·lint는 F05, 환경 분리는 F02, TS recommended 규칙 활성화는 F04에서 연결한다.

ESLint 9 설치 때 지원 종료 경고가 발생해 10으로 재선정했다. React·jsx-a11y의 현재 peer 범위는 9까지이므로 설치를 보류하고 F06·F07에서 호환 대안을 검증한다. [ESLint 지원 정책](https://eslint.org/version-support/)·[typescript-eslint 지원 범위](https://typescript-eslint.io/users/dependency-versions/)와 npm peer 정보를 확인했다.
