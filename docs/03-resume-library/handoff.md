# 여러 이력서 보관함 세션 인수인계

## 현재 상태

- 상태: 1차 구현 및 자동·실제 앱 검증 완료
- 작업 트리: 03 문서와 다중 이력서 구현 변경 존재, 커밋 전
- 기준 커밋: `a280b3b feat: add preview markdown block shortcuts`

## 사용자 요청

- 앱 실행 시 이력서 리스트 페이지를 먼저 표시한다.
- 목록에서 원하는 이력서를 클릭해 편집한다.
- 여러 이력서를 생성·조회·수정·삭제할 수 있게 한다.
- 이력서 목록을 최근 수정 순으로 표시한다.
- 삭제한 이력서를 휴지통 UI에서 복원할 수 있게 한다.

## 조사 결과

- 현재 메인 프로세스는 `workspaces/default.resume.json`만 로드·저장한다.
- 현재 preload에는 단일 `loadDocument`, `saveDocument`만 있다.
- `App`은 시작 즉시 한 문서를 열며 목록 화면 상태가 없다.
- 문서에는 이미 `documentId`, `name`, `updatedAt`이 있어 다중 문서 식별에 재사용할 수 있다.
- 기존 v1→v2 마이그레이션과 `.backup` 저장 흐름이 있다.

## 설계 요약

- `library.json`에는 활성 `ResumeSummary`와 `DeletedResumeSummary`를 저장한다.
- 실제 문서는 `workspaces/resumes/<documentId>.resume.json`으로 분리한다.
- 목록 요약은 문서 저장 때 동기화하며 시작 시 실제 파일과 조정한다.
- 파일 CRUD는 main-process repository로 격리한다.
- 앱은 `library | editor` 두 화면 상태를 사용한다.
- 기존 단일 파일은 복사 이전하고 원본과 백업을 보존한다.
- 삭제 파일은 즉시 영구 삭제하지 않고 `workspaces/trash`로 옮긴다.
- 휴지통은 최근 삭제 순으로 표시하고 개별 문서를 같은 ID와 내용으로 복원한다.
- 목록으로 돌아가기 전에 현재 자동 저장을 완료한다.

## 구현 결과

- `shared/resumeLibrary.ts`: 활성·삭제 summary, index validator, 제목 정규화와 결정적 정렬
- `main/resumeRepository.ts`: 원자적 index·문서 저장, 백업 복구, CRUD, trash·restore·permanent delete, legacy 이전
- `shared/ipc.ts`, `preload/index.ts`: ID 기반 list/create/load/save/rename/delete/list-deleted/restore/permanently-delete API
- `renderer/App.tsx`: library·trash·editor 화면 전환, 문서별 자동 저장과 목록 이동 전 flush
- `renderer/components/ResumeLibrary.tsx`: 최근 수정 순 카드 목록, 빈 상태, 이름 변경·삭제 dialog, 휴지통·복원·완전 삭제 UI
- `test/resume-library.test.mjs`: 정렬, 문서 격리, ID 불일치, 백업 복구, 충돌 없는 복원과 legacy 이전 검증

## 확정된 동작

1. 앱은 항상 목록에서 시작한다.
2. 새 문서 기본 제목은 `제목 없는 이력서`다.
3. 같은 제목을 허용한다.
4. `updatedAt` 기준 최근 수정한 문서를 먼저 표시하고 동률 순서도 고정한다.
5. 기존 단일 문서는 `내 이력서`로 이전한다.
6. 삭제는 확인 후 내부 trash로 이동한다.
7. 목록에서 휴지통으로 들어가 삭제한 문서를 개별 복원할 수 있다.
8. 휴지통의 개별 완전 삭제는 복구 불가 확인 후 실행한다.
9. 휴지통 전체 비우기와 30일 자동 삭제는 이번 범위에서 제외한다.

## 검증 결과

- `npm test`: Markdown 15개, migration 3개, style 2개, library 7개로 총 27개 통과
- `npm run build`: typecheck와 Electron production build 통과
- 임시 Electron userData에서 빈 목록 → 2개 생성 → 이름 저장 → 최근 수정 순 → 삭제 → 휴지통 → 복원 → 재로드 통과
- 삭제 직후 index backup에 활성 1개와 휴지통 1개가 기록되고, 복원 후 활성 2개·휴지통 0개가 되는 것을 확인
- 실제 기존 `default.resume.json`과 새 `resumes/<id>.resume.json`이 byte 단위로 같고 기존 파일·백업이 모두 남아 있는 것을 확인

## 후속 범위

- 휴지통 전체 비우기나 선택 삭제
- 기간 기반 자동 만료 정책
- 검색, 정렬 방식 선택, 복제, 가져오기·내보내기
- 목록 카드의 썸네일이나 지원 회사 같은 추가 메타데이터
