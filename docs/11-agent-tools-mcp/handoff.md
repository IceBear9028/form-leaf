# 에이전트 도구 명세 및 MCP 인수인계

## 현재 상태

- 갱신일: 2026-11-03. 작업 11, 브랜치 `feat/11-agent-tools-mcp`, 기준 `main@6821494`.
- 문서 양식·공통 템플릿을 먼저 커밋한 뒤 공통 기반과 F01→F08을 순서대로 구현했다. 기능별 검증 후 커밋하는 사용자 요청을 따른다.
- 12개 MCP 도구, 18개 변경 명령, 연결·권한 설정, 최근 작업 결과·PDF 저장 UI를 구현했다. 로컬 자동 시험은 통과했다. **Codex의 실제 로그인 세션 여정은 통과했고 Claude 모델 로그인 세션은 미검증**이다. Claude CLI 연결·폐기와 10만 자 문서 부하 시험은 추가로 통과했다. 두 외부 모델 여정을 모두 통과한 상태로 표시하지 않는다.
- 이번 범위는 도구 정의+MCP 구현이다. AI 로그인·내부 채팅·대화 재개·관리되는 에이전트 실행과 OS sandbox는 후속이다.
- 실제 사용자 문서·backup·외부 클라이언트 설정은 수정하지 않았다. 테스트는 임시 workspace와 hidden Electron을 사용했다. 키보드·마우스를 가져오거나 PDF 뷰어를 실제로 열지 않았다. 이번 요청에 따라 로컬 커밋하며 push/PR은 수행하지 않는다.

## 구현 단위와 커밋

| 단위 | 커밋 | 구현과 핵심 검증 |
|---|---|---|
| 문서·공통 양식 | `b65fc85` | README에 전체 기획 통합, 중복 features.md 제거, 공통 workflow/템플릿 개편 |
| 계약 기반 | `d587142` | 닫힌 입력·출력 schema, 12개 도구/18개 명령, revision/request hash, SDK fixture |
| 저장 기반 | `6368045` | UI/MCP 공통 writer, CAS, journal, editor coordinator, 재시작 복구 |
| F01 연결·권한 | `39cfdd9` | 기본 비활성 loopback HTTP, token hash·grant, 연결 UI |
| F02 문맥·대상 | `ec4c6f3` | 허용 문서/세 target/library 조회, resource, signed cursor |
| F03 내용 수정 | `9272786` | Markdown 원문·text·rich-text, batch/dryRun, busy/CAS/ack |
| F04 문서 구성 | `68bace1` | 생성 grant, node 구조·보관/복원·ID, 목록 갱신 |
| F05 재사용 | `fdc9051` | library revision/import remap, instance prop·repeater item |
| F06 스타일 | `baaac77` | 공유 사본 분리, style patch·font·color 검증 |
| F07 출력 | `d564ca4` | 고정 snapshot hidden PNG/PDF, artifact·만료·예산·복구 |
| F08 작업 결과 | `56a1929` | 최근 50건, 상태·저장/화면 구분, PDF 열기/저장, 재연결·권한 철회 |
| 통합 보정 | `c91d75b` | 큰 기존 값 조회, 모델용 object 입력 schema, 출력 파일 resource 경계 |

기능 상세와 계약의 목록은 유지하고 현재 구현 근거를 연결했다. 기능 번호와 구현 커밋을 대응하며 기능마다 별도 기획 문서를 새로 만들지 않았다.

## 기술 구현과 데이터 흐름

### 권한과 계약

`main/mcp`는 SDK 1.32.2/Zod 4.6.7을 고정해 사용한다. Streamable HTTP는 `127.0.0.1:32516/mcp`에서 기본 비활성이다. Host/Origin·Bearer·JSON 크기와 각 도구/resource의 현재 권한을 검사한다. 접속 session 대신 영속 credentialId/requestId로 작업을 식별한다.

`AccessPolicy`는 256-bit 난수 token의 hash만 mode 0600 관리 파일에 저장한다. 원문은 발급 시 한 번 표시한다. 문서별 읽기와 write/create/libraryRead/render는 앱에서 설정하며 create는 write에 의존한다. 이 권한은 MCP 경계이며 외부 에이전트의 별도 shell/파일 접근을 제한하지 않는다.

