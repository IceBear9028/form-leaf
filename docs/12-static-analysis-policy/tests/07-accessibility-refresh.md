# F07. 접근성과 Fast Refresh 검사 테스트

2026-11-08 · 구현·필수 검증 완료 · `74c05a8` + F07 작업 트리

[기획·인수 조건](../features/07-accessibility-refresh.md) · [구현 설계](../implementation/07-accessibility-refresh.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F07의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 접근성·Refresh 규칙과 label 전달을 구현하고 아래 시나리오를 검증했다.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 실행 코드: `client/test/accessibility-refresh.test.ts`·`test/fixtures/accessibility-harness.ts`, 기존 React 회귀와 Electron E2E.
- `npm run test:accessibility`를 기본 `npm test` 마지막 단계에 연결했다.

## 2. 시나리오와 통과 기준

| ID | 인수 조건 | 경계 | 입력·절차 | 기대 결과 | 방법 |
|---|---|---|---|---|---|
| F07-T01 | F07-AC1 | label·ARIA | wrapper label의 htmlFor/id/중첩과 정상·invalid ARIA·alt 비교 | 실제 control 연결 유지, 명확한 오류만 차단 | lint fixture·DOM 접근성 확인 |
| F07-T02 | F07-AC2 | focus·canvas | 이름 수정 autofocus와 canvas 클릭·키보드·편집 진입 실행 | 경고는 표시하고 중복 실행·focus 유실·IME 회귀 없음 | UI 회귀·warning-only exit code |
| F07-T03 | F07-AC2 | Refresh | 상수 export·혼합 export fixture에 Vite 설정 적용 | 허용 상수는 통과, 나머지 경고는 표시하되 오류화하지 않음 | effective config·lint fixture |
| F07-T04 | F07-AC1 | 국소 예외 | wrapper mapping·disable 위치와 사유 검토 | 실제 오탐에만 최소 예외, ARIA·label 규칙 전체 비활성 없음 | 설정·DOM·예외 리뷰 |

## 3. 실행 결과

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 미실행 이유·다음 행동 |
|---|---|---|---|---|
| F07-T01 | 통과 | 2026-11-08, `74c05a8` + F07 작업 트리, `npm run test:accessibility` | alt·ARIA·required role 오류 검출, native/custom unbound label 2건 검출, Label·FieldLabel input.labels와 실제 SelectControl label.control/button.labels 연결 확인 | 전체 접근성 감사·screen reader 시험 아님 |
| F07-T02 | 통과 | 같은 회귀 + 전체 check·React 회귀·Electron user-flow | 이름 변경 창 focus 유지·Enter 저장 1회, canvas 선택·작성·저장·재열기 통과, 경고 69개가 있어도 check 종료 0 | native IME는 F06의 별도 검증; 이 단계에서 편집 handler 변경 없음 |
| F07-T03 | 통과 | 실제 Refresh rule fixture·effective config | allowConstantExport=true, 상수 export 진단 없음, 혼합 함수 export warning 1·error 0 | HMR 전체 런타임 성능 시험 아님 |
| F07-T04 | 통과 | config·wrapper 소스·실제 DOM 대조 | Label/FieldLabel·Input/Switch/SelectControl만 지정, depth=3/either, a11y disable 추가 0 | mapping 이름이 새 구현에 재사용되면 DOM 계약 재검토 |
| G01·최종 gate | 통과 | [공통 G02·G03](README.md#3-공통-검사와-최종-통합) | 전체 검사·165 unit·build·격리 E2E 7개 통과 | opt-in 3개 제외 |

- JSX-a11y 6.10.2는 ESLint peer 9까지여서 compat 2.1.1과 plugin 한정 peer override를 사용한다. Refresh 0.5.7은 ESLint 10 peer를 제공한다. 선택 규칙을 실제 실행해 확인했으며 maintainer의 추가 지원 선언으로 해석하지 않는다.
- 최초 오류 2건은 Label의 숨겨진 htmlFor 전달과 SelectControl 중첩이었다. Label·FieldLabel 전달을 명시하고 확인한 wrapper 목록을 지정한 뒤 오류 0개가 됐다.
- warning은 Hooks 45개·접근성 13개·Refresh 11개다. 접근성은 canvas/drag 이벤트와 직접 편집 진입, contenteditable focus, 이름 변경 autofocus이며 기존 handler를 기계적으로 바꾸지 않았다.
- Refresh 경고는 AgentGrantFields/agentConnectionUi와 badge/button-group/button/toast의 혼합 export다. public export를 강제로 분리하지 않고 경고로 유지했다.
- 로그: `/tmp/formleaf-f07-regression.log`, `/tmp/formleaf-f07-final-check.log`, `/tmp/formleaf-f07-test.log`, `/tmp/formleaf-f07-build.log`, `/tmp/formleaf-f07-e2e.log`. 실제 native IME 근거는 [F06-T07](06-react-behavior.md#3-실행-결과)을 따른다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F07 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.

## 최종 통합 중 발견한 테스트 대기 문제

- 첫 전체 suite에서 F06 grants 시험이 dirty=false 알림 직후 아직 반영되지 않은 aria-checked를 읽어 실패했다. 제품 effect의 후속 render를 기다리지 않은 테스트 경쟁이었다.
- 해당 단언을 Playwright toHaveAttribute의 조건 대기로 바꿨다. 제품 상태 전환이나 effect는 변경하지 않았다.
- `npm run test:react`와 전체 `npm test`를 다시 실행해 통과했고 최종 check도 재실행했다. 초기 실패 로그는 `/tmp/formleaf-f07-test-first.log`, 수정 후 결과는 `/tmp/formleaf-f07-test.log`에 보존한다.
