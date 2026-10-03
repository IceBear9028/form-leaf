# 데이터 설계

## 원칙

- 현재 목표에 필요하지 않은 기능은 구현하지 않는다.
- 데이터는 React 컴포넌트, CSS 클래스와 화면 좌표에 종속되지 않는다.
- 모든 저장 데이터는 `schemaVersion`을 가져 이후 migration이 가능해야 한다.
- 사용자 문장은 원문과 강조 범위를 그대로 보존한다.
- 스타일 데이터와 콘텐츠 데이터를 분리한다.

## 문서 구조

첫 구현은 한 개의 활성 문서만 다룬다. 다중 문서 관리 UI는 만들지 않지만 문서 ID와 저장소 경계를 두어 이후 여러 문서로 확장할 수 있게 한다.

```ts
type ResumeDocument = {
  schemaVersion: 1;
  documentId: string;
  name: string;
  styleSheetId: "reference-resume-v1";
  pagination: {
    mode: "multi-page";
  };
  sections: ResumeSection[];
};
```

## 섹션

```ts
type ResumeSection =
  | ProfileSection
  | IntroductionSection
  | TimelineSection
  | ProjectGroupSection
  | FreeTextSection;
```

- `ProfileSection`: 사진, 이름, 직무, 전화, 이메일과 링크
- `IntroductionSection`: 소개글의 여러 문단
- `TimelineSection`: 경력, 교육과 대외활동처럼 기간과 본문이 함께 있는 항목
- `ProjectGroupSection`: 프로젝트 또는 사이드 프로젝트 목록
- `FreeTextSection`: 제목과 자유롭게 조합한 콘텐츠 블록

`TimelineSection`은 제목 옆에 총 경력 기간처럼 사용자가 확정한 보조 문구를 표시할 수 있도록 선택적인 `annotation`을 가진다. 기간을 앱이 임의 계산하거나 문구를 생성하지 않는다.

## 프로젝트

```ts
type ProjectItem = {
  id: string;
  period: DateRange;
  organization?: string;
  title: TextContent;
  links: ResumeLink[];
  blocks: ContentBlock[];
  visible: boolean;
  order: number;
};
```

프로젝트 상세 내용을 고정된 문장 필드로 제한하지 않고 콘텐츠 블록의 조합으로 저장한다.

## 콘텐츠 블록

```ts
type ContentBlock =
  | ParagraphBlock
  | BulletListBlock
  | DetailBlock
  | LinkListBlock
  | TechStackBlock;
```

- `ParagraphBlock`: 소개, 요약과 일반 프리텍스트
- `BulletListBlock`: 일반 목록
- `DetailBlock`: 성과 제목과 세로선 안의 문제·해결·결과
- `LinkListBlock`: 아이콘과 함께 표시되는 링크 목록
- `TechStackBlock`: 프로젝트 기술 목록

새로운 블록 타입은 union에 추가하고 schema migration으로 확장한다.

## 텍스트와 강조

```ts
type TextContent = {
  runs: TextRun[];
};

type TextRun = {
  text: string;
  marks?: Array<"strong" | "underline" | "link">;
  href?: string;
};
```

문단 스타일은 콘텐츠에 원시 CSS로 저장하지 않고 의미 있는 `styleRef`를 사용한다.

```ts
type ParagraphBlock = {
  id: string;
  styleRef: string;
  content: TextContent;
};
```

## 스타일시트

첫 구현에는 `reference-resume-v1` 하나만 제공하고 스타일 편집 UI는 만들지 않는다.

```ts
type ResumeStyleSheet = {
  id: string;
  tokens: StyleTokens;
  textStyles: Record<string, TextStyle>;
  blockStyles: Record<string, BlockStyle>;
  paginationRules: PaginationRules;
};
```

향후 다른 스타일을 추가하더라도 ResumeDocument와 콘텐츠 블록을 변경하지 않고 `styleSheetId`만 바꿀 수 있어야 한다.

## 로컬 저장

- 앱 전용 데이터 디렉터리에 JSON으로 자동 저장한다.
- 저장 전 runtime schema로 검증한다.
- 임시 파일에 기록한 후 원본 파일을 교체한다.
- 최소 한 개의 직전 정상 저장본을 보관한다.
- JSON 가져오기·내보내기 화면은 이번 작업에 포함하지 않는다.
