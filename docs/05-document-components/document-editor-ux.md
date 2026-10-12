# 실제 Document 편집 UX

## 문서의 범위

이 문서는 component definition 편집 화면이 아니라 사용자가 실제 이력서를 편집하는 Document 화면의 UX를 정의한다. 기존 [`ux.md`](./ux.md)의 범용 문서·component 원칙과 component 편집 경험은 유지하며, 실제 Document 화면에 대해서는 이 문서의 3열 구조와 selection 계약을 적용한다.

도구는 문서의 목적이나 node 이름을 해석하지 않는다. `경력`, `교육`, `프로젝트` 같은 이름은 표시용 데이터일 뿐이며 별도의 semantic type이나 이름 기반 동작을 만들지 않는다.

## 목표

실제 Document 화면에서 사용자는 다음 작업을 한 흐름 안에서 수행한다.

1. 실제 document node tree를 확인하고 선택한다.
2. 미리보기에서 내용을 직접 편집한다.
3. 선택한 node를 숨기고, 복제하고, 보관한다.
4. 현재 문서에 등록된 component를 instance 또는 repeater로 배치한다.
5. 선택한 node의 layout, typography, decoration과 pagination 속성을 편집한다.

component definition 편집 화면에 이미 있는 `DocumentStructurePanel`, `PropertyInspector`, selection 동기화와 요소 추가 도구를 같은 계약으로 재사용한다. 실제 Document 전용으로 같은 기능을 복사한 별도 체계를 만들지 않는다.

## 데스크톱 화면 구조

