# 보안 경계, 외부 파일 접근과 샌드박스

## 1. 위협을 구분해야 하는 이유

| 접근 주체 | 플러그인이 검사하는 것 | 플러그인이 통제하지 않는 것 |
|---|---|---|
| MCP 클라이언트 | HTTP 토큰, 도구/resource의 경로·태그 검사 | 클라이언트가 별도로 가진 OS 권한 |
| 로컬 shell·스크립트 | MCP endpoint를 호출할 때만 인증 검사 | 파일을 직접 읽고 쓰는 시스템 호출 |
| 브라우저 웹 페이지 | 동일 HTTP 진입점을 사용한다면 인증 검사 | 실제 Origin/Host 방어의 전체 동작은 의존 SDK 확인 필요 |
| 다른 Obsidian 플러그인 | 이 MCP를 호출할 때만 검사 | Obsidian API 또는 Node API를 통한 별도 접근 |
| 사용자·관리자 | MCP 호출에 대한 검사 | 앱 파일·설정·vault에 대한 OS 권한 |

이 분석에서 '허용된 기능만 제공한다'는 것은 **서버가 받은 요청을 한정한다**는 뜻이다. 외부 프로세스가 실행할 수 있는 모든 작업을 한정한다는 뜻이 아니다.

## 2. 실제 구현한 보호

### 로컬 주소와 접속 인증

- 기본 주소는 `127.0.0.1:27123`, 인증은 기본 활성화다.
- 최초 토큰은 `crypto.randomBytes(16)`을 hex로 표현한 128비트 난수다.
- `Authorization: Bearer ...` 또는 query의 `token`을 받는다. 길이 확인 후 `timingSafeEqual`로 비교한다.
- 인증을 요구하는데 서버 토큰이 없으면 500, 없거나 잘못된 클라이언트 토큰은 403이다.
- 세션별 토큰이 아니라 설정에 저장된 공통 토큰이다. 이름과 버전은 클라이언트가 주장하는 표시 정보이고 신원 인증이 아니다.
- 토큰을 포함한 설정 전체를 `Plugin.saveData`에 전달한다. 플러그인 자체에 OS credential store 저장이나 암호화 구현은 없다. 실제 저장 파일 ACL은 조사하지 않았다.

