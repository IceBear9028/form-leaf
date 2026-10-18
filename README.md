# Formleaf

> 구조로 작성하고, 완성된 문서로.

Formleaf는 한글이나 Google Docs 같은 기존 문서 편집기에서 Markdown을 자연스럽게 작성하기 어렵고, Figma처럼 공통 양식을 컴포넌트로 만들어 여러 문서에서 재사용하고 관리하기도 불편하다는 문제에서 시작한 로컬 우선 데스크톱 문서 편집기입니다.

Markdown의 빠른 작성 경험과 디자인 도구의 컴포넌트 방식을 결합해, 콘텐츠와 레이아웃을 구조화된 데이터로 관리하면서 최종 결과물을 화면에서 직접 편집하고 PDF로 출력하는 것을 목표로 합니다.

현재 개인 사용을 중심으로 개발 중인 초기 버전이며, 설치 패키지 대신 소스 실행 환경을 제공합니다.

## 주요 기능

### Markdown 중심 작성

- 최종 문서 형태를 보면서 Preview에서 직접 편집
- 제목·목록·인용문·코드와 인라인 서식 지원
- 자동 목록과 들여쓰기 등 키보드 중심 작성 흐름

### 컴포넌트 기반 공통 양식

- 자주 쓰는 문서 구조를 컴포넌트로 정의하고 재사용
- 노출한 속성만 instance별 콘텐츠로 변경
- repeater로 같은 양식을 여러 데이터 항목에 적용

### 구조화된 문서 편집

- 콘텐츠, 문서 구조와 스타일을 분리해 관리
- 레이어에서 요소의 순서와 표시 여부를 편집
- Preview, 페이지 측정과 PDF가 같은 render tree를 공유

### 로컬 보관과 출력

- 여러 문서를 로컬에 자동 저장하고 직전 정상본을 백업
- 삭제한 문서를 휴지통에서 복원
- A4 다중 페이지 미리보기와 PDF 내보내기

## 실행하기

### 요구 사항

- Node.js LTS
- npm
- Electron을 실행할 수 있는 데스크톱 환경

현재 실제 앱 검증은 macOS를 중심으로 진행하고 있습니다.

```bash
git clone https://github.com/IceBear9028/form-leaf.git
cd form-leaf/client
npm ci
npm run dev
```

production build를 만든 뒤 Electron 앱으로 실행하려면 다음 명령을 사용합니다.

```bash
npm run app
```

프로젝트 루트에는 `package.json`이 없으므로 npm 명령은 `client/`에서 실행해야 합니다.

## 검증

```bash
# 전체 단위 테스트
npm test

# TypeScript 검사
npm run typecheck

# production build
npm run build

# Markdown 작성·저장·재열기·PDF Electron 사용자 흐름
npm run test:e2e:markdown
```

Electron E2E는 숨겨진 테스트 창과 임시 user data 디렉터리를 사용하므로 사용자의 실제 문서나 키보드·마우스 포커스를 사용하지 않습니다.

## 로컬 데이터

Formleaf는 서버 계정 없이 문서를 로컬 파일로 저장합니다. macOS에서는 기존 사용자 데이터와의 호환성을 위해 현재 다음 경로를 계속 사용합니다.

```text
~/Library/Application Support/Resume Studio/workspaces/
```

현재 문서, 휴지통, 컴포넌트 라이브러리와 backup이 이 디렉터리 아래에 저장됩니다. 앱 이름 변경만으로 기존 데이터 위치를 옮기지 않으며, 과거 원본과 backup을 자동으로 삭제하지 않습니다.

## 프로젝트 구조

```text
form-leaf/
├─ client/
│  ├─ src/
│  │  ├─ foundation/  문서 모델, 검증, transaction과 IPC 계약
│  │  ├─ main/        Electron main process, 저장소와 PDF 출력
│  │  ├─ preload/     renderer에 노출하는 제한된 API
│  │  └─ renderer/    React 기반 보관함과 문서 편집 UI
│  ├─ test/           모델·저장·migration 단위 테스트
│  └─ e2e/            Playwright Electron 사용자 흐름
└─ docs/              작업별 설계, 결정과 검증 기록
```

## 기술 구성

- Electron
- React 19
- TypeScript
- Tailwind CSS
- Vite / electron-vite
- remark / GFM
- Tiptap / ProseMirror
- Playwright

## 설계 원칙

- 문서 내용과 재사용 구조는 특정 이력서 양식에 종속되지 않습니다.
- renderer는 파일 시스템에 직접 접근하지 않고 preload가 공개한 API만 사용합니다.
- 화면 미리보기, 페이지 측정과 PDF는 동일한 문서 render tree를 공유합니다.
- 편집 중인 DOM, selection과 한글 IME의 소유권을 명확히 분리합니다.
- migration은 반복 실행해도 같은 결과를 만들고 실패 시 기존 파일을 보존해야 합니다.

구현 단계와 기술 결정은 [`docs/README.md`](docs/README.md)에서 확인할 수 있습니다.
