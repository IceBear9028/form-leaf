# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 9단계 구현·검증 완료
- 9단계 커밋: 이 문서를 포함하는 최종 커밋 (`git log -1`로 확인)
- 8단계 커밋: `89fb676 feat: switch app to generic document stack`
- 앞선 단계 커밋: `e6542b4`, `2e80fbe`, `04ac9fc`, `325fc4d`, `b11bed9`, `39116ba`, `c47468b`

## 최종 구현

- production route, repository, preload와 IPC는 범용 `DocumentData`만 사용한다.
- 새 문서는 의미 없는 빈 root로 생성하고 `.document.json` 파일과 `documents.json` index에 원자적으로 저장한다.
- 과거 입력 타입·validator·직렬화·경로는 `main/document/legacy` 아래에만 있다.
- 과거 파일은 원본을 수정하지 않고 별도 범용 파일로 변환한 뒤 모든 저장 성공 후 완료 표식을 남긴다.
- node tree, inspector, component·repeater와 preview 직접 편집을 하나의 범용 editor route에 연결했다.
- 개인 component library는 별도 index/item과 backup을 사용하고 문서로 가져올 때 모든 dependency ID를 새로 만든다.
- 화면과 print는 같은 `NodeRenderer`를 사용한다. 숨겨진 A4 측정 DOM이 root child 높이를 재고 keep·break 규칙으로 화면/print 페이지를 동일하게 나눈다.
- 과거 목적별 editor, preview, style registry, prototype와 임시 harness를 제거했다.
- production core·repository·renderer·editor에는 문서 목적이나 업무 카테고리 문자열 분기가 없다.

## 최종 검증

| 명령 또는 확인 | 결과 |
|---|---|
| `npm test` | 통과, 전체 60개 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| production source 목적별 domain token 정적 검색 | legacy 폴더 밖 결과 없음 |
| 격리 Electron CRUD smoke | 문서 생성·저장·재로드·휴지통·복원, component 저장·불러오기·삭제 통과 |
| 격리 Electron route smoke | library에서 문서를 열어 범용 editor·직접 편집 값·측정 DOM 확인 |
| 격리 Electron pagination smoke | 120개 root child를 screen 3페이지·print 3페이지로 동일 분할 |
| `git diff --check` | 최종 커밋 직전 수행 |

Electron smoke는 `DOCUMENT_USER_DATA_DIRECTORY`로 만든 임시 디렉터리에서 실행했고 검증 후 해당 디렉터리를 삭제했다. 실제 사용자 workspace는 사용하지 않았다.

## 남은 작업

없음. 최종 diff 검사와 9단계 커밋만 수행한다.