근거: [types.ts:24](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/types.ts#L24), [main.ts:22](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/main.ts#L22), [main.ts:76](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/main.ts#L76), [server.ts:203](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/server.ts#L203).

### 문서 경로·태그 차단

기본 blacklist는 `Secret/`와 `#secret`이다. 경로는 `/`로 분해해 `.`·`..`를 정리하고 소문자로 바꾼 뒤 prefix 비교한다. 태그는 metadata cache의 본문 태그와 frontmatter tags를 모아 prefix 비교한다. 목록 계열은 보통 반환 전 파일을 필터링한다. 기존 파일을 다루는 주요 도구는 문자열 경로 검사 후 실제 `TFile`을 다시 검사한다. [security.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/security.ts), [utils.ts:19](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/utils.ts#L19)

이는 기본 허용에 예외를 추가하는 정책이다. 클라이언트별 허용 문서, 읽기 전용 토큰, 작업별 승인, 선택 문서에만 적용되는 capability는 구현되어 있지 않다. 도구 등록은 세션마다 동일하다. [tools/index.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/index.ts#L26)

### 입력 제한과 오류

텍스트 길이·검색 결과 수·첨부 입력 길이에 상수가 있으며 Zod schema와 handler에서 사용한다. 여러 도구는 접근 거부와 파일 부재를 같은 오류 메시지로 반환한다. 다만 이 한도만으로 전체 요청 비용이나 모든 부가 정보 노출이 제한되는 것은 아니다. [constants.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/constants.ts)

## 3. 코드에서 확인한 빈틈과 보장하지 않는 것

아래는 배포된 앱에서 악용을 입증한 취약점 목록이 아니다. 고정한 소스의 동작, 모의 검증 결과, 추가 확인이 필요한 위험을 구분한 것이다.

| 항목 | 관찰 및 영향 | 검증 범위 |
|---|---|---|
| 인증 해제 + 모든 주소 바인딩 | `0.0.0.0`과 `requireAuth=false`를 함께 금지하는 조건이 없다. 네트워크·방화벽 조건에 따라 외부에서도 무인증 접근 가능성이 생긴다 | 설정·서버 소스; 실제 네트워크 접속 미실행 |
| 인증 해제 UX | 설계 문서는 확인 대화상자를 요구하지만 구현은 `Notice` 후 즉시 저장·재시작한다 | 문서와 코드 비교 |
| 차단 폴더명 노출 | instructions와 overview resource의 top-level folders가 blacklist를 적용하지 않는다 | P02 |
| 차단 문서의 변경 경로 | modify 이벤트가 파일 권한 검사 없이 URI를 모든 등록 세션의 SDK 전송 함수에 넘긴다 | P03; 실제 wire 전달 미검증 |
| 전역 태그 집계 | 태그 문자열만 차단하고 원본 파일 경로를 필터링하지 않는다. 차단 폴더에만 있는 다른 태그도 집계에 남을 수 있다 | P04 |
| 부수효과 이후 접근 검사 | 일일 노트가 없으면 `createDailyNote` 호출 후 반환된 파일의 접근을 검사한다 | P05; 실제 helper의 생성 동작은 모의 구현 |
| 폴더 생성 부수효과 | `add_attachment`는 folder 검사·생성 후 결합된 최종 경로를 검사한다 | 소스 확인 |
| 단순 prefix 비교 | `Secret/`가 정규화 후 `secret`이 되어 `SecretsArchive`도 차단한다. 경로 segment 경계가 아니다 | P01 |
| filesystem containment 부재 | `../../outside.md`, 절대 경로, 플러그인 설정 경로를 SecurityManager 자체가 일괄 거절하지 않는다 | P01; 실제 Vault API의 허용 여부는 미확인 |
| 태그 cache 의존 | cache가 없으면 태그 목록을 비워 검사한다. 태그만으로 차단한 문서의 cache 지연/변경 시점 처리는 미검증이다 | 소스 기반 위험 추론 |
| 동시 변경·재시도 | revision 비교·변경 직렬화·요청 중복 제거가 handler에 없다 | P06/P07 |
| 통계 정확성 | 반환값이 `isError: true`여도 예외를 던지지 않으면 성공 통계에 포함된다 | P08 |

근거: [settings.ts:40](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/settings.ts#L40), [인증 설계](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/docs/plans/2026-02-23-disable-auth-design.md), [instructions.ts:31](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/instructions.ts#L31), [static.ts:22](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/resources/static.ts#L22), [subscriptions.ts:17](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/resources/subscriptions.ts#L17), [list-all-tags.ts:19](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/list-all-tags.ts#L19), [daily-note.ts:21](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/append-daily-note.ts#L21), [add-attachment.ts:25](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/add-attachment.ts#L25), [stats.ts:37](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/stats.ts#L37).

### 경로 검사의 정확한 한계

`normalizePath`는 보안 검사 문자열만 만든다. 생성 handler는 원래 받은 경로를 Obsidian API에 전달한다. `realpath`·symlink 해석·vault 밖 탈출 거부는 플러그인 자체에서 찾지 못했다. 이 사실로 곧바로 'MCP로 임의 OS 파일에 쓸 수 있다'고 결론 내리면 안 된다. 실제 Obsidian Vault/adapter가 어떤 경로를 거절하는지, Windows 구분자나 링크를 어떻게 다루는지 추가 검증이 필요하다. [utils.ts:19](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/utils.ts#L19), [create-note.ts:18](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/create-note.ts#L18)

### 브라우저·네트워크 방어의 미확인 범위

애플리케이션 코드에는 별도 Origin/Host middleware, TLS 서버, rate limiter가 보이지 않는다. SDK transport 생성에도 Origin/Host 정책을 명시하지 않는다. **의존 SDK 전체와 배포 bundle을 검사하지 않았으므로 DNS rebinding/CSRF 공격 가능 여부는 미확정**이다. CORS 유무만으로 요청 도달 방어가 증명되지도 않는다. 토큰을 query로 받는 방식은 URL이 기록·공유되는 경로를 추가하므로 Formleaf에서는 header 인증만 제공하는 안을 검토할 수 있다. [server.ts:111](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/server.ts#L111), [server.ts:344](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/server.ts#L344)

정규식 검색은 사용자가 준 패턴을 같은 실행 문맥에서 `new RegExp`/`test`로 수행한다. 실행 시간 제한이나 별도 worker는 해당 handler에 없다. 복잡한 패턴으로 인한 응답 지연 가능성은 검토 대상이며, 실제 지연 유발 실험은 하지 않았다. [search-content.ts:33](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/tools/search-content.ts#L33)

## 4. 외부 shell로 직접 수정하면 어떻게 되는가?

MCP blacklist는 도구 함수가 호출될 때 실행되는 JavaScript 조건문이다. 다른 프로세스가 OS 파일 API로 파일을 열면 이 조건문이 호출되지 않는다.

따라서 **에이전트 프로세스에 해당 파일을 수정할 OS 권한과 shell/파일 도구가 있다면, MCP를 우회하는 직접 수정 경로가 남는다.** 이 플러그인은 에이전트를 실행하거나 프로세스의 권한을 낮추는 역할을 하지 않는다. 저장소에 있는 shell helper도 MCP 요청을 만드는 편의 도구일 뿐 격리 장치가 아니다. 실제 사용자 파일로 우회 실험을 하지는 않았다.

직접 수정은 blacklist 우회뿐 아니라 앱 저장과의 충돌, metadata 갱신 시점 차이, 앱에서 의도한 변경 검증 생략 문제를 만들 수 있다. 어떤 갱신·복구가 일어나는지는 Obsidian의 실제 파일 감시·저장 동작에 달렸으며 이번 조사 범위 밖이다.

### 앱·플러그인 패키지도 접근 가능한가?

- 읽기 가능한 설치 파일은 에이전트의 파일 도구에서도 읽을 수 있다. 코드를 읽을 수 있다는 사실 자체가 곧 권한 우회는 아니다.
- 플러그인 코드·설정 파일에 쓰기 권한까지 있다면 변경 가능성을 별도로 고려해야 한다. 이 플러그인의 MCP 인증이 OS 쓰기를 막지는 않는다.
- `main.ts`는 토큰을 설정과 함께 저장한다. 설정을 직접 읽을 수 있는 프로세스에 대해서는 토큰이 독립적인 비밀 경계가 되기 어렵다.
- 실제 Obsidian 설치 디렉터리 ACL, 코드 서명, 배포 package 무결성, `.obsidian` 파일의 Vault API 노출 여부는 확인하지 않았다. MCP로 패키지를 바꿀 수 있다고 단정하지 않는다.

## 5. 샌드박스는 어떻게 설정되어 있는가?

**분석한 플러그인에는 샌드박스 설정이 없다.** 설정은 주소·인증·blacklist·컨텍스트·resource·통계 중심이다. `src`에서 에이전트 프로세스 생성, OS 권한 하향, 컨테이너나 VM 정책, 파일 접근 중개를 구성하는 구현을 찾지 못했다. 빌드는 Node용 CommonJS bundle이며 `obsidian`, `electron`, Node builtin을 외부 모듈로 둔다. [types.ts](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/types.ts), [esbuild.config.mjs](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/esbuild.config.mjs)

Obsidian 공식 안내도 커뮤니티 플러그인은 Obsidian의 접근 권한을 상속하며, 플러그인별 권한을 신뢰할 수 있게 제한하지 못한다고 설명한다. **Restricted mode는 커뮤니티 플러그인 실행을 끄는 기능**이다. MCP 플러그인을 켠 상태에서 그 플러그인만 제한하는 sandbox가 아니다. [Obsidian Plugin security](https://obsidian.md/help/plugin-security)

| 장치 | 실제 경계 |
|---|---|
| loopback 바인딩 | 접속할 수 있는 네트워크 인터페이스 |
| Bearer token | 서버 요청을 허용할 credential |
| blacklist | 검사 경로를 통과하는 문서·메타데이터 접근 |
| JSON schema | 입력 형식 |
| 별도 프로세스 | 실행 단위·주소 공간; 자동 권한 축소는 아님 |
| OS sandbox / VM | 실제 프로세스의 파일·실행·네트워크 권한을 강제할 수 있는 별도 환경 |

문서 내용에 포함된 악의적 지시도 자연어 안내만으로 막는다고 보장할 수 없다. 실행 권한은 에이전트의 해석과 무관하게 service/OS 경계에서 검사해야 한다. 이 프로젝트의 annotations와 사용 지침은 그러한 강제 격리를 구현하지 않는다.
