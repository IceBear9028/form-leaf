# 05. 범용 문서·컴포넌트 모델

## 상태

component·repeater 완료·preview 직접 편집 구현 중

## 제품 원칙

이 도구는 이력서, 포트폴리오, 자기소개서나 특정 문서 종류를 직접 제공하는 제품이 아니다. 사용자가 범용 노드와 컴포넌트를 조합해 원하는 문서의 목적과 구조를 만든다.

따라서 production core는 다음 의미를 알면 안 된다.

- 이력서, 포트폴리오, 자기소개서 같은 문서 종류
- 프로필, 소개글, 경력, 교육, 프로젝트 같은 카테고리
- 특정 문서 종류를 전제로 한 필드, 기본값, 출력 프리셋과 조건 분기

이런 단어가 저장되는 경우에는 사용자가 정한 컴포넌트·레이어 이름 또는 입력한 내용이어야 한다. 이름을 완전히 다른 단어로 바꿔도 editor, renderer, 저장과 PDF 동작이 달라지면 안 된다.

## 문제

현재 구현은 공통 이름을 일부 사용하지만 실제 데이터, 편집기와 출력은 이력서 도메인에 결합되어 있다.

- `WorkspaceDocument`는 실제로 `ResumeDocument`의 alias다.
- 저장 schema가 `profile`, `timeline`, `project-group` 섹션을 정의한다.
- 목록 summary가 `profileName`을 계산하고 index가 `resumes` 배열을 사용한다.
- 편집기와 미리보기가 이력서 section type별로 분기한다.
- 저장 확장자, CSS와 오류 메시지에도 이력서 의미가 남아 있다.

이 상태에서 동적 카테고리 기능만 추가하면 이력서 schema 위에 범용 편집 UI를 얹게 된다. 이번 작업은 기능 추가 전에 범용 문서 모델로 경계를 다시 세운다.

## 사용자 경험

1. 새 문서는 의미가 정해지지 않은 빈 document root로 시작한다.
2. 사용자는 텍스트, Markdown, 이미지, container, repeater와 component instance를 추가한다.
3. 사용자가 최상위 layer 또는 component에 `상단 영역`, `항목 목록`, `메모`처럼 원하는 이름을 붙인다.
4. 오른쪽 DOM 문서에서 텍스트를 직접 편집하고 드래그 선택해 서식을 적용한다.
5. 왼쪽 패널은 node tree, component 정의와 선택한 node의 구조화된 속성을 편집한다.
6. 선택한 node들을 component로 만들고 같은 문서에서 instance로 재사용한다.
7. component를 개인 library에 저장하면 다른 문서에 독립된 복사본으로 가져올 수 있다.
8. PDF는 편집 중인 동일한 범용 DOM 결과를 출력한다.

상세 상호작용은 [편집 UX 설계](ux.md)를 따른다.

## 목표

- 도메인 의미가 없는 `DocumentData`와 범용 node·component·style 계약을 만든다.
- 문서 최상위 구성을 특정 `categories` schema가 아닌 node tree로 표현한다.
- editor와 renderer가 node type만 해석하고 사용자 이름이나 문서 목적에 따라 분기하지 않게 한다.
- 텍스트·서식 텍스트·Markdown의 preview 직접 편집과 선택 서식을 제공한다.
- container와 repeater를 사용해 단일·반복 구조를 사용자가 구성하게 한다.
- component 정의와 instance 값을 분리하고 같은 문서에서 재사용하게 한다.
- 사용자가 만든 component를 다른 문서에 복사해 재사용할 수 있는 경계를 둔다.
- 현재 로컬 우선 저장, backup, 자동 저장, pagination과 PDF 기능을 범용 구조에서 유지한다.
- 기존 저장 데이터를 보존해야 하는 경우 도메인 의미를 레거시 변환 경계 밖으로 누출하지 않는다.

## 포함 범위

