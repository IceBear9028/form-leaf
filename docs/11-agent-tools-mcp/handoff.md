# 에이전트 도구 명세 및 MCP 인수인계

## 현재 상태

- 갱신일: 2026-11-03
- 작업 번호: 11 / 브랜치: `feat/11-agent-tools-mcp` (기준 `main@6821494`)
- 문서·공통 템플릿 커밋: `b65fc85`.
- 사용자 요청에 따라 구현과 기능별 검증 후 커밋을 진행한다. AI 로그인/채팅은 후속 범위다.
- 1단계 계약 완료, 2단계 공통 저장 기반 구현·검증 완료(명령 adapter 통합은 남음), 3단계 조회 연결 진행 중, 4–6단계 대기. F01/F02 연결과 읽기 도구 8개, schema/document resource 구현. 외부 쓰기·render는 아직 공개하지 않는다.
- 실제 사용자 데이터·backup은 변경하지 않았다.

## 구현 증거 — 계약 기반

- `documentCommandSchemas.ts` / `documentCommands.ts`: 12개 도구 입력, 18개 명령, typed target, 닫힌 중첩 schema, 길이/크기/enum/값 범위와 결과·오류 타입.
- `documentToolResults.ts` / `main/mcp/protocol.ts`: 도구별 출력 schema와 JSON/text 동일 응답. 큰 일반 JSON 응답 거절.
- `documentRevision.ts`: 안정적인 JSON hash와 requestId를 제외한 정규화 요청 hash.
- SDK `1.32.2`, Zod `4.6.7` 정확 버전 고정. 실제 SDK client/server 간 structuredContent·오류·image·resource 계약 시험.
- `test/agent-contracts.test.mjs`: 6개 통과, `npm test` 전체 통과, `npm run build` (typecheck 포함) 통과. `git diff --check` 통과.
- 아직 문서 참조·권한·설치 font·실제 HTTP·hidden render 검증은 아니다. feature 전체 완료로 표시하지 않는다.

## 구현 증거 — 공통 저장 기반

- 모든 제품 document/library IPC writer를 `DocumentService` 직렬화 구간으로 전환. UI load/save에 저장 revision을 전달하고 stale save를 거절해 draft를 유지한다. workspace는 Electron single-instance lock으로 중복 프로세스 writer를 막는다.
- canonical snapshot과 index 저장 전에 별도 staged snapshot·journal을 기록한다. 재시작 시 previous/next hash와 비교해 문서/index/생성 grant를 재조정하며, 판정 불명 문서는 새 writer를 차단한다. 기존 backup은 repository 정책으로 유지한다.
- renderer acquire→apply→release handshake를 추가했다. focus/IME/dirty/saving/component draft가 있으면 거절한다. idle일 때만 잠시 앱 root를 inert로 예약하고 상태를 표시한 뒤 snapshot 렌더를 flushSync하여 ack한다. 늦은 apply가 새 draft를 덮지 않도록 재검사한다.
- 외부 snapshot 뒤 문서 수준 undo/redo를 비운다. 활성 Tiptap session은 acquire 자체가 거절되므로 root/caret/composition을 바꾸지 않는다.
- `test/agent-document-service.test.mjs` 10개 통과: CAS 경쟁, dryRun·부분 실패 무변경, request 재전송, 4개 저장 경계 장애/재시작, 손상 staged snapshot 차단, ack 실패, 실행 시 권한 재검사.
- hidden Electron: 기존 ownership/user-flow 2개 통과. `e2e/agent-editor-coordination.spec.ts` 1개 통과: 실제 inert 예약·snapshot ack·stale save·IME 중 거절/root/focus 보존. 첫 실행의 잘못된 문서 버튼 exact selector를 실제 접근성 이름에 맞게 수정했다.
- `npm test`, build(typecheck 포함), diff check 통과. 모든 저장 시험은 임시 workspace에서 수행했다.
- **남은 gate:** 18개 operation adapter와 전체 graph/prop 검증, 실제 HTTP 권한 연결, 각 feature 전체 AC. 공통 저장 기반만으로 F03/F08 완료를 선언하지 않는다.

## 구현 증거 — F01 연결·권한

- 문서 목록의 “에이전트 연결” 화면: 서버 켜기/끄기, endpoint 복사, 이름별 token 발급/폐기, 읽기 문서 선택과 capability 저장. create 선택 시 write도 선택하며 write 해제 시 create를 해제한다.
- `127.0.0.1:32516/mcp` Streamable HTTP, 기본 비활성. Host를 정확히 검사하고 Origin이 있으면 같은 loopback origin만 허용한다. Origin이 없는 CLI도 Bearer 인증을 거쳐야 한다. JSON body 2MiB 한도. 포트 충돌은 활성화 실패로 표시한다.
- token은 256-bit 난수이며 최초 발급 응답에서만 원문 제공. permission 0600 파일에 hash·영속 credentialId·grant만 저장한다. 요청별 최신 권한을 확인하며 connection session에 권한을 고정하지 않는다.
- 현재 `get_context`만 실제 공개했다. F02 이후 구현한 도구를 추가하고, 각 도구/resource의 정보 노출 경계를 그때 재검증한다. MCP는 외부 CLI의 별도 OS 파일 권한을 제한하지 않는다.
- `test/agent-access.test.mjs` 2개 통과: 기본 거절/영속 hash/폐기/create-write, 실제 HTTP SDK client·인증·Host/Origin·body 한도·권한 변경.
- hidden `e2e/agent-connection.spec.ts` 1개 통과: UI에서 발급→연결→문서 허용→쓰기/생성 연동→폐기→서버 끄기. 실제 사용자 clipboard나 키보드/마우스를 사용하지 않았다.

