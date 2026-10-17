# 08. Preview와 Component 선택 경계 분리

## 상태

완료 — 2026-10-18

## 문제

내용 편집 화면과 component 편집 화면은 같은 renderer와 `DocumentSelection`을 사용한다. 그 결과 내용 preview에서도 component definition 내부 node가 `component-node`로 선택되고 레이어에 공유 구조 전체가 노출된다. 실제 값은 이미 document node, component instance prop, repeater item prop에 저장되지만 클릭·focus 의미에는 component 구조 편집 문맥이 섞여 있다.

1차 경계 분리 뒤에도 외부 node 또는 repeater item selection과 직접 편집 focus가 서로 다른 상태로 남았다. 특히 Markdown은 별도 portal focus ring을 그려 다른 요소로 focus가 이동한 뒤에도 두 선택 표시가 동시에 보일 수 있었다. Preview의 활성 요소는 타입과 관계없이 하나여야 하며, 새 요소를 클릭하면 이전 요소의 편집과 표시가 즉시 종료되어야 한다.

## 사용자 경험

내용 preview에서 사용자가 요소를 클릭하면 기존 활성 요소를 해제하고 클릭한 요소 하나만 활성화한다. Text, rich text와 Markdown은 같은 선택 표시를 사용하며 클릭한 위치에서 바로 편집한다. component 내부 구조와 style을 고치는 선택은 명시적으로 component 편집 화면에 들어갔을 때만 제공한다.

## 목표

- 내용 preview와 component 편집 화면에 서로 다른 선택 정책을 적용한다.
- 내용 preview의 component 내부 클릭을 component instance 또는 repeater item 데이터 문맥으로 제한한다.
- 노출된 component prop의 기존 직접 편집 경로를 보존한다.
- component definition 내부 node 선택과 구조 탐색은 component 편집 화면에 유지한다.
- Preview에서 외부 구조 selection과 직접 편집 focus가 동시에 활성화되지 않게 한다.
- Text, rich text와 Markdown의 활성 표시를 공통 선택 스타일로 통합한다.
- 새 요소를 클릭하면 이전 요소의 편집, caret, 범위 선택과 시각 표시를 종료한다.

## 포함 범위

- `NodeRenderer`, `DocumentRenderer`, `PaginatedDocumentRenderer`의 선택 정책
- preview 클릭을 `node` 또는 `repeater-item` selection으로 변환하는 경계
- 내용 화면 레이어에서 component definition 내부 구조 숨김
- component 편집 화면의 구조 선택 회귀 검증
- 일반 node와 component prop 직접 편집 회귀 검증

## 제외 범위

- DocumentData 또는 component prop 저장 schema 변경
- component 자체 생성·삭제·prop binding API 변경
- renderer pipeline 분리
- component 편집 화면의 drag/layout 기능 재설계
- preview inspector의 전체 UX 개편

## 완료 조건

- [x] 내용 preview에서 component 내부를 클릭해도 `component-node` selection이 생성되지 않는다.
- [x] 노출된 component prop을 클릭하면 기존 외부 node/item selection이 해제되고 해당 편집 요소 하나만 활성화된다.
- [x] Text, rich text와 Markdown이 동일한 공통 선택 표시를 사용한다.
- [x] 이미 활성화된 Markdown의 불릿을 클릭하면 같은 Markdown만 유지되고 외부 owner가 선택되지 않는다.
- [x] 다른 요소를 클릭하면 이전 Markdown 편집과 표시가 즉시 종료되고 새 요소 하나만 표시된다.
- [x] Markdown 전용 portal focus ring과 좌표 기반 focus 경계 보정이 제거된다.
- [x] 비노출 component 내부 요소 클릭은 외부 instance 또는 repeater item을 선택한다.
- [x] 내용 화면 레이어는 component definition 내부 node를 선택 대상으로 표시하지 않는다.
- [x] component 편집 화면에서는 내부 node와 중첩 component 구조 선택이 유지된다.
- [x] preview 빈 영역 선택 해제, 키보드 focus와 레이어 reveal이 회귀하지 않는다.
- [x] 관련 테스트, typecheck, 전체 테스트와 production build가 통과한다.

