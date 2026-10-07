# Renderer

React 기반 이력서 목록·휴지통, Markdown 편집 폼, 스타일 레지스트리를 사용하는 A4 다중 페이지 미리보기와 사용자 상호작용을 담당한다.

- `src/app`: Renderer 진입점, 전역 CSS와 최상위 화면 조립
- `src/pages/document-library`: 문서 목록과 휴지통 화면
- `src/pages/document-editor`: 이력서 편집, Markdown과 preview
- `src/shared`: 둘 이상의 페이지가 함께 사용하는 UI 비종속 helper

`App.tsx`는 library/trash/editor 화면 전환만 담당한다. 목록·휴지통 CRUD 상태는 `useDocumentLibrary`, 자동 저장·저장 실패·목록 복귀 전 flush는 `useDocumentSession`이 소유한다.

사용자가 입력한 데이터를 그대로 표시하며 문장을 작성하거나 요약하지 않는다. 등록된 이력서 스타일 프리셋을 선택할 수 있지만 자유 배치는 제공하지 않는다.

스타일 프리셋은 Markdown 문법과 분리되어 본문 글꼴·색상·제목 계층·목록·코드·표와 프로젝트 제목을 교체할 수 있다. 전체 이력서 레이아웃과 사용자 정의 템플릿 파일 로딩은 아직 지원하지 않는다.

remark parser와 source range 기반 Markdown 편집은 브라우저 편집 UI가 사용하는 `pages/document-editor/markdown`에서 관리한다. DOM Selection 변환은 `sourceSelection.ts`, 순수 source 수정은 `edits.ts`로 분리한다.

이력서 전용 form과 A4 preview는 `pages/document-editor/resume` 아래에 둔다. pagination 계산은 `resume/preview/pagination.ts`, style 계약·preset·CSS 변수 변환은 `pages/document-editor/style`에서 각각 관리한다.
