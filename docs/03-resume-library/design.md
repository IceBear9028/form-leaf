# 여러 이력서 보관함 기술 설계

## 확인한 현재 구조

- 메인 프로세스가 `workspaces/default.resume.json` 한 파일을 직접 읽고 쓴다.
- preload API는 `loadDocument()`와 `saveDocument(document)`만 공개한다.
- 렌더러 `App`은 mount 시 문서를 바로 로드하며 별도 화면 상태가 없다.
- 저장 큐는 앱 전체에 하나이고, 650ms debounce 후 현재 문서를 저장한다.
- `ResumeDocument`에는 이미 안정적인 `documentId`, `name`, `updatedAt`이 있다.
- v1 문서는 로드 시 v2로 변환되고 최초 저장 전에 별도 백업을 만든다.

## 화면 상태

라우터를 추가하지 않고 최상위 상태로 두 화면을 전환한다.

```ts
type AppView =
  | { type: "library" }
  | { type: "trash" }
  | { type: "editor"; resumeId: string };
```

URL 기반 공유나 뒤로 가기가 없는 데스크톱 앱 MVP이므로 라우터 의존성은 추가하지 않는다.

## 공유 타입

`ResumeDocument` 스키마는 변경하지 않는다. 목록 전용 타입을 추가한다.

```ts
type ResumeSummary = {
  id: string;
  title: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
};

type DeletedResumeSummary = ResumeSummary & {
  deletedAt: string;
};

type ResumeLibraryIndex = {
  schemaVersion: 1;
  resumes: ResumeSummary[];
  trash: DeletedResumeSummary[];
};
```

`ResumeSummary`의 `title`, `profileName`, `updatedAt`은 빠른 목록 표시를 위한 저장된 요약이다. 문서 저장과 이름 변경은 문서 파일을 먼저 저장한 뒤 같은 내용으로 인덱스를 갱신한다. `id`는 `ResumeDocument.documentId`와 같으며 배열 index는 식별자로 사용하지 않는다.

제목의 원본은 `ResumeDocument.name`이다. 목록의 `title`은 이를 매번 빠르게 표시하기 위한 복제 값이며, 조정 과정에서 문서 값으로 다시 맞춘다. 따라서 편집 화면과 목록에 서로 다른 이름 변경 규칙을 만들지 않는다.

`createdAt`은 기존 문서에 없으므로 새 문서는 생성 시각을 사용하고, 이전 문서는 파일 생성 시각을 우선 사용하되 얻을 수 없으면 기존 `updatedAt`을 사용한다.

활성 목록은 `updatedAt` 내림차순, `createdAt` 내림차순, ID 오름차순으로 정렬한다. 휴지통은 `deletedAt` 내림차순, ID 오름차순으로 정렬한다. 정렬은 repository가 반환하기 전에 적용해 UI와 테스트에서 같은 규칙을 사용한다.

## 파일 구조

```text
Resume Studio/workspaces/
├── library.json
├── library.json.backup
├── default.resume.json             # 기존 파일, 이전 후에도 보존
├── default.resume.json.backup      # 기존 백업, 보존
├── resumes/
│   ├── resume-<uuid>.resume.json
│   └── resume-<uuid>.resume.json.backup
└── trash/
    ├── <timestamp>-resume-<uuid>.resume.json
    └── <timestamp>-resume-<uuid>.resume.json.backup
```

파일명은 검증된 ID만 사용한다. renderer가 경로나 파일명을 전달하지 않으며 메인 프로세스 repository가 ID에서 경로를 계산한다.

## Repository 경계

파일 작업을 `main/index.ts`의 IPC 등록과 분리한다.

```ts
interface ResumeRepository {
  list(): Promise<ResumeSummary[]>;
  listTrash(): Promise<DeletedResumeSummary[]>;
  create(): Promise<{ summary: ResumeSummary; document: ResumeDocument }>;
  load(id: string): Promise<ResumeDocument>;
  save(id: string, document: ResumeDocument): Promise<ResumeSummary>;
  rename(id: string, title: string): Promise<ResumeSummary>;
  remove(id: string): Promise<void>;
  restore(id: string): Promise<ResumeSummary>;
  permanentlyDelete(id: string): Promise<void>;
}
```

