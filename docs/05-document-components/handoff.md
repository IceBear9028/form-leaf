# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 범용 저장소·개인 component library·앱 route 전환 완료
- 현재 단계: 9. 레거시 runtime 제거·전체 검증
- 완료 커밋: `e6542b4`, `2e80fbe`, `04ac9fc`, `325fc4d`, `b11bed9`, `39116ba`, `c47468b`
- 커밋 정책: 각 계획 단계 완료 후 검증·문서 갱신과 함께 커밋

## 8단계 완료 내용

- `WorkspaceDocument`와 preload 저장 계약을 범용 `DocumentData`로 전환했다.
- `documents.json`, `documents/<id>.document.json`, `document-trash/` 기반 범용 repository를 구현했다.
- 새 문서는 빈 root만 가진 범용 문서로 생성한다.
- 과거 단일 파일과 `resumes/` 파일을 legacy importer로 읽어 새 파일에 복사하고, 모든 저장 성공 후에만 migration 완료를 기록한다.
- 원본 과거 파일은 수정하거나 삭제하지 않으며 완료 표식으로 재실행 중복 import를 방지한다.
- `components.json`, `components/<id>.component.json` 기반 개인 component library CRUD와 backup을 구현했다.
- component 목록·저장·불러오기·삭제 IPC와 preload API를 추가했다.
- 가져온 component package는 모든 dependency ID를 새로 만들어 현재 문서에 독립 복사한다.
- 범용 autosave session과 `GenericDocumentEditorPage`를 앱 route에 연결했다.
- 문서 목록, 휴지통, 오류와 PDF 문구에서 특정 문서 목적을 제거했다.
- screen과 같은 renderer를 사용하는 별도 print surface를 PDF 출력에 연결했다.

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `npm run test:storage` | 통과, 2개 |
| `npm run test:library` | 통과, 8개 |
| `npm test` | 통과, 전체 61개 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `npm start` | production Electron 창 시작 후 startup 오류 없음, 수동 종료 |
| 새 core·repository·editor·library 목적별 domain token 검색 | compatibility export와 legacy path만 남음 |

## 현재 제한

- 과거 editor, preview, style registry와 해당 테스트가 아직 repository에 남아 있다.
- `foundation/document.ts`의 과거 타입 compatibility export와 `documentPaths.ts`의 legacy 입력 경로를 importer 경계 아래로 옮겨야 한다.
- 실제 창에서 장문 직접 편집·재실행·PDF 결과를 사람 눈으로 끝까지 확인하는 최종 회귀는 9단계에서 수행한다.

## 다음 작업

과거 editor·preview·style runtime과 임시 harness를 제거한다. legacy 입력 타입과 path를 `main/document/legacy` 아래로 완전히 격리한 뒤 production 정적 검색, 전체 테스트·typecheck·build·Electron 회귀와 diff 검사를 수행한다.
