# 이력서 편집 기능 및 Markdown 본문 통합 세션 인수인계

## 전달 대상

`resume-기능개선` 세션

## 현재 상태

- 상태: Markdown 기반 v2 편집·미리보기, 실제 데이터 마이그레이션과 확장형 스타일 레지스트리 연결 완료
- 현재 단계: 일반 백업 복구와 실제 PDF 회귀 검증
- 작업 기준 커밋: `08bbe9d docs: add project task workflow skill`

## 확정한 사용자 요구

- 카테고리별 이름, 기간, 소속, 링크, 기술 스택 등 정형 필드는 유지한다.
- 일반 문단, 목록과 성과 서술 등 모든 서술형 본문은 하나의 Markdown 입력으로 제공한다.
- 본문 작성을 위해 존재하던 블록 선택·이동·삭제 UI를 제거한다.
- `성과 제목`, `문제·배경`, `해결 과정`, `결과` 전용 입력 UI를 제거한다.
- 사용자는 Markdown에서 문단, 소제목과 목록을 원하는 순서로 작성한다.
- 기존 이력서 문장은 새로 쓰거나 요약하지 않는다.

## 목표 편집 경험

각 항목은 `카테고리 정형 필드 + Markdown 본문 하나`로 편집한다.

```md
프로젝트에 대한 간단한 소개입니다.

### 검색 성능 개선

- 검색 조건을 단순화했습니다.
- 반복 요청에 캐시를 적용했습니다.
- 평균 응답 시간을 단축했습니다.
```

오른쪽 전체 이력서 미리보기가 Markdown 렌더링 결과를 즉시 보여준다. 별도의 본문 블록 목록이나 성과 작성 흐름은 제공하지 않는다.

## 완료된 작업

- 현재 `ResumeSection`, `TimelineItem`, `ProjectItem`, `ContentBlock` 구조를 확인했다.
- `TimelineEditor`와 `ProjectGroupEditor`의 중복을 확인했다.
- 고정된 `DetailBlock`과 블록별 편집 UI가 복잡성을 만드는 지점을 확인했다.
- 기능 목표를 카테고리 정형 필드 유지와 단일 Markdown 본문으로 확정했다.
- `README.md`, `plan.md`, `design.md`, `handoff.md`를 확정된 기능 방향으로 갱신했다.
- v1 본문을 Markdown으로 옮기는 기본 변환 규칙과 별도 v1 백업 요구를 기록했다.
- `markdown-spec.md`에 CommonMark·GFM, `++밑줄++`, 전체 스타일 계약과 안전 규칙을 확정했다.
- 자체 제한 파서를 `unified + remark-parse + remark-gfm + remark-breaks` 기반 mdast 파서로 교체했다.
- mdast를 H1~H6, 문단, 목록, 체크리스트, 인용문, 코드, 표, 이미지와 각주 React 요소로 직접 렌더링한다.
- 기존 `TextContent`·`ContentBlock` 직렬화 함수와 밑줄 호환 표현은 유지했다.
- `#markdown-prototype` 전용 화면에서 프로젝트·프리텍스트 스타일을 확인했다.
- Markdown 파서 자동 테스트 9건에서 CommonMark·GFM 구조, 연속 빈 줄과 기존 데이터 직렬화를 검증한다.
- v1·v2 타입과 검증기를 분리하고 순수 v1→v2 마이그레이션을 추가했다.
- 소개·경력·교육·프로젝트·사이드 프로젝트·대외활동·프리텍스트를 `bodyMarkdown` 하나로 연결했다.
- `BlocksEditor`, 성과 상세 입력과 프로젝트 별도 소개 입력을 제거했다.
- 프로젝트 기술 스택은 정형 `techStack` 필드로 유지하고 여러 v1 블록의 순서를 보존한다.
- 미리보기는 mdast 최상위 노드를 페이지 측정 단위로 사용한다.
- `MarkdownStyleTokens`와 스타일 레지스트리를 추가하고 참조·컴팩트 프리셋을 제공한다.
- Markdown 요소는 VS Code Markdown Preview의 밝은 화면 규칙을 기준으로 표시한다.
- H3 장식 사각형과 카테고리별 화살표 목록을 제거하고 표준 `disc → circle → square` 목록 마커를 사용한다.
- 본문은 `Pretendard`, 일반 텍스트와 H1~H6은 `#000000`을 사용하고 H1·H2의 장식 구분선은 제거한다.
- 참조 스타일의 프로젝트 제목은 13pt, 프로젝트 본문 H1~H6은 12/10.5/9/8/7/6.8pt로 분리한다.
- 표준 Markdown이 합치는 추가 빈 줄을 원문 위치로 계산해 미리보기와 PDF 간격에 반영한다.
- 메인 프로세스가 remark를 번들링하지 않도록 v1 직렬화를 `markdownSerialization.ts`로 분리한다.
- v1 파일의 최초 v2 저장 전에 덮어쓰지 않는 `.v1.backup`을 만든다.
- 실제 사용자 v1 문서를 v2로 마이그레이션하고 전용 `.v1.backup` 생성을 확인했다.
- 변환 결과가 직렬화된 마이그레이션 기대값과 일치하며 섹션·항목 ID와 정형 링크가 유지됨을 확인했다.

