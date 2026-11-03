# F05. 컴포넌트를 재사용하고 반복 항목 채우기

상태: 구현 기준안 · 우선순위: P1 · 사용자 여정: UJ-05

[기능 전체](../README.md) · [도구 계약](../tool-contracts.md)

## 1. 문제와 배경

경력이나 프로젝트를 추가할 때 매번 제목·기간·설명·배치를 새로 만들면 형식이 달라지기 쉽다. Formleaf의 컴포넌트와 repeater는 이 반복을 줄이기 위한 기반이다. 에이전트가 내부 node를 직접 고치면 특정 회사의 설명 수정이 공유 정의 전체를 바꾸는 실수가 될 수 있다.

이 기능은 기존 라이브러리를 찾아 문서에 가져오고, 공개된 prop으로 개별 값만 채우게 한다. 공유 형식과 개별 내용의 경계를 유지하면서 반복 항목의 추가·순서·복제·제거를 제공한다.

## 2. 사용자와 역할

작성자는 '저장한 경력 양식을 써서 회사 두 곳을 추가해줘'라고 요청한다. 에이전트는 컴포넌트 이름과 prop 설명·유형을 읽어 값의 위치를 찾는다. Formleaf는 라이브러리 항목 ID와 문서 정의 ID를 구분하고, 가져올 때 충돌 없는 ID를 생성한다. 라이브러리 제작자가 미리 정의해 둔 prop만 이번에 수정할 수 있다.

## 3. 목표와 성공 기준

사용자가 기존 형식을 다시 설명하지 않아도 에이전트가 허용된 prop을 발견하고 값을 채울 수 있어야 한다. 한 instance/item의 변경이 원본 라이브러리·다른 instance/item에 전파되지 않아야 한다. 검증에서는 같은 정의를 쓰는 두 instance와 여러 item을 준비해 수정 대상 밖의 값 불변, import 후 참조 유효성을 확인한다.

## 4. 사용 시나리오 — UJ-05

문서에는 아직 경력 형식이 없고, 개인 라이브러리에 '경력 카드'가 있다. 사용자는 libraryRead와 문서 write를 허용했다.

1. 에이전트가 라이브러리를 이름으로 찾고 정의·prop 기본값·libraryRevision을 읽는다.
2. 대상 문서의 현재 revision을 읽고 import_component를 요청한다. 서버는 라이브러리 revision도 확인하고 새 componentId를 반환한다.
3. 에이전트가 새 ID로 instance 또는 repeater를 문서에 추가한다.
4. item을 추가하고 반환된 itemId에 회사명·기간·설명을 설정한다. 값을 설정하지 않은 prop은 정의 기본값을 사용한다.
5. 사용자가 순서 변경을 요청하면 같은 repeater 안에서 item을 이동한다. 비슷한 항목은 복제 후 해당 값만 수정한다.
6. instance의 값을 기본값으로 돌리고 싶으면 clear_component_prop을 사용한다. item override 초기화 전용 명령은 이번에 없다.
7. preview로 형식과 값이 맞는지 확인한다.

종료 상태: 문서는 재사용한 형식을 포함하고, library 원본은 수정되지 않는다. 이후 라이브러리 변경을 자동 동기화하는 연결은 만들지 않는다.

## 5. 상세 요구와 예외

- **F05-R01 — 식별자 구분:** libraryItemId는 library 조회에만 사용한다. import 결과로 받은 componentId만 대상 문서에서 사용한다. node/style/asset 등 충돌하는 ID를 재매핑한다.
- **F05-R02 — 기본값과 override:** 조회 결과에 기본값과 instance/item override를 구분한다. 텍스트 계열은 F03 경로로도 수정 가능하며 같은 validation을 적용한다.
- **F05-R03 — prop 검증:** active prop의 선언 유형·binding·asset 참조를 확인한다. 알 수 없는 prop이나 archived prop은 거절한다. number/boolean/image는 해당 전용 prop 명령으로만 설정한다.
- **F05-R04 — 반복 항목 관리:** add는 기본값 상속, duplicate는 값 복사, move는 제거 후 index 기준, remove는 item과 override 제거다. item 제거는 별도 restore 도구나 editor undo를 보장하지 않는다.
- **F05-R05 — shared definition 보호:** component 내부 node·prop binding·기본 정의 편집을 이 도구로 허용하지 않는다. 정의를 바꿔야 하는 요청은 지원 범위를 설명하고 앱의 해당 편집 기능을 사용하도록 한다.
- **F05-R06 — import 일관성:** library revision이 달라졌으면 재조회한다. 같은 requestId 재전송은 추가 import를 만들지 않는다. 새로운 requestId로 다시 import하면 별도 복사본이 될 수 있다.

