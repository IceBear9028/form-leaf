# 범용 문서·컴포넌트 모델 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 핵심 완료 조건 |
|---|---|---|---|
| 1 | 계약·전환 정책 확정 | 완료 | 다섯 구현 기본안 승인, 문서 계약 일치 |
| 2 | 범용 document core 구현 | 완료 | schema·graph·transaction 단위 테스트 통과 |
| 3 | 레거시 importer 구현 | 완료 | v1/v2를 원본 손상 없이 범용 문서로 변환 |
| 4 | 읽기 전용 범용 DOM renderer 구현 | 완료 | 일반 node fixture의 화면·측정·pagination 일치 |
| 5 | node tree·inspector 편집기 구현 | 완료 | 빈 문서에서 일반 node 구성·저장 가능 |
| 6 | component·repeater 재사용 구현 | 완료 | 문서 내부 definition·instance·반복 구조 동작 |
| 7 | preview 직접 편집·서식 구현 | 완료 | text·rich-text·Markdown 편집 회귀 통과 |
| 8 | 저장소·library·IPC와 앱 전환 | 진행 중 | 새 stack으로 CRUD·재실행·다른 문서 재사용 동작 |
| 9 | 레거시 runtime 제거·전체 검증 | 대기 | domain 결합 제거, 전체 검사와 실제 앱 검증 통과 |

상태는 `대기`, `진행 중`, `완료`, `차단` 중 하나만 사용한다. 동시에 하나의 단계만 `진행 중`으로 둔다.

## 전환 전략

기존 화면을 단계별로 직접 고치지 않는다. 현재 editor와 renderer는 새 stack이 기능적으로 준비될 때까지 그대로 유지한다.

```text
현재 stack ───────────────────────────────────────────┐
                                                     ├─ 8단계에서 앱 진입점 전환
새 core → legacy importer → renderer → editor ───────┘
```

이 방식의 목적은 다음과 같다.

- 개발 중에도 현재 앱이 계속 typecheck·build 가능해야 한다.
- 새 renderer가 준비되기 전에 저장 schema부터 바꿔 편집 화면이 깨지는 상황을 피한다.
- 기존 Markdown 직접 편집을 새 editor에서 검증하기 전에는 앱 진입점을 바꾸지 않는다.
- 레거시 타입은 importer만 알게 하고 generic core·renderer·editor에는 노출하지 않는다.
- 8단계 전환 전까지 새 코드는 목적과 무관한 fixture로 독립 검증한다.

## 구현 기본안

다음 기준은 사용자의 구현 시작 요청과 함께 확정했다.

| 항목 | 기본안 | 이유 |
|---|---|---|
| 레거시 변환 위치 | `main/document/legacy` 내부 importer | 기존 파일을 앱에서 계속 열 수 있으면서 renderer와 editor에서 과거 의미를 격리할 수 있다. |
| 첫 layout 범위 | row·column, gap, 네 방향 padding, align, 폭 모드, 세 가지 page-break 규칙 | DOM flow와 A4 pagination에 필요한 최소 표현만 제공하고 CSS 전체 복제를 피한다. |
| prop 제거·타입 변경 | 기존 prop을 archive하고 새 prop을 생성 | instance value를 버리지 않고 복원 가능하게 한다. 기존 prop의 타입은 제자리에서 바꾸지 않는다. |
| Markdown 일부 글자 색상 | 첫 범위에서 제외 | rich-text inline color와 node 전체 색상으로 우선 제공하고 비표준 Markdown 확장은 미룬다. |
| 개인 component library | 앱 workspace 아래 별도 index와 item 파일, 가져올 때 독립 복사 | 문서 파일의 독립성과 원자적 저장을 유지한다. 외부 JSON import/export는 첫 범위에서 제외한다. |

폭 모드는 `auto`, `fill`, `fixed`만 허용하며 `fixed`일 때만 pt 값을 저장한다. page-break 규칙은 `keepTogether`, `keepWithNext`, `forcePageBreakBefore`로 제한한다.

