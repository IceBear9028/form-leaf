# Renderer

`App.tsx`는 범용 문서 library, 휴지통과 editor 화면 전환만 담당한다. 목록 CRUD 상태는 `useDocumentLibrary`, 자동 저장과 저장 실패·목록 복귀 전 flush는 `useGenericDocumentSession`이 소유한다.

`GenericDocumentEditorPage`는 다음 범용 UI를 조립한다.

- `DocumentStructurePanel`: node tree와 구조 transaction
- `ComponentReusePanel`: 문서 내부 component와 개인 library 복사
- `PropertyInspector`: 선택 node·instance·repeater 속성
- `rendering/DocumentRenderer`: screen·measure·print 공통 DOM renderer
- `markdown/`: Markdown source range 직접 편집

renderer는 node type, prop type과 검증된 style만 해석하며 사용자 이름이나 문서 목적에 따라 분기하지 않는다.
