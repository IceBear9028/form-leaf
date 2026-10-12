# 범용 문서·컴포넌트 편집 UX

## UX 목표

오른쪽 문서 화면을 결과 확인용 미리보기가 아니라 실제 콘텐츠 편집 화면으로 사용한다. 별도의 `내용` 모드나 왼쪽에 같은 텍스트를 반복하는 입력 폼은 만들지 않는다.

왼쪽 패널은 다음 책임을 가진다.

1. 문서를 이루는 node tree를 관리한다.
2. 선택한 node의 구조와 직접 편집하기 어려운 속성을 편집한다.
3. component 정의와 개인 component library로 이동하는 진입점을 제공한다.

도구는 문서의 목적을 제안하거나 해석하지 않는다. 사용자가 붙인 layer·component·field 이름은 표시용 데이터일 뿐이며 어떤 기능 분기도 만들지 않는다.

## 전체 화면 구조

현재 2열 구조를 유지한다. 오른쪽은 DOM으로 렌더링한 흐름형 문서이며 Canvas bitmap이나 절대 좌표 편집기가 아니다.

```text
┌──────────────────────────────────────────────────────────────┐
│ 문서 목록   문서 이름       저장 상태       PDF 내보내기   │
├──────────────────────┬───────────────────────────────────────┤
│ 레이어               │                                       │
│                      │       직접 편집 가능한 문서            │
│ 상단 영역            │                                       │
│ 본문                 │       텍스트를 클릭하거나 드래그해      │
│   ├ 제목             │       내용과 서식을 바로 편집           │
│   └ 반복 목록        │                                       │
│ 하단 영역            │                                       │
│                      │                                       │
│ + 추가               │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

왼쪽 패널은 별도 모드 전환 없이 stack navigation을 사용한다.

- 최상위: node tree와 component·library 진입점
- node 선택: 선택한 node의 속성
- component 선택: component 정의 draft
- 뒤로 가기: 직전 목록으로 이동

오른쪽 문서와 현재 선택은 패널 이동 중에도 유지한다.

## 새 문서와 node 추가

새 문서는 이름과 빈 root container만 가진다. 특정 목적을 전제로 한 starter나 기본 section을 자동으로 만들지 않는다.

`+ 추가`를 누르면 현재 선택한 container에 다음 범용 요소를 추가한다.

- 텍스트
- 서식 텍스트
- Markdown
- 이미지
- Container
- Repeater
- 이 문서의 component instance
- 개인 library에서 가져오기

root 바로 아래에 추가한 node는 사용자가 문서를 나누는 최상위 layer가 된다. 사용자가 이를 카테고리로 인식하거나 원하는 이름을 붙일 수 있지만, 저장 모델에는 별도의 category 타입이 없다.

추가 직후에는 tree와 문서 화면에서 새 node를 함께 선택한다. 텍스트 계열이면 caret을 놓고, 나머지는 속성 패널을 연다. 저장 실패 시 입력과 선택을 유지하고 다시 시도할 수 있게 한다.

## 문서에서 직접 편집

### 텍스트 계열

- `text`: 클릭해 일반 문자열을 편집한다.
- `rich-text`: 클릭해 편집하고 범위를 드래그해 서식을 적용한다.
- `markdown`: 렌더링 결과를 직접 편집하되 원문 transaction으로 저장한다.

편집 대상은 화면 문구가 아니라 안정적인 node 또는 instance prop 경로로 식별한다. 페이지 재측정으로 위치가 바뀌어도 같은 target의 focus와 caret을 복원한다. IME 조합 중에는 저장·재측정이 조합을 끊지 않아야 한다.

### 구조화된 속성

다음 값은 문서에서 대상을 선택한 뒤 왼쪽 inspector에서 편집한다.

- 링크 URL
- 이미지 asset, 대체 텍스트와 맞춤 방식
- container 방향, 간격, 여백과 정렬
- repeater item 추가, 복제, 순서와 숨김
- node 전체의 글꼴, 크기, 색상과 page-break 규칙

화면에 보이는 링크 문구는 직접 편집할 수 있지만 URL은 inspector에서 편집한다. 편집 중 링크 클릭은 선택 동작이며 실제 이동은 `링크 열기` action으로 분리한다.

### 선택 동기화

- 문서의 요소를 선택하면 왼쪽 tree에서 같은 node 또는 instance를 선택한다.
- tree에서 선택하면 문서의 위치를 강조하고 화면 밖이면 스크롤한다.
- 선택 outline과 toolbar는 출력 DOM 크기에 영향을 주지 않는 overlay로 표시한다.
- 서로 다른 node나 페이지를 가로지른 텍스트 선택에는 inline toolbar를 표시하지 않는다.
- `Escape`는 toolbar, 텍스트 편집, 요소 선택 순으로 한 단계씩 닫는다.
- drag reorder 외에 키보드와 메뉴로 같은 순서 변경을 제공한다.

## 텍스트 서식

`rich-text` 안에서 범위를 선택하면 selection 가까이에 floating toolbar를 표시한다.

```text
┌ B │ I │ U │ S │ 링크 │ 글자색 ● │ ⋯ ┐
```

- `B`: 굵게, `Cmd/Ctrl+B`
- `I`: 기울임, `Cmd/Ctrl+I`
- `U`: 밑줄, `Cmd/Ctrl+U`
- `S`: 취소선
- `링크`: URL 추가·수정·제거
- `글자색`: palette 또는 검증된 직접 색상 적용, 기본색 복원

버튼은 선택 범위가 모두 같은 상태이면 active, 일부만 같으면 mixed로 표시한다. toolbar를 눌러도 원래 selection과 focus를 잃지 않는다.

선택한 일부 글자의 색상은 rich-text mark로, node 전체의 기본 색상은 style로 저장한다. inline 색상을 제거하면 node style의 기본색으로 돌아간다. 색상은 임의 CSS가 아니라 검증된 token 또는 `#RRGGBB`만 허용한다.

