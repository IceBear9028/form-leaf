# Preview와 Component 선택 경계 분리 기술 설계

## 현재 구조

공통 `NodeRenderer`가 클릭한 가장 가까운 `[data-document-node-id]`를 `componentNodeId`로 포함한다. 내용 preview와 component 편집 화면이 같은 `selectionFromRenderTarget()`을 사용하므로 둘 다 `component-node` selection을 만든다. 내용 화면의 레이어도 component instance와 repeater item 아래에 component definition tree를 렌더한다. 반면 실제 직접 편집 target은 render tree 단계에서 이미 `node`, `component-prop`, `repeater-item-prop`으로 올바르게 분리되어 있다.

## 변경 구조

```text
공통 render tree와 NodeRenderer
├─ content selection policy
│  ├─ document node → node selection
│  ├─ component 내부 → 외부 component instance selection
│  └─ repeater 내부 → repeater item selection
└─ structure selection policy
   ├─ component definition node → node selection
   └─ 중첩 component 내부 → component-node selection
```

내용 preview 레이어는 document tree와 repeater item까지만 표시한다. component 편집 레이어는 component root를 실제 tree root로 사용하며 중첩 component structure를 계속 표시한다.

Preview의 활성 상태는 `구조 selection`과 `직접 편집 focus`가 동시에 보이지 않는 상호 배타 규칙을 따른다.

```text
비활성
├─ 비편집 요소 클릭 → document node 또는 repeater item 하나 선택
└─ 편집 요소 클릭 → Text/Rich text/Markdown 하나 focus

활성 요소 A
└─ 요소 B 클릭 → A 종료·표시 제거 → B 하나 활성화
```

직접 편집 표시는 요소 타입별 구현이 아니라 preview가 소유한 `activeEditRenderId`와 `[data-document-edit-active="true"]` 공통 경계가 담당한다. DOM focus는 caret과 입력을 담당하고 선택 표시는 명시적 단일 상태를 사용한다. Markdown만 별도 portal overlay를 만들지 않는다.

## 데이터 흐름

노출된 component 값 클릭 → 기존 document selection 해제 → render node의 `editTarget` 하나 활성화 → `component-prop` 또는 `repeater-item-prop` update → 외부 instance/item 데이터 갱신. 비노출 내부 요소에는 edit target이 없으므로 기존 직접 편집 focus를 종료하고 외부 소유 단위 하나만 선택한다.

## 사용자 흐름

내용 화면에서 component 값 클릭 → 해당 값을 직접 수정 → instance/item에 저장. component 외형이나 내부 구조를 바꾸려면 component navigator에서 편집 화면 진입 → 내부 node 선택·배치·style 변경 → component 원본 저장.

## 영향받는 코드

| 영역 | 파일 또는 모듈 | 변경 책임 |
|---|---|---|
| render selection | `client/src/renderer/src/pages/document-editor/rendering/NodeRenderer.tsx` | content/structure 클릭 target과 DOM focus 분리 |
| renderer props | `DocumentRenderer.tsx`, `PaginatedDocumentRenderer.tsx` | 화면별 선택 정책과 단일 active render ID 전달 |
| selection mapping | `documentSelection.ts`, `GenericDocumentEditorPage.tsx` | content와 structure target 변환 분리 |
| layer tree | `DocumentStructurePanel.tsx` | 내용 화면의 component 내부 structure 숨김 |
| tests | `client/test/document-editor.test.mjs`, renderer 관련 테스트 | 화면별 선택 불변식 검증 |

## 저장과 복구

DocumentData와 저장 형식은 바뀌지 않는다. selection은 renderer 메모리 상태이므로 migration이나 복구 작업이 없다. 직접 편집 transaction과 자동 저장 경로도 유지한다.

## 오류와 경계 조건

- 노출된 prop의 편집 가능한 내부 node는 content mode에서도 DOM focus를 받아야 한다.
- 비노출 component 내부 node는 content mode에서 focus outline이나 component-node selection을 만들지 않아야 한다.
- repeater item의 빈 영역과 내부 비노출 요소는 모두 동일 item을 선택해야 한다.
- pagination으로 분할된 Markdown은 기존 source node/edit target identity를 유지해야 한다.
- Markdown list marker가 실제 edit target DOM에 포함되는 동안 외부 selection을 만들지 않아야 한다.
- 시각 경계를 벗어난 실제 비편집 여백은 계속 외부 instance 또는 repeater item을 선택해야 한다.
- 같은 source의 pagination fragment라도 현재 DOM focus를 가진 개별 root 하나만 공통 선택 표시를 가져야 한다.
- 외부 owner가 focus된 상태에서는 이전 직접 편집 요소의 표시가 남아 있으면 안 된다.
- component 편집 화면의 중첩 component는 structure mode에서 기존 component-node 선택을 유지해야 한다.

