# F06. React 규칙과 편집·초안 보존 테스트

2026-11-08 · 구현·필수 검증 완료 · `af4ec23` + F06 작업 트리

[기획·인수 조건](../features/06-react-behavior.md) · [구현 설계](../implementation/06-react-behavior.md) · [테스트 목록·공통 검사](README.md) · [실행 계획](../plan.md)

## 1. 범위와 준비

**이 문서는 F06의 테스트 절차·통과 기준과 실제 실행 결과를 소유한다.**

- 제품 구현·자동 검사와 실제 macOS 두벌식 입력 검증을 완료했다.
- [공통 환경·격리 기준](README.md)을 적용하고 실제 실행 때 버전·명령·대상 commit 또는 작업 트리를 기록한다.
- 실행 코드는 `client/test/react-behavior.test.ts`와 `test/fixtures/react-*`이며 기존 Electron E2E를 함께 사용한다.
- `npm run test:react`를 도입하고 기본 `npm test` 마지막 단계에 연결했다.

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
| F06-T01 | 통과 | 2026-11-08, `af4ec23` + F06 작업 트리, `npm run test:react` | dirty 상태에서 render=false 유지, 옛 baseline 복원 뒤 render=true·clean | 없음 |
| F06-T02 | 통과 | 같은 실행의 실제 GrantEditor | 동일값 polling clean, reset, 저장 false 후 초안 유지, true 후 clean, ID 변경 reset, revoke disabled | 없음 |
| F06-T03 | 통과 | 같은 실행의 실제 editor page + owner spy | selection 갱신 flush/close 0회·동일 store, 외부 클릭 각 1회, 재등록 후 unmount 각 2회 | 없음 |
| F06-T04 | 통과 | 같은 실행의 실제 MarkdownEditorHost + Electron ownership/user-flow E2E | CDP 조합 중 동일 DOM·텍스트, 부모/확대/속성 publish 후 유지, 종료 snapshot·재열기·PDF 통과 | 실제 입력기는 T07에서 별도 확인 |
| F06-T05 | 통과 | 같은 실행의 실제 buffer hook | 늦은 가나를 거부하고 가나다 유지, 최신 callback 1회 발행, unmount 예약 취소 | 없음 |
| F06-T06 | 통과 | 실제 overlay harness + pagination unit·Markdown user-flow E2E | drag 중 callback version 1, Escape·unmount 후 userSelect 복구; 다중 page 선택·조합 중 panel publish·measure DOM 무편집 유지 | cache 구조는 보존; 제품 전체 성능 측정 아님 |
| F06-T07 | 통과 | macOS 26.6.2·두벌식, 임시 userData의 격리 Electron, CUA pressKey durationMs=80 | ㅎ→하→한·글·입력 조합, Space 확정, 확대·굵게 툴바, 다른 요소 선택·재진입·추가 입력·저장·재열기 보존 | CDP와 분리한 네이티브 키 입력이며 실제 개인 문서 미사용 |
| F06-T08 | 통과 | 실제 TSX lint fixture·전체 lint·session harness·refresh 코드 검토 | 핵심 규칙 활성화, 필수 오류 0·refs/effect 경고 45; store 동일성 확인. refresh cleanup은 live active/sequence를 무효화하는 기존 순서 보존 | 오래된 응답의 배제 조건은 코드 검토, 새 네트워크 경쟁 부하 시험 아님 |
| G01 | 통과 | `npm run build`, `npm run lint`, `npm test`, `npx playwright test` | 타입 검사 포함 build 통과, lint 0 errors/45 warnings, unit 163개 통과, E2E 7 passed/3 skipped | opt-in 외부 CLI·부하·개인 문서 3개 미실행 |

- 환경: Node 26.7.0, npm 11.19.0, TypeScript 5.9.3, ESLint 10.14.0, React plugin 7.37.5 + compat 2.1.1, Hooks 7.1.1. 테스트용 Chrome·Electron은 설치된 실행 파일과 임시 데이터만 사용했다.
- 최초 harness 실행의 localStorage·CSS 치수·canvas ref 준비 오류를 수정한 뒤 회귀 2개와 전체 suite를 재실행했다. App.loading 오치환은 타입 검사에서 차단되어 복구했다. 위 결과는 수정 후 실행 기준이다.
- 실행 로그: `/tmp/formleaf-f06-regression.log`, `/tmp/formleaf-f06-test.log`, `/tmp/formleaf-f06-build.log`, `/tmp/formleaf-f06-lint.log`, `/tmp/formleaf-f06-e2e.log`. 임시 로그는 저장소 산출물에 포함하지 않는다.
- 최초 native 제어 시간 초과와 기본 pressKey의 ㄱ·ㅏ 단발 입력 후, 80ms 키 누름을 적용해 실제 조합을 재검증했다. 처음부터 네이티브 검증이 불가능하다고 판단한 것은 정정한다.
- 별도 관측 연결에서 compositionstart 10회·compositionupdate 38회·compositionend 11회와 insertCompositionText를 수집했다. 첫 end 1회는 관측 시작 전 조합의 종료여서 start와 개수 차이가 있다. 조합 중 대상 교체는 false였다.
- 최종 source는 `**한글 입력**  다시 `였고 문서 목록 이동·재열기 후 같은 한글·굵게·공백이 보존됐다. 추가 입력 위치는 Meta+Right로 명시했다.
- native 원시 이벤트: `/tmp/formleaf-f06-native-events.json`, 관측 스크립트 `/tmp/formleaf-native-observe.mjs`. UI 입력은 CUA만 사용하고 별도 Playwright 연결은 이벤트·저장 파일 관측에 사용했다. 격리 앱은 검증 후 종료했다.

## 4. 종료와 인수인계

- 필수 시나리오와 이 단계에 해당하는 공통 검사를 통과해야 F06 기능을 완료 처리한다.
- 실행 환경 때문에 확인하지 못한 항목은 원인·영향·다음 실행 방법을 남기며 완료 판단에 반영한다.
- plan에는 기능 상태·완료 커밋을, handoff에는 결과 요약과 이 문서 링크를 기록한다.