Markdown은 승인된 원문 문법만 저장한다. 굵게, 기울임, 취소선, 링크와 인라인 코드는 원문 marker로 보존한다. 일부 문자열의 색상은 표준 Markdown이 아니므로 첫 범위에서는 제공하지 않고 node 전체 색상만 style로 바꾼다. 확장 문법을 도입하려면 별도 결정을 거친다.

## 왼쪽 node tree와 inspector

최상위 패널은 문서 이름, node tree와 component 진입점을 표시한다.

```text
레이어

문서 이름       새 문서

≡ 상단 영역                    표시
≡ 본문                         표시
   ├ 제목
   └ 반복 목록 · 3개
≡ 하단 영역                    숨김

[+ 추가]

컴포넌트  2개  →
내 라이브러리   →
보관함          →
```

각 node 행은 다음 동작을 제공한다.

- 선택과 문서 위치 이동
- 이름 변경
- 위·아래 이동 또는 drag reorder
- 표시 전환
- 복제
- 자식 추가가 가능한 경우 자식 추가
- component로 만들기
- 보관

텍스트 값을 tree나 inspector에 중복 입력하지 않는다. inspector에는 node 타입, 구조화된 속성, style과 component 편집 진입점만 표시한다.

Repeater는 item을 하위 행으로 펼쳐 보여준다. 표시 이름은 component가 지정한 대표 prop 값에서 가져오되 값이 비면 `새 항목 1` 같은 중립 fallback을 사용한다.

## Component 만들기와 편집

### 선택한 node로 만들기

사용자는 하나의 node 또는 같은 container 아래의 연속된 node들을 선택해 component로 만들 수 있다.

1. 선택한 subtree를 component definition으로 이동한다.
2. 원래 위치에는 component instance를 둔다.
3. 반복해서 바꿀 값을 prop으로 노출한다.
4. 같은 문서에 새 instance를 추가해 재사용한다.

component 이름과 prop 이름은 사용자가 정한다. 도구는 이름을 보고 레이아웃이나 동작을 추론하지 않는다.

### Definition 편집

component를 열면 실제 문서와 분리된 draft를 만든다.

```text
← 컴포넌트 목록

이름             [정보 블록             ]

레이어
≡ Container
   ├ Text
   └ Rich text

노출된 속성
≡ heading         텍스트
≡ body            서식 텍스트

사용 위치: 3개

[취소]                              [변경 적용]
```

