# 에이전트 도구 명세 및 MCP 인수인계

## 현재 상태

- 갱신일: 2026-11-03
- 작업 번호: 11
- 기준 HEAD·브랜치: `main@6821494` — `Merge pull request #1 from IceBear9028/feat/10-markdown-editor-ownership`
- 상태: 문서 구조·공통 템플릿 개편, 제품 구현 미착수. plan의 구현 1–6단계는 모두 대기.
- 작업 트리: 미커밋. 기존 docs 인덱스·backlog·references 변경을 보존했다.
- 변경 범위: docs와 저장소의 문서 workflow/템플릿. 제품 코드·제품 의존성·실제 사용자 데이터 변경 없음.

## 이번에 바꾼 것 — 2026-11-03

| 영역 | 실제 변경과 이유 |
|---|---|
| README | 전체 문제·사용자·목표·성공 기준·기능 목록·범위를 통합. 별도 features.md 제거 |
| tool-contracts | 12개 도구 목록을 이동. 18개 명령은 기존 상세 계약을 기준으로 유지해 중복 목록 제거 |
| design/runtime/plan/기능 상세 | README와 공통 작성 규칙으로 링크 갱신. As-Is/To-Be·데이터 소유권·관계·시퀀스·전환 gate 유지 |
| handoff | 현재 상태·실제 변경·검증·미결정·다음 행동을 먼저 배치하고 과거 기록 분리 |
| 공통 workflow assets | 기존 기본 템플릿 4개 개편, 선택 템플릿 3개 추가. 작은 작업은 불필요한 파일 생성하지 않도록 변경 |
| 공통 workflow 규칙 | Formleaf 명칭·문서 작업 적용, 전체 기획은 README, 구현 전 단계는 대기, 문서 검증과 제품 시험 구분 |
| docs/templates/README | 공통 원본으로 연결하는 저장소 안내 추가. 실제 원본은 .codex skill의 assets 한 곳에서 관리 |
| 11번의 templates 디렉터리 | 작성 규칙·출처를 공통 workflow references로 이동하고 작업별 사본 제거 |

사용자는 문서 전반과 템플릿을 함께 바꾸도록 요청했다. 이번 작업은 기존 11번 문서의 정리이며 새 작업 번호나 제품 기능 추가가 아니다. 8개 기능·12개 도구·18개 명령·45개 상세 요구·47개 인수 조건은 유지한다.

## 검증 근거 — 이번 변경

| 검사 | 결과·한계 |
|---|---|
| 현재 문서·공통 안내·workflow 18개 | 상대 링크 146개, JSON 예시 7개, fence·개행·공백 검사 통과 |
| 기능·계약 대응 | 기능 8개, 도구 12개·명령 18개, 요구 45개·AC 47개와 plan 대응 확인 |
| 공통 템플릿 7개 | 기본 4문서/선택 포함 7문서로 임시 생성해 상대 링크와 placeholder 치환 확인. 자연어 기획 품질 자동 검증은 아님 |
| skill-creator quick_validate.py | `Skill is valid!` — 임시 경로에 PyYAML을 준비해 실행. 제품 의존성 변경 없음 |
| Mermaid | 기존 도식 13개 유지. 이번에는 도식 내용을 변경하지 않아 2026-11-02 렌더 결과를 참고하며 새 렌더 실행으로 기록하지 않음 |
| git diff --check | 통과. untracked 문서는 별도 공백 검사 |

이번 링크·내용 검사는 저장소 파일을 직접 읽어 수행했다. 앞선 임시 백업/가상환경은 이후 호출에서 남아 있지 않아 그 백업에 대한 byte 비교 결과는 주장하지 않는다.

제품 코드를 변경하지 않아 npm test/typecheck/build 및 외부 에이전트 실행 시험은 이번 문서 정리에서 수행하지 않았다. 문서 검사 통과를 MCP 구현 완료로 표시하지 않는다.

## 남은 작업과 주의할 경계

- 구현은 [plan](plan.md)의 1단계 계약 fixture부터 시작한다. 기능·호출 계약·허용 범위를 추가 후보로 임의 확대하지 않는다.
- [design](design.md)의 O02(다중 파일 복구), O03(idle 이후 입력 경쟁), O06(저장 우회 경로)을 외부 쓰기 공개 전에 검증해야 한다. 나머지 SDK·token 저장·출력·용량 과제도 O01–O07과 plan gate를 따른다.
- UI 저장은 자기 draft를 저장하며, 외부 MCP 쓰기의 busy 규칙과 구분한다. 10번의 DOM/IME 소유권과 canonical Markdown을 보존한다.
- 사용자 승인 범위는 도구 정의+MCP 구현이다. AI 로그인·내부 채팅·대화 재개·관리되는 에이전트 프로세스와 OS sandbox는 후속이다. MCP가 외부 에이전트의 별도 shell 권한을 통제한다고 설명하지 않는다.
- 현재 작성한 세부 설계안은 모든 선택이 사용자 승인됐거나 구현 검증됐다는 뜻이 아니다. 기준 변경 시 관련 기능·설계·계약·plan을 함께 갱신한다.

## 다음 세션의 첫 작업

