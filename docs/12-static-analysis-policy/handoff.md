# 정적 분석 정책 인수인계

## 현재 상태

**F01–F07 구현과 필수 검증을 완료했다. 기능별 코드·테스트·문서 커밋은 [plan](plan.md)에 기록한다.**

- 갱신일: 2026-11-08. 브랜치 `docs/12-static-analysis-policy`.
- 최초 설계 기준은 `989a7f6`, 문서 선행 커밋은 `b379b3f`다. 최종 구현 커밋은 `41907d8`이며 검증한 `74c05a8` + F07 작업 트리를 포함한다. 기능별 해시는 plan에서 관리한다.
- 마지막 완료 기능은 F07이다. 구현·검증 결과는 [기능 목록](features/README.md)·[설계 목록](implementation/README.md)·[테스트](tests/README.md)를 따른다.
- push·PR·merge는 수행하지 않았다. 실제 사용자 데이터·개인 문서·토큰으로 시험하지 않았다.

## 구현 결과와 검증

| 기능 | 결과 원본 |
|---|---|
| F01 검사 기반·severity | [테스트](tests/01-analysis-tooling.md) |
| F02 환경·레이어 경계 | [테스트](tests/02-runtime-boundaries.md) |
| F03 Promise 책임·실패 보존 | [테스트](tests/03-promise-ownership.md) |
| F04 타입·외부 입력·반환 | [테스트](tests/04-type-safety.md) |
| F05 테스트 TS 전환 | [테스트](tests/05-typescript-tests.md) |
| F06 React·초안·IME 수명 | [테스트](tests/06-react-behavior.md) |
| F07 접근성·Refresh | [테스트](tests/07-accessibility-refresh.md) |

- 최종 G02: 195파일의 lint 적용과 7개 TS project 포함 범위를 대조하고 정책상 옵션·규칙·severity를 확인했다.
- 최종 G03: check 종료 0·오류 0/경고 69, unit 165개·build·격리 Electron E2E 7개 통과. opt-in 3개는 제외했다.
- native IME는 80ms 네이티브 키 누름으로 실제 조합·Space·툴바·선택 전환·추가 입력·저장·재열기를 별도 검증했다. 최초 도구 시간 초과·단발 입력만 보고 검증 불가로 판단했던 것을 정정했다.
- 구조 검토: 7개 feature/implementation/tests 대응·34개 시나리오·AC 추적·완료 상태 일치를 확인했다.
- 문법 검사: 30개 문서·상대 링크 384개·anchor·placeholder·fence·공백 검사를 통과했다. 기존 Mermaid 9개는 변경하지 않았고 도식과 audit 보존 검사를 통과했다.

## 운영상 한계와 다음 작업

- ESLint 10.14.0을 사용한다. eslint-plugin-react 7.37.5·jsx-a11y 6.10.2는 peer가 9까지여서 공식 compat adapter와 plugin 한정 peer override를 사용했다. 선택 규칙의 실제 실행을 검증했으며 maintainer가 ESLint 10 지원을 선언한 것으로 보지 않는다.
- 경고 69개는 정책상 유지한다. Hooks refs/effect 수명을 경고 해소만을 위해 재설계하거나 canvas 키 이벤트·혼합 export를 일괄 변경하지 않았다.
- exactOptionalPropertyTypes의 전역 강화와 skipLibCheck 해제는 범위에 포함하지 않는다.
- 외부 CLI·부하·개인 문서 opt-in 3개와 최소 Node 버전·보조 기술 전체 조합은 별도 검증하지 않았다.
- 구현 잔여 작업은 없다. 추가 범위가 정해지면 이 결과와 정책을 기준으로 진행한다.

## 문서 작성 시점의 기록

아래는 `b379b3f` 문서 작성 때의 이력이며 최종 제품 검증과 구분한다.

## 문서 작성 때 바꾼 것

| 문서 | 실제 변경·책임 |
|---|---|
| [README](README.md)·[features](features/README.md) | 작업 소개·범위·AC |
| [implementation](implementation/README.md) | 기술 요약·7개 기능별 설계 목차 |
| [policy](implementation/policy.md) | D01–D12와 위임 항목·예외·severity 확정 기록 |
| [audit](implementation/audit.md) | 측정 버전·조건·수치·재현 방법·검증 한계 |
| [F06 React](implementation/06-react-behavior.md) | 기존 React 근거를 보존한 기능별 수정 설계 |
| [tests](tests/README.md) | 기능별 34개 시나리오·AC 연결·미실행 결과 기록, 공통 검사 G01–G03 |
| [plan](plan.md) | 구현 단계·의존성·검증·완료 조건 |
| [docs index](../README.md) | 12번 작업 연결 |
| [workflow](../../.codex/skills/resume-studio-task-workflow/SKILL.md)·[작성 기준](../../.codex/skills/resume-studio-task-workflow/references/documentation.md)·[템플릿 안내](../templates/README.md) | 기능 분리·통합 기준, 구조 검토, Mermaid 선택·생략 기준과 완료 보고 안내 보강 |
| workflow assets | 기획·설계·테스트 대응, plan의 설계 링크, 구조/문법 검사와 Mermaid 작성 기준 반영 |

