# 스타일 시스템

## 목표

참조 PDF 수준의 결과물을 일관되게 생성하는 고정 스타일 에셋 `reference-resume-v1`을 정의한다.

사용자는 이번 작업에서 색상, 글꼴, 크기, 간격과 레이아웃을 변경하지 않는다. 스타일 값은 코드로 관리하고 참조 PDF와 비교해 조정한다.

## 스타일 시스템 분리

```text
AppStyle
└─ 편집기, 버튼, 입력 필드와 상태 표시

ResumeStyleSheet: reference-resume-v1
└─ A4 미리보기와 최종 PDF
```

앱 UI 테마를 변경해도 PDF 스타일은 변하지 않아야 한다.

## `reference-resume-v1` 구성

```ts
type ResumeStyleSheet = {
  id: "reference-resume-v1";
  tokens: StyleTokens;
  textStyles: Record<TextStyleId, TextStyle>;
  blockStyles: Record<BlockStyleId, BlockStyle>;
  paginationRules: PaginationRules;
};
```

스타일시트는 immutable asset으로 취급한다. 구현 중 참조 PDF에 맞춰 값을 조정할 수 있지만 사용자 편집 데이터로 저장하지 않는다.

## 색상 토큰

```text
color.page.background
color.text.primary
color.text.secondary
color.text.muted
color.accent.primary
color.rule.light
color.rule.strong
color.link
color.icon
```

참조 PDF의 파란색, 검정, 회색과 구분선 색상을 실제 렌더링 비교를 통해 확정한다. 임의의 색상 선택 UI는 제공하지 않는다.

## 타이포그래피 토큰

```text
font.family.primary
font.weight.regular
font.weight.medium
font.weight.bold

font.size.profileRole
font.size.profileName
font.size.pageTitle
font.size.sectionTitle
font.size.itemTitle
font.size.body
font.size.meta
font.size.pageNumber

lineHeight.body
lineHeight.compact
letterSpacing.default
```

정확한 서체를 확인해 앱에 로컬 asset으로 포함한다. 대체 서체를 사용할 경우 줄바꿈과 페이지 분리를 다시 검증해야 한다.

## 간격 토큰

```text
space.page.top
space.page.right
space.page.bottom
space.page.left
space.section
space.item
space.paragraph
space.bullet
space.detailIndent
space.metaToBody
```

여백과 간격은 화면 크기에 따라 반응형으로 바꾸지 않는다. A4 출력 좌표를 기준으로 고정한다.

## 그리드 토큰

```text
grid.contentWidth
grid.metaColumnWidth
grid.columnGap
grid.bodyColumnWidth
grid.headerLeftWidth
grid.headerRightWidth
```

프로젝트, 경력과 대외활동은 왼쪽 메타데이터 열과 오른쪽 본문 열을 공유한다. 다른 섹션이 같은 구조를 사용할 때 동일한 grid token을 재사용한다.

## 텍스트 스타일 에셋

```text
profile.role
profile.name
page.title
section.title
section.annotation

meta.date
meta.duration
meta.organization
meta.link

item.title
item.subtitle
item.summary

achievement.title
detail.body
detail.action
techStack

body
body.emphasis
inline.link
pageNumber
```

콘텐츠 블록은 원시 글꼴 값을 갖지 않고 위 스타일 ID를 참조한다.

## 인라인 mark

문단 안에서 지원하는 mark는 다음으로 제한한다.

- `strong`
- `underline`
- `link`

mark의 실제 굵기, 밑줄 두께와 링크 색상은 스타일시트가 결정한다. 콘텐츠 데이터는 적용 범위와 URL만 저장한다.

## 블록 스타일 에셋

```text
profileHeader
introduction
sectionHeader
timelineItem
projectItem
projectContinuation
achievementList
detailBlock
linkList
techStackRow
sectionDivider
pageFooter
```

### `profileHeader`

- 원형 프로필 이미지
- 좌측 직무명과 이름
- 우측 연락처 표
- 좌우 영역 사이의 세로 구분선

### `timelineItem`

- 왼쪽 기간과 조직 정보
- 가운데 세로 구분선
- 오른쪽 제목과 내용

### `projectItem`

- 왼쪽 기간, 소속과 링크
- 오른쪽 파란색 제목, 요약과 콘텐츠 블록
- 프로젝트 사이의 안정적인 세로 간격

### `detailBlock`

- 사각 bullet의 성과 제목
- 들여쓴 상세 설명
- 세로선
- 화살표가 있는 해결 과정과 결과

### `techStackRow`

- 고정 아이콘
- 굵은 기술 목록
- 프로젝트 본문 열과 동일한 시작 위치

## 아이콘과 이미지

다음 자산은 앱에 로컬로 포함한다.

- 프로필 이미지 placeholder
- 웹 문서 링크 아이콘
- GitHub 아이콘
- 홈페이지 아이콘
- App Store 아이콘
- 기술 스택 아이콘

아이콘은 참조 PDF와 비슷한 무게와 크기로 통일한다. 시스템 emoji는 운영체제에 따라 달라질 수 있으므로 최종 PDF에는 고정 vector 또는 font icon asset을 사용한다.

사용자 프로필 이미지는 원본 비율을 유지한 채 원형 frame에 `cover` 방식으로 표시한다.

## 구분선

- 섹션 사이 가로 구분선
- 메타데이터와 본문 사이 세로 구분선
- 상세 설명 내부 세로선
- 필요한 페이지 하단 구분선

구분선의 색상과 두께는 역할별 token으로 분리한다.

## 페이지 스타일

- A4 `210mm × 297mm`
- 흰색 배경
- 고정 외곽 여백
- 우측 하단 `현재 페이지 / 전체 페이지`
- 페이지 번호를 제외한 별도 header/footer 없음
- 다중 페이지에서 열 위치 유지

## 페이지 연결 스타일

프로젝트가 다음 페이지로 이어질 때 `projectContinuation`을 적용한다.

- 프로젝트 제목을 자동 반복하지 않음
- 왼쪽 메타데이터 열을 비움
- 본문 열 시작 위치 유지
- 이전 프로젝트의 상세 블록과 기술 스택을 계속 렌더링
- 완료 후 다음 프로젝트 시작

## 앱 UI 스타일

앱 자체는 PDF보다 시각적으로 뒤로 물러나는 중립적인 작업 환경으로 만든다.

- 밝은 편집 패널
- 미리보기 영역은 A4 흰 페이지와 구분되는 중립 회색 배경
- 파란색은 주요 동작과 focus에 제한적으로 사용
- 입력 필드는 명확한 label과 일관된 높이 사용
- 카드와 구분선은 낮은 대비로 처리
- 성공, 저장 중, 오류 상태는 색상과 텍스트를 함께 사용

앱 UI의 폰트와 spacing은 PDF style token을 재사용하지 않는다.

## 품질 기준

`reference-resume-v1`은 다음 조건을 만족해야 한다.

- 참조 PDF와 같은 정보 계층이 즉시 인식됨
- 페이지별 여백과 2열 grid가 안정적으로 유지됨
- 한글 본문의 줄바꿈과 행간이 자연스러움
- 굵게와 밑줄 강조가 참조 문서와 같은 역할을 수행함
- 프로젝트의 중첩 설명과 페이지 연결이 어색하지 않음
- 아이콘, 구분선과 페이지 번호가 조악한 임시 요소처럼 보이지 않음
- 미리보기와 최종 PDF가 동일함

완료 기준은 사용자가 색상을 바꿀 수 있는지가 아니라, 고정 에셋만으로 참조 PDF 수준의 완성도를 안정적으로 생성할 수 있는지다.
