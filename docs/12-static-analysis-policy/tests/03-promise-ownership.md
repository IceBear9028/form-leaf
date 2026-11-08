# F03. Promise 완료와 실패 책임 테스트

2026-11-08 · 구현 검증 완료 · 설계 기준 `989a7f6`

[기획·인수 조건](../features/03-promise-ownership.md) · [구현 설계](../implementation/03-promise-ownership.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F03의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 대상: `6214fac` 이후 F03 작업 트리, Node 26.7.0/Chrome 156/TS 5.9.3/ESLint 10.14.0.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 테스트 구현 파일명은 해당 기능 착수 시 기존 테스트와 대조해 정하고 실행 기록에 남긴다.
- 제안한 새 npm 명령은 현재 존재한다고 가정하지 않으며 도입 후 실제 명령을 기록한다.

## 2. 시나리오와 통과 기준

| ID | 인수 조건 | 경계 | 입력·절차 | 기대 결과 | 방법 |
|---|---|---|---|---|---|
| F03-T01 | F03-AC1 | 지연 저장 | 저장을 지연한 상태에서 닫기 요청 후 성공 응답 전달 | 저장 성공 전에는 닫히지 않고 성공 뒤 후속 동작 진행 | 제어 가능한 Promise·onBeforeClose 테스트 |
| F03-T02 | F03-AC1 | reject와 false | 저장 reject와 resolve(false)를 각각 발생시킴 | 닫기가 거절되고 초안·기존 오류 표시·재시도 경로 유지 | session·닫기 경계 회귀 테스트 |
| F03-T03 | F03-AC2 | 분리 실행 | timer·poll·초기화·openExternal 호출별 내부 실패를 유도 | 미처리 rejection 없이 지정한 소유자가 처리하고 필요한 UI 오류 표시 | 호출 계약 검토·격리 실패 주입 |
| F03-T04 | F03-AC2 | void 우회 | 미처리 Promise, void Promise, async callback 오용 fixture 검사 | 두 Promise 규칙이 위반을 잡고 사유가 있는 최소 예외만 통과 | typed lint fixture |

## 3. 실행 결과

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 미실행 이유·다음 행동 |
|---|---|---|---|---|
| F03-T01 | 통과 | 2026-11-08 · 6214fac + F03 작업 트리 · npm run test:promises | 실제 hook·preload의 지연 저장 완료 전 후속 동작 보류, 성공 후 진행 | native IME 시험 아님 |
| F03-T02 | 통과 | 같은 시험 | reject 후 초안·error 상태 보존과 재시도, preload handler false/reject의 닫기 거절 확인 | 없음 |
| F03-T03 | 통과 | npm run test:promises, npm test | 분리 UI rejection의 오류 toast·pageerror 0, 기존 agent output·HTTP 실패 회귀 통과; main 호출별 catch 검토 | OS 외부 URL 실패는 소스 검토 |
| F03-T04 | 통과 | npm run test:promises | 미처리·void Promise 2건과 async callback 오용 1건 검출, catch 경계 허용 | 없음 |
| G01 | 통과 | npm run check, npm test, npm run build | 제품 검사·전체 unit·Electron bundle 통과 | 테스트 TS/lint는 F05 |

- 실제 실행하면 위 묶음 행을 시나리오별 기록으로 바꾸고 실패·차단·미실행을 통과로 처리하지 않는다.
- 재실행은 원래 실패 근거와 수정 대상 코드를 식별할 수 있게 기록한다.
- 기존 사전 분석은 [audit](../implementation/audit.md)의 당시 조건을 인용하며 이 기능의 통과 결과로 계산하지 않는다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F03 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.

## 현재 검증 근거

- `npm run test:promises`의 3개 테스트가 실제 session hook·preload listener·typed lint fixture를 검증한다.
- 저장 지연 동안 후속 동작 보류, reject 후 초안·error 보존, 재시도 성공 후 후속 동작, handler false/reject의 completeClose(false)를 확인했다.
- 분리 실행 rejection의 toast 표시와 pageerror 0을 확인했다.
- 최초 일괄 catch 적용은 void callback에 Promise 반환 오류가 생겨 반환 void인 runAction 경계로 수정했다. 전체 unit에서 session hook의 toast import가 Node 경로 해석을 깨뜨려 저장 오류를 기존 store로 돌린 뒤 재실행했다.
- Chrome은 macOS 설치 경로를 사용했고 다른 환경에서는 Playwright Chromium 또는 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH가 필요하다.
- 로그: `/tmp/formleaf-f03-{check,test,build,promises}.log`. 최종 전체 unit 로그는 `/tmp/formleaf-f03-final-test.log`이며 build까지 성공했다.
