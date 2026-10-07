# 이력서 편집 기능 및 Markdown 본문 통합 기술 설계

## 기능 결정

카테고리별 정형 필드는 유지하고, 사용자가 문장을 작성하는 모든 본문 영역은 하나의 Markdown 원문으로 통합한다.

이 결정의 목적은 블록 기반 데이터 구조 자체를 사용자에게 편집 UI로 노출하지 않는 것이다. 사용자는 문단·목록·성과 상세 중 하나를 선택하지 않고 Markdown 본문에 원하는 순서로 글을 작성한다.

## 현재 구조와 제거 대상

기존 v1 데이터 모델은 [resume.ts](../../client/src/shared/resume.ts)의 레거시 타입으로 유지한다.

- `IntroductionSection`은 여러 개의 `paragraphs`를 가진다.
- `ProjectItem`은 `summary`와 `blocks`에 서술형 내용을 나누어 저장한다.
- `ContentBlock`은 `paragraph`, `bullet-list`, `detail`, `link-list`, `tech-stack`을 구분한다.
- `DetailBlock`은 `title`, `context`, `actions`, `result` 구조를 요구한다.
- 편집기는 블록 종류별 추가·이동·삭제 UI와 별도 입력 필드를 제공한다.

v2 편집 UI에서는 다음을 제거한다.

- `BlocksEditor`와 블록 종류 선택 버튼
- 본문 블록별 이동·삭제 제어
- `성과 제목`, `문제·배경`, `해결 과정`, `결과` 입력
- 소개글 문단별 카드
- 프로젝트 `summary`와 `blocks`를 나눈 입력 흐름

## v2 개념 구조

```text
ResumeDocumentV2
└─ sections
   ├─ ProfileSection
   ├─ IntroductionSection
   │  └─ bodyMarkdown: string
   ├─ TimelineSection
   │  └─ items[]
   │     ├─ 카테고리 정형 필드
   │     └─ bodyMarkdown: string
   ├─ ProjectGroupSection
   │  └─ items[]
   │     ├─ 카테고리 정형 필드
   │     └─ bodyMarkdown: string
   └─ FreeTextSection
      └─ bodyMarkdown: string
```

Markdown 본문은 `bodyMarkdown: string`으로 사용자가 작성한 원문만 저장한다. 파싱된 HTML이나 렌더러 전용 노드는 저장하지 않는다. 미리보기와 PDF는 저장된 Markdown 원문에서 매번 안전한 렌더링 결과를 만든다.

## 카테고리 필드 경계

| 카테고리 | 정형 필드 | Markdown으로 통합하는 내용 |
|---|---|---|
| 프로필 | 이름, 직무명, 사진, 전화번호, 이메일, 링크 | 없음 |
| 소개글 | 섹션 제목 | 기존 여러 소개 문단 |
| 경력 | 회사명, 직무, 기간, 기간 보조 표기, 링크 | 일반 문단·목록·성과 상세 |
| 교육 | 기관, 과정·학위, 기간, 링크 | 선택 본문 |
| 프로젝트 | 프로젝트명, 기간, 소속, 링크, 기술 스택 | 프로젝트 소개와 모든 서술 블록 |
| 사이드 프로젝트 | 프로젝트명, 기간, 소속, 링크, 기술 스택 | 프로젝트 소개와 모든 서술 블록 |
| 대외활동 | 활동명, 기간, 기관·주최, 링크 | 일반 문단·목록·성과 상세 |
| 프리텍스트 | 섹션 제목 | 기존 콘텐츠 블록 |

섹션 표시 여부, 항목 표시 여부와 순서는 본문이 아니므로 기존 기능을 유지한다.

## Markdown 문법과 스타일 범위

- CommonMark의 H1~H6, 문단, 목록, 인용문, 코드, 구분선, 링크와 이미지를 지원한다.
- GFM의 표, 취소선, 체크리스트, 자동 링크와 각주를 지원한다.
- 한 번의 줄바꿈은 이력서 작성 경험에 맞게 강제 줄바꿈으로 표시한다.
- 문단 구분에 필요한 빈 줄을 넘겨 추가로 입력한 빈 줄은 원문 위치를 이용해 줄 높이로 보존한다.
- 밑줄은 표준 문법에 없으므로 `++내용++` 호환 확장을 사용한다.
- 임의 HTML은 실행하지 않고 원문 텍스트로 표시한다.

파서는 `unified + remark-parse + remark-gfm + remark-breaks`로 mdast를 만든다. 공통 React 렌더러가 mdast의 의미 노드를 화면 요소로 변환하고, 선택한 이력서 스타일이 크기·글꼴·간격·목록 모양을 결정한다. 전체 문법과 스타일 계약은 [Markdown 문법과 스타일 규칙](markdown-spec.md)을 따른다.

### 스타일 확장 구조