예상 모듈 책임:

| 모듈 | 책임 |
|---|---|
| `shared/resumeLibrary.ts` | 목록 타입, 검증, 제목 정규화, summary 생성 |
| `main/resumeRepository.ts` | 경로, 원자적 저장, 백업, 이전, CRUD |
| `shared/ipc.ts` | 채널 이름 |
| `preload/index.ts` | 최소 권한 API 노출 |
| `renderer/App.tsx` | 화면 전환과 저장 완료 보장 |
| `renderer/components/ResumeLibrary.tsx` | 목록, 빈 상태, dialog와 사용자 행동 |

## IPC 계약

```ts
type ResumeStudioApi = {
  listResumes(): Promise<ResumeSummary[]>;
  listDeletedResumes(): Promise<DeletedResumeSummary[]>;
  createResume(): Promise<{ summary: ResumeSummary; document: ResumeDocument }>;
  loadResume(id: string): Promise<ResumeDocument>;
  saveResume(id: string, document: ResumeDocument): Promise<ResumeSummary>;
  renameResume(id: string, title: string): Promise<ResumeSummary>;
  deleteResume(id: string): Promise<void>;
  restoreResume(id: string): Promise<ResumeSummary>;
  permanentlyDeleteResume(id: string): Promise<void>;
  exportPdf(suggestedName: string): Promise<PdfExportResult>;
  showInFolder(filePath: string): Promise<void>;
};
```

기존 단일 문서 IPC는 새 UI 전환과 함께 제거한다. 모든 mutation 입력은 메인 프로세스에서 다시 검증한다.

## 저장 순서와 일관성

### 문서 저장

1. 요청 ID와 `document.documentId` 일치를 검사한다.
2. 현재 정상 파일을 `.backup`으로 복사한다.
3. 갱신한 `updatedAt`을 포함한 문서를 `.tmp`에 쓰고 rename한다.
4. 문서에서 summary를 계산해 인덱스를 원자적으로 저장한다.
5. renderer에 summary를 반환한다.

문서 저장 성공 후 인덱스 저장만 실패할 수 있다. 다음 `list()`는 `resumes` 디렉터리를 검사해 누락된 파일을 인덱스에 다시 포함하고, 문서에서 달라진 요약을 정정한다. 인덱스는 데이터 원본이 아니라 탐색용 목록이다.

### 저장 큐

저장 큐는 문서 ID별로 둔다. 서로 다른 문서의 저장 실패가 다음 문서 저장을 막지 않게 하고, 같은 문서의 쓰기 순서는 유지한다.

렌더러가 목록으로 이동할 때는 debounce timer를 취소하고 현재 `saveNow()`를 await한다. 이전 문서의 늦은 응답은 현재 편집 문서의 save state를 덮어쓰지 않도록 요청 시점의 ID와 비교한다.

## 생성과 삭제의 장애 복구

### 생성

문서 파일을 먼저 저장하고 인덱스를 갱신한다. 인덱스 쓰기 전 앱이 종료되면 다음 목록 조정 과정이 문서를 발견한다. 사용자 문서를 롤백 목적으로 삭제하지 않는다.

### 삭제

문서와 백업을 `trash`로 이동한 뒤 활성 인덱스에서 제거하고 `deletedAt`을 가진 휴지통 항목으로 옮긴다. 인덱스 갱신이 실패하면 원래 위치로 되돌리기를 시도한다. 되돌리기도 실패하면 다음 시작 때 `trash`와 인덱스의 불일치를 감지해 삭제 항목이 활성 목록에 유령 카드로 남지 않도록 한다.

### 복원

휴지통 문서와 백업을 원래 `resumes` 위치로 이동하고 휴지통 summary를 활성 summary로 되돌린다. 같은 ID의 활성 파일이나 index entry가 있으면 덮어쓰지 않고 실패한다. 파일 이동 후 인덱스 갱신이 실패하면 휴지통 위치로 되돌리기를 시도한다.

`createdAt`과 `updatedAt`은 삭제 전 값을 유지하며 `deletedAt`만 제거한다. 인덱스가 손상되거나 오래된 경우에는 `trash` 파일을 검사하고 파일 수정 시각을 임시 `deletedAt`으로 사용해 복원 가능한 항목을 재구성한다.

