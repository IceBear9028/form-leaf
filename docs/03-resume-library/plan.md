# 여러 이력서 보관함 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 완료 기준 |
|---|---|---|---|
| 1 | 현재 저장·화면 구조 조사 | 완료 | 단일 파일, IPC, 자동 저장 경계 확인 |
| 2 | 제품 범위와 데이터 모델 설계 | 완료 | CRUD·이전·오류·완료 기준 문서화 |
| 3 | 사용자 설계 확인 | 완료 | MVP 범위와 기본 동작 승인 |
| 4 | 목록 타입과 repository | 완료 | 파일 기반 CRUD와 이전 테스트 통과 |
| 5 | IPC와 preload API 전환 | 완료 | renderer에서 ID 기반 CRUD 호출 가능 |
| 6 | 목록·휴지통 화면 구현 | 완료 | 정렬·빈 상태·생성·이름 변경·삭제·복원·영구 삭제 동작 |
| 7 | 편집 화면 연결 | 완료 | 저장 후 목록 복귀와 문서 간 격리 |
| 8 | 회귀·실제 앱 검증 | 완료 | 테스트·빌드·재실행 확인 |
| 9 | 문서 및 인수인계 갱신 | 완료 | 구현 결과와 검증 내용 기록 |

## 1. 공유 모델

- `ResumeSummary`, `ResumeLibraryIndex`와 validator를 추가한다.
- `DeletedResumeSummary`와 삭제·복원 인덱스 상태를 추가한다.
- 제목 정규화와 프로필 이름 추출을 순수 함수로 구현한다.
- 활성 목록과 휴지통의 결정적 정렬 함수를 구현한다.
- 기존 `ResumeDocument` schemaVersion 2는 변경하지 않는다.
- `ResumeStudioApi`를 ID 기반 목록 API로 전환한다.

## 2. Repository

- root 경로를 주입할 수 있는 repository를 구현한다.
- 문서·인덱스의 tmp write + rename과 backup을 공통화한다.
- ID를 검증하고 renderer 입력으로 파일 경로를 직접 만들지 않는다.
- 목록 조정과 legacy `default.resume.json` 이전을 구현한다.
- 생성, 로드, 저장, 이름 변경, trash 이동, 복원과 확인형 영구 삭제를 구현한다.
- 문서 ID별 저장 큐를 연결한다.

## 3. 자동 테스트

- 기존 migration fixture를 repository 이전 테스트에 재사용한다.
- 임시 디렉터리에서 CRUD와 앱 재시작에 해당하는 새 repository 인스턴스 재로드를 검사한다.
- 실패·손상·부분 저장 시 사용자 데이터가 빈 기본 문서로 대체되지 않는지 검사한다.
- 삭제→재시작→복원 후에도 ID, 본문과 수정 시각이 유지되는지 검사한다.
- 영구 삭제가 선택한 휴지통 문서와 백업만 제거하는지 검사한다.
- `npm test`에 library test script를 포함한다.

## 4. IPC와 preload

- list/create/load/save/rename/delete/list-trash/restore/permanently-delete 채널을 등록한다.
- mutation 인자와 반환값을 메인 프로세스에서 검증한다.
- 기존 PDF와 Finder API는 유지한다.
- 사용하지 않는 단일 문서 IPC를 제거한다.

## 5. React 화면 분리

- 현재 편집기 부분을 `ResumeEditor`로 분리한다.
- `App`에 `library | editor` 화면 상태와 목록 로딩 상태를 둔다.
- 목록에서 생성하거나 열 때 편집 화면으로 전환한다.
- 목록 복귀 시 대기 중 저장을 await하고 실패하면 이동하지 않는다.
- 비동기 응답이 다른 문서 상태를 덮어쓰지 않도록 ID를 확인한다.

## 6. 목록과 휴지통 UI

- 기존 toolbar와 어울리는 목록 header와 card grid를 구현한다.
- 제목, 프로필 이름, 수정 시각과 열기 행동을 최근 수정 순으로 표시한다.
- 접근 가능한 이름 변경 dialog와 삭제 확인 dialog를 구현한다.
- 휴지통 진입, 최근 삭제 순 카드, 개별 복원과 목록 복귀를 구현한다.
- 복구 불가 경고가 있는 개별 완전 삭제 dialog를 구현한다.
- 빈 상태, 로딩, 오류, mutation 진행 상태를 구현한다.
- 창 drag 영역과 클릭 가능한 no-drag 영역을 구분한다.

## 7. 검증 순서

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. 기존 실제 데이터 사본으로 legacy 이전 확인
5. 문서 두 개 생성 후 각기 다른 프로필·Markdown 저장
6. 목록 복귀·재열기·앱 재실행 확인
7. 최근 수정 순과 동률 정렬의 재실행 안정성 확인
8. rename과 delete 대상 격리, 휴지통 재실행과 restore 확인
9. Preview Markdown 편집과 PDF 내보내기 회귀 확인
10. `git diff --check`

## 구현 중 지켜야 할 안전 조건

- 실제 사용자 `default.resume.json`을 테스트 목적으로 수정하거나 삭제하지 않는다.
- 이전·삭제 검증은 임시 디렉터리 또는 복사본에서 수행한다.
- 손상되거나 알 수 없는 문서를 기본 문서로 덮어쓰지 않는다.
- 생성·저장 실패 때 다른 문서의 index entry를 변경하지 않는다.
- 실제 사용자 저장소를 대상으로 destructive 테스트를 실행하지 않는다.

## 완료 결과

- `ResumeRepository`가 목록 인덱스와 ID별 문서 파일을 관리한다.
- 활성 목록과 휴지통에 결정적인 정렬 규칙을 적용한다.
- 기존 단일 파일을 원본 보존 방식으로 자동 이전한다.
- 목록·편집·휴지통 세 화면과 생성·열기·이름 변경·삭제·복원을 연결했다.
- 편집 화면에서 목록으로 이동하기 전에 대기 중 저장을 완료한다.
- repository 테스트 7개와 기존 회귀 테스트를 포함한 전체 27개 테스트가 통과한다.
- production build와 격리된 Electron 전체 사용자 흐름 검증이 통과했다.
