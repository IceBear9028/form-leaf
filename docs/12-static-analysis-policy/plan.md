# 정적 분석 적용 계획

## 현재 상태

2026-11-08 · 코드 기준 `989a7f6` · 정책·문서·기능별 적용 완료 · 편집기 진단 후속 수정·검증 완료

[기획](features/README.md) · [설계](implementation/README.md) · [실제 결과](handoff.md)

- 브랜치: `docs/12-static-analysis-policy`.
- 문서 선행 커밋: `b379b3f`. 사용자 요청에 따라 기능별 구현·검증·문서 갱신·커밋을 진행한다.
- F01–F07 구현·필수 검증과 최종 G02·G03 및 기능별 커밋을 완료했다.

## 기능별 의존 순서·상태·커밋

**한 기능의 구현·필수 검증·문서 갱신·커밋을 마친 뒤 다음 기능을 시작한다.**

| 기능·기획 | 대응 구현 설계 | 테스트 계획·결과 | 선행 | 상태 | 완료 커밋 |
|---|---|---|---|---|---|
| F01 [검사 기반](features/01-analysis-tooling.md) | [01-analysis-tooling](implementation/01-analysis-tooling.md) | [테스트](tests/01-analysis-tooling.md) | 확정 정책 | 완료 | `a567664` |
| F02 [환경·레이어 경계](features/02-runtime-boundaries.md) | [02-runtime-boundaries](implementation/02-runtime-boundaries.md) | [테스트](tests/02-runtime-boundaries.md) | F01 | 완료 | `6214fac` |
| F03 [Promise 책임](features/03-promise-ownership.md) | [03-promise-ownership](implementation/03-promise-ownership.md) | [테스트](tests/03-promise-ownership.md) | F02 | 완료 | `3df95bb` |
| F04 [타입 안전성](features/04-type-safety.md) | [04-type-safety](implementation/04-type-safety.md) | [테스트](tests/04-type-safety.md) | F03 | 완료 | `d61b510` |
| F05 [테스트 TS 전환](features/05-typescript-tests.md) | [05-typescript-tests](implementation/05-typescript-tests.md) | [테스트](tests/05-typescript-tests.md) | F04 | 완료 | `af4ec23` |
| F06 [React 동작 보존](features/06-react-behavior.md) | [06-react-behavior](implementation/06-react-behavior.md) | [테스트](tests/06-react-behavior.md) | F05 | 완료 | `74c05a8` |
| F07 [접근성·Refresh](features/07-accessibility-refresh.md) | [07-accessibility-refresh](implementation/07-accessibility-refresh.md) | [테스트](tests/07-accessibility-refresh.md) | F06 | 완료 | `41907d8` |

- 각 기능 커밋 메시지에 F01–F07 ID를 포함한다.
- 관련 코드·테스트·문서만 함께 커밋하고 무관한 변경을 보존한다.
- 검증·커밋이 실패하면 해당 기능에서 재개하며 다음 기능으로 넘어가지 않는다.
- 성공한 커밋 해시는 이 표에 기록하고 그 기록은 다음 커밋에 포함할 수 있다.
- 문서와 workflow는 `b379b3f`로 커밋했다.

## 기능별 진입·종료 조건

| 기능 | 진입 조건 | 산출물·종료 gate | 실패 시 유지·복귀 범위 |
|---|---|---|---|
| F01 | 확정 정책 완료와 해당 설계 확인 | 도구·현재 연결 명령·severity·예외 fixture 통과 | 도구·config만 재조정 |
| F02 | F01 완료와 해당 설계 확인 | project·import 위반 검증, Markdown·Electron 결과 보존 | 이동 범위와 import 제한 재검토 |
| F03 | F02 완료와 해당 설계 확인 | 완료·성공·실패 소유자와 저장 후속 동작 검증 | 호출부 변경에서 실패·초안 계약 보존 |
| F04 | F03 완료와 해당 설계 확인 | 인덱스·외부 입력·반환·cleanup·일반 규칙 검증 | lookup·validator·반환 변경 재검토 |
| F05 | F04 완료와 해당 설계 확인 | 테스트 목록·Node 실행·타입 검사·lint 통과 | 확장자·import·config를 함께 복구 |
| F06 | F05 완료와 해당 설계 확인 | 핵심 오류·R01 수정, R02–R05·IME 범위 검증 | 문제가 생긴 후보 수정 재설계 |
| F07 | F06 완료와 해당 설계 확인 | label·ARIA·warning 종료 코드·focus 동작 검증 | mapping·UI 변경 단위 재검토 |