읽기는 저장본 기준이다. 최종 조회 회귀에서 입력 100,000자 제한이 기존 저장값 출력에 적용되던 문제를 수정했다. 큰 기존 text/prop은 원문으로 읽고 전체 JSON 한도 초과는 RESULT_TOO_LARGE로 명시한다. 세 DocumentEditTarget은 whole Markdown value를 가리키며 block·DOM·caret을 identity로 만들지 않는다. 권한 없는 문서의 이름·집계·resource를 노출하지 않는다. target/list cursor는 credential·query·snapshot에 묶고 10분 후 만료한다. asset은 metadata만 제공한다.

### 저장과 editor ownership

모든 제품 문서 저장/관리와 library 변경 IPC가 `DocumentService`의 queue를 거친다. UI 자신의 dirty 저장은 CAS로 처리하며 외부 쓰기의 busy 규칙과 구분한다. canonical schemaVersion 4와 Markdown 문자열을 유지한다.

외부 쓰기는 권한→queue에서 재검사→renderer acquire→revision→사본 batch/graph 검증→stage/journal→canonical/index→생성 grant→completed 순서다. UI apply/ack가 유실되면 persisted=true/uiSynced=false를 기록한다. busy인 활성 editor를 flush하거나 selection을 복원하지 않는다. idle 예약 때만 root를 inert로 만들고 lease/busy를 재검사해 적용하며 timeout·오류 후 release한다. 예약 중 프로그램적 draft 변경도 버리지 않는다.

재시작은 previous/next snapshot hash와 staged snapshot으로 저장 결과를 조정한다. 결과가 불명이거나 stage가 손상되면 affected document writer를 차단하고 recovery_required를 유지한다. journal은 자동 삭제하지 않는다. 앱 workspace single-instance lock도 사용한다.

### 명령과 출력

내용·구조·컴포넌트·스타일 명령은 동일 adapter/service를 사용한다. library import는 writer 구간에서 revision을 확인하고 모든 entity/prop/asset 참조를 재매핑하며 library 원본은 바꾸지 않는다. import idMap은 종류별 key를 사용한다. number/boolean은 union에 있으나 v4 모델에 없는 prop binding을 새로 만들지 않는다.

style은 공유 사본을 분리하고 그룹 깊이 병합·배열 교체·leaf null 삭제를 지원한다. ColorValue/WidthValue는 구별값 객체 전체를 교체한다. 현재 CSS에 정의되지 않은 document color token은 거절한다. 설치 font 조회는 OS별 고정 명령만 사용하며 renderer lease 전에 수행하고 process 내 cache한다.

`RenderService`는 전용 sandbox hidden 창/preload로 저장 revision만 출력한다. font/image 준비 후 pagination을 다시 측정하고 외부 resource를 차단해 warning을 반환한다. preview 30초/PDF 60초, PNG 4MiB/2048px, PDF 20MiB를 적용한다. job은 직렬 처리한다.

`OutputService`는 journal에 출력 snapshot을 stage하고 pending을 반환한다. artifact 완료 표식 이후 completed가 된다. 완료 응답 유실/재시작은 같은 artifact를 반환하며 재출력하지 않는다. 미완료 출력은 실패로 기록한다. artifact는 24시간/100MiB 예산, pending당 20MiB 예약이며 정리는 새 관리 영역의 고정 payload만 대상으로 한다. 소유 credential·현재 문서/render grant·만료와 파일 유형을 재검사한다.

### 결과 UI와 외부 연결 안내

모델용 tools/list 입력 schema는 최상위 object로 제공한다. 조건부 필수 필드는 property 설명에 명시하고 원래 strict union으로 서버 검증한다. Claude Code의 root union 자동 변환에 의존하지 않으며 실제 계정 세션 검증과는 구분한다. 출력 resource 경계는 플랫폼별 absolute path 판정을 사용해 Windows의 다른 drive 경로도 허용하지 않는다. Windows 실제 출력 시험은 여전히 미수행이다.

