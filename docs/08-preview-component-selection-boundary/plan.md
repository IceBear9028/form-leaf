# Preview와 Component 선택 경계 분리 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 검증 |
|---|---|---|---|
| 1 | 선택 정책과 변환 경계 정의 | 완료 | selection·render target 단위 테스트 통과 |
| 2 | preview renderer와 레이어에 content 정책 적용 | 완료 | component instance·repeater 클릭 회귀 테스트 통과 |
| 3 | component 편집 구조 정책 보존 | 완료 | component editor 수동·자동 확인 완료 |
| 4 | 전체 검증과 문서 완료 | 완료 | 전체 테스트·typecheck·build·diff 점검 통과 |
| 5 | 실제 이벤트 A/B 진단과 focus 경계 보완 | 완료 | 변경 전/후 CDP 입력 비교 및 두 화면 전체 이벤트 로그 확인 |
| 6 | 직접 편집 클릭과 외부 selection action 분리 | 완료 | direct edit 내부 click은 selection request 없이 종료 |
| 7 | focus된 Markdown의 시각 경계 hit 보정 | 완료 | 실제 좌표 A/B 재현 및 경계 밖 owner 선택 유지 |
| 8 | pagination fragment focus ring 단일 소유 진단 | 완료 | 스크린샷으로 별도 ring lifecycle이 근본 원인임을 확인 |
| 9 | Preview 단일 활성 요소와 공통 편집 표시 | 완료 | 실제 기존 이력서에서 Text·Rich text·Markdown·불릿·owner 전환 시 단일 표시 확인 |

상태는 `대기`, `진행 중`, `완료`, `차단` 중 하나만 사용한다. 동시에 하나의 단계만 `진행 중`으로 둔다.

## 구현 순서

### 1. 선택 정책과 변환 경계 정의

- content selection은 component 내부 render node를 외부 instance 또는 repeater item으로 접는다.
- structure selection은 현재 `component-node` 문맥을 유지한다.
- 직접 편집 target은 selection과 독립적으로 기존 `node`, `component-prop`, `repeater-item-prop`을 유지한다.

### 2. preview renderer와 레이어에 content 정책 적용

- preview에서 비편집 component 내부 DOM으로 focus가 들어가지 않게 한다.
- 내용 레이어는 component instance와 repeater item을 데이터 소유 단위로 표시하고 내부 definition tree를 숨긴다.

### 3. component 편집 구조 정책 보존

- component 편집 canvas와 레이어에는 structure 정책을 명시한다.
- 중첩 component 내부 node 선택과 기존 direct manipulation을 확인한다.

### 4. 전체 검증과 문서 완료

- targeted test 후 전체 테스트, typecheck와 production build를 실행한다.
- 실제 앱에서 preview와 component 편집 화면을 각각 확인하고 문서에 결과를 반영한다.

### 5. 실제 이벤트 A/B 진단과 focus 경계 보완

- 동일 사용자 데이터 복사본으로 변경 전 `3febb4f`와 현재 production build에 신뢰된 마우스 입력을 전달한다.
- `pointerdown`, `mousedown`, focus, click, handler, selection request/state, settled 순서를 비교한다.
- content 비편집 target은 `mousedown` 기본 focus를 차단하고 가장 가까운 외부 소유 단위에서 전파를 멈춘다.
- component 편집 화면에도 동일한 interaction capture와 scope 표식을 적용한다.

### 6. 직접 편집 클릭과 외부 selection action 분리

- 실제 앱을 debug mode로 실행하고 사용자의 Markdown 클릭 이벤트를 수집한다.
- content preview의 direct edit target 클릭은 caret/focus를 보존하고 외부 node 또는 repeater selection을 요청하지 않는다.
- structure mode에서는 component 내부 구조 selection을 그대로 유지한다.
- handler 로그에 실제 action을 기록해 selection 요청 유무를 바로 판별할 수 있게 한다.

### 7. focus된 Markdown의 시각 경계 hit 보정

- Markdown이 이미 focus된 상태에서 불릿 왼쪽과 focus outline 경계를 다시 클릭하는 순서를 별도로 재현한다.
- active Markdown의 DOM rect와 focus outline을 포함한 4px 범위는 직접 편집 경계로 유지한다.
- 경계 보정 click은 `mousedown` 기본 focus 이동을 막고 기존 contenteditable/caret을 유지한다.
- 실제 경계 밖의 비편집 여백은 기존 `select-owner` 경로를 유지한다.
- `node-handler`에 `directEditHit=target|active-boundary`와 `preserve-active-direct-edit-boundary` action을 기록한다.

이 단계의 좌표 보정은 9단계에서 폐기한다. 최종 동작은 요소 타입과 무관한 실제 edit target DOM 경계와 공통 focus 표시를 사용한다.

### 8. pagination fragment focus ring 단일 소유

- 같은 Markdown source의 여러 pagination fragment가 독립적인 ring 상태를 남기는지 확인한다.
- focus가 현재 `EditableMarkdownValue` root를 벗어나면 source ID가 같아도 이전 ring을 즉시 해제한다.
- document `focusin` guard로 다른 Markdown root나 외부 owner가 focus될 때 오래된 ring을 제거한다.
- `focus-boundary` 로그에서 ring 활성화, 해제와 단일 소유 강제를 구분한다.
- 외부 repeater item focus 뒤 `.document-markdown-focus-ring`이 0개인지 실제 DOM으로 확인한다.

이 단계의 Markdown 전용 ring lifecycle도 9단계에서 제거한다. 진단 근거로만 보존한다.

### 9. Preview 단일 활성 요소와 공통 편집 표시

- 직접 편집 요소를 클릭하면 해당 fragment의 `renderId` 하나를 활성화하고 기존 document node 또는 repeater item selection을 해제한다.
- 비편집 요소를 선택하면 기존 직접 편집 요소를 blur하고 편집 내용과 범위 선택을 정리한다.
- Text, rich text와 Markdown에 `data-document-edit-active` 기반의 같은 공통 선택 스타일을 적용한다.
- Markdown 전용 portal focus ring과 4px 좌표 경계 보정을 제거한다.
- Markdown 불릿 클릭은 같은 edit target으로, 실제 바깥 여백 클릭은 소유 요소 전환으로 검증한다.
- 서로 다른 편집 요소를 연속 클릭했을 때 공통 활성 표시가 항상 하나인지 실제 앱에서 확인한다.

## 회귀 검증

- [x] 관련 selection·renderer 단위 테스트
- [x] 실제 앱 preview/component 화면 확인
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `git diff --check`
- [x] 개인정보와 로컬 사용자 데이터가 Git diff에 없는지 확인
- [x] 변경 전/후 실제 이벤트 A/B 비교
- [x] content 비편집·직접 편집·component structure 이벤트 시퀀스 확인
- [x] focus된 Markdown 불릿 안쪽·시각 경계·실제 경계 밖 좌표 대조
- [x] 같은 source fragment 이동 후 외부 owner focus에서 Markdown ring 1→0 확인
- [x] 실제 기존 이력서에서 owner → Text → Markdown → 불릿 → rich text → owner 전환 시 활성 표시 1/1/1/1/1/1 확인
- [x] Markdown 불릿의 신뢰된 click에서 `activate-single-edit-target`, `preserve-direct-edit`만 발생하고 `select-owner`가 없는지 확인
