# 미리보기 Markdown 직접 편집 기술 설계

## 핵심 결정

미리보기 DOM을 별도의 문서 모델로 사용하지 않는다. 저장과 동기화의 유일한 원본은 기존 `bodyMarkdown` 문자열이다.

```text
bodyMarkdown
  ↓ remark parse
mdast + source position
  ↓ React renderer
Preview DOM + source range metadata
  ↓ 사용자 입력·선택
MarkdownEdit transaction
  ↓ source range 치환
bodyMarkdown
```

이 구조는 왼쪽 textarea, 오른쪽 미리보기와 JSON 저장본이 서로 다른 내용을 가지는 문제를 막는다.

## 왜 DOM→Markdown 재직렬화를 사용하지 않는가

`contentEditable` DOM 전체를 다시 Markdown으로 바꾸면 다음 정보가 쉽게 달라진다.

- 사용자가 입력한 원래 Markdown 표기
- 이스케이프 문자와 줄바꿈 수
- `++밑줄++` 확장
- 중첩된 굵게·링크의 경계
- 참조 링크와 각주 definition 위치
- 페이지 측정을 위해 분리한 블록 경계

따라서 브라우저 DOM 변경을 저장하지 않고, 입력 의도를 source range 기반 문자열 연산으로 변환한다.

## 데이터 식별

각 편집 가능한 본문은 문서 안에서 안정적인 ID를 가져야 한다.

```ts
type MarkdownSourceTarget = {
  sourceId: string;
  sectionId: string;
  itemId?: string;
  field: "bodyMarkdown";
};
```

예시:

```text
section:introduction-about-me/bodyMarkdown
section:projects/item:project-lms/bodyMarkdown
section:activities/item:activity-ddd/bodyMarkdown
```

배열 index는 항목 순서 변경 시 달라지므로 식별에 사용하지 않는다.

## 편집 트랜잭션

모든 직접 편집과 서식 변경은 동일한 트랜잭션 형식을 사용한다.

```ts
type MarkdownSourceRange = {
  start: number;
  end: number;
};

type MarkdownEditTransaction = {
  sourceId: string;
  baseRevision: number;
  range: MarkdownSourceRange;
  replacement: string;
  selectionAfter: MarkdownSourceRange;
  reason: "typing" | "delete" | "line-break" | "format" | "link";
};
```

- offset은 JavaScript 문자열과 DOM Range가 공통으로 사용하는 UTF-16 code unit 기준으로 통일한다.
- `baseRevision`이 현재 원문 revision과 다르면 오래된 편집을 적용하지 않고 새 위치를 다시 계산한다.
- 트랜잭션 적용 함수는 React와 DOM에 의존하지 않는 순수 함수로 구현한다.
- 실행 취소 단위는 트랜잭션이며 연속 타이핑은 짧은 시간 범위에서 하나로 합칠 수 있다.

## mdast source position 매핑

remark가 제공하는 `node.position.start.offset`과 `end.offset`을 최상위 블록뿐 아니라 인라인 렌더링에도 전달한다.

렌더링 요소는 필요한 범위에서 다음 정보를 가진다.

```html
<span
  data-markdown-source="section:projects/item:project-lms/bodyMarkdown"
  data-source-start="142"
  data-source-end="151"
>
  선택 가능한 텍스트
</span>
```

브라우저 선택 위치는 DOM text offset과 가장 가까운 source metadata를 조합해 원문 offset으로 변환한다.

### 별도 처리가 필요한 표현

- `**내용**`: 화면에는 marker가 없으므로 내부 텍스트 범위와 전체 mark 범위를 모두 기록한다.
- `++내용++`: remark 표준 노드가 아니므로 전용 tokenizer가 source offset을 유지해야 한다.
- 이스케이프 문자: 화면 문자 하나와 원문 두 글자의 대응을 기록한다.
- 링크: label 범위와 destination 범위를 분리한다.
- inline code: backtick 길이와 내부 텍스트 범위를 구분한다.
- entity와 이모지: 렌더링 text offset과 source offset의 차이를 테스트한다.

단순히 mdast 노드 시작 offset에 DOM text offset을 더하는 방식은 이스케이프와 marker 때문에 정확하지 않다. 텍스트 조각별 source segment가 필요하다.

## 미리보기 편집 모드

### 상태

```ts
type PreviewMarkdownEditingState = {
  sourceId: string;
  blockId: string;
  revision: number;
  selection?: MarkdownSourceRange;
  composing: boolean;
};
```

- 기본 상태에서는 현재 미리보기와 동일하게 선택 가능한 읽기 화면이다.
- 지원 블록을 클릭하면 해당 블록만 편집 상태가 된다.
- 편집 상태는 시각적으로 최소한의 focus outline만 표시한다.
- 다른 본문을 클릭하면 이전 편집을 확정하고 새 블록으로 이동한다.
- `Escape`는 선택 toolbar를 닫고 편집 포커스를 해제한다.

### 입력 처리

