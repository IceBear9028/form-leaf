# F05. 테스트 TS 전환과 검사 범위 테스트

2026-11-08 · 구현 검증 완료 · 설계 기준 `989a7f6`

[기획·인수 조건](../features/05-typescript-tests.md) · [구현 설계](../implementation/05-typescript-tests.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F05의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 대상: `d61b510` 이후 F05 작업 트리. Node 26.7.0/TS 5.9.3/ESLint 10.14.0.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 테스트 구현 파일명은 해당 기능 착수 시 기존 테스트와 대조해 정하고 실행 기록에 남긴다.
- 제안한 새 npm 명령은 현재 존재한다고 가정하지 않으며 도입 후 실제 명령을 기록한다.

## 2. 시나리오와 통과 기준

| ID | 인수 조건 | 경계 | 입력·절차 | 기대 결과 | 방법 |
|---|---|---|---|---|---|
| F05-T01 | F05-AC1 | 사례 목록 보존 | 전환 전후 unit·fixture·개별 script 목록 비교 | 기존 사례 누락이나 실행 명령의 의미 변경 없음 | package scripts·test 목록 비교 |
| F05-T02 | F05-AC1 | 직접 TS 실행 | 각 테스트와 전체 npm test를 Node runner로 실행 | 확장자·module·erasable 문법 문제 없이 같은 사례 실행 | Node·npm 버전과 명령 기록 |
| F05-T03 | F05-AC2 | 검사 범위 | unit·fixture·E2E·Playwright 설정에 타입 오류를 각각 주입 | 각 전용 typecheck/lint가 실제 파일을 검사해 실패 | 프로젝트 파일 목록·임시 오류 fixture |
| F05-T04 | F05-AC2 | mock와 런타임 타입 | invalid input 예외, CDPSession·DOM narrowing·실행 경로 확인 | 전체 제외·any 우회 없이 필요한 국소 예외와 실제 타입 사용 | 기존 E2E 소스 검사·가능한 격리 실행 |
| F05-T05 | F05-AC2 | 편집기 프로젝트 탐색 | 실제 tsserver에서 E2E·unit·각 제품 환경·root 설정 파일을 직접 open | 해당 leaf project·전역 선언을 선택하고 semantic/config 진단 0 | workspace 5.9.3·VS Code 6.0.3 protocol 회귀 |

## 3. 실행 결과

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 미실행 이유·다음 행동 |
|---|---|---|---|---|
| F05-T01 | 통과 | 2026-11-08 · d61b510 + F05 작업 트리 · case inventory·scripts 비교 | 30파일·159개 등록 사례의 이름·순서와 개별 실행 명령 보존 | 외부 CLI discovery는 기존처럼 별도 실행 |
| F05-T02 | 통과 | Node 26.7.0 · npm test | 161개 unit을 직접 TS 실행, module·확장자·erasable 문법 회귀 없음 | 최소 Node 버전 별도 실행 아님 |
| F05-T03 | 통과 | coverage probe · 전용 tsc/ESLint | unit·fixture·E2E·Playwright 설정 4곳 모두 type exit 2·lint exit 1 | probe 제거·config 원본 복구 |
| F05-T04 | 통과 | Playwright 1.64.1 · 기본 격리 E2E | 연결·내용 변경·lease·작업 기록·출력·editor ownership·저장 재열기 7개 통과 | 외부 CLI·부하·개인 문서 원본 3개 opt-in 제외; OS native IME 미검증 |
| F05-T05 | 통과 | 2026-11-08, dceeffe + 후속 수정, 실제 tsserver 5.9.3/6.0.3 | 8개 대상 모두 올바른 project 선택, E2E/unit 전역 선언 포함·제품 전역 미유입, semantic/config 진단 0 | 실행 중 VS Code UI의 기존 진단 갱신은 별도 한계 기록 |
| G01 | 통과 | npm run check, npm test, npm run build | app/unit/E2E/tools 전체 검사·기존 unit·빌드 통과 | 제품 package type은 CJS 호환 유지 |

- 실제 실행하면 위 묶음 행을 시나리오별 기록으로 바꾸고 실패·차단·미실행을 통과로 처리하지 않는다.
- 재실행은 원래 실패 근거와 수정 대상 코드를 식별할 수 있게 기록한다.
- 기존 사전 분석은 [audit](../implementation/audit.md)의 당시 조건을 인용하며 이 기능의 통과 결과로 계산하지 않는다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F05 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.

## 현재 검증 근거

- `/tmp/formleaf-f05-case-inventory.cjs`: 기존 unit 30파일·159개 등록 사례의 이름·순서 보존. 외부 CLI discovery는 기존처럼 별도 script이며 기본 unit 명령에 새로 포함하지 않았다.
- unit·E2E 단독 타입 검사와 lint 통과. renderer·Markdown·legacy import·문서 모델 37개 실행 통과.
- 전환 중 runtime 회귀로 다형 target predicate·선택 속성 부재 검사·렌더 완료 gate의 초기 상태 문제를 발견했다. 종류 분기·객체 존재 검사·undefined gate 초기 상태를 복원한 뒤 해당 5개·2개·3개 회귀와 이후 검사 시험을 통과했다.
- 최종 check·전체 unit·build·기본 Playwright 실행 통과. 외부 CLI·개인 원본 문서·부하 시험은 opt-in 환경 변수를 제거해 기본 실행에서 제외한다.
- E2E callback에 Node helper가 직렬화되는 참조가 없는지 소스 AST로 확인했다.
- 국소 예외: 의도적 invalid input 5곳과 부분 session mock 1곳의 ts-expect-error, Playwright 빈 fixture 인자 5곳, non-Error parser 실패 시험 1곳. 사용하지 않는 예외는 검사 오류다.
- 최초 Playwright 수집에서는 import.meta의 CJS 비호환과 빈 fixture 인자 요구를 확인했다. 범용 runtime 경로 adapter와 국소 예외로 수정한 뒤 7개 E2E를 통과했다.
- 로그: `/tmp/formleaf-f05-{check,final-test,build,e2e,fixture-runtime,coverage}.log`.

## 편집기 진단 후속 검증 계획

- F05-AC2의 검사 범위를 CLI 명령뿐 아니라 실제 편집기 프로젝트 탐색까지 확인한다.
- E2E를 직접 연 tsserver가 tsconfig.e2e.json과 browser-globals.d.ts를 선택하고 agentRoot 진단이 없어야 한다. unit·제품 각 환경과 두 root 설정 파일도 올바른 project를 선택해야 한다.
- workspace TS 5.9.3 및 설치된 VS Code TS 6.0.3에서 semantic/config 진단을 비교한다. baseUrl 경고는 옵션 제거로 해결하고 경고 억제를 추가하지 않는다.
- 현재 상태: 수정 전 inferred project와 누락 전역 진단 재현 후 수정·검증 완료. 기존 G02는 파일 포함 여부만 확인했고 editor 자동 탐색을 검증하지 못했으므로 완료 보고 범위를 정정한다.

## 편집기 진단 후속 실행 결과

- 수정 전 agent-content.spec.ts와 React unit은 inferred project로 열렸고 browser-globals.d.ts가 빠졌다. 전자는 agentRoot 2339뿐 아니라 잘못된 기본 옵션의 .ts import·타입 진단도 발생했다. root tsconfig는 제품 파일을 혼합 project로 열었다.
- 수정 후 workspace 5.9.3과 설치된 VS Code 6.0.3 tsserver 각각에서 E2E·unit·foundation/main/preload/renderer·Vite·Playwright 설정 8개 경로와 root config 진단을 확인해 모두 통과했다.
- VS Code 6.0.3 compiler API로 leaf project 7개 전체의 pre-emit 진단도 0이었다. baseUrl/ignoreDeprecations를 추가하거나 전역 타입 범위를 넓히지 않았다.
- `npm run check` 종료 0·오류 0/경고 69, `npm test` 166개, `npm run build`, 제보 파일의 `npx playwright test e2e/agent-content.spec.ts` 1개 통과. 기존 전체 E2E 7개 결과와 이번 1개 재실행은 구분한다.
- 파일 범위 감사는 197파일 모두 lint·project 포함 검증 통과(test 포함 45, 나머지 leaf 포함 건수 유지). protocol 회귀는 기본 npm test 마지막에 연결했다.
- 로그: `/tmp/formleaf-editor-{before,after-workspace,after-vscode}.jsonl`, `/tmp/formleaf-editor-projects-{workspace,vscode}.log`, `/tmp/formleaf-vscode-types-check.jsonl`, `/tmp/formleaf-editor-{check,test,build,e2e}.log`, `/tmp/formleaf-editor-config-audit.json`.
- 실제 실행 중 VS Code Problems에는 이전 root baseUrl 진단 1개가 남아 있었고 CUA 메뉴·키보드 명령으로 창 상태를 갱신하지 못했다. 이 화면의 0개 표시까지 확인했다고 주장하지 않는다. 디스크 설정과 같은 버전의 새 tsserver 진단은 0이며 기존 표시가 남으면 `TypeScript: TS 서버 다시 시작` 또는 창 다시 로드가 필요하다.

- 기본 재실행 명령은 client에서 `npm run test:editor-projects`다. 설치된 VS Code 버전 검사는 `FORMLEAF_TSSERVER_PATH='/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/node_modules/typescript/lib/tsserver.js' npm run test:editor-projects`로 실행했다. 다른 SDK도 같은 환경 변수로 지정할 수 있다.
