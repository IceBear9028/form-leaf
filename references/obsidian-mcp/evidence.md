# 근거와 재현 기록

## 1. 식별 정보

| 항목 | 값 |
|---|---|
| 저장소 | `https://github.com/Leonezz/obsidian-mcp-server.git` |
| 조사 당시 branch | `master` |
| 고정 commit | `e16ba0e95ed22f0d75c20efbd07b37525da2ba65` |
| commit 날짜 | `2026-10-13T01:05:47+08:00` |
| commit 제목 | `fix: type moment via root package so the scanner can resolve it` |
| package / manifest | `1.1.10` / `1.1.10`, desktop only |
| 라이선스 | MIT |
| 조사일 | 2026-11-01 |
| 조사 환경 | macOS의 임시 소스 checkout, Node·TypeScript 버전은 results.json 참조 |

원본 저장소와 의존 패키지는 Formleaf에 vendor하지 않았다. 검증 코드는 이번 분석용으로 작성했으며 원본 구현을 재작성한 테스트가 아니라 해당 commit의 함수를 로드한다. 기록된 hash는 실제 probe가 읽은 원본 TypeScript 파일을 식별한다.

## 2. 근거 유형

- **S — 소스 관찰:** 고정 commit의 구현 또는 해당 저장소의 설계 문서.
- **P — 제한된 실행:** 원본 함수를 TypeScript로 변환해 모의 Obsidian/SDK 경계에서 실행한 결과.
- **D — 공식 설명:** Obsidian 공식 플러그인 보안 문서.
- **I — 추론/제안:** 위 근거를 토대로 한 신뢰 경계 분석 또는 Formleaf 설계 제안.

REA 스킬을 적용했지만 소스 분석 경로이므로 REA engine Evidence ID는 생성하지 않았다. 아래 S/P 번호는 이 보고서의 자체 근거 식별자이며 REA 도구가 반환한 ID가 아니다.

## 3. 소스 근거 색인

모든 GitHub 코드 링크는 분석 commit에 고정했다.

