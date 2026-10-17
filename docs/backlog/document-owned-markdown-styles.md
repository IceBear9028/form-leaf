# Document-owned Markdown styles

## 상태

Backlog — 미착수

## 문제

현재 Markdown renderer는 공통 `document.css`에 하나의 시각 테마를 정의하고, Document의 일반 typography와 일부 CSS variable만 주입한다.

`StyleDefinition.markdown`이 직접 지원하는 값은 현재 `listItemGapPt`뿐이다. 제목 크기는 본문 크기의 고정 비율로 계산되며, 인용문·목록·코드·표·링크·각주의 주요 시각값은 전역 CSS에 고정돼 있다.

따라서 현재 구조는 문서별 Markdown 스타일 시스템이 아니라 하나의 전역 Markdown 테마를 제한적으로 조정하는 구조다.

## 현재 데이터로 변경 가능한 값

- 기본 font family
- 기본 font size
- 기본 line height
- 기본 text color
- Markdown block gap
- list item gap
- 본문 크기에서 고정 비율로 파생되는 제목·코드·표 크기

## 현재 전역 CSS에 고정된 값

- 제목 단계별 배율, 굵기와 line height
- 인용문 배경, 선, padding과 radius
- 목록 들여쓰기와 marker
- inline code와 code block의 배경, 선, padding과 글꼴
- 표의 셀 padding, header 배경과 구분선
- 링크 색상과 decoration
- 각주 크기와 구분선
- Markdown palette 기본값

## 목표

- Document가 Markdown theme를 데이터로 소유한다.
- 문서마다 제목, 본문, 목록, 인용문, 코드, 표, 링크, 구분선과 각주 스타일을 독립적으로 설정할 수 있다.
- Markdown node는 필요한 경우 문서 theme를 부분 override할 수 있다.
- screen, measure와 print가 동일한 resolved style을 사용한다.
- `document.css`는 구조, 안전한 layout 기본값과 편집기 전용 표현만 소유한다.
- 임의 CSS 문자열이 아니라 검증 가능한 typed style model을 사용한다.

## 기본 스타일 제공 원칙

시스템은 새 문서를 위한 기본 Markdown style template를 제공한다. 새 Document를 생성할 때 이 template의 현재 값을 복사해 Document 데이터에 포함한다.

```text
System default Markdown style template
→ 새 Document 생성
→ template 값을 deep copy
→ Document가 독립적인 Markdown theme로 저장
→ renderer는 Document의 theme만 사용
```

시스템 기본값은 새 문서 생성 시 사용하는 초기값이지, 모든 문서가 실행 중에 참조하는 전역 theme가 아니다.

따라서 다음 원칙을 지킨다.

- 새 문서는 생성 시점의 시스템 기본 Markdown style 전체를 갖는다.
- 생성 이후 Document의 Markdown style은 시스템 기본값과 독립적이다.
- 시스템 기본값이 변경돼도 기존 Document의 출력은 자동으로 바뀌지 않는다.
- 사용자가 기본값으로 초기화하면 그 시점의 시스템 template를 다시 복사한다.
- preset을 적용할 때도 preset ID만 저장하지 않고 실제 style 값을 Document에 복사한다.
- renderer, screen, measure와 print는 시스템 template를 직접 조회하지 않고 Document에 저장된 resolved theme를 사용한다.
- 기존 문서는 migration 시 해당 문서의 현재 출력을 보존하는 Markdown theme snapshot을 생성한다.

시스템 template가 필요한 이유는 새 문서가 유효하고 완전한 Markdown style로 시작하도록 하기 위해서다. Document에 값이 없는 경우마다 전역 CSS 기본값으로 fallback하는 용도로 사용하지 않는다.

## 설계 시 결정할 사항

- 시스템 기본 Markdown style template의 위치와 version 관리 방식
- Document-level theme를 `DocumentData`에 별도 필드로 둘지 root `StyleDefinition`이 소유할지
- Markdown node별 override 범위
- heading `h1`~`h6`의 독립 style과 상속 규칙
- block gap과 Markdown 원문의 빈 줄을 결합하는 규칙
- quote, code, table처럼 layout과 decoration이 함께 필요한 style schema
- 기존 Document에 기본 Markdown theme를 채우는 migration 방식
- Inspector에서 노출할 속성과 preset UX

## 공통 CSS에 남겨야 할 범위

- semantic element의 기본 display 구조
- table border collapse
- overflow와 word wrapping 안전 규칙
- contenteditable caret과 selection 보조 스타일
- screen 전용 interaction UI
- print와 measurement에 필요한 비시각적 규칙

## 완료 조건

- [ ] Markdown theme의 typed data model이 정의된다.
- [ ] 시스템 기본 Markdown style template가 정의된다.
- [ ] 새 Document 생성 시 기본 template를 deep copy해 저장한다.
- [ ] 시스템 template 변경이 기존 Document의 출력에 영향을 주지 않는다.
- [ ] 기존 문서가 기본 theme를 갖도록 migration된다.
- [ ] 문서별 Markdown theme를 저장하고 다시 열 수 있다.
- [ ] 제목 단계별 typography를 문서별로 변경할 수 있다.
- [ ] 본문과 block 사이 간격을 문서별로 변경할 수 있다.
- [ ] 목록의 간격, 들여쓰기와 marker를 문서별로 변경할 수 있다.
- [ ] 인용문의 typography, 배경, 선과 padding을 문서별로 변경할 수 있다.
- [ ] inline code와 code block 스타일을 문서별로 변경할 수 있다.
- [ ] 표와 링크 스타일을 문서별로 변경할 수 있다.
- [ ] screen, measure와 print 결과가 동일하다.
- [ ] 전역 CSS에 문서 고유 시각값이 남아 있지 않다.
- [ ] Inspector 또는 preset을 통해 실제 값을 변경하고 Electron에서 검증한다.
- [ ] typecheck, 전체 테스트와 production build가 통과한다.

## 비범위

- 사용자가 임의 CSS 문자열을 직접 입력하는 기능
- Markdown 문법이나 AST 의미 구조 변경
- 특정 이력서 section 이름에 따른 스타일 분기