- `resumeStyleSheets.ts`가 스타일 ID, 표시 이름, 페이지 규격과 `MarkdownStyleTokens`를 등록한다.
- Markdown 프리셋이 담당하는 폰트 크기와 간격은 CSS에 반복하지 않고 `--markdown-*` 변수를 사용한다.
- 런타임이 선택된 스타일 토큰을 CSS 변수로 변환해 미리보기와 측정 페이지에 동일하게 적용한다.
- 새 스타일은 파서·React 렌더러·저장 스키마를 수정하지 않고 레지스트리에 프리셋을 추가한다.
- 현재 `reference-resume-v1`과 같은 레이아웃의 `reference-resume-compact-v1`을 제공해 스타일 토큰 교체를 검증한다.
- 프로젝트 제목과 프로젝트·사이드 프로젝트 본문의 H1~H6 크기도 프리셋 토큰으로 정의해 항목 제목이 본문 제목보다 상위에 보이도록 한다.
- Markdown 스타일 프리셋은 교체 가능하지만 전체 이력서 레이아웃과 사용자 정의 템플릿 로딩은 아직 이 계약의 범위가 아니다.

## 편집 UX

각 카테고리는 다음 깊이를 사용한다.

1. 섹션 아코디언
2. 반복 카테고리의 항목 카드
3. 카테고리 정형 필드와 하나의 `본문` Markdown 입력

본문 편집기는 여러 줄 원문 입력을 기본으로 한다. 별도의 블록 팔레트와 본문 블록 목록은 제공하지 않는다. 오른쪽 전체 이력서 미리보기가 Markdown 렌더링 결과를 즉시 보여준다.

Markdown 문법 삽입 버튼은 필수 기능으로 두지 않는다. 첫 구현은 단일 입력 영역과 짧은 문법 안내에 집중하고, 실제 사용성 검증 후 필요한 최소 버튼만 별도 결정한다.

## v1→v2 변환 원칙

마이그레이션은 기존 문장을 새로 쓰거나 요약하지 않고, 기존 순서를 유지해 Markdown 원문으로 직렬화한다.

기본 변환 규칙:

- 소개글의 `paragraphs`는 빈 줄로 구분한 Markdown 문단으로 합친다.
- 프로젝트 `summary`는 Markdown 본문의 첫 문단으로 옮긴다.
- `paragraph`는 Markdown 문단으로 옮긴다.
- `bullet-list`의 각 항목은 `- ` 목록으로 옮긴다.
- `detail.title`은 `### ` 소제목으로 옮긴다.
- `detail.context`는 제목 다음 일반 문단으로 옮긴다.
- `detail.actions`와 `detail.result`는 원래 순서를 유지한 목록으로 옮긴다.
- `TextRun`의 굵게, 밑줄과 링크는 대응하는 Markdown 표기로 옮긴다.
- 원문에 포함된 Markdown 특수문자는 의도하지 않은 서식으로 바뀌지 않도록 escape한다.
- 빈 필드는 불필요한 제목·목록·공백을 생성하지 않는다.

- 기존 `link-list`는 위치를 유지한 Markdown 링크 목록으로 변환한다.
- 프로젝트와 사이드 프로젝트의 기존 `tech-stack`은 카테고리의 기술 스택 정형 필드로 옮긴다.
- 그 밖의 카테고리나 본문 중간에 존재하는 `tech-stack`은 값과 위치를 잃지 않도록 `**기술 스택:** 값` 문단으로 변환한다.

## 렌더링 경계

- 저장 데이터는 Markdown 원문과 카테고리 정형 필드만 가진다.
- remark 파서는 CommonMark·GFM 원문을 mdast로 변환한다.
- 공통 React 렌더러는 mdast를 HTML 문자열이 아닌 안전한 React 요소로 변환한다.
- `reference-resume-v1`은 H1~H6와 모든 지원 문법의 첫 번째 스타일 구현이다.
- 후속 이력서 스타일은 파서와 저장 데이터를 바꾸지 않고 같은 Markdown 스타일 계약을 구현한다.
- 본문 소제목은 성과 제목이라는 의미를 갖지 않는다.
- 프로젝트 첫 본문과 항목 헤더의 페이지 연결, 세로 구분선과 페이지네이션 규칙은 유지한다.
- 링크 URL은 현재와 같은 안전한 프로토콜 검사 후 렌더링한다.

## 저장과 복구

- 외부 사용자 JSON을 저장소로 복사하지 않는다.
- v1 파일을 읽을 때 메모리에서 v2로 변환하되 원본을 즉시 덮어쓰지 않는다.
- 사용자가 처음 v2 저장을 시작하기 전에 별도의 v1 전용 백업을 한 번 생성한다.
- v1 전용 백업은 이후 자동 저장으로 덮어쓰지 않는다.
- 일반 `.backup`은 직전 정상 v2 저장본을 보관하는 회전 백업으로 사용한다.
- v2 검증에 실패하면 저장을 거부하고 마지막 정상 파일을 유지한다.