## 이전 구현과 재설계

- 공통 renderer에 `content`와 `structure` 선택 mode를 추가했다.
- 내용 preview에서 component 내부의 비편집 영역은 외부 instance 또는 repeater item에 focus와 selection을 둔다.
- 노출된 prop은 내부 contenteditable에 정확히 focus되며 기존 `component-prop`·`repeater-item-prop` transaction으로 저장된다.
- 내용 화면 레이어는 document node와 repeater item까지만 표시하고 component definition 내부 tree를 숨긴다.
- component 편집 화면은 내부 node와 중첩 component의 `component-node` selection 및 구조 레이어 연결을 유지한다.
- 비편집 preview 클릭은 `mousedown` 단계에서 가장 가까운 문서 소유 단위에 한 번만 focus하고 내부 definition node의 일시적 focus를 만들지 않는다.
- interaction debug 기록에 `content-preview`/`component-preview` scope와 selection mode를 남겨 두 화면의 이벤트 효과를 같은 형식으로 비교할 수 있다.

## 실제 이벤트 A/B 확인

동일한 실제 사용자 데이터 복사본과 동일 좌표의 신뢰된 마우스 입력으로 `3febb4f`와 현재 구현을 비교했다.

| 시나리오 | 변경 전 | 현재 |
|---|---|---|
| preview의 component 내부 비편집 Markdown 클릭 | 내부 node focus + `component-node` selection | 외부 instance focus + `node` selection |
| preview 레이어의 component definition 행 | 3개 노출 | 0개 |
| repeater 직접 편집 값 클릭 | 내부 `contenteditable` focus와 외부 item selection 동시 발생 | `preserve-direct-edit`, 내부 focus 유지, selection 요청 없음 |
| component 편집 내부 node 클릭 | 구조 선택 | `component-node` selection과 내부 레이어 연결 유지 |

실제 사용자 클릭 재진단에서 Markdown 내부 클릭이 외부 repeater handler까지 전달되어 `repeater-item` selection을 매번 요청하는 문제가 추가로 확인됐다. Content mode는 direct edit target 내부 click을 `preserve-direct-edit` action으로 종료하고, 비편집 여백만 `select-owner` action으로 외부 선택을 요청한다.

후속 재현에서는 focus된 Markdown의 왼쪽 시각 경계와 실제 DOM hit box 사이 약 2px에서 target이 component 내부 container로 바뀌었다. 한때 focus outline을 포함한 4px 좌표 보정을 적용했지만, 이는 Markdown에만 별도 hit 정책을 만드는 문제가 있어 최종 설계에서 제거한다. 불릿과 목록 marker는 실제 Markdown edit target DOM으로 처리하고, 그 밖의 실제 비편집 여백은 외부 소유 단위 선택으로 전환한다.

사용자 스크린샷 재진단에서 더 근본적인 문제가 확인됐다. 하나의 Markdown source가 여러 pagination fragment로 렌더될 때 각 `EditableMarkdownValue`가 focus ring 상태를 독립적으로 보유했고, 외부 selection과 Markdown 전용 ring도 서로 다른 상태였다. blur 보정만으로 이중 표시를 막는 접근을 폐기하고, 모든 직접 편집 요소에 브라우저의 단일 focus와 공통 선택 표시를 적용한다. 직접 편집 요소가 활성화되면 기존 document selection을 해제하고, 비편집 요소가 선택되면 기존 직접 편집 focus가 종료된다.

최종 구현은 브라우저 `:focus-within`만 표시 근거로 사용하지 않는다. 구조 selection과 상호 배타인 `activeEditRenderId` 하나를 preview가 소유하고, 정확히 일치하는 render fragment에만 `data-document-edit-active="true"`를 부여한다. 실제 기존 이력서에서 repeater item → Text → Markdown → Markdown 불릿 → rich text → repeater item 순서로 클릭했을 때 매 단계 공통 outline이 하나만 존재하고, 불릿 클릭에는 `select-owner`가 발생하지 않음을 확인했다.

## 관련 문서

- [구현 계획](plan.md)
- [기술 설계](design.md)
- [세션 인수인계](handoff.md)