## 공통 구현 원칙

- production core는 문서 목적이나 사용자 category를 나타내는 타입·기본값·분기를 갖지 않는다.
- 새 문서는 범용 metadata와 빈 root container만 가진다.
- 화면에서 category로 인식하는 대상은 root 바로 아래의 일반 node다. 별도 category schema를 만들지 않는다.
- editor와 renderer는 node type, prop type과 검증된 style 값만 해석한다.
- 사용자 이름과 text value를 전혀 다른 문자열로 바꿔도 기능 동작은 같아야 한다.
- 문서 파일은 자신이 사용하는 component·style·asset을 포함해 독립적으로 재현 가능해야 한다.
- 다른 문서에서 component를 사용할 때는 모든 dependency를 새 ID로 복사한다.
- 기존 사용자 파일은 변환 성공과 새 파일 저장 완료 전까지 수정하거나 삭제하지 않는다.
- 각 단계는 좁은 테스트, `npm run typecheck`, `npm run build`를 통과한 뒤 완료한다.

## 단계별 작업

### 1. 계약·전환 정책 확정

#### 작업

- 위 다섯 구현 기본안을 사용자와 확정한다.
- `DocumentData`, node union, component definition·instance, repeater, style과 asset 계약을 확정한다.
- ID uniqueness, dangling reference, node cycle과 component cycle validation 순서를 확정한다.
- prop archive 상태와 instance value 보존 형식을 schema에 반영한다.
- 개인 component library index, item 파일과 dependency package 형식을 설계에 반영한다.
- 레거시 importer에서만 허용할 type과 문자열의 경계를 명시한다.
- 현재 v1/v2 fixture와 일반 문서 fixture의 비식별 테스트 데이터를 준비할 범위를 정한다.

#### 완료 조건

- `README.md`, `design.md`, `ux.md`, `plan.md`가 같은 용어와 저장 계약을 사용한다.
- 구현자가 추가 제품 결정을 만들지 않고 2단계를 시작할 수 있다.
- 정확히 하나의 단계만 `진행 중`이다.

### 2. 범용 document core 구현

#### 대상

- `client/src/foundation/document.ts`
- 새 node·component·style·asset 모듈
- pure transaction과 validator 테스트

#### 작업

- 범용 `DocumentData`와 runtime validator를 구현한다.
- 빈 root container를 만드는 factory를 구현한다.
- node 추가, 이동, 복제, 표시, 보관과 복원 transaction을 구현한다.
- component definition, prop, instance와 repeater item transaction을 구현한다.
- style 값 범위와 asset reference를 검증한다.
- graph 전역 검증으로 누락 참조와 순환 참조를 보고하는 validator를 구현한다.
- 현재 `WorkspaceDocument` alias는 앱 전환 단계까지 유지하되 새 core가 이를 import하지 않게 한다.

#### 검증

- 빈 문서와 모든 node type fixture validation
- 중복 ID, dangling reference, node cycle과 component cycle 거부
- prop archive 이후 instance value 보존
- 이름과 text 내용만 바꾼 fixture의 동일 transaction 결과
- 기존 앱 `typecheck`와 `build`

### 3. 레거시 importer 구현

#### 대상

- `client/src/main/document/legacy/`
- `client/src/main/document/documentMigration.ts`
- migration fixture 테스트

#### 작업

- 과거 v1/v2 입력 타입과 validator를 legacy 폴더로 격리한다.
- 기존 v1 → v2 변환을 importer 내부 단계로 보존한다.
- v2 → 범용 `DocumentData` 변환을 구현한다.
- 변환 결과를 일반 node·component·style 조합으로 만들고 별도 document kind를 남기지 않는다.
- importer 입력을 mutation하지 않고 원본 파일을 그대로 보존한다.
- 일부 항목 변환 실패 시 전체 원본과 오류 위치를 유지한다.

