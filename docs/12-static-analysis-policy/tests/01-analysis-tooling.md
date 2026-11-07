# F01. 검사 기반과 오류·경고 운영 테스트

2026-11-08 · 구현 검증 완료 · 설계 기준 `989a7f6`

[기획·인수 조건](../features/01-analysis-tooling.md) · [구현 설계](../implementation/01-analysis-tooling.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F01의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 검사 config·scripts와 회귀 테스트를 구현했다. 대상은 `b379b3f` 이후 F01 작업 트리다.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 테스트 구현 파일명은 해당 기능 착수 시 기존 테스트와 대조해 정하고 실행 기록에 남긴다.
- 제안한 새 npm 명령은 현재 존재한다고 가정하지 않으며 도입 후 실제 명령을 기록한다.

## 2. 시나리오와 통과 기준

| ID | 인수 조건 | 경계 | 입력·절차 | 기대 결과 | 방법 |
|---|---|---|---|---|---|
| F01-T01 | F01-AC1 | 설치·typed lint | 격리 환경에 선택한 도구 버전을 설치하고 대표 TS 파일 검사 | peer 오류 없이 type 정보를 사용하는 규칙이 실행됨 | 패키지 설치·ESLint 유효 설정 |
| F01-T02 | F01-AC1 | 파일 범위 | 제품·설정·JS 도구의 현재 연결 파일 목록과 실제 파일 비교 | 누락·중복 소유를 설명하고 후속 연결 범위를 명시함 | lint 대상 목록·tsc 파일 목록 |
| F01-T03 | F01-AC2 | 오류와 경고 | 같은 규칙 설정에서 정상·error-only·warning-only fixture 실행 | 정상·경고만 있으면 종료 0, error가 있으면 비정상 종료 | 명령 출력·exit code |
| F01-T04 | F01-AC2 | 예외 관리 | 필요한 국소 disable과 사용하지 않는 disable을 각각 실행 | 정당한 예외만 허용하고 미사용 disable은 오류 | ESLint fixture·사유 리뷰 |

## 3. 실행 결과

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 미실행 이유·다음 행동 |
|---|---|---|---|---|
| F01-T01 | 통과 | 2026-11-08 · Node 26.7.0/npm 11.19.0/TS 5.9.3/ESLint 10.14.0/typescript-eslint 8.72.1 · npm install, npm run test:analysis | peer 충돌 없음, 실제 foundation 프로젝트의 await-thenable 실행 | React·접근성 plugin은 해당 기능에서 선정 |
| F01-T02 | 통과 | 같은 작업 트리 · npm run lint:app, npm run lint:tools | 제품·Vite 설정 133파일과 JS 도구 검사, 타입 project 지정 확인 | test/E2E는 F05 연결 예정 |
| F01-T03 | 통과 | npm run test:analysis | CLI warning 종료 0·error 종료 1, 정상 진단 없음 | 없음 |
| F01-T04 | 통과 | npm run test:analysis | 사유 있는 필요한 disable 통과·미사용 disable 오류 | 없음 |
| G01 | 통과 | npm run check, npm test, npm run build | 현재 연결 검사·기존 unit suite·Electron bundle 통과 | Electron 실행·외부 CLI E2E는 이 단계 변경 범위 밖 |

- 실제 실행하면 위 묶음 행을 시나리오별 기록으로 바꾸고 실패·차단·미실행을 통과로 처리하지 않는다.
- 재실행은 원래 실패 근거와 수정 대상 코드를 식별할 수 있게 기록한다.
- 기존 사전 분석은 [audit](../implementation/audit.md)의 당시 조건을 인용하며 이 기능의 통과 결과로 계산하지 않는다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F01 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.

실행 로그: `/tmp/formleaf-f01-{check,test,build}.log`. 실행 테스트: `client/test/analysis-tooling.test.mjs`. 초기 설치 중 병행 check는 eslint bin 교체 중 종료 127로 실패했고 설치 완료 후 재실행했다.
