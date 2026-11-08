# F05. 테스트 TS 전환과 검사 범위

2026-11-08 · 기획 확정 · 구현·검증 완료 · 코드 기준 `989a7f6`

[기능 목록](README.md) · [대응 구현 설계](../implementation/05-typescript-tests.md) · [계획](../plan.md) · [테스트 계획·결과](../tests/05-typescript-tests.md)

## 1. 문제와 사용자

**unit .mjs와 E2E가 기존 제품 타입 검사 밖에 있다.**

- 목표: 개발자가 테스트를 TS로 작성하고 실행·타입 검사·lint 결과를 함께 확인한다.
- 사용자: 제품·테스트를 수정하는 개발자와 리뷰어, 해당 동작을 사용하는 문서 편집 사용자.

## 2. 사용 흐름과 요구

**수정 후 검사를 실행하고 동작 계약까지 확인한다.**

1. 개발자가 TS unit 또는 E2E 사례와 fixture를 수정한다.
2. 테스트 실행과 별도 타입 검사·lint를 수행한다.
3. 실행 성공만으로 완료하지 않고 타입 오류와 의도한 예외까지 확인한다.

- Node built-in runner를 유지한다.
- E2E·Playwright 설정과 fixture를 검사 대상에 포함한다.
- scripts/run-app.mjs의 TS 전환은 요구하지 않고 JS lint를 적용한다.

## 3. 범위·대안·의존성

- 정책 추적: D05, O03, AC01·AC05; 정확한 설정값은 [공통 정책](../implementation/policy.md)이 소유한다.
- 선행 기능: F04.
- 제외: 다른 기능의 규칙 수정과 사용자 데이터·schema migration.
- 선택 이유: 테스트 제외는 편하지만 타입 계약의 오류를 남긴다. runner 교체 없이 TS 실행과 타입 검사를 분리한다.
- 실패 시: 기존 저장·편집 계약을 유지하고 이 기능의 수정 범위에서 재검토한다.

## 4. 인수 조건

| ID | Given — 전제 | When — 행동 | Then — 관찰 결과 |
|---|---|---|---|
| F05-AC1 | 기존 unit·fixture 목록 | TS 전환 후 개별·전체 테스트 실행 | 기존 사례와 runner 의미를 유지한다 |
| F05-AC2 | unit·E2E·Playwright 설정의 타입 오류 | 전용 타입 검사와 lint 실행 | 오류를 잡고 의도적 잘못된 입력은 국소 예외만 허용한다 |

- 영향 파일은 [구현 설계](../implementation/05-typescript-tests.md), 테스트 절차·통과 기준·실행 결과는 [테스트 문서](../tests/05-typescript-tests.md)가 소유한다.
- 기능 상태·커밋은 [계획](../plan.md), 결과 요약·재개 지점은 [인수인계](../handoff.md)에 기록한다.

## 적용 결과

unit 30파일과 fixture를 TS로 전환하고 기존 사례 159개의 이름·순서를 보존했다. Node runner·개별 script 목록은 유지한다. test/e2e project는 ES2023 lib·DOM/Node 타입·erasableSyntaxOnly를 적용하며 제품 target은 유지한다. typed lint는 두 project와 Playwright 설정을 포함한다. fixture의 필수 값·node 종류·MCP 응답은 실제 검사 helper로 좁히고 의도적인 invalid input에만 사유 있는 국소 예외를 둔다. Node test 등록 Promise는 top-level await로 처리한다. Electron executable의 런타임 문자열 반환을 별도 adapter에서 확인한다.
