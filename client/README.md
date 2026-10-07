# Resume Studio App

첨부 이력서 PDF의 정보 구조와 시각적 완성도를 기준으로 만든 로컬 우선 Electron 이력서 편집기다.

## 실행

`resume-studio` 프로젝트 루트에서 실행할 때는 `client`의 `package.json`을 명시한다.

```bash
cd /Users/isang-yun/code/resume-studio
npm --prefix client run app
```

개발 모드는 다음과 같이 실행한다.

```bash
npm --prefix client run dev
```

또는 `client` 디렉터리로 이동한 뒤 일반 npm 명령을 사용할 수 있다.

```bash
cd /Users/isang-yun/code/resume-studio/client
npm install
npm run dev
```

프로덕션 빌드를 실제 Electron 창으로 확인하려면 다음 명령을 사용한다.

```bash
npm run app
```

프로젝트 루트에는 `package.json`이 없으므로 루트에서 `npm run app`만 실행하면 동작하지 않는다.

## 구현 구조

```text
client/
└─ src/
   ├─ main/       Electron main process
   ├─ preload/    renderer에 노출할 최소 권한 API
   ├─ renderer/   React 기반 편집 UI, Markdown parser와 A4 미리보기
   └─ foundation/ 실행 환경이 공유하는 문서 모델, IPC 계약과 직렬화 규칙
```

## 경계

- `main`: 파일 시스템, 앱 창, 최근 문서와 PDF 내보내기를 소유한다.
- `preload`: `contextBridge`로 허용된 기능만 renderer에 노출한다.
- `renderer`: Node.js와 파일 시스템에 직접 접근하지 않는다.
- `foundation`: 둘 이상의 실행 환경이 함께 사용하는 환경 독립 타입과 규칙만 둔다.

## 현재 구현

- 프로필, 소개글, 경력, 교육, 프로젝트, 사이드 프로젝트, 대외활동과 프리텍스트 편집
- 문단 내부의 굵게, 밑줄과 링크
- 항목 및 콘텐츠 블록 추가, 삭제, 위·아래 이동과 표시 여부 설정
- 고정 `reference-resume-v1` 스타일의 A4 다중 페이지 미리보기
- 프로젝트 콘텐츠의 페이지 간 연결
- 앱 전용 데이터 디렉터리의 JSON 자동 저장과 직전 저장본 백업
- 최근 수정 순 이력서 목록과 여러 문서 생성·열기·이름 변경
- 삭제 확인, 휴지통 목록, 동일 ID 기반 개별 복원과 확인형 영구 삭제
- 기존 단일 이력서 파일의 원본 보존 자동 이전
- Chromium `printToPDF()`를 사용하는 PDF 파일 내보내기

색상, 글꼴, 간격과 레이아웃을 사용자가 바꾸는 기능은 포함하지 않는다.

`styleSheetId`는 renderer의 스타일 에셋 registry와 연결된다. 현재 registry에는 `reference-resume-v1` 하나만 등록되어 있다.

## 로컬 데이터

이력서 목록과 문서는 Electron의 운영체제별 앱 데이터 디렉터리 아래에 저장된다.

```text
Resume Studio/workspaces/library.json
Resume Studio/workspaces/library.json.backup
Resume Studio/workspaces/resumes/<documentId>.resume.json
Resume Studio/workspaces/resumes/<documentId>.resume.json.backup
Resume Studio/workspaces/trash/<documentId>.resume.json
```

기존 `default.resume.json`과 백업은 최초 이전 후에도 원본으로 보존한다. renderer는 파일 시스템에 직접 접근하지 않고 preload가 공개한 ID 기반 CRUD 및 PDF API만 사용한다.