### 완전 삭제

휴지통 index에서 대상만 먼저 제거한 뒤 `.backup`, `.v1.backup`, 문서 본체 순서로 삭제한다. 보조 백업 삭제가 실패하면 본체를 남기고 기존 index 복구를 시도한다. 문서 ID는 경로 계산 전에 다시 검증하며 활성 문서 경로는 영구 삭제 대상이 될 수 없다.

30일 자동 삭제는 구현하지 않는다. 앱을 오랫동안 열지 않았거나 시스템 시각이 달라진 경우의 예기치 않은 삭제를 피하고, 사용자가 확인 dialog에서 명시적으로 선택한 항목만 제거한다.

## 기존 단일 파일 이전

이전은 repository 초기화에서 한 번의 멱등 연산으로 수행한다.

```text
library.json 있음 ─────────────→ 인덱스 검증·문서 조정
library.json 없음
  ├─ default.resume.json 있음 ─→ 검증 → resumes에 복사 → 인덱스 생성
  └─ 기존 파일 없음 ──────────→ 빈 인덱스 생성
```

- v1이면 기존 `migrateResumeDocumentV1`을 재사용한다.
- 대상 ID 파일이 이미 있으면 덮어쓰지 않고 내용을 검증한 뒤 같은 항목으로 등록한다.
- 기존 기본 파일은 읽기 전용 이전 원본으로 남긴다.
- 새 인덱스를 만들 때 `trash`는 빈 배열로 시작한다.
- 손상된 기존 파일은 자동으로 빈 문서로 대체하지 않는다. 기존 백업 복구 후에도 실패하면 명시적 오류를 반환한다.

## UI 구성

```text
App
├─ ResumeLibrary
│  ├─ LibraryHeader
│  ├─ ResumeCard[]
│  ├─ RenameDialog
│  └─ DeleteConfirmDialog
├─ ResumeTrash
│  ├─ TrashHeader
│  └─ DeletedResumeCard[] + 복원·완전 삭제
└─ ResumeEditor (현재 App 편집 영역 분리)
   ├─ EditorToolbar + 목록으로
   ├─ EditorPanel
   └─ ResumePreview
```

`App`은 목록 데이터와 화면 전환을 소유하고, 편집 문서 상태·debounce·PDF 동작은 `ResumeEditor`로 분리한다. 기존 Markdown 편집 컴포넌트는 수정하지 않는 것을 기본으로 한다.

## 테스트 전략

### 순수 타입·요약 테스트

- 인덱스 검증
- 빈 제목 정규화
- 프로필 이름 추출
- 문서에서 summary 생성
- 최근 수정 순과 동률 정렬
- 최근 삭제 순 정렬

### Repository 통합 테스트

임시 디렉터리를 주입해 실제 파일 연산을 검사한다.

- 빈 저장소 목록
- 여러 문서 생성·독립 저장·재로드
- 잘못된 ID와 documentId 불일치 거부
- rename이 문서와 index 모두 갱신
- 삭제가 대상만 trash로 이동
- 복원이 같은 ID·내용·시각을 유지하고 활성 목록으로 이동
- 활성 ID 충돌 시 복원이 어떤 파일도 덮어쓰지 않음
- 영구 삭제가 선택한 휴지통 문서와 백업만 제거
- 손상된 현재 파일의 backup 복구
- v1/v2 기존 단일 파일 이전과 반복 실행의 멱등성
- 문서는 저장됐지만 index가 오래된 상태의 조정

### UI·실제 앱 검증

- 실행 → 목록 → 생성 → 편집 → 저장 → 목록 → 재열기
- 두 문서에 다른 값을 저장하고 교차 오염이 없는지 확인
- 이름 변경, 삭제 취소, 삭제 확인과 마지막 문서 빈 상태
- 휴지통 진입, 최근 삭제 순, 개별 복원과 복원 후 열기
- 목록 이동 직전 미저장 입력 보존
- 재실행 후 목록과 내용 보존
- Preview 직접 편집, PDF 내보내기 회귀

## 제외와 후속 확장

검색, 정렬 선택, 복제, 가져오기·내보내기, 휴지통 전체 비우기, 자동 만료와 클라우드 동기화는 별도 작업 단위로 다룬다.
