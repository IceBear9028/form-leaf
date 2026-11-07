# 확정 정책과 예외 기준

2026-11-08 · 사용자와 합의 완료 · 설정 적용 전

[설계](README.md) · [측정 근거](audit.md) · [React 검토](06-react-behavior.md)

## 기능별 적용 소유자

| 기능 | 적용하는 정책 |
|---|---|
| [F01 검사 기반](01-analysis-tooling.md) | 지원 버전·severity·예외·unused disable·검사 명령 |
| [F02 환경 경계](02-runtime-boundaries.md) | D04 |
| [F03 Promise](03-promise-ownership.md) | D01 |
| [F04 타입 안전성](04-type-safety.md) | D02·D03·D07–D12와 추가 TS·일반 lint 규칙 |
| [F05 테스트](05-typescript-tests.md) | D05 |
| [F06 React](06-react-behavior.md) | D06 |
| [F07 접근성·Refresh](07-accessibility-refresh.md) | 추가 접근성·Fast Refresh 규칙 |

## 1. 개별 합의한 12개 결정

**D01–D12는 대화에서 순서대로 확정한 항목이며, 진단을 없애기 위해 계약을 바꾸지 않는다.**

| ID | 대상 | 확정 방향 |
|---|---|---|
| D01 | Promise | typed lint로 `no-floating-promises` 오류, `ignoreVoid: false`; `no-misused-promises` 오류 |
| D02 | 인덱스 접근 | `noUncheckedIndexedAccess: true` |
| D03 | 선택 속성 | `exactOptionalPropertyTypes` 전역 비활성 유지 |
| D04 | 실행 환경·레이어 | 환경별 tsconfig와 ESLint import 제한 |
| D05 | 테스트 | unit·fixture를 `.ts`로 전환, Node runner 유지, unit·E2E 타입 검사와 lint |
| D06 | React | 핵심 오류 규칙 적용, `refs`·`set-state-in-effect`는 초기 경고 |
| D07 | any·외부 입력 | `no-explicit-any`와 recommended의 `no-unsafe-*` 오류 |
| D08 | 미사용 값 | import·일반 지역 변수 오류, 필요한 위치 인자와 rest 제외 패턴 허용 |
| D09 | 반환 경로 | `noImplicitReturns: true` |
| D10 | 선언 파일 | `skipLibCheck: true` 유지 |
| D11 | 부수 효과 import | `noUncheckedSideEffectImports: true`, renderer CSS 선언 추가 |
| D12 | switch | `noFallthroughCasesInSwitch: true` |

### D01. Promise의 완료와 실패 책임

**`void`는 반환값을 버릴 뿐 완료 대기나 rejection 처리를 하지 않는다.**

- 함수 계약과 호출 문맥을 함께 보고 분리 실행을 판단한다.
- 후속 동작이 완료·성공 여부에 의존하면 `await`하고 필요한 결과를 확인한다.
- 저장 후 닫기처럼 순서가 필요한 곳에 `.catch()`만 붙이는 것은 해결이 아니다.
- 완료·결과가 불필요하고 실패 처리를 함수 내부 등에서 확실히 소유하는 호출만 최소 범위 예외를 검토한다.
- 모든 `void` 호출을 안전하다고 허용하거나, 빈 catch로 오류를 삼키지 않는다.
- 모든 호출에 기계적으로 `await`를 추가해 UI 동작을 바꾸지 않는다.