연결 설정 화면은 최근 50개 agent 작업을 2초마다 조회한다. 본문·staged result·token은 요약 DTO에서 제외한다. pending/completed/failed/recovery_required와 저장 성공/화면 ack 미확인을 구분하고 자동 재시도 버튼은 제공하지 않는다. 권한 철회 뒤 로컬 작성자는 요청 발생·상태만 보고 문서명·revision·artifact는 보지 못한다.

PDF 열기/다른 위치에 저장은 main의 검증된 artifact ID에서 시작한다. 임의 파일 경로를 받는 MCP 도구는 없다. 저장 대화상자가 닫힌 후에도 권한·만료를 재확인하며 사용자 선택 위치에 임시 파일을 쓴 뒤 교체한다. 별도 저장한 PDF는 artifact 정리 대상이 아니다.

Codex/Claude Code 설정 예시 복사를 제공한다. 실제 token 대신 FORMLEAF_MCP_TOKEN 환경 변수를 참조한다. 설정 형식만 [OpenAI 공식 문서](https://developers.openai.com/codex/mcp)와 [Claude Code 공식 문서](https://code.claude.com/docs/en/mcp)로 확인했다. 공식 CLI가 기존 인증을 사용하는 방식으로 Codex를 검증했고 인증 원문을 직접 읽거나 복사하지 않았다. 실제 사용자 설정 파일은 변경하지 않았으며 Claude CLI 연결 시험 설정은 임시 디렉터리에만 만들었다.

## 검증 근거 — 2026-11-03

| 검사 | 실제 결과 |
|---|---|
| `npm test` | 25개 test script, 총 146개 테스트 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과, main·일반 preload·출력 전용 preload·renderer 생성 |
| `npx playwright test` | 기본 hidden Electron 7개 통과(48.5초), opt-in 3개 skip. Codex/부하 opt-in은 별도 실행해 통과, 원본 fixture만 미지정 |
| PDF 의미/시각 검사 | 임시 출력 4쪽의 node/component/item·마지막 문단 보존, 미저장 IME 제외, 18pt/#123456 확인. PyMuPDF 추출/픽셀 검사 및 페이지 이미지 검수 |
| 문서 정합성 | 15개 문서 상대 링크 132개·JSON 예시 7개·요구 45개·AC 47개 확인, git diff --check 통과 |
| 결과 UI | 작업 카드 screenshot 검수. PDF OS 열기는 mock, 저장 대화상자는 임시 목적지를 반환하는 mock으로 검증 |

테스트 파일은 `client/test/agent-*.test.mjs`와 `client/e2e/agent-*.spec.ts`, 기존 Markdown ownership/user-flow E2E다. 빠른 한글·반복 Space·Enter·Tab/Shift+Tab, 부모 publish/rerender, 세 target 저장/재열기/PDF와 외부 쓰기 busy 보호를 포함한다.

F08의 HTTP 시험은 문서 저장 직전 응답 연결을 끊고 취소 통지를 보낸 뒤 writer 완료·service 재초기화·새 client 조회를 수행했다. 같은 requestId/입력을 재전송해도 item 하나와 같은 생성 ID/revision을 유지한다. PDF E2E는 실제 앱 재시작 후 artifact ID가 같은지 확인한다. 생성은 prepare/canonical-index/grant/completed 네 경계 장애를 주입해 복구한다. stage 손상은 자동 성공 처리하지 않는다.

F08 테스트 중 정리 경쟁을 발견했다. 최초 writer의 UI ack 기록이 끝나기 전에 테스트 workspace를 지우던 문제로, writer queue를 drain하고 client/server를 닫은 뒤 정리하도록 수정했다. 제품 재시작 시험과 단순 객체 재초기화 시험을 구분한다.

F03 E2E에서는 main 부팅 시 ESM-only remark/unified의 CJS require 실패를 발견했다. main bundle에 포함해 해결했다. unit/build 통과만으로 실제 Electron 부팅을 확인했다고 간주하지 않는다.

모든 산출물은 ignored `client/test-results` 또는 `/tmp`에 있으며 영구 보관을 보장하지 않는다. 검증용 PyMuPDF는 임시 venv에만 설치했고 제품 의존성으로 추가하지 않았다. OS 입력·실제 사용자 데이터로 시험하지 않았다.

## 추가 검증 — 실제 클라이언트와 지속 출력

| 항목 | 실제 결과 |
|---|---|
| Codex CLI | 0.165.0, `login status`: Logged in using ChatGPT. API key 환경 변수를 사용하지 않는 임시 read-only/ephemeral 실행 |
| 첫 자연어 여정 | 21회 도구 호출 중 add_item 입력 추측 2회 거절, schema resource 조회 후 복구·완료(약 1.5분) |
| 설명 보강 후 같은 여정 | 17회 도구 호출, 오류 0회, 55.3초. 문서/target/현재값/revision을 조회로 선택하고 세 target·새 item·PNG·PDF 완료 |
| 변경 독립성 | 기존 component 정의 불변, 반복 항목 정확히 2개, shell 명령과 다른 MCP server 호출 없음 |
| Codex PDF | 요청한 네 한글 문장 모두 추출 확인, 한 페이지 렌더 이미지 검수 |
| Claude Code CLI | 기본 설치 위치에 없음. npm cache의 임시 공식 CLI 2.1.317로 확인. `auth status`: loggedIn=false/authMethod=none |
| Claude MCP 연결 | 격리한 CLAUDE_CONFIG_DIR에서 HTTP 연결 성공, token 폐기 후 연결 거절. 모델 추론/문서 조작 시험은 아님 |
| 부하 fixture | Markdown 정확히 100,000자, 37쪽. preview 20회+PDF 20회 연속, 준비 신호 유실/복구, 6개 동시 PDF 요청. 전체 2.2분 |
| 출력 지연 | preview 중앙값 1,666.0ms/최대 2,297.7ms, PDF 완료 중앙값 2,651.1ms/최대 4,286.3ms |
| 메모리 | 500ms마다 Electron process working-set 합 측정: 시작 421.6MiB, 최대 720.2MiB, 종료 368.3MiB. 공유 메모리 중복 가능, native peak RSS 아님 |
| 편집 창 | 출력 중 evaluate 응답 중앙값 2.2ms/최대 714.1ms. 전체 작업에서 활성 IME/root/focus 보존. main+출력 창 최대 2개 |
| timeout/예산 | layout-ready 신호 유실 시 30,264.2ms 뒤 RENDER_FAILED, worker 회수 후 다음 preview 성공. 동시 PDF 4개 완료/2개 RESULT_TOO_LARGE |
| 큰 PDF 의미 | 37쪽의 원문 364개 문단을 공백 정규화해 모두 대조, 미저장 조합 문자열 제외. 처음/마지막 페이지를 표본 검수 |

실행 harness는 `client/e2e/agent-external-client.spec.ts`, `client/e2e/agent-load.spec.ts`, `client/test/agent-client-discovery.test.mjs`다. 외부 계정 사용과 부하 시험은 명시적 opt-in이며 기본 회귀에서 실행하지 않는다. `test-results`가 다음 실행에 지워질 수 있어 이번 원시 결과를 `/tmp/formleaf-task11-acceptance-20261103`에도 복사했다. 임시 파일의 영구 보관을 보장하지 않으며 핵심 수치는 위에 남긴다.

재실행(모두 `client`에서):

```sh
FORMLEAF_CODEX_E2E=1 npm run test:agent-codex
FORMLEAF_LOAD_E2E=1 FORMLEAF_LOAD_ROUNDS=40 npm run test:agent-load
FORMLEAF_CLAUDE_BIN=/path/to/claude npm run test:agent-claude-discovery
```

Codex는 실행 가능한 `codex` 또는 FORMLEAF_CODEX_BIN 경로와 기존 로그인이 필요하다. Claude discovery는 CLI 실행 경로만 필요하며 별도 AI 로그인을 대신하지 않는다. 테스트는 기존 설정/사용자 workspace를 수정하지 않는다. Codex와 load Electron 시험은 기본 endpoint를 사용하므로 서로 동시에 실행하지 않는다.

## 남은 검증과 한계

1. **Claude Code 모델 로그인 여정:** CLI가 미설치였고 임시 CLI의 실제 auth 조회에서도 미로그인이 확인됐다. 로그인된 실행 환경이 필요하다. 사용자에게 별도 경로/로그인 환경 유무를 질문했으며 인증 토큰을 요구하거나 로그인 절차를 대행하지 않았다.
2. **Windows/Linux:** 현재 호스트는 Darwin x86_64다. Docker CLI는 있으나 daemon에 연결할 수 없었다. macOS 결과를 Windows/Linux 설치 font·PDF·패키지 검증으로 대체하지 않는다.
3. **부하 범위:** 10만 자/37쪽/40회 및 timeout/동시 요청 범위를 통과했다. 총 canonical 문서 크기에는 유한한 상한이 없으며, 수 시간 운영·임의 규모의 최악 메모리를 모두 검증한 것은 아니다.
4. **보관 정책:** journal/staged snapshot과 artifact metadata tombstone은 현재 계약대로 자동 pruning하지 않는다. 100MiB는 PDF payload/예약 예산이며 장기 기록 정책은 별도 후속 설계다.
5. **원본 opt-in:** 사용자 원본 경로가 지정되지 않아 해당 시험은 skip했다. 임시 fixture 검증과 구분하며 실제 사용자 파일을 임의로 찾아 사용하지 않는다.

## 다음 작업

- [plan](plan.md) 6단계의 Claude 로그인 모델 여정 및 Windows/Linux 환경 검증을 수행하고 결과를 보강한다. 실패하면 기능·계약·설계를 함께 수정한다.
- 현재 구현에 로그인/채팅·대화 재개·OS sandbox를 섞지 않는다. 다음 번호 작업에서 공식 runtime 연결·구독 조건·프로세스/파일 권한을 검토한다.
- 작업 재개 시 git status와 이 handoff를 읽는다. 사용자 데이터·backup·미커밋 변경을 보존하고 테스트 workspace만 사용한다.

## 문서 양식 변경과 과거 검증

- 전체 기획을 README로 통합하고 별도 features.md를 제거했다. 정확한 도구 목록은 tool-contracts, 기능의 목적·사용자·실패 행동·트레이드오프·AC는 features, 단계는 plan이 소유한다.
- 기존 workflow 기본 템플릿 4개를 개편하고 선택 템플릿 3개를 추가했다. 공통 원본은 `.codex/skills/resume-studio-task-workflow/assets`, 저장소 안내는 `docs/templates/README.md`다. 11번의 작성 규칙/출처 사본은 공통 references로 이동했다.
- BMAD 사용자/목표/여정, OpenSpec 대안/트레이드오프, Spec Kit 인수 조건, arc42/C4 기술 경계를 조합했다. 공개 skill/script 전체를 설치하지 않았고 출처는 공통 작성 규칙에 보존했다.
- 문서 정리 시 18개 문서의 상대 링크 146개, JSON 예시 7개, 기능 8개/도구 12개/명령 18개/요구 45개/AC 47개 대응을 확인했다. 템플릿 7개 임시 생성과 skill-creator frontmatter 검증도 통과했다. 이는 제품 실행 증거와 별개다.
- 2026-11-02 Mermaid 11.12.1로 13개 도식의 parse/SVG 렌더를 통과하고 구조/TB02 이미지를 검수했다. 이번 구현에서는 기존 As-Is 도식을 변경 전 기준으로 유지하고 To-Be를 실제 모듈에 연결했다. 이번에 도식을 새로 렌더했다고 기록하지 않는다.
- 사전 계정 정책·Obsidian 분석과 완료된 과거 task 문서는 당시 기록으로 유지한다. 현재 기준은 이 작업의 README/design/contracts/plan이다.

[전체 기획](README.md) · [기술 설계](design.md) · [실행 시퀀스](runtime-flows.md) · [공통 양식과 출처](../../.codex/skills/resume-studio-task-workflow/references/documentation.md)
