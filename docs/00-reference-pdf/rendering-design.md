# 렌더링 및 PDF 설계

## 목표

동일한 ResumeDocument와 ResumeStyleSheet를 사용해 화면 미리보기와 최종 PDF를 렌더링한다. 미리보기 전용 마크업과 PDF 전용 마크업을 따로 만들지 않는다.

## 렌더링 구조

```text
ResumeDocument
      +
ResumeStyleSheet
      ↓
ResumeRenderer
├─ PreviewSurface
└─ PdfExportSurface
```

## 페이지

- 페이지 크기는 A4 `210mm × 297mm`로 고정한다.
- 화면 zoom은 페이지 바깥 wrapper에만 적용한다.
- 실제 줄바꿈과 페이지 계산은 원래 A4 크기에서 수행한다.
- 페이지마다 동일한 외곽 여백과 페이지 번호 위치를 사용한다.
- 화면에서 페이지 사이에 사용하는 간격은 `@media print`에서 반드시 제거한다.
- 참조 PDF의 6페이지 흐름을 재현할 수 있는 다중 페이지 renderer를 사용한다.

이번 작업에서는 한 페이지 안에 내용을 강제로 맞추지 않는다.

## 스타일 토큰

다음 값을 `reference-resume-v1` 스타일시트에 모은다.

- 페이지 여백
- 프로필 헤더 크기
- 파란색 강조색
- 본문 및 보조 텍스트 색상
- 제목과 본문의 서체, 크기, 굵기와 행간
- 섹션, 항목과 문단 사이의 간격
- 왼쪽 메타데이터 열과 본문 열 너비
- 가로·세로 구분선
- bullet, 상세 블록과 기술 스택 스타일
- 페이지 번호 위치와 형식

토큰 편집 UI는 만들지 않는다.

## 페이지 분리

페이지 분리기는 렌더링된 블록 높이를 기준으로 다음 페이지로 콘텐츠를 이동한다.

```ts
type PaginationRules = {
  repeatSectionTitle: boolean;
  repeatItemHeader: boolean;
  keepHeadingWithNext: boolean;
  allowItemSplit: boolean;
  continuationMeta: "repeat" | "empty";
  footerPageNumber: boolean;
};
```

참조 스타일에서는 프로젝트가 페이지 사이에서 나뉠 수 있고, 이어지는 페이지의 왼쪽 메타데이터는 비워 둘 수 있어야 한다.

## PDF 내보내기

Electron의 `webContents.printToPDF()`를 PDF 생성 API로 사용한다.

```ts
const pdf = await pdfContents.printToPDF({
  pageSize: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: false,
  scale: 1,
});
```

- 사용자가 저장 위치를 선택한다.
- PDF buffer는 임시 파일에 기록한 뒤 최종 경로로 교체한다.
- 시스템 프린터 인쇄 기능은 제공하지 않는다.
- PDF는 텍스트 검색과 복사가 가능해야 한다.
- PDF 페이지 수는 미리보기에 표시된 페이지 수와 같아야 하며 빈 페이지를 삽입하지 않는다.

## 검증

참조 PDF와 결과 PDF를 동일한 배율의 이미지로 변환해 페이지별로 비교한다.

검증 대상:

- 전체 페이지 수
- 페이지 여백
- 열 위치와 너비
- 제목과 본문 기준선
- 줄바꿈 위치
- 문단 간격
- 구분선과 아이콘 위치
- 프로젝트의 페이지 연결 위치
- 페이지 번호

초기에는 차이를 목록화해 수정하고, 렌더링이 안정되면 대표 fixture의 이미지 회귀 테스트를 추가한다.
