# F05. 테스트 TS 전환과 검사 범위 구현 설계

2026-11-08 · 설계 확정·구현 대기 · As-Is 코드 `989a7f6`

[기능 기획](../features/05-typescript-tests.md) · [설계 요약](README.md) · [정책](policy.md) · [계획](../plan.md) · [테스트 계획·결과](../tests/05-typescript-tests.md)

## 1. 목표와 현재 구조

**unit·fixture를 TS로 전환하고 E2E까지 실행과 정적 검사를 분리한다.**

- 관련 인수 조건: F05-AC1·F05-AC2, 공통 AC01·AC05.
- [package.json](../../../client/package.json)은 unit .mjs를 Node runner로 실행한다.
- [playwright.config.ts](../../../client/playwright.config.ts)와 e2e는 현재 제품 typecheck include 밖이다.
- F01의 명령과 F02의 project 경계를 재사용하고 실제 테스트 파일 목록을 연결한다.

## 2. 변경 파일·방식

**테스트 실행과 타입 검사를 분리하고, 전체 검사가 둘 다 빠뜨리지 않도록 구성한다.**

- `test/**/*.test.mjs`와 테스트 fixture를 `.ts`로 바꾸고 내부 import 및 package scripts를 갱신한다.
- 잘못된 입력을 의도한 테스트는 유효 타입으로 위장하지 말고 해당 호출의 최소 예외를 명시한다.
- E2E의 CDPSession 값·factory 구분, Node union narrowing, HTMLElement narrowing을 실제 타입으로 고친다.
- `findLast`의 lib 선택과 Electron executable path는 실행 런타임·타입 선언을 함께 확인한다.
- 테스트를 위해 build target을 무조건 올리거나 `any`로 되돌리지 않는다.
- 기존 개별 test 명령의 테스트 목록을 보존한다.

| 변경 | 대상 | 결과 |
|---|---|---|
| 이름·타입·import 수정 | client/test의 unit·fixture | 같은 사례를 .ts로 직접 Node 실행 |
| 타입 수정 | client/e2e와 playwright.config.ts | CDPSession·DOM·SDK 계약 오류 해소 |
| config 연결 | tsconfig.test.json·tsconfig.e2e.json·eslint.config.mjs | 실제 파일 전체를 타입 검사·lint에 포함 |
| scripts 연결 | package.json의 test·typecheck:test·lint:test | 실행과 타입 검사 모두 수행 |

### 실행 성공과 정적 검사 성공의 구분

**To-Be에서는 같은 테스트 소스를 타입 검사·lint·runner 실행으로 각각 확인한다.**

```mermaid
flowchart TD
  S[TS unit와 fixture] --> T[tsc test project]
  S --> L[typed lint test scope]
  S --> N[Node test runner]
  E[E2E와 Playwright 설정] --> ET[tsc e2e project]
  E --> L
  E --> P[관련 Playwright 실행]
  T --> G{필수 검사 모두 통과?}
  ET --> G
  L --> G
  N --> G
  P --> G
  G -->|예| OK[결과와 실행 환경 기록]
  G -->|아니오 또는 미실행| FAIL[실패 또는 미검증 기록 후 재개]
```

- 이 그림은 검사 책임과 완료 판단이며 명령의 병렬 실행이나 하나의 npm 명령으로 모두 실행됨을 뜻하지 않는다.
- Node의 타입 제거와 테스트 통과만으로 `tsc`·lint 성공을 대신할 수 없다.
- E2E 실행은 해당 변경에 필요한 범위를 정하고 외부 CLI·계정 조건 때문에 못한 경우 별도로 기록한다.
- 합의한 lint warning은 통과를 막지 않지만 error와 필수 검사의 미실행은 통과로 기록하지 않는다.
- 소스→검사→결과 관계는 이 그림에서 다루며 실제 명령·버전·실행 결과는 [F05 테스트](../tests/05-typescript-tests.md)가 소유한다.

## 3. 계약·전환·검증

- Node type stripping은 타입 검사가 아니므로 tsc 실행을 유지한다.
- O03: module 해석·.ts 확장자·erasable 문법·lib를 실제 설치 런타임에서 확인한다.
- 제품 package의 type 필드를 변경해 Electron 출력 해석을 깨뜨리지 않는다.
- 테스트 fixture는 격리 데이터만 사용하며 실제 userData를 읽거나 수정하지 않는다.
- 의도적인 invalid input은 테스트 지점의 예외이며 전체 test 폴더 제외는 금지한다.
- 대안: runner 교체는 범위와 비용을 늘리므로 현재 Node runner를 유지한다.
- 검증 범위·절차·통과 기준·실행 결과: [대응 테스트 문서](../tests/05-typescript-tests.md).
- 실패 시 확장자·import·config를 같은 단위로 복구하며 사례 자체를 삭제하지 않는다.
- 검사 경로는 위 flowchart로 설명한다. 실행 도구 내부의 호출 순서와 클래스 관계는 선택한 Node runner를 교체하는 설계가 아니므로 상세 범위에서 제외한다.
- 최종 검사 명령 계약은 [F01](01-analysis-tooling.md)을 따른다.