| ID | 확인한 내용 | 원본 |
|---|---|---|
| S01 | 공개 목적·설치·사용법 | [README](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/README.md) |
| S02 | 로드·토큰 생성·설정 저장·종료 | [main.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/main.ts) |
| S03 | HTTP, 인증, 세션, transport 생성 | [server.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/server.ts) |
| S04 | 경로·태그 정책과 정규화 | [security.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/security.ts), [utils.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/utils.ts) |
| S05 | 설정 기본값·주소·인증 해제 UI | [types.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/types.ts), [settings.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/settings.ts) |
| S06 | 초기 컨텍스트와 힌트 | [instructions.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/instructions.ts), [annotations.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/annotations.ts) |
| S07 | 21개 도구와 공통 한도 | [tools/index.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/index.ts), [constants.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/constants.ts) |
| S08 | 수정·생성·이동·삭제·첨부 경로 | [tools 디렉터리](https://github.com/Leonezz/obsidian-mcp-server/tree/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools) — 상세 함수 링크는 architecture/security 문서 참조 |
| S09 | resource 조회·목록·완성·알림 | [static.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/resources/static.ts), [templates.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/resources/templates.ts), [subscriptions.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/resources/subscriptions.ts) |
| S10 | 통계의 성공 판정 | [stats.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/stats.ts#L37) |
| S11 | 버전·의존성·bundle 환경 | [package.json](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/package.json), [manifest.json](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/manifest.json), [esbuild.config.mjs](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/esbuild.config.mjs) |
| S12 | 의도와 구현의 차이 | [인증 해제 설계](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/docs/plans/2026-02-23-disable-auth-design.md), [세션 설계](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/docs/plans/2026-02-22-session-stats-design.md) |
| S13 | shell에서 MCP 사용 | [OpenClaw helper](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/openclaw-skill/scripts/obsidian-mcp.sh) |
| D01 | 플러그인 권한 상속·Restricted mode | [Obsidian Plugin security](https://obsidian.md/help/plugin-security), 2026-11-01 확인 |

부정적 결론의 검색 범위: `src`, `tests`, `README.md`, `docs`, build config와 lockfile. sandbox, child_process/spawn, 직접 fs 사용, realpath/symlink, expectedRevision, mutex/queue, Origin/Host/DNS 정책 키워드를 검색하고 서버·설정·보안·resource·주요 쓰기 handler를 읽었다. 의존성 이름에 관련 단어가 등장하는 것과 앱이 그 기능을 호출하는 것은 구분했다. 전체 dependency 공급망이나 Obsidian 호스트의 부재까지 증명하는 검색은 아니다.

## 4. 제한된 실행 결과

| ID | 확인한 동작 | 결과 |
|---|---|---|
| P01 | blacklist 차단, prefix 과차단, 외부 경로와 plugin 경로에 대한 검사기 응답 | 확인 |
| P02 | 차단 폴더명이 instructions·overview에 포함 | 확인 |
| P03 | 차단 파일의 modify URI를 SDK 전송 함수에 전달 | 확인 |
| P04 | 전역 태그 집계에 파일 경로 필터 미적용 | 확인 |
| P05 | daily-note 생성 helper 호출 뒤 접근 거부 반환 | 확인 |
| P06 | 두 append가 동일 이전 값을 읽을 때 마지막 저장만 유지 | 확인 |
| P07 | 같은 patch를 두 번 호출하면 `x → xy → xyy` | 확인 |
| P08 | `isError: true` 반환을 성공 통계로 집계 | 확인 |
| P09 | 실제 인증 middleware의 토큰 허용·거부·query 토큰·인증 해제 | 확인 |

모두 조사한 동작이 재현되었다는 뜻이다. 보안 요구를 통과했다는 뜻이 아니다. [기계 판독 결과](probes/results.json)

### 재현

Formleaf 루트에서 실행한다. 테스트 대상 코드는 실행되므로 고정 commit을 확인한다. `vm` 사용은 실행 편의를 위한 것이며 악성 코드 격리가 아니다.

```sh
git clone https://github.com/Leonezz/obsidian-mcp-server.git /tmp/formleaf-obsidian-review
git -C /tmp/formleaf-obsidian-review checkout --detach e16ba0e95ed22f0d75c20efbd07b37525da2ba65
node references/obsidian-mcp/probes/source-probes.cjs \
  /tmp/formleaf-obsidian-review \
  client/node_modules/typescript
```

`/tmp/formleaf-obsidian-review`는 존재하지 않는 새 디렉터리를 사용한다. TypeScript는 기존 Formleaf 설치본을 이용했으며 upstream npm 의존성 설치·postinstall·앱 실행을 하지 않았다. 이 테스트는 schema 객체와 SDK를 stub으로 제공하므로 JSON schema 검증, HTTP parser, SDK protocol, 실제 transport 전달을 검증하지 않는다. 실제 Obsidian의 `TFile`/`TFolder` 대신 최소한의 객체를 사용하며 모든 문서 read/write는 메모리 안에서 수행한다.

원본의 `tests/auth.test.ts`는 middleware 로직을 별도 함수로 복제해 검사한다. 이번 P09는 원본 `src/server.ts`의 실제 middleware 메서드를 실행한다. 원본 Jest 전체 suite를 실행한 것으로 보고하지 않는다.

## 5. 질문별 완료 상태와 남은 조사

| 질문 | 상태 | 남은 범위 |
|---|---|---|
| 목적·구조·에이전트 컨텍스트 | 소스 기준 답변 완료 | 저자의 비공개 의도는 추론하지 않음 |
| 인증·도구 권한 정책 | 소스 기준 답변 완료 | HTTP/SDK 통합 시험 |
| shell 직접 접근 차단 여부 | 별도 통제가 없다는 결론 | 실제 호스트 ACL과 agent 환경에 따른 접근 가능성 |
| package·설정 파일 보호 | plugin 수준 보호 부재 확인 | 배포 artifact, 코드 서명, OS 권한, Vault API의 숨김 경로 처리 |
| sandbox 설정 | 플러그인에 없음 확인 | 다른 제품/agent runtime의 OS sandbox는 별도 조사 |
| 경로 탈출·symlink | 검사기 한계 확인 | 실제 Obsidian adapter 및 플랫폼별 동작 미확인 |
| 메타데이터·변경 알림 | 소스와 mock 재현 완료 | 실제 MCP 클라이언트 수신 여부 |
| 동시 저장·IME·undo | 일부 함수의 경쟁 조건 확인 | 실제 앱 자동 저장·편집기·복구 동작 미확인 |
| 배포 binary와 소스 일치 | 미확인 | release bundle을 별도 확보해 hash·코드 대응 확인 필요 |

추가로 실제 Obsidian 검증이 필요하다면 새 임시 vault와 테스트 계정/환경에서 수행한다. 현재 자료만으로 '안전하다', '임의 파일 쓰기 취약점이 확정됐다', '외부 shell을 차단한다' 중 어느 것도 보장하지 않는다.
