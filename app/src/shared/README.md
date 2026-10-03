# Shared

`ResumeDocument` 스키마, 콘텐츠 블록, 인라인 텍스트 mark와 IPC 요청·응답 타입을 담당한다.

현재는 단일 활성 문서만 사용하지만 `documentId`, `schemaVersion`과 `styleSheetId`를 유지해 이후 문서 및 스타일 확장이 가능하게 한다.