- `beforeinput`에서 입력 종류와 현재 Selection을 읽는다.
- 브라우저 기본 DOM 변경은 필요한 경우 막고 동일한 MarkdownEdit 트랜잭션을 만든다.
- `compositionstart`부터 `compositionend`까지 한글 조합 문자열은 임시 상태로 다룬다.
- 조합 중에는 자동 저장과 전체 재렌더링을 유예하고 조합 완료 후 하나의 트랜잭션으로 반영한다.
- 붙여넣기는 우선 plain text로 처리하며 rich HTML 붙여넣기는 지원하지 않는다.

### 줄바꿈과 블록 생성

- Enter는 Markdown 원문에 빈 줄을 삽입해 현재 위치에서 블록을 분리한다.
- Shift+Enter는 현재 블록을 유지하는 인라인 강제 줄바꿈 `<br>`를 삽입한다. ATX 제목처럼 물리적 개행을 허용하지 않는 블록에서도 같은 동작을 보장하기 위한 표현이다.
- `<br>`는 허용된 단일 인라인 HTML 문법으로만 해석하며, 나머지 원문 HTML처럼 실행하지 않는다. 편집 화면에서는 source range가 연결된 줄바꿈 요소로 렌더링한다.
- Enter 트랜잭션의 `selectionAfter`는 새 블록 시작 offset이고, Shift+Enter의 `selectionAfter`는 `<br>` 직후 offset이다. 복원 시 Range를 반드시 `collapse(true)`한다.
- 빈 줄이 추가되면 01에서 정의한 연속 빈 줄 보존 규칙을 따른다. AST가 내용 없는 문단을 만들지 않는 구간은 줄바꿈 두 개마다 독립적인 편집용 빈 블록을 합성하며, 나머지 홀수 줄만 추가 공백으로 표시한다.
- 문단 사이 gap은 `\n`뿐 아니라 공백·탭만 있는 빈 줄도 허용해 source offset을 계산한다. 다음 블록의 leading-line anchor에서 Backspace를 누르면 바로 앞 `\n`을 삭제하고 이전 블록 끝으로 selection을 복원한다.
- anchor를 유지하기 위한 제로폭 문자는 source transaction에 포함하지 않으며 IME 확정 시 제거한다.
- 삭제 결과가 trailing space나 inline marker 안쪽처럼 DOM에 정확한 source boundary가 없는 offset이면, 같은 source에서 가장 가까운 이전 화면 boundary를 우선 사용한다. 이전 boundary가 없을 때만 다음 boundary를 사용한다.
- 빈 ATX 제목과 빈 `****`, `++++`, `~~~~` marker는 편집 중 전용 caret anchor로 렌더링한다. marker는 원문에 그대로 남고 다음 입력은 marker 내부 offset에 삽입된다.
- 목록·인용문·제목에서도 Enter는 새 블록, Shift+Enter는 현재 블록 내부 줄바꿈이라는 동일한 키 계약을 따른다.
- 1차 구현에서 안전하게 매핑할 수 없는 구조 변경은 왼쪽 Markdown 입력으로 안내할 수 있다.

## 선택 서식 연산

서식 적용은 선택 문자열을 무조건 marker로 감싸는 방식이 아니라 현재 문맥을 분석한 토글 연산으로 처리한다.

```text
원문: **빠른 검색 성능**
선택: 빠른 검색 성능
굵게 버튼 → 빠른 검색 성능

원문: 빠른 검색 성능
선택: 빠른 검색 성능
굵게 버튼 → **빠른 검색 성능**
```

### 공통 규칙

- 선택 전체가 같은 mark 안에 있으면 제거한다.
- 선택 일부만 mark 안에 있으면 선택 전체에 일관되게 적용한다.
- marker 바로 안쪽의 공백은 가능한 한 포함하지 않는다.
- 중첩 mark 순서는 01 직렬화 규칙과 일치시킨다.
- 인라인 코드 안에서는 다른 인라인 서식을 적용하지 않는다.
- 여러 최상위 블록을 가로지르면 도구를 숨긴다.

### 링크

- 일반 텍스트 선택에서 링크 버튼을 누르면 URL 입력 popover를 표시한다.
- 기존 링크 label을 선택하면 현재 URL을 수정하거나 링크만 제거할 수 있다.
- `http:`, `https:`, `mailto:` 검증을 기존 렌더러와 공유한다.
- destination에 괄호가 있으면 기존 escaping 규칙을 사용한다.

## Selection toolbar

- 브라우저 `selectionchange`를 document 단위로 관찰하되 preview 영역 밖의 선택은 무시한다.
- 선택한 DOM Range를 source range로 변환할 수 있을 때만 표시한다.
- 위치는 첫 번째 선택 rect를 기준으로 하되 viewport 밖으로 나가지 않게 보정한다.
- 마우스 버튼을 놓은 뒤 표시하고 선택이 무너지면 닫는다.
- toolbar를 클릭해도 preview selection을 잃지 않도록 `pointerdown` 단계에서 처리한다.
- 각 버튼은 `aria-label`, 눌림 상태와 키보드 포커스를 제공한다.

## 상태 전달 구조

현재 `ResumePreview`는 문서를 읽기만 한다. 구현 시 문서 갱신 함수를 전달한다.

