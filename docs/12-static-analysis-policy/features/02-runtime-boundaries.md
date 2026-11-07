# F02. 실행 환경과 레이어 경계

2026-11-08 · 기획 확정 · 구현 대기 · 코드 기준 `989a7f6`

[기능 목록](README.md) · [대응 구현 설계](../implementation/02-runtime-boundaries.md) · [계획](../plan.md) · [테스트 계획·결과](../tests/02-runtime-boundaries.md)

## 1. 문제와 사용자

**DOM·Node 타입이 한 project에 섞이고 main이 renderer 구현에 의존한다.**

- 목표: 개발자가 실행 환경에 맞는 API를 쓰고 공통 계약만 공유한다.
- 사용자: 제품·테스트를 수정하는 개발자와 리뷰어, 해당 동작을 사용하는 문서 편집 사용자.

## 2. 사용 흐름과 요구

**수정 후 검사를 실행하고 동작 계약까지 확인한다.**

1. 개발자가 공통 로직 또는 실행 환경 전용 API를 import한다.
2. 환경별 타입 검사와 import 제한이 허용된 의존 방향인지 검사한다.
3. 위반이면 공통 코드 소유권 또는 호출 경계를 바로잡는다.

- main·preload·renderer·foundation의 검사 환경을 나눈다.
- 상대 경로와 alias 모두 같은 import 경계를 적용한다.
- preload를 통해 Node API 전체를 노출하지 않는다.

## 3. 범위·대안·의존성

- 정책 추적: D04, O02, AC01·AC02; 정확한 설정값은 [공통 정책](../implementation/policy.md)이 소유한다.
- 선행 기능: F01.
- 제외: 다른 기능의 규칙 수정과 사용자 데이터·schema migration.
- 선택 이유: 단일 config는 간단하지만 전역 유입을 놓친다. config 분리와 import 제한을 함께 적용하는 비용을 감수한다.
- 실패 시: 기존 저장·편집 계약을 유지하고 이 기능의 수정 범위에서 재검토한다.

## 4. 인수 조건

| ID | Given — 전제 | When — 행동 | Then — 관찰 결과 |
|---|---|---|---|
| F02-AC1 | renderer 또는 foundation 소스 | 금지된 환경 API·다른 레이어 구현 import | 타입 검사 또는 lint에서 실패한다 |
| F02-AC2 | main과 renderer의 Markdown 읽기 | 공통 파서로 같은 입력 처리 | 기존 호환성·offset·읽기 결과와 Electron 로딩을 보존한다 |

- 영향 파일은 [구현 설계](../implementation/02-runtime-boundaries.md), 테스트 절차·통과 기준·실행 결과는 [테스트 문서](../tests/02-runtime-boundaries.md)가 소유한다.
- 기능 상태·커밋은 [계획](../plan.md), 결과 요약·재개 지점은 [인수인계](../handoff.md)에 기록한다.