libraryRead가 없어도 읽기 허용 문서에 이미 들어 있는 정의는 get_component의 document 경로로 읽을 수 있다. 임의 외부 파일을 import하거나 라이브러리 원본을 저장·삭제하는 기능은 없다.

## 6. 대안과 트레이드오프

| 대안 | 이점 | 비용·한계 | 판단 |
|---|---|---|---|
| 내부 node를 직접 편집 | 공개 prop이 없는 부분도 수정 가능 | 공유 정의 변경의 영향이 커지고 사용자가 요청한 개별 수정과 어긋난다 | 미선택 |
| instance/item의 공개 prop 편집 | 개별 값과 공통 형식을 구분한다 | prop으로 노출되지 않은 값은 변경할 수 없다 | 선택 |
| library 원본을 실시간 참조 | 공통 수정이 자동 반영된다 | library 변경이 완성 문서와 PDF 결과를 바꿀 수 있다 | 미선택 |
| 문서로 복사해 import | 문서가 독립적인 snapshot을 갖는다 | 중복 정의·asset로 문서 크기가 늘 수 있다 | 선택 |

첫 버전은 사용자가 만든 형식의 재사용에 집중한다. AI가 새 component 정의를 설계하고 공개 prop까지 만드는 작업은 후속이다.

## 7. 범위와 의존성

F01 권한, F02 탐색, F04 배치와 F03 저장 보호를 재사용한다. set/clear_component_prop, item 추가·순서·복제·제거·값 설정, library import와 instance 배치를 포함한다. item 숨김·item override 초기화, library 쓰기, 공유 정의 수정은 제외한다.

## 8. 인수 조건

| ID | Given | When | Then |
|---|---|---|---|
| F05-AC01 | 문서와 library의 ID 충돌 | component import | 새 ID와 유효한 참조, library 파일 불변 |
| F05-AC02 | 같은 정의를 쓰는 두 instance | 한 instance prop 변경 | 다른 instance와 기본값 불변 |
| F05-AC03 | override가 있는 instance | clear_component_prop | override 제거, 정의 기본값으로 조회·렌더 |
| F05-AC04 | item 두 개가 있는 repeater | 추가·복제·이동·제거 | 반환 ID와 지정 순서 일치, 다른 item 값 불변 |
| F05-AC05 | prop 유형 불일치 또는 archived prop | 값 설정 | validation/target 오류, 전체 batch 미반영 |
| F05-AC06 | library가 조회 뒤 변경됨 | 이전 libraryRevision으로 import | 충돌, 기존 문서에 부분 import 없음 |

## 9. 기술 연결과 남은 확인

T08/T09/T07, set_component_prop/clear_component_prop/add_item/move_item/duplicate_item/remove_item/set_item_prop/import_component/add_component_instance. 기존 documentComponentOperations와 library repository를 사용한다. 계획 4-4/4-5에 대응한다.

실제 library의 prop 이름·기본값만으로 에이전트가 필드를 충분히 이해하는지 확인해야 한다. 공개 prop이 부족한 경우를 사용자 입력 없이 추정해서 component 정의를 확대하지 않는다.

기술 실행 흐름: [실행 시퀀스](../runtime-flows.md)의 TB03의 library revision·ID 재매핑·항목 구성를 함께 읽는다. 기능 간 의존성은 [설계](../design.md)의 기능 관계 절을 따른다.