근거: [no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/), [no-misused-promises](https://typescript-eslint.io/rules/no-misused-promises/).

### D02–D03. 부재 값과 선택 속성

**인덱스의 부재는 처리하되, 모든 선택 속성에서 생략과 명시적 undefined를 강제로 구분하지 않는다.**

- 배열·map 조회 결과가 없을 수 있으면 정상 분기로 처리한다.
- 존재가 불변식이면 공통 `requireNode` 형태의 조회·검사 함수에서 명확하게 실패시킨다.
- `!`와 cast를 대량 추가해 진단을 우회하지 않는다.
- 전역 D03 비활성이므로 `?` 속성은 생략과 명시적 `undefined`를 계속 허용한다.
- JavaScript는 `Object.hasOwn`, `Object.keys`, spread로 두 상태를 구분할 수 있다.
- JSON 직렬화는 객체의 undefined 속성을 생략하므로 삭제·미변경 의미는 해당 API 계약에서 정한다.
- `exactOptionalPropertyTypes`는 TS 옵션이며 ESLint 파일 override로 켜고 끌 수 없다.
- 필요하면 별도 TS 프로젝트를 검토하되, import된 소스도 검사에 들어온다는 점을 고려한다.

근거: [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html), [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html).

### D04–D05. 환경과 테스트

**실행 환경의 타입과 import 방향을 별도로 검사한다.**

- main은 Node/Electron, preload는 제한된 bridge, renderer는 DOM/React, foundation은 환경 독립 계약을 담당한다.
- tsconfig의 include 분리만으로 다른 레이어 import를 차단할 수 없으므로 lint를 함께 둔다.
- renderer의 app은 pages를 조립하고, pages는 app을, shared는 pages·app을 import하지 않는다.
- unit 테스트·fixture는 `.ts`로 통일하고 E2E·Playwright 설정도 검사한다.
- Node의 TS 실행은 타입 제거일 뿐 타입 검사가 아니므로 `tsc --noEmit`을 별도로 유지한다.
- 직접 Node 실행 경로에는 erasable TS 문법을 사용하고 실제 런타임에서 해석할 수 있는 import를 쓴다.
- `scripts/run-app.mjs`의 TS 전환은 필수가 아니며 JS lint 범위에는 포함한다.
- mock·의도적인 잘못된 입력은 최소 예외를 허용하지만 테스트 폴더 전체를 제외하지 않는다.

근거: [Node TypeScript](https://nodejs.org/api/typescript.html), [Node test runner](https://nodejs.org/api/test.html), [ESLint 파일별 설정](https://eslint.org/docs/latest/use/configure/configuration-files).

### D06. React

| 수준 | 규칙 |
|---|---|
| error | `react-hooks/rules-of-hooks`, `exhaustive-deps`, `set-state-in-render`, `immutability`, `purity`, `globals`, `static-components` |
| error | `react/jsx-key`, `react/jsx-no-duplicate-props`, `react/no-unknown-property` |
| warn | `react-hooks/refs`, `react-hooks/set-state-in-effect` |

**의존성은 사용하는 값의 실제 수명에 맞추고 editor 수명과 UI 갱신을 혼동하지 않는다.**

- `session`·`library` 객체 전체를 의존성에 기계적으로 추가하지 않는다.
- 안정적인 `setSelection`, `saveUntilClean`, `updateDocument`, `load` 멤버를 분리해 사용한다.
- callback 최신값 보관 방식의 변경과 pending 입력 보호 장치 제거를 함께 하지 않는다.
- drag 이벤트 중 DOM 스타일 변경은 props/state 변이와 구분해 국소 예외를 검토한다.
- 경고를 오류로 올리는 시점은 관련 동작 검증과 정상 패턴 정리 후 별도 판단한다.
- 구체적인 수정 경계는 [React 분석과 설계](06-react-behavior.md)가 소유한다.

근거: [React Hooks lint](https://react.dev/reference/eslint-plugin-react-hooks), [refs](https://react.dev/reference/eslint-plugin-react-hooks/lints/refs), [예측 가능한 ref 초기화](https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents).

### D07–D08. 값의 타입과 미사용 코드

**외부 입력은 경계에서 좁히고, 의도적인 제외와 불필요한 코드를 구분한다.**

- JSON·IPC·SDK에서 온 검증되지 않은 값은 `unknown`에서 시작해 런타임 검사한다.
- 이미 검증된 내부 데이터까지 매번 재검사하지 않는다.
- `as SomeType`은 런타임 검증을 대신하지 않는다.
- 미사용 검사의 주체는 `@typescript-eslint/no-unused-vars`로 둔다.
- 필요한 callback 위치 인자에는 `argsIgnorePattern: "^_"`를 적용한다.
- rest 결과를 쓰는 속성 제외 destructuring은 `ignoreRestSiblings: true`로 허용한다.
- 일반 지역 변수에는 포괄적인 underscore 예외를 주지 않는다.
- 필요 없는 인자는 제거하며 compiler의 중복 미사용 옵션은 별도로 강화하지 않는다.

### D09–D12. 제어 흐름과 선언

**반환·fallthrough·import의 의도를 명확히 하되 정상적인 부재 반환과 선언 파일 정책을 유지한다.**

- 정상적인 미지원·부재 결과는 계약에 맞게 `return undefined` 또는 `return null`을 명시한다.
- 미지원 operation의 정상 sentinel 반환을 lint 때문에 throw로 바꾸지 않는다.
- `skipLibCheck`는 `.d.ts` 내부 검사에 적용되며 로컬 선언도 영향을 받는다.
- 우리 소스에서 라이브러리 API를 사용하는 타입 검사는 계속 수행한다.
- CSS wildcard 선언은 import 타입을 인정할 뿐 파일 실존을 보장하지 않으므로 build에서 경로를 검증한다.
- 내용이 없는 switch case의 묶음은 허용하며, 내용이 있는 case는 적절히 종료한다.

근거: [skipLibCheck](https://www.typescriptlang.org/tsconfig/skipLibCheck.html).

## 2. 나머지 위임 항목의 확정 결과

| 대상 | 정책 | 이유·예외 |
|---|---|---|
| `noImplicitOverride` | true | 상속 멤버 재정의 의도 표시 |
| `verbatimModuleSyntax` | true | 타입·값 import 구분; 환경 분리 후 module 설정과 재검증 |
| `allowUnreachableCode` | 미지정/default | 아래 실제 finally 진단의 의미 미확정 |
| `no-unreachable`, `no-unused-labels` | error | 도달 불가 코드·미사용 label 검사 |
| `no-unnecessary-type-assertion` | error | 불필요한 assertion 제거 |
| `no-redundant-type-constituents` | error | 중복 union 정리 |
| `no-base-to-string` | error | 의도하지 않은 기본 객체 문자열화 방지 |
| `unbound-method` | error | 메서드 전달 시 this 계약 보존 |
| `only-throw-error` | error | 새 오류는 Error로 표현, 전달하는 원본·cause 보존 |
| `require-await` | off | await 없는 async도 Promise·rejection 계약에 필요할 수 있음 |
| `no-control-regex` | error | 입력 검증을 위한 제어 문자 거부식만 국소 예외 검토 |

- 위 타입 기반 단축 규칙명은 모두 `@typescript-eslint/` 접두사다.
- `allowUnusedLabels` compiler 옵션은 별도로 강화하지 않는다.
- `renderService.ts`의 finally 진단 2건을 실제 dead code나 입증된 compiler 오탐으로 단정하지 않는다.
- 단순 try/catch/never/finally 예제에서는 같은 진단이 재현되지 않았으며 cleanup 삭제 근거가 아니다.
- `require-await`를 맞추려고 가짜 await를 넣거나 async를 제거하지 않는다.

근거: [allowUnreachableCode](https://www.typescriptlang.org/tsconfig/allowUnreachableCode.html), [require-await](https://typescript-eslint.io/rules/require-await/), [only-throw-error](https://typescript-eslint.io/rules/only-throw-error/).

### 접근성과 Fast Refresh

| 수준 | 규칙 |
|---|---|
| error | `jsx-a11y/alt-text`, `label-has-associated-control`, `aria-props`, `aria-proptypes`, `role-has-required-aria-props` |
| warn | `jsx-a11y/click-events-have-key-events`, `interactive-supports-focus`, `no-static-element-interactions`, `no-autofocus` |
| warn | `react-refresh/only-export-components`, Vite에 맞게 `allowConstantExport: true` |

- 표의 접근성 단축 이름은 모두 `jsx-a11y/` 접두사다.
- custom component mapping과 wrapper의 실제 label 연결을 확인한 뒤 수정·예외를 결정한다.
- 정적 진단을 모두 실제 접근성 결함으로 단정하지 않는다.
- prop 정렬·포맷·인라인 화살표 일괄 금지 등 스타일 선호는 이 작업에서 강제하지 않는다.
- TS 컴포넌트에 prop-types를 요구하거나 automatic JSX에서 불필요한 React import를 요구하지 않는다.

근거: [React plugin](https://github.com/jsx-eslint/eslint-plugin-react), [jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y), [React Refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh).

## 3. 설정과 예외 관리

**오류는 필수 검사를 실패시키고, 합의한 경고는 보이게 유지한다.**

- JS recommended와 TS recommendedTypeChecked를 기반으로 위 정책을 명시적으로 override한다.
- React·접근성 plugin의 추천 preset 전체를 무조건 오류로 확장하지 않는다.
- `--max-warnings 0`으로 합의한 warn까지 일괄 차단하지 않는다.
- 사용하지 않는 disable directive는 error로 보고한다.
- 예외에는 규칙명·구체적인 사유·최소 위치를 적는다.
- 빈 catch, 무조건 cast, 전체 테스트 제외처럼 문제를 숨기는 예외는 허용하지 않는다.
- 새 plugin 버전에서 규칙이 추가되면 유효 설정을 확인하고 정책과 차이를 기록한다.
- 분석용 버전은 측정 재현 정보이며 제품에 설치할 버전 확정이 아니다.

근거: [typescript-eslint 설정](https://typescript-eslint.io/users/configs/).
