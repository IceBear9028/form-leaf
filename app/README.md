# Resume Studio App

첨부 이력서 PDF의 정보 구조와 시각적 완성도를 기준으로 만든 로컬 우선 Electron 이력서 편집기다.

## 실행

`resume-studio` 프로젝트 루트에서 실행할 때는 `app`의 `package.json`을 명시한다.

```bash
cd /Users/isang-yun/code/resume-studio
npm --prefix app run app
```

개발 모드는 다음과 같이 실행한다.

```bash
npm --prefix app run dev
```

또는 `app` 디렉터리로 이동한 뒤 일반 npm 명령을 사용할 수 있다.

```bash
cd /Users/isang-yun/code/resume-studio/app
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
app/
└─ src/
   ├─ main/       Electron main process
   ├─ preload/    renderer에 노출할 최소 권한 API
   ├─ renderer/   React 기반 편집 UI와 A4 미리보기
   └─ shared/     ResumeWorkspace, ResumeDocument, IPC 계약, 오류 타입
```

## 경계

- `main`: 파일 시스템, 앱 창, 최근 문서와 PDF 내보내기를 소유한다.
- `preload`: `contextBridge`로 허용된 기능만 renderer에 노출한다.
- `renderer`: Node.js와 파일 시스템에 직접 접근하지 않는다.
- `shared`: 프로세스 양쪽이 함께 사용하는 타입과 검증 규칙만 둔다.

## 현재 구현

- 프로필, 소개글, 경력, 교육, 프로젝트, 사이드 프로젝트, 대외활동과 프리텍스트 편집
- 문단 내부의 굵게, 밑줄과 링크
- 항목 및 콘텐츠 블록 추가, 삭제, 위·아래 이동과 표시 여부 설정
- 고정 `reference-resume-v1` 스타일의 A4 다중 페이지 미리보기
- 프로젝트 콘텐츠의 페이지 간 연결
- 앱 전용 데이터 디렉터리의 JSON 자동 저장과 직전 저장본 백업
- Chromium `printToPDF()`를 사용하는 PDF 파일 내보내기

색상, 글꼴, 간격과 레이아웃을 사용자가 바꾸는 기능은 포함하지 않는다.

`styleSheetId`는 renderer의 스타일 에셋 registry와 연결된다. 현재 registry에는 `reference-resume-v1` 하나만 등록되어 있다.

## 로컬 데이터

활성 문서는 Electron의 운영체제별 앱 데이터 디렉터리 아래에 저장된다.

```text
Resume Studio/workspaces/default.resume.json
Resume Studio/workspaces/default.resume.json.backup
```

renderer는 파일 시스템에 직접 접근하지 않고 preload가 공개한 저장 및 PDF API만 사용한다.
