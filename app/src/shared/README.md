# Shared

Markdown 본문을 저장하는 `ResumeDocument` v2 스키마, v1 레거시 타입·마이그레이션과 IPC 요청·응답 타입을 담당한다. `markdown.ts`는 remark 파싱을, `markdownSerialization.ts`는 메인 프로세스에서도 안전하게 사용할 의존성 없는 v1 직렬화를 담당한다.

현재는 단일 활성 문서만 사용하지만 `documentId`, `schemaVersion`과 `styleSheetId`를 유지한다. `styleSheetId`는 콘텐츠 스키마와 독립적이며 렌더러의 스타일 레지스트리가 해석한다.
