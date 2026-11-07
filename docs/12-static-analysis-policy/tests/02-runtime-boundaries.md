# F02. 실행 환경과 레이어 경계 테스트

2026-11-08 · 구현 검증 완료 · 설계 기준 `989a7f6`

[기획·인수 조건](../features/02-runtime-boundaries.md) · [구현 설계](../implementation/02-runtime-boundaries.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F02의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 대상: `a567664` 이후 F02 작업 트리, Node 26.7.0/TS 5.9.3/ESLint 10.14.0.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 테스트 구현 파일명은 해당 기능 착수 시 기존 테스트와 대조해 정하고 실행 기록에 남긴다.
- 제안한 새 npm 명령은 현재 존재한다고 가정하지 않으며 도입 후 실제 명령을 기록한다.

## 2. 시나리오와 통과 기준

| ID | 인수 조건 | 경계 | 입력·절차 | 기대 결과 | 방법 |
|---|---|---|---|---|---|
| F02-T01 | F02-AC1 | 환경 전역 | foundation의 Node/DOM 사용과 renderer의 Node 전용 사용을 주입 | 해당 단독 project 검사에서 거부하고 허용 API는 통과 | 환경별 tsc 최소 fixture |
| F02-T02 | F02-AC1 | import 경계 | 금지 상대·alias·type import·export-from·dynamic import와 정상 경로 비교 | 모든 금지 방향은 실패하고 foundation 공유는 통과 | 파일별 lint fixture |
| F02-T03 | F02-AC2 | 공통 Markdown | 동일 source·blockIndex로 이동 전후 파서·호환성 결과 비교 | editable·unsupportedTypes·offset·빈 줄·prepare 결과가 동일 | 기존 markdown·agent 읽기 테스트와 비교 fixture |
| F02-T04 | F02-AC2 | Electron 로딩 | 공통 파서를 사용하는 main·renderer를 빌드하고 격리 앱 실행 | ESM 의존성이 CJS main에서 정상 로딩되고 MCP 읽기 결과 유지 | npm run build·격리 Electron smoke |

## 3. 실행 결과

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 미실행 이유·다음 행동 |
|---|---|---|---|---|
| F02-T01 | 통과 | 2026-11-08 · a567664 + F02 작업 트리 · npm run test:boundaries | foundation Node/DOM·renderer Node 전역 주입을 단독 tsc가 거절 | fixture 제거 확인 |
| F02-T02 | 통과 | 같은 환경 · npm run test:boundaries, npm run lint | 상대·alias·type·재수출·dynamic·Node import 위반 거절, 정상 공유 허용 | 비정적 경로 계산 import는 해석 범위 밖 |
| F02-T03 | 통과 | npm test, git show a567664와 이동 파일 비교 | 기존 Markdown·agent read 사례 통과, parser 원문 동일·compat import만 변경 | 없음 |
| F02-T04 | 통과 | npm run build, node /tmp/formleaf-f02-smoke.cjs | main CJS bundle·숨김 Electron·renderer bridge 로딩, page error 0 | 외부 CLI 연동 시험 아님 |
| G01 | 통과 | npm run check, npm test, npm run build | 현재 연결 검사와 전체 unit 통과 | 테스트 TS/lint는 F05 |

- 실제 실행하면 위 묶음 행을 시나리오별 기록으로 바꾸고 실패·차단·미실행을 통과로 처리하지 않는다.
- 재실행은 원래 실패 근거와 수정 대상 코드를 식별할 수 있게 기록한다.
- 기존 사전 분석은 [audit](../implementation/audit.md)의 당시 조건을 인용하며 이 기능의 통과 결과로 계산하지 않는다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F02 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.

## 현재 검증 근거

- `npm run test:boundaries`: 2개 테스트 통과. 금지 상대·alias·type·재수출·동적 경로 및 Node import를 거절하고 정상 공유 경로를 허용했다.
- foundation에 window/document/process/Buffer, renderer에 process/Buffer를 주입한 단독 tsc가 모두 실패하며 해당 이름을 진단했다. fixture 파일은 finally에서 제거한다.
- 이동한 parser는 원본과 byte 동일하고 compatibility는 parser import 경로만 다르다.
- `npm run check`·전체 unit·build·임시 userData의 숨김 Electron smoke 통과. 로그: `/tmp/formleaf-f02-{check,test,build,boundaries,smoke}.log`.