- `취소`는 실제 문서를 바꾸지 않는다.
- `변경 적용`은 graph와 prop validation을 통과한 경우에만 반영한다.
- 오른쪽에는 대표 instance에 draft를 적용한 결과와 `미적용 변경` badge를 표시한다.
- 삭제·타입 변경으로 기존 instance 값이 사라질 수 있으면 적용 전에 영향 범위를 보여준다.
- component가 자신을 직접 또는 간접 참조하는 구성은 저장하지 못하게 한다.

## Repeater 사용

반복 구조는 별도의 `목록 카테고리`가 아니라 `repeater` node로 만든다.

1. 반복할 component를 고른다.
2. `항목 추가`로 독립된 prop 값을 가진 item을 만든다.
3. tree 또는 문서 화면에서 item을 선택한다.
4. 직접 편집 가능한 값은 문서에서, 구조화된 값은 inspector에서 수정한다.
5. item을 복제하거나 순서를 바꾸고 숨기거나 보관한다.

반복이 필요하지 않으면 일반 component instance를 사용한다. 이 차이는 문서의 의미가 아니라 구조 동작만 나타낸다.

## 다른 문서에서 component 재사용

component 메뉴의 `내 라이브러리에 저장`을 사용한다.

```text
현재 문서의 component
→ 내 라이브러리에 저장
→ 다른 문서에서 가져오기
→ 새 ID를 가진 독립 복사본 생성
```

- 가져올 때 definition, node, style과 필요한 asset dependency를 함께 복사한다.
- 이미 만들어진 문서와 library 원본 사이에는 live link가 없다.
- library 원본을 바꿔도 기존 문서는 자동으로 바뀌지 않는다.
- 같은 문서에 다시 가져올 때도 ID 충돌이 없도록 새 ID를 만든다.
- 저장 대상으로 선택한 definition의 node 값과 prop 기본값을 포함한다. 문서에 배치한 개별 instance·repeater item override는 포함하지 않는다.

## 빈 상태

- 빈 document root에는 `+ 요소 추가`와 `내 라이브러리에서 가져오기`만 안내한다.
- 빈 text·rich-text·Markdown node는 선택하거나 포커스하기 전에도 편집 위치를 알리는 `텍스트 입력` placeholder를 화면에 표시한다.
- placeholder는 편집 UI일 뿐 실제 node 값이나 component prop 기본값으로 저장하지 않으며 PDF에도 출력하지 않는다.
- 빈 image node는 선택 가능한 placeholder를 표시한다.
- 빈 repeater는 출력 공간을 강제로 만들지 않고 선택했을 때 `첫 항목 추가` action을 보여준다.
- 모든 placeholder와 선택 UI는 PDF에서 숨긴다.

## 숨김, 보관과 삭제

- `숨김`: 데이터와 tree 위치를 유지하고 화면·PDF 출력만 끈다.
- `보관`: 원래 위치에서 제거하지만 문서의 보관함에서 복원할 수 있다.
- `영구 삭제`: 보관함에서만 제공하고 영향 범위와 복구 불가를 확인한다.
- 참조 중인 component와 dependency는 바로 영구 삭제하지 못한다.
- component 변경으로 제거된 prop 값의 보존 형식이 확정되기 전에는 자동 폐기하지 않는다.

## 접근성과 출력 안정성

- 모든 drag 동작은 키보드와 메뉴 대안을 제공한다.
- toolbar와 inspector control에 이름, focus 순서와 shortcut 안내를 제공한다.
- 색상만으로 선택·숨김·오류 상태를 구분하지 않는다.
- 편집 overlay는 측정 DOM과 print DOM에 포함하지 않는다.
- 화면, 숨겨진 측정 DOM과 PDF는 같은 node renderer와 style 값을 사용한다.

## UX에서 의도적으로 제공하지 않는 것

- 문서 목적 선택 화면
- 목적별 starter와 추천 category
- 사용자 이름에 따른 자동 레이아웃 변경
- 별도 `내용` 모드
- Canvas 기반 자유 배치와 좌표 단위 이동
- 여러 문서에 component 변경을 자동 전파하는 연결 instance
- 임의 HTML, CSS 또는 JavaScript 실행
