# F06. React 규칙과 편집·초안 보존 테스트

2026-11-08 · 계획 작성 완료 · 구현 후 검증 미실행 · 설계 기준 `989a7f6`

[기획·인수 조건](../features/06-react-behavior.md) · [구현 설계](../implementation/06-react-behavior.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F06의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 제품 코드는 아직 수정하지 않았으며 아래 시나리오는 실행 예정이다.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 테스트 구현 파일명은 해당 기능 착수 시 기존 테스트와 대조해 정하고 실행 기록에 남긴다.
- 제안한 새 npm 명령은 현재 존재한다고 가정하지 않으며 도입 후 실제 명령을 기록한다.

## 2. 시나리오와 통과 기준

| ID | 인수 조건 | 경계 | 입력·절차 | 기대 결과 | 방법 |
|---|---|---|---|---|---|
| F06-T01 | F06-AC1 | clean 전환 R01 | write=true/render=false에서 write=false 편집, 원격 render=true, write를 true로 복원 | dirty 중 draft 유지, clean 전환 뒤 render=true이며 저장 상태와 일치 | 실제 GrantEditor 격리 렌더 |
| F06-T02 | F06-AC1 | 권한 상태 분기 | 동일값 polling·명시적 reset·저장 성공/실패·connection 변경·revoke 실행 | dirty 보호·최신 baseline·실패 초안·접근 해제 의미가 각각 유지 | 권한 UI 상태 전환 테스트 |
| F06-T03 | F06-AC2 | effect 수명 R02 | 활성 editor에서 selection 갱신 후 외부 클릭·unmount | selection 갱신에는 flush/close 0회, 실제 종료에는 정상 cleanup | owner spy·실제 컴포넌트 harness |
| F06-T04 | F06-AC2 | 조합 DOM R03 | CDP 조합 중 부모·toolbar·selection 갱신, 이후 편집 대상 전환 | 조합 중 DOM·텍스트 유지, 실제 종료에서만 snapshot·destroy | CDP composition·editor E2E |
| F06-T05 | F06-AC2 | 입력 buffer R04 | 가나다 입력 후 늦은 가나 전달, 연속 입력·flush·예약 취소·callback 갱신 | 화면·publish 가나다 유지, 중복 발행·stale callback 없음 | useBufferedStringEdit harness |
| F06-T06 | F06-AC2 | cache·drag R05 | IME pin 중 pagination, panel 선택 변경, drag 시작·종료 수행 | 불필요한 reflow·stale panel/callback·남은 userSelect 변경 없음 | 계측·선택/drag 회귀 |
| F06-T07 | F06-AC2 | 실제 IME | 격리 앱에서 macOS 입력기로 한글 조합·선택·툴바 동작 확인 | 조합 유실·중복·DOM 교체로 인한 입력 중단 없음 | 수동 검증; CDP와 별도 기록 |
| F06-T08 | F06-AC2 | Hooks·정상 패턴 | 핵심 error 규칙과 refs/effect warning, store 초기화·응답 무효화 검토 | 필수 오류 해결, 단일 instance·오래된 응답 배제 유지 | typed lint·수명 회귀 |

## 3. 실행 결과

| 대상 | 상태 | 실행일·대상 코드·환경·명령 | 관찰 결과·근거 | 미실행 이유·다음 행동 |
|---|---|---|---|---|
| F06-T01–T08 전체 | 미실행 | 실행 기록 없음 | 제품 적용 결과 없음 | 구현 대기; 구현 후 시나리오별 결과 기록 |

- 실제 실행하면 위 묶음 행을 시나리오별 기록으로 바꾸고 실패·차단·미실행을 통과로 처리하지 않는다.
- 재실행은 원래 실패 근거와 수정 대상 코드를 식별할 수 있게 기록한다.
- 기존 사전 분석은 [audit](../implementation/audit.md)의 당시 조건을 인용하며 이 기능의 통과 결과로 계산하지 않는다.
- R01–R05의 사전 재현·정적 검토 근거는 [F06 설계](../implementation/06-react-behavior.md)에 보존했다. 격리 후보 시험은 최종 구현 검증과 구분한다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F06 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.