1. 최신 git status와 [README](README.md)·해당 기능 상세를 읽는다. 중복 전체 기획 문서를 다시 생성하지 않는다.
2. [design](design.md)→[runtime-flows](runtime-flows.md)→[tool-contracts](tool-contracts.md)→[plan](plan.md)으로 구조·순서·계약·gate를 확인한다.
3. 문서 수정에는 [공통 템플릿 안내](../templates/README.md)를 사용한다. 코드 구현 요청이 있을 때 작업 브랜치를 준비하고 계약/schema fixture부터 진행한다.
4. 실제 검증 결과를 얻은 후에만 plan의 단계와 제품 상태를 갱신한다. 사용자 요청 없이 커밋하지 않는다.

## 설계·양식 이력

- 2026-11-01: 현재 모델·편집·저장·PDF와 Obsidian 구현을 조사하고 11번 작업 문서를 작성. 도구 계약과 사용자 기능 상세 8개, D01–D07과 6단계 계획을 정리했다. 처음에는 전체 기능을 features.md로 별도 관리했다.
- 2026-11-01: BMAD PRD·OpenSpec·Spec Kit를 조합해 목표·사용자·흐름·예외·트레이드오프·인수 조건을 보강했다. 당시 양식은 11번 templates에 두었다.
- 2026-11-02: 중복 설명을 줄였으나 기술 설계 양식 개선이 부족하다는 사용자 지적을 반영해 A01–A07, As-Is/To-Be 구조·데이터 소유권·기능 관계, AS01/AS02/TB01–TB05와 O01–O07을 추가했다. UI 저장·현재 창 PDF 경로는 소스로 확인했다.
- 2026-11-02: arc42/C4·Senior Architect·BMAD architecture·OpenSpec·Spec Kit plan을 참고했다. 공개 skill이나 script 전체를 설치·실행하지 않았다. 참고 출처와 채택한 관점은 현재 공통 workflow의 작성 규칙에 보존했다.
- 2026-11-03: README와 전체 기능 문서의 역할 중복을 해소하고, 실제 문서 생성 workflow와 assets도 함께 개편했다. 과거 작업 문서·사전 계정 정책 조사·Obsidian 분석은 당시 기록으로 유지했다.

## 이전 검증 기록 — 2026-11-01–02

- 2026-11-02 기술 양식 개편 후: 문서 17개, 상대 링크 137개, JSON 예시 7개, 도구 12개·명령 18개, 요구 45개·AC 47개의 고유 ID와 plan 대응을 확인했다. 코드 근거 A01–A07·결정 D01–D07·미결정 O01–O07·시퀀스 AS01/AS02/TB01–TB05도 확인했다.
- Mermaid 11.12.1로 그림 13개 전체의 parse와 SVG 렌더를 통과했다. Playwright가 사용할 bundled Chromium이 없어 설치된 Google Chrome을 headless·임시 profile로 실행했다. 실제 사용자 창·키보드·마우스를 사용하지 않았다. 목표 구조도와 TB02 이미지를 육안 확인했고 가로로 길던 현재 구조·전환 그림은 세로 배치로 조정했다.
- Mermaid 검증 의존성과 산출물은 `/tmp/formleaf-doc-diagrams-hKNOFJ`에만 두었다. `verify.cjs`가 재현 script, `results.json`이 13개 결과이며 SVG/PNG도 같은 임시 경로에 있다. 임시 파일은 영구 보관을 보장하지 않는다. repository package/lockfile 변경은 없다. Markdown 소비 도구의 Mermaid 버전별 표시까지 검증한 것은 아니다.
- 최신 문서의 fence·개행·공백과 `git diff --check`를 통과했다. 제품 코드를 바꾸지 않아 npm test/typecheck/build와 실제 외부 에이전트 실행은 이번 문서 작업에서 수행하지 않았다.
- 2026-11-02 중복 정리 후 문서 15개의 상대 링크 96개·JSON 예시 7개·도구 12개·명령 18개 대응, fence·개행·공백 및 `git diff --check`를 다시 검사해 통과했다. JSON 예시 감소는 design의 중복 예시 제거에 따른 것이다.
- 2026-11-01 양식 개편 당시 작업 문서 15개에서 상대 링크 94개, JSON 예시 8개, 도구 12개·명령 18개의 목록/계약 대응을 검사했다. 모두 통과했다.
- 기능 상세 8개의 공통 9개 절, 요구사항 ID 45개·인수 조건 ID 47개, D01–D07 결정 기록, plan의 AC 범위 대응을 검사했다. 모두 통과했다. 이는 문서 구조·참조 검사이며 해당 기능의 실행 검증 통과가 아니다.
- 코드 fence·마지막 개행·공백 검사와 `git diff --check`를 통과했다. 11번 문서가 untracked이므로 git 검사와 별도로 해당 Markdown 파일 전체의 공백도 검사했다.
- 코드 변경이 없어 제품 테스트는 이번 문서 정리에서 실행하지 않았다.
- MCP 서버·도구 구현·외부 클라이언트 실행 검증은 아직 수행하지 않았다.

## 참고

- [전체 기획과 기능 목록](README.md)
- [공통 작성 규칙과 양식 출처](../../.codex/skills/resume-studio-task-workflow/references/documentation.md)
- [Obsidian MCP 참고 분석](../../references/obsidian-mcp/README.md)
- [사전 기획·계정 조사](../backlog/formleaf-mcp.md)
- [10번 handoff](../10-markdown-editor-ownership/handoff.md)