## 결정과 근거

| 결정 | 근거 | 대안 |
|---|---|---|
| renderer를 복제하지 않고 선택 정책을 명시한다. | 렌더 결과는 같고 화면별 차이는 선택·편집 권한에 있다. | renderer를 두 벌로 나누면 출력과 pagination 회귀 위험이 커진다. |
| Preview의 구조 selection과 직접 편집 focus를 상호 배타로 만든다. | 클릭한 요소 하나만 활성화한다는 제품 규칙을 상태 수준에서 보장한다. | 외부 owner selection을 유지하면 직접 편집 표시와 이중 선택이 된다. |
| Text, rich text와 Markdown에 공통 focus 표시를 사용한다. | 편집기 종류가 아니라 사용자가 클릭한 요소가 선택 단위다. | Markdown 전용 portal ring은 pagination fragment와 외부 selection 사이에 별도 lifecycle을 만든다. |
| 활성 직접 편집 fragment를 `renderId` 하나로 관리한다. | React 재렌더 이후 브라우저 `:focus-within` 갱신에만 의존하지 않고 단일 표시를 상태 수준에서 보장한다. | edit target identity만 사용하면 같은 source의 pagination fragment 여러 개가 동시에 표시될 수 있다. |
| preview 레이어에서 definition 내부 tree를 숨긴다. | 내용 편집에서 조작할 수 없는 공유 구조를 선택 대상으로 보이는 혼동을 제거한다. | read-only로 유지하면 클릭 selection 경계와 레이어 모델이 다시 달라진다. |

## 검증 전략

pure mapping 테스트로 같은 render target이 content에서는 외부 소유 단위, structure에서는 component-node가 되는지 확인한다. renderer 테스트로 edit target이 유지되는지 확인하고 editor 테스트로 selectable tree 경계를 검증한다. 이후 실제 앱에서 component instance와 repeater item의 노출·비노출 영역, component 편집 화면의 내부 선택을 확인한 뒤 전체 테스트, typecheck와 production build를 실행한다.

## 구현 결과

- `NodeRenderer`의 content mode는 클릭 지점이 실제 edit target일 때만 component 내부 DOM으로 focus를 보낸다. 그 밖에는 handler의 외부 instance 또는 item wrapper에 focus한다.
- 비편집 target은 `mousedown` 기본 동작이 내부 focus를 먼저 만들지 않도록 가장 가까운 selectable 소유 단위에서 기본 동작과 전파를 중단한다. 직접 편집 target의 브라우저 focus와 caret 동작은 차단하지 않는다.
- Content mode의 direct edit target 내부 `click`은 가장 가까운 selectable handler에서 전파를 종료한다. 직접 편집 focus가 들어올 때 기존 외부 selection을 해제해 활성 요소가 하나만 남는다.
- Text, rich text와 Markdown click은 target과 개별 fragment `renderId`를 preview에 전달한다. preview는 `activeEditRenderId` 하나만 보유하고, 구조 선택이 발생하면 이를 즉시 해제한다.
- content mode의 render selection target에는 `componentNodeId`를 포함하지 않으며, mapping 단계에서도 외부 node 또는 item으로 정규화한다.
- structure mode는 기존처럼 가장 가까운 내부 node를 `componentNodeId`로 전달한다.
- 내용 화면의 `DocumentStructurePanel`은 `includeComponentStructure=false`, component 편집 화면은 `true`를 사용한다.
- interaction debug는 두 화면 모두를 capture하고 각 record에 `content-preview` 또는 `component-preview` scope를 기록한다. `node-handler`에는 실제 `content`/`structure` mode와 `preserve-direct-edit`, `select-owner`, `select-structure` action을 기록한다.
- 좌표 기반 Markdown focus 경계와 Markdown 전용 portal ring은 제거한다. 불릿을 포함한 실제 Markdown DOM은 공통 edit target 경계로 처리하고, 그 밖의 영역은 클릭된 소유 단위로 전환한다.
- 저장 schema와 direct edit transaction에는 변경이 없다.