## 구현 증거 — F02 문맥·대상

- `get_context/list_documents/get_document/list_edit_targets/get_edit_value/list_components/get_component/get_operation` 조회와 schema/document resources를 연결했다. 실제 공개 도구는 tools/list를 기준으로 한다.
- canonical DTO는 asset metadata만 반환한다. 문서 outline은 component 내부를 직접 노출하지 않고 문서 active/archived tree를 표시한다. typed target은 active text/Markdown/rich-text 값만 포함하고 기본값/override·숨김을 표시한다.
- HMAC cursor는 credential·query·snapshot/revision에 묶고 10분 만료를 검사한다. resource 목록도 100개씩 나눈다.
- 문서/컴포넌트 조회 전후 및 resource 경로에서 현재 권한을 확인한다. 비허용/미존재 문서는 같은 오류로 처리한다. 지원하지 않는 Markdown은 compatibility 정보와 원문을 그대로 반환한다.
- `test/agent-reads.test.mjs` 4개 통과: 비허용 정보/resource/context 차단, 세 target과 상속/보관/숨김, 원문/asset metadata, revision/credential/query/만료/변조 cursor. 전체 `npm test`와 build(typecheck 포함) 통과.
- 다음 기능 F03에서 내용 변경 adapter를 연결한다. F05에서 library import·prop/item 쓰기, F07에서 실제 render, F08에서 작업 결과 UI를 검증한다.

## 이번에 바꾼 것 — 2026-11-03

### F03 내용 수정 구현

- node/component prop/repeater item prop의 set_edit_value와 replace_text를 공통 service/CAS/idle/journal에 연결했다. canonical Markdown을 codec 왕복 없이 변경하며 rich-text는 runs 전체 교체만 허용한다.
- 겹치는 일치까지 두 번 이상이면 AMBIGUOUS_TEXT, 0회는 TEXT_NOT_FOUND. 선언 유형/target/최종 graph를 검증하며 하나라도 실패하면 batch를 저장하지 않는다. dryRun은 journal/영속 ID/revision 예약을 만들지 않는다.
- `test/agent-content.test.mjs` 3개 통과: 세 target 저장·재열기·원문/기본값 불변, dryRun/batch/권한/CAS/requestId, 겹치는 문자열/rich-text.
- hidden `agent-content.spec.ts`에서 실제 HTTP 쓰기→화면 ack→IME 중 거절→자동 저장을 확인했다. 연결/coordinator 회귀와 함께 3개 통과.
- 이 E2E가 main 시작 실패를 발견했다. renderer parser의 ESM-only remark/unified를 CJS main에서 외부 require하던 문제로, electron-vite main bundle에 해당 의존성을 포함하여 해결했다. F02의 unit/build 통과만으로 Electron 부팅을 검증한 것은 아니었다.
- 다음은 F04 생성과 구조 변경이다. 현재 공개된 쓰기 명령은 내용 set/replace이며 구조·재사용·style·출력·결과 UI는 남아 있다.

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

- 구현은 [plan](plan.md)의 2단계 공통 service를 진행한다. 기능·호출 계약·허용 범위를 추가 후보로 임의 확대하지 않는다.
- [design](design.md)의 O02(다중 파일 복구), O03(idle 이후 입력 경쟁), O06(저장 우회 경로)을 외부 쓰기 공개 전에 검증해야 한다. 나머지 SDK·token 저장·출력·용량 과제도 O01–O07과 plan gate를 따른다.
- UI 저장은 자기 draft를 저장하며, 외부 MCP 쓰기의 busy 규칙과 구분한다. 10번의 DOM/IME 소유권과 canonical Markdown을 보존한다.
- 사용자 승인 범위는 도구 정의+MCP 구현이다. AI 로그인·내부 채팅·대화 재개·관리되는 에이전트 프로세스와 OS sandbox는 후속이다. MCP가 외부 에이전트의 별도 shell 권한을 통제한다고 설명하지 않는다.
- 현재 작성한 세부 설계안은 모든 선택이 사용자 승인됐거나 구현 검증됐다는 뜻이 아니다. 기준 변경 시 관련 기능·설계·계약·plan을 함께 갱신한다.

## 다음 세션의 첫 작업

1. 최신 git status와 [README](README.md)·해당 기능 상세를 읽는다. 중복 전체 기획 문서를 다시 생성하지 않는다.
2. [design](design.md)→[runtime-flows](runtime-flows.md)→[tool-contracts](tool-contracts.md)→[plan](plan.md)으로 구조·순서·계약·gate를 확인한다.
3. 문서 수정에는 [공통 템플릿 안내](../templates/README.md)를 사용한다. 현재 브랜치에서 공통 service/CAS/renderer handshake부터 계속한다.
4. 실제 검증 결과를 얻은 후에만 plan의 단계와 제품 상태를 갱신한다. 사용자가 기능별 완료 후 커밋을 요청했으므로 검증한 단위로 커밋한다.

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
