# 에이전트 도구 명세 및 MCP 인수인계

## 현재 상태

- 갱신일: 2026-11-03. 작업 11, 브랜치 `feat/11-agent-tools-mcp`, 기준 `main@6821494`.
- 문서 양식·공통 템플릿을 먼저 커밋한 뒤 공통 기반과 F01→F08을 순서대로 구현했다. 기능별 검증 후 커밋하는 사용자 요청을 따른다.
- 12개 MCP 도구, 18개 변경 명령, 연결·권한 설정, 최근 작업 결과·PDF 저장 UI를 구현했다. 로컬 자동 시험은 통과했다. **실제 로그인된 Codex와 Claude Code 각각의 전체 사용 여정은 미검증**이므로 제품 인수 전체 완료로 표시하지 않는다.
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
| 통합 보정 | F08 이후 fix 커밋 | 큰 기존 값 조회, 모델용 object 입력 schema, 출력 파일 resource 경계 |

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

Codex/Claude Code 설정 예시 복사를 제공한다. 실제 token 대신 FORMLEAF_MCP_TOKEN 환경 변수를 참조한다. 설정 형식만 [OpenAI 공식 문서](https://developers.openai.com/codex/mcp)와 [Claude Code 공식 문서](https://code.claude.com/docs/en/mcp)로 확인했다. 계정/외부 설정 파일을 읽거나 바꾸지 않았다.

## 검증 근거 — 2026-11-03

| 검사 | 실제 결과 |
|---|---|
| `npm test` | 25개 test script, 총 146개 테스트 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과, main·일반 preload·출력 전용 preload·renderer 생성 |
| `npx playwright test` | hidden Electron 7개 통과(최종 48.9초), 실제 원본 경로 opt-in 시험 1개 skip |
| PDF 의미/시각 검사 | 임시 출력 4쪽의 node/component/item·마지막 문단 보존, 미저장 IME 제외, 18pt/#123456 확인. PyMuPDF 추출/픽셀 검사 및 페이지 이미지 검수 |
| 문서 정합성 | 15개 문서 상대 링크 132개·JSON 예시 7개·요구 45개·AC 47개 확인, git diff --check 통과 |
| 결과 UI | 작업 카드 screenshot 검수. PDF OS 열기는 mock, 저장 대화상자는 임시 목적지를 반환하는 mock으로 검증 |

테스트 파일은 `client/test/agent-*.test.mjs`와 `client/e2e/agent-*.spec.ts`, 기존 Markdown ownership/user-flow E2E다. 빠른 한글·반복 Space·Enter·Tab/Shift+Tab, 부모 publish/rerender, 세 target 저장/재열기/PDF와 외부 쓰기 busy 보호를 포함한다.

F08의 HTTP 시험은 문서 저장 직전 응답 연결을 끊고 취소 통지를 보낸 뒤 writer 완료·service 재초기화·새 client 조회를 수행했다. 같은 requestId/입력을 재전송해도 item 하나와 같은 생성 ID/revision을 유지한다. PDF E2E는 실제 앱 재시작 후 artifact ID가 같은지 확인한다. 생성은 prepare/canonical-index/grant/completed 네 경계 장애를 주입해 복구한다. stage 손상은 자동 성공 처리하지 않는다.

F08 테스트 중 정리 경쟁을 발견했다. 최초 writer의 UI ack 기록이 끝나기 전에 테스트 workspace를 지우던 문제로, writer queue를 drain하고 client/server를 닫은 뒤 정리하도록 수정했다. 제품 재시작 시험과 단순 객체 재초기화 시험을 구분한다.

F03 E2E에서는 main 부팅 시 ESM-only remark/unified의 CJS require 실패를 발견했다. main bundle에 포함해 해결했다. unit/build 통과만으로 실제 Electron 부팅을 확인했다고 간주하지 않는다.

모든 산출물은 ignored `client/test-results` 또는 `/tmp`에 있으며 영구 보관을 보장하지 않는다. 검증용 PyMuPDF는 임시 venv에만 설치했고 제품 의존성으로 추가하지 않았다. OS 입력·실제 사용자 데이터로 시험하지 않았다.

## 남은 검증과 한계

1. 이미 로그인된 외부 Codex와 Claude Code 각각에서 instructions/schema만으로 대상 발견→변경→preview→PDF를 수행하는 검증이 남아 있다. SDK client 시험을 실제 에이전트의 판단·사용성 검증으로 표현하지 않는다.
2. macOS/Electron 44 환경을 확인했다. Windows/Linux 설치 font 조회·PDF·패키지 배포는 미검증이다. macOS font scan은 약 27초 걸려 cache하며 실패 시 알려진 fallback만 허용한다.
3. O07 장기 연속 출력·최악 문서의 peak memory/처리량 측정은 남아 있다. 한도·artifact 예산·직렬 worker·권한/만료 테스트 통과와 구분한다.
4. journal/staged snapshot과 artifact metadata tombstone은 자동 pruning하지 않는다. 100MiB 예산은 PDF payload/예약 기준이며 장기 journal 보관 정책은 후속 설계가 필요하다.
5. 원본 사용자 문서 opt-in E2E는 경로를 받지 않아 skip했다. 임시 fixture와 기존 Markdown 회귀만 확인했다. 외부 이미지 차단 fixture는 warning과 미로드 상태를 의도적으로 검사한다.

## 다음 작업

- [plan](plan.md) 6단계의 실제 외부 클라이언트 및 플랫폼 확인을 수행하고 결과를 보강한다. 실패하면 기능·계약·설계를 함께 수정한다.
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
