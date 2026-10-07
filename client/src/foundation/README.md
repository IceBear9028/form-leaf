# Foundation

main, preload, renderer 중 둘 이상의 실행 환경이 공유하는 환경 독립 소스만 둔다. 현재 `ResumeDocument` v2와 v1 레거시 타입, IPC 요청·응답 타입, 목록·휴지통 규칙과 Markdown 직렬화를 담당한다.

`resumeLibrary.ts`는 여러 이력서의 목록·휴지통 summary, index 검증, 최근 수정·삭제 순 정렬과 preload API 계약을 제공한다. `markdownSerialization.ts`는 main의 v1 migration과 renderer의 parser 양쪽이 공유하는 의존성 없는 직렬화만 제공한다.

React, DOM, Electron과 Node 파일 시스템에 의존하는 구현은 이 디렉터리에 두지 않는다. remark parser와 source range 편집은 renderer가, 저장 migration은 main이 소유한다.
