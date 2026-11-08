# 기존 정적 분석 근거

2026-11-08 · 제품 코드 `989a7f6` · 문서화 전 수행한 분석 결과 인용

[정책](policy.md) · [적용 설계](README.md) · [React 재현 근거](06-react-behavior.md)

## 1. 측정 환경과 해석

**현재 통과하는 검사에 범위·규칙을 추가해 측정했으며, 최종 정책 적용 후의 오류 수가 아니다.**

| 구분 | 측정 버전 |
|---|---|
| Node / npm | 26.7.0 / 11.19.0 |
| TypeScript / 설치된 React | 5.9.3 / 19.3.0 |
| 임시 ESLint / typescript-eslint | 9.39.5 / 8.72.1 |
| react-hooks / react plugin | 7.1.1 / 7.37.5 |
| jsx-a11y / react-refresh | 6.10.2 / 0.5.7 |

- 프로젝트 manifest의 버전 범위와 실제 설치 버전을 구분한다.
- 도구는 `/tmp`에 설치했고 저장소 설정·lockfile·제품 소스는 변경하지 않았다.
- ESLint 9 설치에서 지원 종료/deprecated 경고가 있었으므로 제품 의존성 채택 결정으로 해석하지 않는다.
- 구현 때 지원되는 호환 조합을 선택하고 결과 차이를 다시 기록한다.
- 진단은 겹칠 수 있으며 여러 프로필의 수를 버그 총수로 합산하지 않는다.

## 2. TypeScript

**기존 `npm run typecheck`는 통과했으며, 추가 프로필은 기존 옵션에서 각각 출발했다.**

- 현재 root 파일은 133개이며 `src`와 `electron.vite.config.ts`가 대상이다.
- `allowJs: false`이므로 unit `.mjs`는 타입 검사 대상이 아니다.
- 확장 프로필은 E2E·Playwright 설정을 더해 root 144개를 검사했다.
- `controlflow` 프로필은 관련 옵션 5개를 함께 켠 측정이므로 개별 독립 실행 결과로 표현하지 않는다.

| 프로필 | 변경한 조건 | 진단 / 파일 | 의미 |
|---|---|---|---|
| baseline | 기존 옵션 | 0 / 0 | 기존 검사 통과 |
| unused | noUnusedLocals·noUnusedParameters | 2 / 2 | 미사용 import |
| indexed | noUncheckedIndexedAccess | 174 / 24 | foundation 28·main 69·renderer 77 |
| optional | exactOptionalPropertyTypes | 103 / 26 | foundation 4·main 21·renderer 78; 채택하지 않음 |
| controlflow | noImplicitReturns·noFallthroughCasesInSwitch·noImplicitOverride·allowUnreachableCode=false·allowUnusedLabels=false | 5 / 4 | 반환 경로 TS7030 3·도달 불가 TS7027 2 |
| libraries | skipLibCheck=false | 1 / 1 | electron-vite 선언의 선택 peer @swc/core 참조 |
| sideeffects | noUncheckedSideEffectImports | 3 / 3 | renderer CSS import 선언 없음 |
| verbatim | verbatimModuleSyntax | 0 / 0 | 현행 단일 project 기준 |
| expanded | E2E·Playwright include 추가 | 43 / 8 | 테스트 타입 범위 확대 |

- controlflow 측정에서는 override·fallthrough·unused-label 진단이 없었다.
- 반환 진단은 `main/application/componentOperations.ts:11`, `nodeOperations.ts:16`, renderer `markdownEditorCommands.ts:40`에 있었다.
- 도달 불가 진단은 `main/application/renderService.ts:88`의 finally 내부 두 위치였다.
- 단순 try/catch/never/finally 별도 재현에서는 진단이 없고 cleanup 두 호출이 실행됐다.
- 따라서 실제 finally 코드가 죽었거나 compiler 오탐이 입증됐다고 주장할 수 없다.
- E2E 예시는 CDPSession 값과 factory 타입 혼동, Node union·HTMLElement narrowing, `.mjs` fixture 타입, `findLast` lib, Electron 실행 경로 타입이다.

## 3. ESLint 기본 실험

**JS recommended + TS recommendedTypeChecked + React Hooks recommended로 172개 파일을 검사했다.**

- TS 검사 program에는 E2E를 추가했다.
- JS 테스트·스크립트에는 기본 lint만 적용했으며 typed lint 결과가 아니다.
- 실험 preset의 severity와 [확정 정책](policy.md)의 severity는 다르다.

| 영역 | error | warning |
|---|---:|---:|
| foundation | 5 | 0 |
| main | 52 | 0 |
| renderer | 59 | 9 |
| E2E | 357 | 0 |
| unit `.mjs` | 5 | 0 |
| 합계 | 478 | 9 |