**공통 설정은 담당 기능에서 단계적으로 완성한다.**

- F01은 지원 도구와 명령 기반을 만들고 실제 연결 범위·미연결 범위를 기록한다.
- F02가 환경·import 경계를, F03이 Promise 규칙을 활성화한다.
- F04가 일반 엄격 옵션·규칙을 활성화하고 필요한 소스 수정을 완료한다.
- F05가 테스트 TS 전환과 테스트 검사 범위를 연결한다.
- F06·F07이 각각 React와 접근성·Refresh 규칙을 활성화한다.
- 미래 기능의 미해결 오류를 현재 기능의 성공으로 숨기지 않으며 전체 활성화는 최종 gate에서 확인한다.

## 인수 조건과 검증 추적

- 기능별 AC→시나리오→실행 결과는 위 표의 tests/NN-name.md가 소유한다.
- 각 기능 종료 조건은 해당 테스트 문서와 [공통 검사 G01](tests/README.md)의 통과다.
- 상세 절차와 실행 로그를 plan에 복제하지 않는다.

## 최종 통합 gate

- F07 완료 커밋 전에 [공통 검사 G02·G03](tests/README.md)을 통과한다.
- 실패하면 관련 기능에서 수정·재검증하고 다음 완료 처리로 진행하지 않는다.
- handoff에는 테스트 문서 링크와 결과 요약·한계를 남긴다.

## 현재 문서 작업의 검증

- 번호별 features/implementation/tests 파일명 일치, 양방향 링크, 기능·정책·AC·plan 추적을 확인한다.
- 상대 링크·anchor·placeholder·fence·공백·Mermaid를 검사한다.
- 실제 결과는 [handoff](handoff.md)에 기록한다.

## 최종 확인

- 공통 G02·G03과 기능별 34개 시나리오가 기록된 검증 경계 안에서 통과했다. 결과의 한계는 tests 각 문서가 소유한다.
- 최종 check·165 unit·build·격리 Electron E2E 7개 통과, opt-in 3개 제외, warning 69개 유지. native IME는 F06에서 별도 통과했다.
- 기능별 code·feature·implementation·tests 갱신과 커밋 순서를 유지했다. PR 게시 상태는 아래 기록을 따른다. merge는 수행하지 않았다.

## 편집기 진단 후속 수정

- 사용자 제보: E2E Window.agentRoot 누락, VS Code TS 6의 baseUrl deprecation.
- F05 후속 수정 완료: solution config 연결·baseUrl 제거·실제 tsserver 회귀를 추가한다. 기존 완료 보고는 CLI 검증 범위였으며 editor 자동 프로젝트 탐색까지 완료한 것으로 해석한 점을 정정한다.

- 후속 검증: 두 tsserver의 8개 경로, TS 6.0.3 전체 7 project, check·166 unit·build·agent-content E2E 1개 통과. 실행 중 VS Code 화면 갱신 한계는 F05 테스트에 기록했다.
- 후속 기능 커밋: `c76cde3`. 원래 기능 커밋 표와 이 결함 수정 커밋을 구분한다.

## PR 게시

- 2026-11-08 사용자 요청에 따라 브랜치 push와 [PR #4](https://github.com/IceBear9028/form-leaf/pull/4) 게시를 완료했다.
- base: main, head: docs/12-static-analysis-policy. merge는 수행하지 않았다.