```text
App
├─ document
├─ updateMarkdownSource(target, transaction)
├─ EditorPanel
└─ ResumePreview
   └─ MarkdownBlockContent
      └─ editable Markdown nodes
```

왼쪽 EditorPanel과 ResumePreview는 동일한 상위 update 함수를 사용한다. Preview 전용 사본이나 별도 저장 큐를 만들지 않는다.

## 페이지네이션과 포커스 복원

Markdown 변경은 블록 높이와 페이지 수를 바꿀 수 있다. React 재렌더링 후 기존 DOM Range는 무효가 되므로 source range를 기준으로 복원한다.

1. 변경 전 `sourceId`, block ID와 `selectionAfter`를 기록한다.
2. 문서를 갱신하고 현재 unit을 기존 page slot에 즉시 주입해 보이는 DOM이 오래된 원문을 유지하지 않게 한다.
3. 갱신된 DOM에서 같은 source range를 가진 DOM segment를 찾아 Selection과 focus를 우선 복원한다.
4. 측정 페이지에서 새 레이아웃을 계산한다.
5. 페이지 배치가 바뀌어 DOM이 다시 교체되면 같은 source range로 한 번 더 복원한다.
6. 커서 복원 자체는 강제 스크롤을 만들지 않는다.

페이지 측정용 숨은 DOM은 편집 이벤트와 selection 대상에서 제외한다.

## 스타일과 인쇄

편집 기능은 선택한 이력서 스타일을 바꾸지 않는다.

- focus outline과 toolbar는 앱 UI 계층에 속하며 PDF 스타일과 분리한다.
- `@media print`에서 toolbar, caret 보조 요소와 편집 outline을 제거한다.
- 선택 highlight는 브라우저 기본 표현을 사용하되 PDF에는 포함되지 않아야 한다.
- Markdown 스타일 프리셋은 편집 가능 여부와 무관하게 같은 CSS 변수를 사용한다.

## 접근성

- 편집 블록은 편집 상태와 역할을 스크린 리더에 전달한다.
- toolbar는 키보드로 이동하고 실행할 수 있어야 한다.
- 단축키 실행 후 selection을 유지한다.
- 마우스 드래그가 어려운 사용자는 Shift+화살표 선택과 단축키를 사용할 수 있다.
- 읽기 상태의 링크 클릭과 편집 상태의 선택 동작이 충돌하지 않도록 편집 모드에서 링크 이동을 막는다.

## 테스트 전략

### 순수 함수 테스트

- DOM selection ↔ source range segment 변환
- 문자열 삽입·삭제·줄바꿈 트랜잭션
- 각 mark의 적용·제거와 중첩
- 링크 destination escaping
- revision 불일치 거부
- 커서 위치 보정

### 컴포넌트 테스트

- 선택 조건에 따른 toolbar 표시·숨김
- toolbar pointerdown 후 selection 유지
- 한글 composition 동안 문서 갱신 유예
- 왼쪽 입력과 미리보기 동기화
- 읽기 전용 노드에서 편집 진입 차단

### 통합 검증

- 긴 프로젝트 본문 편집 후 페이지 이동
- 페이지 경계에 있는 텍스트 선택
- 자동 저장 후 앱 재실행
- PDF에 편집 UI가 포함되지 않는지 비교
- 기존 Markdown 14개 테스트와 스타일 프리셋 회귀

## 위험 요소와 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| DOM과 Markdown offset 불일치 | 다른 문장이 수정됨 | segment 단위 매핑과 순수 함수 테스트 우선 |
| IME 중 재렌더링 | 한글 조합 해제·중복 입력 | composition 동안 원문 확정과 페이지 재측정 유예 |
| 편집 중 페이지 이동 | 커서·스크롤 유실 | source range와 block ID로 재탐색 |
| 중첩 mark 토글 오류 | 깨진 Markdown 생성 | 문자열 연산을 별도 모듈로 격리하고 조합 테스트 |
| contentEditable DOM 오염 | HTML이 저장됨 | DOM 직렬화 금지, transaction만 저장 |
| 선택이 여러 블록을 통과 | 모호한 marker 배치 | 1차 버전에서 toolbar 비활성화 |
| 링크 클릭과 편집 충돌 | 의도치 않은 페이지 이동 | 편집 모드에서 링크 navigation 차단 |

## 구현 후보 모듈

| 모듈 | 책임 |
|---|---|
| `shared/markdownSourceMap.ts` | source segment와 selection offset 변환 |
| `shared/markdownEdits.ts` | 원문 치환, mark 토글과 링크 연산 |
| `renderer/components/PreviewMarkdownEditor.tsx` | 편집 상태·입력·IME 연결 |
| `renderer/components/MarkdownSelectionToolbar.tsx` | 선택 도구와 링크 popover |
| `MarkdownContent.tsx` | source metadata를 포함한 안전한 렌더링 |
| `ResumePreview.tsx` | source target 전달, 페이지 재배치와 포커스 복원 |

파일명은 구현 시 현재 코드 경계에 맞춰 조정할 수 있지만, source mapping과 문자열 편집 연산은 React 컴포넌트 밖에 둔다.
