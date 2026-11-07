# 작업 문서 작성 규칙

2026-11-03 개정. 공통 원본은 이 skill의 assets에 있다. 작업 폴더에 양식 설명이나 템플릿 사본을 복제하지 않는다.

## 1. 문서 선택과 정보의 기준 위치

기본은 README·design·plan·handoff 네 문서다. README가 전체 기획을 맡고 별도 features.md나 product-spec을 기본 생성하지 않는다. 기존 작업을 정리할 때는 고유 내용을 먼저 옮기고 참조를 고친 뒤 중복 파일을 없앤다.

| 파일 | 관리할 내용 | 생성 기준 |
|---|---|---|
| README.md | 문제·사용자·목표·성공 기준·범위·기능 목록·읽는 순서 | 기본 |
| design.md | As-Is/To-Be, 코드 근거·책임·상태 소유권·기능 관계·결정·위험 | 기본; 단순 작업은 필요한 절만 간결하게 |
| plan.md | 구현 의존성·전환·검증 gate·진행 상태 | 기본; 설계만 했으면 구현은 대기 |
| handoff.md | 실제 변경·검증 증거·미결정·다음 행동 | 기본; 현재 요약 먼저, 필요한 이력만 |
| features/NN-name.md | 개별 사용자 작업의 상세 흐름·예외·대안·AC | 여러 독립 기능을 README에서 설명하기 어려울 때만 |
| runtime-flows.md | 현재/목표 메시지 순서·실패·commit 경계 | design 안 시퀀스가 길어 별도 탐색이 필요할 때만 |
| tool-contracts.md | 정확한 호출 목록·입출력·권한·오류·재시도 | 외부/API/IPC 계약을 독립 관리할 필요가 있을 때만 |

작은 기능은 README에 상세를 통합한다. runtime과 계약을 분리하지 않으면 design의 관련 절에 작성한다. 선택 파일이 없는 경우 그 파일 링크와 빈 절을 제거한다. 전체 도구/명령 목록은 계약에, 구현 진행 상태는 plan에 한 번만 관리한다. 사용자 결과를 설명하는 요약과 링크는 다른 문서에 둘 수 있다.

독자는 README→기능 상세→design의 현재/목표 구조→시퀀스→계약→plan 순서로 읽을 수 있어야 한다. handoff는 다음 세션의 진입점이다. 완료된 과거 작업을 새 양식에 맞추려고 소급 재작성하지 않는다.

## 2. 확인한 공개 skill·양식과 조합

2026-11-01–02에 설계 관련 원본과 공식 아키텍처 양식을 확인했다. 별점 순위를 새로 산정하지 않았으며, 이름의 인기도보다 이 작업에 필요한 관점을 기준으로 채택했다. 아래 설명은 각 원본에서 채택한 항목의 요약이다.