- 범용 document envelope와 versioned schema
- `container`, `text`, `rich-text`, `markdown`, `image`, `repeater`, `component-instance` node
- component definition, prop definition, instance value와 override
- 문서 내부 component 재사용
- 개인 component library에 저장하고 다른 문서로 복사하는 계약
- DOM 기반 흐름형 layout과 A4 pagination
- preview 직접 편집, mouse selection과 floating format toolbar
- node tree, component editor와 property inspector
- 범용 document summary, repository path와 IPC 경계
- 기존 데이터의 격리된 변환 전략

## 제외 범위

- 이력서·포트폴리오 같은 문서 종류 enum과 전용 editor
- 프로필·경력·프로젝트 같은 built-in component 또는 starter
- 문서 의미에 따른 renderer 분기
- component 변경을 여러 문서에 자동 전파하는 live link
- Figma와 같은 절대 좌표 기반 자유 배치 canvas
- 임의 HTML, CSS 또는 JavaScript 입력과 실행
- 클라우드 동기화, 공동 편집과 서버 저장

## 확정된 결정

1. 문서 목적은 schema의 `kind`로 저장하지 않는다.
2. 저장 모델에는 이력서 카테고리 union이나 `categories` 전용 배열을 두지 않는다.
3. 화면에서 말하는 카테고리는 document root 바로 아래의 이름 있는 layer 또는 component instance다.
4. renderer는 범용 node type만 분기한다.
5. 새 문서는 domain starter 없이 빈 root로 시작한다.
6. document layout은 Canvas가 아닌 DOM과 구조화된 flow layout을 사용한다.
7. component library에서 다른 문서로 가져올 때는 live link가 아닌 독립 복사본을 만든다.
8. 문서에 저장하는 이름과 내용은 사용자 데이터이며 어떤 코드 동작도 그 문자열에 의존하지 않는다.

## 구현 기준

1. 기존 v1/v2 입력은 `main/document/legacy` 아래의 격리 importer에서 범용 문서로 변환한다.
2. 첫 layout은 row·column, gap, 네 방향 padding, alignment, `auto`·`fill`·`fixed` 폭과 세 가지 page-break 규칙만 제공한다.
3. component prop 제거는 definition을 archive해 instance value를 보존한다. 타입 변경은 새 prop을 만드는 방식으로 처리한다.
4. Markdown 일부 문자열 색상은 첫 범위에서 제외하고 rich-text inline color와 node 전체 색상을 제공한다.
5. 개인 component library는 앱 workspace의 별도 index와 item 파일에 저장하고, 다른 문서에는 dependency를 새 ID로 독립 복사한다.

## 완료 조건

- [ ] production core의 저장 계약에 특정 문서 종류나 업무 카테고리가 없다.
- [ ] `WorkspaceDocument`가 더 이상 `ResumeDocument`의 alias가 아니다.
- [ ] 새 문서는 빈 root와 범용 metadata만 가진다.
- [ ] 사용자가 node를 추가하고 component 정의와 instance를 만들 수 있다.
- [ ] 최상위 layer 이름을 무엇으로 바꿔도 동일하게 편집·저장·출력된다.
- [ ] renderer와 editor가 범용 node type 외의 사용자 이름으로 분기하지 않는다.
- [ ] 텍스트·서식 텍스트·Markdown을 preview에서 직접 편집할 수 있다.
- [ ] 선택 toolbar의 서식과 색상이 승인된 저장 계약에 맞게 재실행 후 복원된다.
- [ ] component를 개인 library에 저장하고 다른 문서에 독립 복사본으로 추가할 수 있다.
- [ ] 현재 문서 파일과 backup을 손상시키지 않는 migration 또는 import 경로가 검증된다.
- [ ] DOM 측정, pagination, print CSS와 PDF 출력이 범용 node renderer에서 동작한다.
- [ ] 관련 자동 테스트, 타입 검사, production build와 실제 Electron 회귀 검증이 통과한다.

## 관련 문서

- [구현 계획](plan.md)
- [기술 설계](design.md)
- [편집 UX 설계](ux.md)
- [세션 인수인계](handoff.md)