#### 검증

- v1과 v2 fixture의 텍스트·링크·이미지·순서·숨김 상태 보존
- importer 결과가 generic validator를 통과
- generic foundation·renderer에서 legacy 모듈 import가 없음
- 변환 실패 시 원본 fixture가 변경되지 않음

### 4. 읽기 전용 범용 DOM renderer 구현

#### 대상

- `pages/document-editor/rendering/NodeRenderer.tsx`
- `nodeRegistry.ts`
- 범용 pagination 모듈과 document CSS

#### 작업

- container, text, rich-text, Markdown, image, component-instance와 repeater renderer를 구현한다.
- component와 repeater를 안정적인 render path로 확장한다.
- container flow와 검증된 style을 DOM·CSS로 변환한다.
- 일반 node subtree를 pagination unit으로 만들고 page-break 규칙을 적용한다.
- 화면, 숨겨진 측정 DOM과 print DOM이 같은 renderer를 사용하게 한다.
- selection outline과 편집 overlay가 측정·출력에 영향을 주지 않는 slot을 둔다.

#### 검증

- 일반 fixture의 render tree snapshot
- component instance와 repeater의 결정적 출력
- font ready 전후 재측정과 page reconcile
- overflow와 keep 규칙 단위 테스트
- 사용자 이름에 따른 renderer 분기가 없는지 정적 검색

### 5. node tree·inspector 편집기 구현

#### 대상

- `DocumentStructurePanel.tsx`
- `PropertyInspector.tsx`
- 선택 모델과 generic document session

#### 작업

- 빈 root에서 범용 node를 추가할 수 있게 한다.
- node tree의 선택, 이름 변경, 이동, 복제, 표시와 보관을 구현한다.
- tree와 문서 화면의 선택을 stable render path로 동기화한다.
- container, image, style과 pagination property를 inspector에서 편집한다.
- 직접 편집 가능한 text value는 inspector에 중복 입력 UI를 만들지 않는다.
- drag reorder와 같은 동작을 키보드·메뉴에서도 제공한다.
- 새 editor는 독립 fixture harness에서 실행하고 앱 기본 route는 아직 바꾸지 않는다.

#### 검증

- 빈 문서에서 node 추가·이동·숨김·복제·보관·복원
- 선택 후 pagination이 바뀌어도 같은 node를 재선택
- 유효하지 않은 style 입력이 document에 반영되지 않음
- keyboard navigation과 기본 접근성 확인

### 6. component·repeater 재사용 구현

#### 작업

- 선택한 subtree를 definition으로 옮기고 원래 위치를 instance로 교체한다.
- prop 노출, 기본값, instance override와 archived prop 표시를 구현한다.
- definition 변경을 draft에서 검증한 뒤 명시적으로 적용한다.
- component instance 추가와 repeater item 추가·복제·이동·숨김을 구현한다.
- component를 library package로 만드는 pure export와 새 ID로 가져오는 pure import를 구현한다.
- 자신을 직접·간접 참조하는 component 편집을 차단한다.

#### 검증

- subtree → component 변환 전후 화면 결과 일치
- 두 instance의 값이 독립적으로 변경됨
- definition 변경이 모든 instance 구조에 반영됨
- archived prop 값이 유지되고 복원됨
- library import 시 node·style·asset ID collision이 없음

### 7. preview 직접 편집·서식 구현

#### 작업

- `EditTarget`을 node, instance prop과 repeater item prop 경로로 일반화한다.
- plain text edit transaction을 연결한다.
- rich-text run·mark와 floating toolbar를 연결한다.
- 현재 Markdown parser, source selection, IME와 history 기능을 generic target으로 옮긴다.
- node 전체 typography와 inline mark 우선순위를 적용한다.
- 편집으로 pagination이 바뀐 뒤 focus, caret과 selection을 복원한다.
- placeholder, caret, toolbar와 outline을 print DOM에서 제거한다.