| 검토 항목 | 관찰 |
|---|---|
| Promise 추가 실험 | 기본 no-floating-promises 1건, ignoreVoid=false 49곳 |
| any | 제품 explicit any 없음; 제품 no-unsafe-* 30건, E2E explicit any 64건 |
| unused | 전체 20건; 제품 15건 중 import 2·의도한 제외 이름 13, 테스트 5 |
| React Hooks | 13파일 54건: deps 9·refs 34·set-state-in-effect 9·immutability 2 |
| require-await | 제품 3·E2E 4; 최종 off |
| no-base-to-string | 3 |
| no-unnecessary-type-assertion | 14 |
| no-redundant-type-constituents | 1; unknown과 undefined union |
| only-throw-error | 1; atomicJsonStore의 firstError |
| unbound-method | E2E 1 |
| no-control-regex | 3; 아래 검토 위치 |

- Promise 49곳은 미처리 실패 49개를 입증한 것이 아니라 호출 계약을 검토할 목록이다.
- 제어 문자 검토 위치는 `foundation/documentCommandSchemas.ts:108`, `main/application/outputService.ts:101`, renderer `rendering/safeHref.ts:3`이다.
- 입력 검증 의도와 실제 regex를 보고 국소 예외를 결정한다.

## 4. 추가 plugin 실험

| 실험 | 진단 |
|---|---:|
| React recommended + JSX runtime, prop-types off | 0 |
| jsx-a11y recommended | 13 |
| label-has-associated-control | 2 |
| no-static-element-interactions | 6 |
| click-events-have-key-events | 3 |
| interactive-supports-focus | 1 |
| no-autofocus | 1 |
| react-refresh/only-export-components | 11 |

- label 진단은 `ComponentReusePanel.tsx:176`, `shared/ui/label.tsx:6`이며 wrapper mapping과 실제 연결을 확인해야 한다.
- canvas 클릭·키보드, EditableTextValue의 focus, library 이름 수정의 autofocus가 별도 검토 대상이다.
- 추가 plugin 결과는 기본 실험과 별도 측정이며 그대로 최종 오류 총수에 더하지 않는다.

## 5. 재현 방법과 자료의 수명

**임시 산출물은 원시 측정 근거이며, 핵심 조건·수치·동작은 이 문서에 보존한다.**

| 임시 위치 | 내용 |
|---|---|
| `/tmp/formleaf-static-audit.oaW10F/ts-audit.cjs`, `typescript.json` | TS compiler API로 프로필별 program·진단 생성 |
| 같은 폴더 `lint-audit.mjs`, `eslint.json`, `eslint-summary.json` | 기본 lint 실행과 집계 |
| 같은 폴더 `promises-audit.mjs`, `promises.json` | ignoreVoid=false 비교 |
| 같은 폴더 `extra-lint.mjs`, `extra-eslint.json` | React·접근성·Refresh 추가 검사 |
| 같은 폴더 `reachability.ts`, `reachability.json` | 단순 finally 사례; 실제 진단 재현 실패 |
| `/tmp/formleaf-react-review.7Jeqt8/run.cjs`, `harness.tsx`, `results.json` | 실제 컴포넌트를 번들한 격리 브라우저 시험 |

- 임시 파일은 다른 환경에서 존재한다고 가정하지 않는다.
- TS 재측정 시 같은 commit·설치 버전에서 tsconfig를 읽고 표의 overrides 또는 include를 각각 적용한다.
- compiler API 측정은 cwd를 client로 설정한 최종 결과이며 초기 cwd 오류가 있는 결과는 사용하지 않았다.
- lint 재측정 시 위 preset·파일 범위와 최종 정책 중 어느 설정을 쓰는지 명시한다.
- React 재현의 입력과 기대 결과는 [별도 문서](06-react-behavior.md)에 보존했다.
- 최초 `.mjs` 테스트는 `66b24f5`에서 추가됐으나 선택 이유가 명시된 문서는 찾지 못했다.
- Node 직접 실행의 편의였다는 설명은 추론이며 기술적 필수 조건이 아니다.

## 6. 검증 한계

- 기존 분석에서 제품 전체 build·`npm test`·Electron E2E를 재실행하지 않았다.
- React 시험은 실제 소스와 React를 사용했지만 IPC mock과 통제된 props를 사용했다.
- CDP composition은 macOS의 실제 입력기로 검증한 결과가 아니다.
- 수정 후보의 일부 시나리오 통과는 전체 저장·접근 해제·출력 흐름의 검증을 대신하지 않는다.