## 변경 파일

- `docs/README.md`
- `docs/00-reference-pdf/README.md`
- `docs/01-resume-feature-improvement/README.md`
- `docs/01-resume-feature-improvement/plan.md`
- `docs/01-resume-feature-improvement/design.md`
- `docs/01-resume-feature-improvement/markdown-spec.md`
- `docs/01-resume-feature-improvement/handoff.md`
- `app/package.json`
- `app/package-lock.json`
- `app/tsconfig.json`
- `app/src/shared/markdown.ts`
- `app/src/shared/markdownSerialization.ts`
- `app/src/shared/resume.ts`
- `app/src/shared/resumeMigration.ts`
- `app/src/main/index.ts`
- `app/src/renderer/src/components/EditorPanel.tsx`
- `app/src/renderer/src/components/ResumePreview.tsx`
- `app/src/renderer/src/main.tsx`
- `app/src/renderer/src/components/MarkdownContent.tsx`
- `app/src/renderer/src/components/MarkdownPrototype.tsx`
- `app/src/renderer/src/styles/app.css`
- `app/src/renderer/src/styles/resume.css`
- `app/src/renderer/src/styles/resumeStyleSheets.ts`
- `app/test/markdown.test.mjs`
- `app/test/resume-migration.test.mjs`
- `app/test/resume-style-sheets.test.mjs`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `git status --short` | 문서와 Markdown 프로토타입 변경 존재 |
| 현재 데이터 타입·편집기·미리보기·저장 코드 연결 | 완료 |
| `npm run test:markdown` | 9건 통과 |
| `npm run test:migration` | 3건 통과 |
| `npm run test:styles` | 2건 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `#markdown-prototype` 헤드리스 Chrome 캡처 | 참조·컴팩트 프리셋의 크기·간격 차이와 기존 문법 렌더링 확인 |
| VS Code 기반 Markdown 스타일 캡처 | 장식 없는 H3, 표준 원형 불릿과 파란색 링크 확인 |
| 프로젝트 제목 계층 캡처 | 프로젝트 제목 13pt와 프로젝트 본문 H3 9pt의 시각적 위계 확인 |
| 실제 v2 재실행·자동 저장 | 정상 로드 및 v2 `.backup` 생성 확인 |

## 남은 검증 사항

- 손상된 현재 v2 파일에서 일반 `.backup`으로 복구되는지 확인한다.
- 실제 데이터 PDF를 기존 출력과 비교해 페이지 수, 텍스트, 링크와 세로선을 확인한다.

## 다음 작업

1. 복사본에서 손상된 현재 파일의 일반 `.backup` 복구를 검증한다.
2. 실제 데이터의 기존 PDF와 v2 PDF를 비교한다.
3. 차이가 있으면 스타일 토큰이나 페이지네이션 정책을 조정하고 회귀 fixture를 추가한다.