실제 Document 편집 화면은 데스크톱 Electron을 기준으로 3열 구조를 사용한다. 가운데 문서는 DOM으로 렌더링한 흐름형 문서이며 Canvas bitmap이나 절대 좌표 편집기가 아니다.

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│ 문서 목록   문서 이름              저장 상태                  PDF 내보내기   │
├──────────────────────┬────────────────────────────────────────┬────────────────┤
│ 레이어               │                                        │ 속성           │
│                      │        직접 편집 가능한 문서            │ 요소           │
│ Root                 │                                        │ 레이아웃       │
│ ├ 상단 영역          │        텍스트를 클릭하거나 드래그해      │ 위치           │
│ ├ 본문               │        내용과 서식을 바로 편집           │ 글자           │
│ │ ├ 제목             │                                        │ 장식           │
│ │ └ 반복 목록        │                                        │ 페이지         │
│ └ 하단 영역          │                                        │                │
├──────────────────────┤                                        │                │
│ 컴포넌트             │             [요소 추가 도구]            │                │
└──────────────────────┴────────────────────────────────────────┴────────────────┘
```

- 왼쪽 위: 실제 document node tree인 `레이어`
- 왼쪽 아래: 현재 문서의 component 목록과 배치 action
- 가운데: paginated Document renderer와 하단 요소 추가 도구
- 오른쪽: 선택한 document node의 `PropertyInspector`

component definition 편집은 별도 draft 화면으로 진입한다. 취소하거나 적용하면 같은 Document 화면으로 돌아온다. 좁은 화면에서 inspector를 접거나 overlay로 표시하는 동작은 후속 범위이며, 이번 범위는 데스크톱 3열을 우선한다.

## Document selection 계약

### 단일 상태

선택 상태의 단일 출처는 `useGenericDocumentSession`의 `session.selection`이다. 미리보기, layer tree와 inspector는 같은 document node id를 사용한다.

- 선택 가능한 id는 `documentSelectableNodeIds(document)`로 계산한다.
- 선택은 `selectNode(nodeId)`로 생성한다.
- document 변경 뒤에는 `reconcileDocumentSelection`으로 유효성을 맞춘다.
- 미리보기와 layer는 `session.setSelection`을 통해 같은 상태를 변경한다.

### 미리보기에서 선택

- 실제 document node를 클릭하면 해당 node를 선택한다.
- 선택한 node는 layout에 영향을 주지 않는 outline으로 표시한다.
- 미리보기 선택 직후 접힌 조상 layer를 모두 펼치고 선택 행을 보이는 위치로 스크롤한다.
- 키보드로 선택 가능한 구조 node는 `Enter`와 `Space`를 지원한다.
- 직접 편집 중인 text, rich-text와 Markdown은 caret을 유지한다. 이때 layer 선택과 스크롤은 동기화하되 layer 행으로 focus를 옮기지 않는다.
- component definition 내부 node는 실제 Document 선택 대상이 아니다. instance 내부 텍스트를 클릭할 때 구조 selection은 document의 component-instance node를 사용하고, 직접 편집 target만 instance prop 경로를 유지한다.
- repeater는 하나의 node이지만 layer에서는 실제 `items` 배열을 하위 행으로 펼쳐 표시한다. item 행은 `repeaterNodeId`와 `itemId`의 조합으로 선택하며, component-instance 한 줄과 반복 항목 여러 줄이 같은 구조처럼 보이지 않게 한다.
- 미리보기에서 repeater 내부 값을 클릭하면 repeater 전체가 아니라 해당 item을 선택한다. 직접 편집 target은 같은 item prop 경로를 유지한다.

### 선택 해제

- 문서 페이지의 여백이나 회색 작업영역을 클릭하면 document selection과 rich-text selection을 해제한다.
- 선택 가능한 node의 클릭은 propagation을 멈춰 빈 영역 클릭 처리로 이어지지 않는다.
- 선택을 해제할 때 활성화된 직접 편집 focus도 정리한다.

### 출력 안정성

- selection outline은 screen renderer에서만 보인다.
- screen mode에만 `selectedNodeId`, `selectableNodeIds`와 `onSelect`를 전달한다.
- measure와 print renderer에는 selection event나 action UI를 넣지 않는다.
- outline과 floating UI는 pagination 측정값과 PDF layout을 바꾸지 않는다.

## 레이어와 구조 action

`DocumentStructurePanel`을 실제 Document root에 연결한다. component definition 화면과 같은 접기, 선택, drag reorder, 숨김, 복제, 보관 동작을 사용한다.

### Repeater item

Repeater 행은 component 이름과 item 수를 함께 표시하고, 펼치면 `items` 배열과 같은 순서로 item 행을 렌더링한다.

```text
교육 items · 2개
├ 항목 1 · 2025.01
└ 항목 2 · 2017.03
```

- item 이름은 component prop의 선언 순서에서 첫 번째로 표시 가능한 실제 값 또는 기본값을 사용한다. 값이 없으면 `항목 1` 같은 중립 fallback을 사용하며 prop 이름이나 문서 목적을 해석하지 않는다.
- item 행은 일반 component-instance와 다른 list-item 아이콘과 한 단계 깊은 들여쓰기를 사용한다.
- item 선택은 `{ kind: "repeater-item", nodeId, itemId }`로 식별한다.
- item 행에서 숨김, 복제, 삭제와 같은 repeater item transaction을 실행할 수 있다. 순서는 drag로 변경한다.
- item의 휴지통 action은 해당 값을 `items` 배열에서 즉시 영구 삭제한다. document node 보관함으로 이동시키지 않는다.
- 삭제 직전 Document는 현재 편집 세션의 undo history에 저장한다. 삭제 직후 `Ctrl+Z` 또는 macOS의 `Cmd+Z`로 항목과 원래 순서를 복원할 수 있다.
- 삭제한 item이 선택 중이었다면 selection을 즉시 해제한다.
- item을 선택하면 inspector에는 repeater 전체 style이 아니라 해당 item의 component prop을 표시한다.

### Root

document root는 선택하고 속성을 편집할 수 있다. 다만 root에는 숨김, 복제, 보관과 drag action을 제공하지 않는다.

### 숨김

- node와 tree 위치는 유지한다.
- 화면과 PDF 출력에서 제외한다.
- layer에서 다시 표시할 수 있다.

### 복제

- `duplicateNodeSubtree`로 같은 부모의 바로 다음 위치에 복제한다.
- 복제 직후 새 subtree root를 선택한다.
- 접힌 조상을 펼치고 새 layer 행을 보이는 위치로 스크롤한다.

### 보관

- 휴지통 아이콘은 `archiveNode`를 실행한다.
- 영구 삭제가 아니라 복구 가능한 `보관함으로 이동`임을 tooltip과 접근 가능한 이름에 표시한다.
- 선택한 node를 보관하면 selection을 해제한다.
- component-instance와 repeater도 같은 일반 document node 규칙을 사용한다.
- 영구 삭제는 보관함에서만 제공한다.

## Component 선택과 배치

왼쪽 `컴포넌트` 영역은 `document.components`의 각 component에 다음 정보를 표시한다.

- component 이름
- 보관되지 않은 실제 document tree에서의 현재 사용 횟수
- `Instance 추가`
- `Repeater 추가`
- `정의 편집`

Instance와 Repeater는 구조 의미가 다르므로 하나의 모호한 추가 버튼으로 합치지 않는다.

- Instance: component를 한 번 사용하는 `component-instance`
- Repeater: 같은 component 구조의 반복 목록을 담는 빈 `repeater`

### 삽입 위치

삽입 부모는 의미 이름이 아니라 현재 구조 selection으로 결정한다.

1. 선택한 node가 보관되지 않은 container면 그 container 안에 추가한다.
2. 선택한 node가 container가 아니면 해당 node의 부모 container에 추가한다.
3. 선택이 없거나 유효한 부모를 찾지 못하면 document root에 추가한다.

component definition root나 definition 내부 node는 실제 Document의 삽입 대상으로 사용하지 않는다.

### 추가 후 동작

- component-instance는 `addComponentInstance`, repeater는 `addNode` transaction을 사용한다.
- 생성한 node를 즉시 session selection으로 설정한다.
- layer의 접힌 조상을 펼치고 새 행을 보이는 위치로 스크롤한다.
- definition 편집 진입은 기존 component draft 흐름을 사용한다.

개인 library import는 기존 component library operation을 유지한다. 이번 범위에서는 현재 문서 component의 선택과 배치를 먼저 완성하며, 실제 Document 왼쪽 영역에 library 관리 UI를 합치는 일은 후속 단계로 둘 수 있다.

## 속성 inspector

오른쪽 `PropertyInspector`는 component definition 화면과 같은 component를 사용한다. 미선택 상태에서는 선택 안내를 표시하고, 선택 상태에서는 node 타입에 맞는 기존 layout, position, typography, Markdown, image, repeater와 pagination 속성을 표시한다.

화면에 보이는 Button, Select, Tooltip과 toggle은 `client/src/renderer/src/shared/ui`의 shadcn component를 사용한다. 아이콘은 Lucide를 사용한다. 문서 출력·pagination과 무관한 UI 스타일은 `document.css`에 추가하지 않는다.

## 장식

선택한 일반 container를 포함한 style 가능 node에는 의미 이름과 무관한 `장식` section을 제공한다. `StyleDefinition.decoration`을 직접 편집한다.

- 배경색: `background`
- 선 색상: `borderColor`
- 선 두께: `borderWidthPt`
- 선 방향: `borderEdges`
- 모서리 반경: `radiusPt`
- 전체 초기화: 현재 style의 `decoration`만 제거

선 방향은 Lucide 아이콘을 사용한 작은 toggle 네 개로 표시한다.

- 위: `top`
- 오른쪽: `right`
- 아래: `bottom`
- 왼쪽: `left`

각 toggle은 독립적으로 `borderEdges` 배열에 방향을 추가하거나 제거한다. 빈 장식 객체는 저장하지 않는다. 전체 초기화는 layout, typography, Markdown과 pagination style을 보존한다.

`경력`, `교육`, `프로젝트` 같은 node 이름을 보고 선이나 배경을 자동 적용하지 않는다.

## Pagination의 continuation 장식

페이지 사이에서 분리된 container의 continuation fragment에는 기존 `continuationStyle` 규칙대로 top padding과 top border를 제거한다.

- 원본 node style은 변경하지 않는다.
- 첫 fragment의 top border는 유지한다.
- continuation fragment의 top border만 제거한다.
- top 외의 border 방향, 배경과 radius는 유지한다.
- selection UI를 켠 상태와 끈 상태의 pagination 결과가 같아야 한다.

## 빈 상태와 오류

- component가 없으면 현재 문서에 등록된 component가 없다는 안내를 표시한다.
- 빈 document root에서도 하단 요소 추가 도구는 사용할 수 있다.
- 추가나 style 변경 저장이 실패하면 현재 document와 selection을 유지하고 기존 저장 오류 UI에서 재시도할 수 있다.
- 보관된 node를 복원하면 해당 node를 선택하고 layer에서 보이게 한다.

## 접근성

- icon-only action에는 한국어 접근 가능한 이름을 제공한다.
- 숨김, 복제, 보관과 component 배치 action은 키보드로 실행할 수 있다.
- 보관 action은 영구 삭제로 오인되지 않도록 `보관함으로 이동`이라고 읽힌다.
- repeater item action은 `항목 삭제 · 실행 취소 가능`이라고 읽혀 document node의 보관 action과 구분한다.
- 선택 상태를 색상만으로 전달하지 않고 tree의 `aria-selected`와 renderer의 selection attribute를 함께 사용한다.
- 직접 편집 중 layer 동기화가 caret을 빼앗지 않는다.

## 완료 조건

- 실제 Document에서 node를 클릭하거나 키보드로 선택할 수 있다.
- 미리보기와 layer selection이 양방향으로 동기화된다.
- Repeater는 실제 item 수만큼 하위 layer 행을 표시하고 component-instance와 구조적으로 구분된다.
- Repeater item을 미리보기나 layer에서 선택하고 해당 item prop을 inspector에서 편집할 수 있다.
- Repeater item을 영구 삭제할 수 있고 `Ctrl/Cmd+Z`로 원래 순서에 복원할 수 있다.
- 빈 영역을 클릭하면 selection이 해제된다.
- 선택 node를 숨기고, 복제하고, 보관할 수 있으며 document root는 보관할 수 없다.
- 현재 문서 component를 선택한 container 또는 fallback root에 instance와 repeater로 각각 추가할 수 있다.
- 추가된 node가 즉시 선택되고 layer에 표시된다.
- 선택 node의 배경, 선 색상, 두께, 방향과 radius를 편집하고 decoration만 초기화할 수 있다.
- section 이름에 의존한 하드코딩이 없다.
- selection UI가 measure와 PDF 출력에 포함되지 않는다.
- continuation page의 top border 제거 동작이 유지된다.
- typecheck, 전체 테스트와 production build가 통과한다.
- Electron 실제 화면에서 선택, 빈 영역 선택 해제, 보관, component 추가와 장식 변경을 클릭으로 확인하고 스크린샷을 비교한다.