## 영향받는 코드

| 영역 | 파일 또는 모듈 | 변경 책임 |
|---|---|---|
| 공유 데이터 | `client/src/shared/resume.ts`, `resumeMigration.ts` | v1 타입 분리, v2 Markdown 본문 타입·검증·마이그레이션 |
| Markdown 기반 | `client/src/shared/markdown.ts`, `markdownSerialization.ts` | remark 파이프라인·mdast 블록 분리와 메인 프로세스에서 사용할 의존성 없는 v1 직렬화 |
| 메인 프로세스 | `client/src/main/index.ts` | 버전 판별, 메모리 변환, v1 전용 백업과 v2 저장 |
| 편집 UI | `client/src/renderer/src/components/EditorPanel.tsx` | 블록 UI 제거와 단일 Markdown 입력 연결 |
| 편집 primitives | `client/src/renderer/src/components/EditorPrimitives.tsx` | 공통 항목 카드와 Markdown 입력 UI |
| 렌더링 프로토타입 | `client/src/renderer/src/components/MarkdownContent.tsx`, `MarkdownPrototype.tsx` | 안전한 React 렌더링과 스타일 검증 |
| 미리보기 | `client/src/renderer/src/components/ResumePreview.tsx` | Markdown 렌더링 노드와 페이지네이션 연결 |
| 이력서 스타일 | `client/src/renderer/src/styles/resumeStyleSheets.ts`, `resume.css` | 타입이 있는 Markdown 토큰, 프리셋 레지스트리와 CSS 변수 소비 |

## 오류와 경계 조건

- 빈 Markdown 본문도 유효한 작성 중 상태로 저장한다.
- Markdown 특수문자가 포함된 기존 문장이 의도하지 않은 서식으로 바뀌면 안 된다.
- 같은 `TextRun`에 굵게·밑줄·링크가 함께 있을 때 모든 표현을 보존해야 한다.
- 위험한 HTML이나 허용하지 않은 URL이 미리보기에서 실행되면 안 된다.
- 선택 필드와 빈 본문 때문에 미리보기 공간이 남으면 안 된다.
- 한 프로젝트가 페이지를 넘을 때 제목 연결과 세로 구분선 규칙이 깨지면 안 된다.
- UI 단순화가 링크, 강조와 밑줄 등 기존 표현 능력을 제거하면 안 된다.

## 결정과 근거

| 결정 | 근거 | 대안 |
|---|---|---|
| 카테고리 정형 필드는 유지 | 이름·기간·소속처럼 의미가 명확한 정보는 별도 입력이 더 간결함 | 모든 정보를 Markdown에 작성 |
| 서술형 본문은 Markdown 하나로 통합 | 블록 관리 UI와 고정된 성과 서술 구조를 제거함 | 일반화된 블록 편집기 유지 |
| Markdown 원문을 저장 | 사용자가 작성한 내용을 직접 보존하고 특정 React/CSS 구조와 분리함 | HTML 또는 파싱 결과 저장 |
| remark와 mdast 사용 | 다중 스타일, React 렌더링과 페이지네이션에서 의미 구조를 유지함 | 자체 제한 파서, markdown-it 토큰 스트림 |
| CommonMark·GFM 지원 | 익숙한 기본 문법을 별도 자체 문법 없이 사용할 수 있음 | 일부 문법만 허용 |
| 스타일 계약 분리 | 같은 Markdown을 여러 이력서 디자인으로 표시할 수 있음 | 문법별 스타일을 렌더러에 고정 |
| 오른쪽 전체 미리보기를 사용 | 별도 본문 미리보기 UI의 중복을 피함 | 편집기 내부 분할 미리보기 |

## 남은 검증 사항

1. 손상된 현재 v2 파일에서 일반 `.backup`으로 복구되는지 확인한다.
2. 실제 데이터 PDF의 페이지 수, 텍스트와 링크를 기존 출력과 비교한다.

## 검증 전략

- 모든 v1 블록과 중첩 mark 조합을 포함한 합성 fixture를 v2로 변환한다.
- 변환 전후의 텍스트, 링크 URL과 기술 스택 값을 비교한다.
- Markdown 특수문자와 빈 블록 변환을 검사한다.
- 각 카테고리의 빈 본문과 정형 필드 조합을 렌더링한다.
- 기존 실제 데이터는 저장소에 복사하지 않고 로컬에서만 변환·복구를 확인한다.
- 기존 실제 데이터로 PDF를 출력해 6페이지 구성과 텍스트·링크 누락 여부를 비교한다.
- 자동 저장, v1 전용 백업, 일반 백업 복구와 앱 재실행을 확인한다.
