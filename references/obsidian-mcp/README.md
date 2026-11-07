# Obsidian MCP 설계 및 보안 분석

분석일: 2026-11-01

## 대상과 방법

- 대상: 커뮤니티 플러그인 [Leonezz/obsidian-mcp-server](https://github.com/Leonezz/obsidian-mcp-server). Obsidian 공식 구현이나 `cyanheads/obsidian-mcp-server`와 구분한다.
- 분석 기준: [`e16ba0e95ed22f0d75c20efbd07b37525da2ba65`](https://github.com/Leonezz/obsidian-mcp-server/tree/e16ba0e95ed22f0d75c20efbd07b37525da2ba65), 커밋 시각 `2026-10-13T01:05:47+08:00`, package/manifest 버전 `1.1.10`, MIT.
- 사용자가 요청한 **REA 스킬**을 읽고 적용했다. 스킬은 전체 소스가 있는 저장소 분석에는 일반 저장소 도구를 사용하도록 명시한다. 따라서 REA 엔진 설치·바이너리 역컴파일 없이 소스 추적과 모의 환경 검증을 수행했다.
- 공개 저장소를 임시 디렉터리에 내려받았다. 실제 Obsidian, 사용자 vault, Formleaf 문서·backup에는 접근하거나 변경하지 않았다.
- 배포된 `main.js`와 소스의 일치 여부, 실제 Obsidian 동작, OS 샌드박스는 검증하지 않았다. 아래 결론의 범위는 고정한 소스 버전이다.

## 핵심 결론

**이 프로젝트는 Obsidian이 가진 문서 기능과 현재 작업 문맥을 외부 에이전트에 제공하는 앱 내부 MCP 플러그인이다. 외부 에이전트를 격리하는 실행 환경은 제공하지 않는다.**

| 질문 | 답 | 근거 수준 |
|---|---|---|
| 어떤 목적으로 만들었나? | 활성 문서·vault 구조를 에이전트가 이해하고, Obsidian API로 조회·수정하게 한다 | README와 구현 확인 |
| 자체 AI나 로그인도 제공하나? | 분석한 플러그인은 MCP 서버다. 모델 추론·계정 로그인·채팅 실행 계층은 구현되어 있지 않다 | 소스 범위 확인 |
| MCP로 허용하지 않은 파일은 어떻게 막나? | 공통 토큰 인증과 경로·태그 blacklist를 도구 및 일부 resource 경로에서 검사한다 | 소스 및 P01/P09 |
| blacklist가 모든 정보 노출을 막나? | 아니다. 초기 폴더 목록, 전역 태그 집계, 변경 알림에 필터 적용 누락이 있다 | 소스 및 P02–P04 |
| 외부 shell의 직접 파일 수정을 차단하나? | 차단하지 않는다. 그 프로세스에 OS 파일 권한이 있으면 MCP를 거치지 않는 접근이 가능하다 | 신뢰 경계에 대한 추론; 실제 vault 실험 제외 |
| 앱·플러그인 패키지 접근을 막나? | 별도 통제 구현을 찾지 못했다. OS 권한과 앱 배포 방식의 문제다 | 소스 범위 확인; 실제 패키지 변경 제외 |
| 샌드박스 설정은 어디 있나? | 이 플러그인에는 없다. loopback 주소, 인증, blacklist는 각각 다른 통제다 | 설정·서버·전체 src 조사 |
| Formleaf에 참고할 수 있나? | 앱 내부 MCP와 컨텍스트 제공은 유용하다. 권한·동시 편집·격리를 그대로 가져오면 요구를 충족하지 못한다 | 분석에 따른 제안 |

핵심 구현: [서버](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/server.ts), [접근 검사](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/security.ts), [컨텍스트](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/instructions.ts), [설정](https://github.com/Leonezz/obsidian-mcp-server/blob/e16ba0e95ed22f0d75c20efbd07b37525da2ba65/src/types.ts).

## 읽는 순서

1. [설계 철학과 호출 구조](architecture.md)
2. [보안 경계·외부 shell·샌드박스](security.md)
3. [Formleaf에 적용할 점과 검토 순서](formleaf-implications.md)
4. [근거 목록·재현 방법·미확인 범위](evidence.md)

## 검증 요약

고정한 원본 TypeScript 함수를 변환해 **9개 소스 수준 검증을 수행했고, 모두 예상한 동작을 확인**했다. Obsidian API와 SDK 경계는 모의 구현이다. 이 결과를 실제 앱 보안 감사 통과나 공격 재현 성공으로 해석하지 않는다.

- [검증 코드](probes/source-probes.cjs)
- [실행 결과와 사용한 원본 파일 SHA-256](probes/results.json)

이 분석은 [11번 MCP 작업](../../docs/11-agent-tools-mcp/README.md)의 참고 자료다. 기존 작업 범위와 미확정 설계를 변경하지 않는다.