#### 검증

- 한글 IME 조합, paste, delete와 paragraph split
- 굵게·기울임·밑줄·취소선·링크·rich-text 색상
- Markdown source offset과 undo/redo 회귀
- 서로 다른 node를 가로지른 selection 차단
- 화면 편집 후 측정 DOM과 PDF 내용 일치

### 8. 저장소·library·IPC와 앱 전환

#### 작업

- document library index를 `documents`와 범용 summary로 전환한다.
- 새 문서는 범용 suffix에 원자적으로 저장하고 backup을 유지한다.
- 기존 파일은 legacy importer로 읽고 새 범용 파일을 별도로 만든 뒤 index를 전환한다.
- 변환과 새 파일 저장이 모두 성공한 경우에만 migration 완료를 기록한다.
- 개인 component library index와 item 파일의 CRUD·backup을 구현한다.
- component 저장·목록·가져오기 IPC를 추가한다.
- `WorkspaceDocument`, preload API, document session과 앱 route를 범용 stack으로 한 번에 전환한다.
- 현재 editor·renderer는 이 단계가 완료될 때까지 제거하지 않는다.

#### 검증

- 빈 문서 생성, 이름 변경, 저장, 재실행, 삭제와 복원
- 손상된 document·index·component item의 backup 복구
- 기존 파일 원본 보존과 중복 migration 방지
- 다른 문서로 component를 가져온 뒤 library 원본 변경이 전파되지 않음
- 저장 실패 시 편집 중 document와 library 입력 유지

### 9. 레거시 runtime 제거·전체 검증

#### 작업

- 기존 목적별 editor, preview, style registry와 runtime import를 제거한다.
- 과거 입력 타입은 legacy importer 아래에만 남긴다.
- repository, IPC, UI 문구, CSS 변수와 테스트 fixture의 범용 이름을 정리한다.
- 사용하지 않는 compatibility adapter와 임시 fixture harness를 제거한다.
- 설계와 실제 파일 구조가 달라진 부분을 문서에 반영한다.

#### 검증

- production core·renderer·editor의 목적별 domain token·type import 정적 검색
- `npm test`
- `npm run typecheck`
- `npm run build`
- 실제 Electron에서 생성·편집·자동 저장·재실행·PDF 출력
- legacy v1/v2 import와 원본 보존
- 문서 간 component 복사와 독립성
- `git diff --check`
- 개인정보와 로컬 사용자 데이터가 Git diff에 없는지 확인

## 단계 운영 규칙

각 단계를 다음 순서로 진행한다.

1. 해당 코드와 caller를 다시 확인한다.
2. 구현 증거가 설계와 다르면 문서를 먼저 수정한다.
3. 가장 작은 테스트 가능한 단위부터 구현한다.
4. 좁은 테스트를 실행한 뒤 typecheck와 build를 실행한다.
5. 완료 조건을 충족하면 현재 단계를 `완료`, 다음 하나를 `진행 중`으로 바꾼다.
6. `handoff.md`에 변경 파일, 검증 결과와 정확한 다음 작업을 기록한다.

## 최종 완료 조건

- [ ] 새 문서는 빈 root와 범용 metadata만 가진다.
- [ ] schema에 document kind나 category 전용 union이 없다.
- [ ] 사용자 이름이나 text 내용이 validator·editor·renderer 동작을 바꾸지 않는다.
- [ ] node·component·repeater를 추가하고 문서에서 직접 편집할 수 있다.
- [ ] component를 다른 문서에 독립 복사할 수 있다.
- [ ] 기존 사용자 파일을 손상시키지 않고 범용 문서로 가져올 수 있다.
- [ ] 화면, 측정 DOM과 PDF가 같은 renderer·style을 사용한다.
- [ ] 레거시 domain type이 importer 밖의 production runtime에 없다.
- [ ] 전체 자동 검사와 실제 Electron 회귀 검증이 통과한다.