| 출처 | 유용한 관점 | 채택한 관점 | 적용하지 않은 부분 |
|---|---|---|---|
| [Senior Architect SKILL.md](https://github.com/alirezarezvani/claude-skills/blob/main/engineering-team/skills/senior-architect/SKILL.md) 및 [설계 workflow](https://github.com/alirezarezvani/claude-skills/blob/main/engineering-team/skills/senior-architect/references/system_design_workflows.md) | 컴포넌트·계층·의존성 도식, 기술 선택과 실패·전환 검토 | 책임 표, 데이터 경계, 전환 위험과 gate | generator 자동 실행, 웹서비스용 규모 추정·microservice 구성을 그대로 적용 |
| [arc42 Building Block View](https://docs.arc42.org/section-5/) | 구조 분해, 컴포넌트와 인터페이스 설명 | design의 As-Is/To-Be와 책임 표 | 클래스 단위 전체 구조 문서화 |
| [arc42 Runtime View](https://docs.arc42.org/section-6/) | 주요 동작과 외부 상호작용·예외를 시나리오로 설명 | 현재/목표 시퀀스 | 도구마다 거의 같은 그림을 복제 |
| [C4 Container](https://c4model.com/diagrams/container)·[Dynamic diagram](https://c4model.com/diagrams/dynamic) | 구조의 책임·통신 경계와 기능 수행 중 상호작용 | Electron main/renderer/외부 agent/저장소 경계, runtime 연결 | 전체 C4 레벨과 별도 DSL 도입 |
| [BMAD architecture 안내](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/plan/design-ux-and-architecture.md) | 여러 구현 단위에서 일치해야 할 경계·상태·공유 데이터 결정 | 결정 ID와 실제 코드 근거 | 독립적인 전체 agent/workflow 체계 |
| [OpenSpec design template](https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/templates/design.md) | 현재 맥락, 목표/비목표, 결정·대안·위험 | 설계의 선택 이유와 미확인 경계 | 중복 proposal/design 트리 |
| [Spec Kit plan template](https://github.com/github/spec-kit/blob/main/templates/plan-template.md) | 기술 맥락·실제 프로젝트 구조·검증 gate | 단계별 진입/종료 조건과 검증 증거 | 별도 constitution·tasks 체계의 전면 도입 |

공개 skill은 참고 자료로 읽었다. 로컬 skill 설치나 부속 script 실행, 원본의 승인·agent 절차 도입은 하지 않았다. arc42/C4는 skill이 아니라 문서화·시각화 방법이다. As-Is/To-Be 비교표와 아래 문서별 구분은 이 요구에 맞춘 조합이며 특정 도구의 공식 양식으로 주장하지 않는다. main 링크는 이후 바뀔 수 있으므로 적용한 항목은 이 파일에 남긴다.

### 기능 정의에 참고한 양식

| 참고 | 채택한 부분 | 이번에 생략한 부분 |
|---|---|---|
| [BMAD PRD template](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-prd/assets/prd-template.md) | 대상 사용자·목표·여정·기능 행동·요구사항 ID·범위 | 전체 agent/workflow 설치와 제품 전체 사업계획 |
| [OpenSpec design template](https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/templates/design.md) | 배경·목표/비목표·대안·선택 이유·위험과 트레이드오프 | 별도 OpenSpec 디렉터리·CLI·전체 change 관리 절차 |
| [Spec Kit spec template](https://github.com/github/spec-kit/blob/main/templates/spec-template.md) | 우선순위·독립 검증·Given/When/Then·예외·성공 기준 | 전체 Spec Kit 명령·constitution·별도 spec 트리 |


## 3. 설계 문서 작성 양식

새 작업의 design에는 다음 순서를 사용한다. 각 행의 설명을 실제 코드·데이터·행동으로 채운다.

| 순서 | 제목 | 반드시 작성할 내용 |
|---|---|---|
| 0 | 상태·근거 | 작성일, 코드 기준 HEAD, 소스 확인/실행 검증 구분, 제안/확정/구현 상태 |
| 1 | 목표·비목표·제약 | 기능 문서 연결, 지킬 기존 동작, 현재 작업 밖의 기능 |
| 2 | As-Is | 현재 컴포넌트와 저장 경로, 코드 링크·symbol·근거 ID, 현재 구조도 |
| 3 | As-Is → To-Be | 같은 비교 축으로 현재/목표/유지/위험 표시 |
| 4 | To-Be | 프로세스·신뢰 경계, 신규/변경/재사용 표시, 책임과 입출력 |
| 5 | 데이터·상태 소유권 | 생성 주체, authoritative 값, 전달 경로, 영속/임시, commit·수명 |
| 6 | 기능 관계 | 기반·조합·결과 전달 관계, 화살표 의미, 기능↔시퀀스↔결정↔단계 |
| 7 | 결정 | Dxx별 선택 이유, 실행 가능한 대안의 장점, 감수하는 비용, 재검토 조건 |
| 8 | 위험·미결정 | Oxx별 현재 모르는 것, 실패 영향, 확인 방법·시점, 통과 기준 |
| 9 | 전환·후속 연결 | plan으로 연결, 기존 코드 제거 조건, 후속 확장 경계 |

코드 트리를 복사해 나열하는 것만으로 책임 설명을 대신하지 않는다. 파일이 아직 없다면 '신규 제안'으로 표시하고 존재하는 코드 링크처럼 만들지 않는다. To-Be의 보장과 이를 입증할 시험을 구별한다.

## 4. 실행 시나리오 양식

각 ASxx/TBxx는 다음 내용을 가진다.

1. **상태와 근거:** 현재 코드인지 목표 계약인지, 관련 Axx/Fxx/Dxx.
2. **전제:** 연결·권한·문서·편집 상태·이미 확보한 식별자.
3. **시퀀스:** actor/프로세스/책임별 participant, 실제 데이터 필드와 검사·저장 순서.
4. **분기:** 권한·busy·revision·validation·영속화·UI ack 등 해당 시나리오의 주요 실패.
5. **commit 경계:** 언제부터 실제 변경됐다고 말할 수 있는지, 부분 완료와 결과 불명.
6. **사후 조건:** 반환값, 보존할 데이터·UI 상태, 실패 후 다음 행동.
7. **미확정 경계:** 구현 시험이 필요한 부분을 Oxx와 plan gate로 연결.

도식은 핵심 상호작용만 설명한다. 반복되는 공통 정책은 다른 시퀀스로 연결하되, 실패 분기를 생략했다면 무엇을 생략했는지 명시한다. 비동기 job의 pending 응답과 완료 조회를 구분하고 존재하지 않는 push 응답을 그리지 않는다.

## 5. 계약·계획·인수인계 양식

### 계약

도구마다 `이름/관련 Fxx → 권한·전제 → 입력·기본값·한도 → 반환 → 부작용·commit → 오류와 다음 행동 → 중복·재시도 → 호출 예시`를 확인한다. 공통 필드는 공통 계약에 한 번 정의한다. public target/revision/requestId와 내부 generation·IPC token을 구분한다.

상태도에는 실제 계약의 상태명만 쓴다. 오류 code, lifecycle 상태, commit outcome과 UI 동기화 여부는 서로 다른 축이므로 하나의 '성공/실패'로 합치지 않는다.

### 계획

각 단계는 `입력/진입 조건 → 기존 경로에서 바꿀 부분 → 산출물 → 검증할 시퀀스·AC → 종료 gate → 실패 시 유지/복귀 범위`로 설명한다. 데이터 migration이 없더라도 무엇이 유지되고 어떤 metadata가 추가되는지 적는다. 연결 비활성화와 이미 저장된 사용자 변경의 rollback을 구분한다.

### 인수인계

`기준 날짜·HEAD → 사용자 지시 → 이번 변경 → 실제 수행한 검사와 결과 → 실행하지 않은 검증 → 미결정 Oxx → 다음 시작점`으로 기록한다. 과거 수치에는 날짜를 붙이고 최신 검증과 섞지 않는다. 문서·Mermaid 검사 통과를 제품 연동 검증으로 표현하지 않는다.

## 6. Mermaid 작성 규칙

- 각 그림의 제목이나 바로 위 문장에 As-Is/To-Be와 근거·제안 상태를 표시한다.
- 구조도는 컴포넌트·프로세스·저장소, 시퀀스는 메시지 순서, 상태도는 lifecycle, 의존성 그림은 선행 조건에 사용한다.
- 화살표에 `DocumentData`, `expectedRevision`, `snapshot`, `ack` 등 실제 전달 의미를 적는다. 기능 관계 그림이면 호출 순서와 혼동하지 않게 설명한다.
- 같은 책임은 문서 전체에서 같은 이름을 사용한다. participant를 읽기 위해 구현 파일명을 외워야 하지 않도록 역할명을 쓴다.
- 일반 flowchart/sequenceDiagram/stateDiagram을 우선 사용한다. 불필요한 색상·아이콘·실험 문법에 의미를 의존하지 않는다.
- 정상·오류가 한 그림에서 읽히지 않으면 시나리오를 분리한다. 한 함수·도구마다 같은 그림을 복제하지 않는다.
- 문법 파싱과 headless 렌더를 확인하고, 출력 크기·텍스트 잘림을 점검한다. 검증한 Mermaid 버전과 실행 한계를 handoff에 남긴다.

문법 기준은 [Mermaid sequence diagram 공식 문서](https://mermaid.js.org/syntax/sequenceDiagram.html)를 참조한다. GitHub나 편집기에서 사용하는 Mermaid 버전이 검증 환경과 같다고 가정하지 않는다.

## 검토와 적용

- 실제 코드 근거와 To-Be 제안이 구분되는지 확인한다. 필요한 근거를 못 찾으면 미확인으로 표시한다.
- 구조·데이터·기능 관계·핵심 정상/실패 시퀀스를 설명한다. 단순 변경은 도식이 불필요한 이유를 적고 생략할 수 있다.
- 모든 문서에 같은 절이나 그림을 강제하지 않는다. 시퀀스의 participant와 design의 책임 이름을 일치시킨다.
- F/D/O/AS/TB 등의 ID는 추적할 필요가 있을 때 사용한다. 기능·설계·계약·계획의 범위 변경을 함께 반영한다.
- 상대 링크·anchor, JSON, placeholder 잔존, 코드 fence·공백, 필요한 Mermaid 렌더를 검사한다. 문서 검사와 제품 동작 시험의 결과를 분리한다.
- 템플릿은 placeholders를 채우고 안내 주석을 제거해 사용한다. 예시의 저장소·에이전트·권한 정책을 제품 요구로 임의 채택하지 않는다.

현재 적용 사례는 저장소의 docs/11-agent-tools-mcp다. 사례의 도구 수나 ID 범위를 다음 작업의 필수 구조로 복제하지 않는다.