- 사용자 요청: 12번 docs를 작업 브랜치에 작성한 뒤, 여러 기능에 맞게 번호별 기획·구현 설계를 대응시키도록 수정.
- 기존 완료 작업 문서와 client 파일은 수정하지 않았다.
- 단일 F01로 묶었던 문서를 수정해 features/NN-name.md·implementation/NN-name.md·tests/NN-name.md를 7세트로 대응시키고 테스트 문서를 추가했다.
- 두 README는 요약·목차로 줄이고 policy·audit은 공통 원본으로 유지했다.
- 기존 react-review.md의 내용은 F06 구현 설계로 옮기고 모든 참조를 갱신했다.
- 후속 요청에 따라 같은 통합 오류를 막도록 스킬과 양식도 개선했다.
- tests 폴더 요청에 따라 상세 테스트 계획·실행 결과 소유권과 신규 템플릿 2개를 추가했다.
- Mermaid 기준을 신규 구조 유무에서 핵심 동작·보존 조건의 설명 필요성으로 보완했다.
- F03 저장 후 닫기, F05 검사·실행 관계, F06 editor 수명과 pending 입력 보호 도식 4개를 추가하고 기능별 생략 이유를 재검토했다.
- F07은 속성·severity 대응이 중심이므로 도식 생략 범위를 명시했다.
- 제품 테스트는 미실행이며 사전 분석·문서 검사와 구분했다.
- 규칙의 상세 원본은 작성 기준에 두고 스킬·docs 안내는 해당 기준을 참조한다.

## 검증 근거

**현재 문서 검사와 앞선 제품 분석 결과를 구분한다.**

| 실행일·대상 | 검사·결과 | 한계 |
|---|---|---|
| 2026-11-08, `989a7f6`의 소스 재확인 | package·tsconfig·레이어 README·핵심 React·MCP 코드와 설계 대조 | 전체 소스 재감사 아님 |
| 2026-11-08, 같은 HEAD + 테스트 문서·Mermaid 보완 후 작업 트리 | 문서 30개·상대 링크 372개, anchor·placeholder·fence·공백 검사 통과 | 외부 URL 가용성 전수 검사 아님 |
| 2026-11-08, 같은 문서 작업 트리 | 기획·설계·테스트 7세트의 번호·파일명·양방향 링크·plan·AC 대응 통과, 기존 정책·분석·React 근거 보존 확인 | 제품 구현 검증 아님 |
| 2026-11-08, 구조 검토 | 7개 기능의 목적·계약·완료 경계를 대조하고 F04의 관련 타입 옵션은 한 검증 단위로 유지; plan·handoff의 미구현 상태 일치 확인 | 작성자 내용 검토이며 자동 검사의 보장이 아님 |
| 2026-11-08, 테스트 문서 구조 검증 | 기획·설계·tests 7세트의 파일명·상호 링크·목차·plan 연결과 34개 사례의 AC 추적 확인; 모두 미실행 상태 | 제품 테스트 실행 아님 |
| 2026-11-08, workflow·양식 변경 | quick_validate.py 통과, UI metadata 변경 없음; 기준·양식 16파일의 참조 97개 검사 통과 | 템플릿 링크는 생성될 위치를 기준으로 확인; 에이전트 행동의 독립 실행 평가는 아님 |
| 2026-11-08, 같은 문서 작업 트리 | Mermaid 11.12.1 도식 9개 parse·headless Chrome render 통과, 추가 도식 4개의 표시·잘림 확인 | GitHub renderer와 버전 동일 보장 없음 |
| 2026-11-08 기존 분석 인용, `989a7f6` | 기존 typecheck 통과, TS·ESLint 추가 측정 | 최종 정책 적용 결과가 아님 |
| 2026-11-08 기존 격리 React 시험 인용, `989a7f6` | R01 문제·후보와 R02–R04 수정 회귀 재현, page error 0 | Electron 전체·native IME 미검증 |

- 검사 명령: `python3 /tmp/formleaf-task12-docs-validation/validate.py`, `node /tmp/formleaf-task12-docs-validation/render.cjs`, `git diff --check`.
- 기능·설계·테스트 대응·AC 추적 검사: `python3 /tmp/formleaf-task12-docs-validation/check-triples.py`.
- workflow·템플릿 참조 검사: `python3 /tmp/formleaf-task12-docs-validation/check-workflow.py`.
- skill-creator의 `quick_validate.py`는 PyYAML이 설치된 임시 venv에서 실행했다.
- 신규 미추적 Markdown도 별도로 공백을 검사했으며 문서 검사 오류와 브라우저 page error는 0이었다.
- 문서 검사 스크립트·SVG·PNG·결과 JSON은 `/tmp/formleaf-task12-docs-validation/`의 임시 산출물이다.
- 문서 전용 작업이므로 제품 `npm test`, build, Electron E2E를 새로 실행하지 않았다.
- 기존 도식 5개와 audit을 보존하고, 추가 도식의 호출·완료·cleanup·pending 분기를 현재 소스와 대조했다. 새 도식은 저장 후 닫기·editor 수명·buffer는 As-Is, 검사 관계는 To-Be로 구분한다.
- 기존 분석에서도 전체 제품 suite는 실행하지 않았으므로 과거 typecheck·격리 시험을 대신 사용했다고 주장하지 않는다.
- 임시 원시 자료 위치와 측정 프로필은 [audit](implementation/audit.md)에 기록했다.
- 원본 스크립트를 다시 확인해 controlflow 옵션이 묶음 측정이었다는 점을 명시했다.
