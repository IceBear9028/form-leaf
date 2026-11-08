# F04. 타입 안전성과 제어 흐름 테스트

2026-11-08 · 구현 검증 완료 · 설계 기준 `989a7f6`

[기획·인수 조건](../features/04-type-safety.md) · [구현 설계](../implementation/04-type-safety.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F04의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 대상: `3df95bb` 이후 F04 작업 트리. Node 26.7.0·TS 5.9.3·ESLint 10.14.0.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 테스트 구현 파일명은 해당 기능 착수 시 기존 테스트와 대조해 정하고 실행 기록에 남긴다.
- 제안한 새 npm 명령은 현재 존재한다고 가정하지 않으며 도입 후 실제 명령을 기록한다.

## 2. 시나리오와 통과 기준

| ID | 인수 조건 | 경계 | 입력·절차 | 기대 결과 | 방법 |
|---|---|---|---|---|---|
| F04-T01 | F04-AC1 | 부재와 필수 ID | 존재·정상 부재·깨진 필수 참조를 각각 조회 | 정상 부재는 계약의 sentinel, 불변식 위반은 기존 오류 code | foundation·operation unit |
| F04-T02 | F04-AC1 | 외부 입력 | 유효·잘못된 JSON/IPC/SDK 응답을 경계에 전달 | 기존 schema/guard가 좁히며 invalid 값이 내부에 전파되지 않음 | 경계 validator·응답 fixture |
| F04-T03 | F04-AC2 | 반환·선택 속성 | 미지원 operation, 생략/undefined 속성, async without await 비교 | 기존 undefined 반환과 선택 속성·Promise 계약 유지 | tsc·domain unit·유효 설정 |
| F04-T04 | F04-AC2 | 오류와 cleanup | 출력 실패·timeout·저장 오류 주입 | job·창 정리와 원본 Error/cause가 유지됨 | renderService·storage 실패 경계 |
| F04-T05 | F04-AC1 | 미사용·타입 lint | 일반 미사용 값, 필요한 위치 인자·rest 제외, unsafe 값 fixture | 정책상 오류는 거부하고 좁은 허용 패턴만 통과 | typed lint·예외 리뷰 |
| F04-T06 | F04-AC2 | CSS·추가 옵션 | 정상/없는 CSS 경로와 override·fallthrough·type-only import 검사 | 정상 build 통과, 누락 CSS는 build 실패, 확정 옵션 유효 | tsc·npm run build·정적 fixture |

## 3. 실행 결과

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 미실행 이유·다음 행동 |
|---|---|---|---|---|
| F04-T01 | 통과 | 2026-11-08 · 3df95bb + F04 작업 트리 · npm run test:type-safety, npm test | 필수 ID의 INVALID_TARGET·기존 domain 조회·정상 sentinel 유지 | 없음 |
| F04-T02 | 통과 | 같은 환경 · IPC validator·전체 agent 계약 시험, schema 소스 검토 | 유효 IPC·잘못된 boolean/target 구분; JSON·SDK의 unknown 경계 검증 | 실제 OS/SDK 모든 응답 변종의 전수 시험 아님 |
| F04-T03 | 통과 | test:type-safety·compiler fixture·전체 unit | 미지원 undefined·명시 undefined 선택 속성 허용·async 계약 유지 | 없음 |
| F04-T04 | 통과 | storage 실패 주입, 격리 Electron cleanup 스크립트 | Error identity/cause 보존, 렌더 timeout RENDER_FAILED와 job/창 0 | timer를 100ms로 단축한 격리 시험 |
| F04-T05 | 통과 | test:type-safety·npm run lint | any/unsafe·일반 underscore 변수 거절, 필요한 위치 인자·rest 제외 허용 | 제어 문자 검증 3곳만 국소 예외 |
| F04-T06 | 통과 | compiler fixture·missing CSS build·npm run build | index·return·type import·override·fallthrough 진단, missing CSS build 실패 후 정상 build 성공 | 없음 |
| G01 | 통과 | npm run check, npm test, npm run build | 현재 제품·도구 검사와 전체 unit·빌드 성공 | 테스트 project·lint는 F05 연결 |

- 실제 실행하면 위 묶음 행을 시나리오별 기록으로 바꾸고 실패·차단·미실행을 통과로 처리하지 않는다.
- 재실행은 원래 실패 근거와 수정 대상 코드를 식별할 수 있게 기록한다.
- 기존 사전 분석은 [audit](../implementation/audit.md)의 당시 조건을 인용하며 이 기능의 통과 결과로 계산하지 않는다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F04 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.

## 현재 검증 근거

- `npm run test:type-safety`: 필수 ID/미지원 sentinel, IPC 입력 검증, 저장 Error identity/cause, unsafe/미사용 예외, compiler 옵션의 5개 테스트.
- `node /tmp/formleaf-f04-css.cjs`: 임시 missing CSS import의 build 실패 확인 후 원본 복구.
- `node /tmp/formleaf-f04-render-cleanup.cjs`: 임시 userData·숨김 창에서 renderer ready가 오지 않는 timeout을 100ms로 단축 주입. 결과 `RENDER_FAILED`, job 0, 창 0.
- `npm run check` 통과. 전체 unit·정상 build도 통과했다. 로그는 `/tmp/formleaf-f04-{check,test,build,contracts,css,cleanup}.log`.
- finally cleanup은 보존했다. 실제 30초 대기와 native IME 검증을 수행했다는 의미는 아니다.
