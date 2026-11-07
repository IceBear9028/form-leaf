# 작업 문서 작성 규칙

2026-11-07 개정. 작업 문서 원본은 이 skill의 assets에 있다. 작업 폴더에 양식 설명이나 템플릿 사본을 복제하지 않는다. PR은 [작성 규칙](pull-requests.md)에서 GitHub 본문 양식으로 연결한다.

## 1. 문서 선택과 정보의 기준 위치

루트 README는 작업 소개·핵심 변화·문서 안내만 짧게 담는다. 기획은 features/, 기술 설계는 implementation/이 맡는다. 새 양식의 책임은 다음과 같다.

| 파일 | 관리할 내용 | 생성 기준 |
|---|---|---|
| README.md | 작업 소개 2–3문장·핵심 변화·문서 링크 | 작업 진입점 |
| features/README.md | 배경·문제·사용자·목표·범위·전체 기능 목록·성공 기준 | 전체 기획 원본 |
| features/NN-name.md | 개별 기능의 상세 여정·예외·대안·AC | 독립적인 상세 기획이 필요할 때 |
| implementation/README.md | 기술 구조·As-Is/To-Be·책임·공통 결정의 요약과 설계 목차 | 기술 설계 진입점 |
| implementation/NN-name.md | 현재 코드·변경 지점·목적·방식·흐름·입출력 계약·실패 처리·검증 설계 | 대응 기능의 코드 착수 전에 작성 |
| plan.md | 실행 순서·의존성·완료 조건·진행 상태·기능별 완료 커밋 | 실행 관리 |
| handoff.md | 실제 구현·검증 결과·미검증·주의점·다음 시작점 | 진행 상황 공유와 작업 재개 |
| implementation/<topic>.md | 여러 기능이 공유하는 긴 구조·흐름·계약의 상세 | 독립 관리가 필요한 경우만 |

새 양식에 루트 design.md를 만들지 않는다. runtime-flows.md와 tool-contracts.md도 기본 파일이 아니다. 실행 흐름과 계약은 기능별 구현 설계 안에 작성하고, 여러 기능이 공유하는 긴 내용만 implementation/ 안에서 주제에 맞는 이름으로 분리한다. 같은 설명·schema·그림을 두 곳에 유지하지 않는다.

단일 기능이면 기획을 features/README.md, 구현 설계를 implementation/README.md에 통합할 수 있다. 작은 작업은 plan·handoff를 루트 README의 작업 계획·현재 상태와 검증 절에 통합할 수 있고, 단순 오타·링크 수정은 기존 문서나 PR 요약으로 충분하다. 전체 문서 세트나 도식을 일괄 강제하지 않는다. 선택 파일을 생략하면 해당 링크도 제거한다.

처음 읽는 순서는 루트 README→features의 전체·개별 기획→implementation의 요약·개별 설계→plan이다. 작업 재개 시 handoff부터 읽고 plan의 진행·커밋 기록으로 연결한다. 기능 목록은 features/README.md가 소유하며 구현 설계 링크를 함께 둔다. 완료된 11번을 포함한 과거 docs는 그대로 보존하고 새 양식을 소급 적용하지 않는다.

### 기능 기획과 코드 설계의 연결

예를 들어 `features/01-connect-and-authorize.md`는 사용자 문제·목표·여정·범위·제품 대안·AC를 유지하고, `implementation/01-connect-and-authorize.md`는 그 요구를 어느 코드로 어떻게 구현할지 설명한다. 다음 내용은 [기능별 구현 설계 템플릿](../assets/feature-implementation.md.template)을 사용한다.

| 순서 | 코드 작업 전에 판단할 내용 |
|---|---|
| 목표·범위 | 관련 기획/요구/AC, 이번 코드 변경의 목적, 보존할 동작, 선행 기능 |
| 현재 코드 | 확인한 커밋과 실제 파일·symbol, 진입점→처리→저장/응답 경로, 현재 한계 |
| 전후 비교 | 같은 사용자 행동·실패 상황이 어떻게 바뀌며 어떤 코드 변경이 필요한지 |
| 변경 설계 | 수정/신규/재사용/삭제별 파일·symbol, 구체적인 처리 방식과 이유, 호출부·타입·계약 영향 |
| 실행·상태 | 변경 후 호출·데이터 흐름, 상태 소유자, 저장 확정, 실패·경쟁·복구, 다른 기능 영향 |
| 대안·검증 | 구현 대안의 비용과 선택 이유, 미결정의 확인 방법, 순서·AC별 시험·회귀 경계 |

'관련 service를 수정한다'에서 끝내지 않는다. 핵심 함수의 입력·검사·분기·출력과 기존 로직을 재사용하거나 이동할 위치를 설명한다. 필요하면 signature/type 또는 의사 코드를 사용하되 실제 구현 전체를 문서에 미리 작성할 필요는 없다. 존재하지 않는 파일은 신규 제안 경로로 적고 현재 코드 링크로 표시하지 않는다.

예를 들어 저장 충돌 개선 설계라면 '저장 기능을 개선한다' 대신 다음 수준으로 작성한다. 이는 형식 설명용 가상 사례이며 실제 코드 근거는 작성할 때 확인해야 한다.

- 현재: 저장 handler가 받은 snapshot을 repository에 전달해 이전에 읽은 값인지 검사하지 않는다.
- 변경: 저장 service가 입력의 expectedRevision과 저장본 revision을 writer 구간에서 비교한다. 불일치면 충돌 결과를 반환하고 repository 저장을 호출하지 않는다.
- 호출부: UI session은 읽은 revision을 전달하고 충돌 시 dirty draft를 유지한다. '다시 읽기' 동작의 영향은 기능 기획과 연결한다.
- 검증: 두 호출자가 같은 revision을 읽은 뒤 순차 저장할 때 두 번째 저장이 거절되고 첫 저장값과 두 번째 초안이 각각 보존되는지 확인한다.

공통 저장 service를 여러 기능이 사용하면 공통 책임·동시성 정책은 implementation/README.md에 요약하고, 길면 같은 폴더의 공통 설계에서 한 번 정의한다. 기능 설계에는 그 경계를 어떻게 호출하며 해당 기능에서 무엇이 달라지는지 적는다. 같은 코드에 여러 설계가 영향을 주면 공통 변경의 기준 위치와 의존성을 연결한다. 기획의 제품 대안과 구현 설계의 기술 대안을 구분하고 동일한 결정은 링크한다.

코드 작성 전 해당 기능의 설계를 먼저 작성한다. 미결정이 구현을 막는지와 확인 방법을 명시하고 plan 진입 조건에서 연결한다. 별도 승인 절차를 자동 추가하지 않으며 실제 코드 착수는 현재 사용자 요청 범위를 따른다. 구현 중 달라진 결정은 설계에 반영하고 진행은 plan, 실제 검증은 handoff에서 관리한다.

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

아래는 기술 설계에서 확인할 관점이다. implementation/README.md에는 전체 구조와 결정의 요약·목차만 남기고, 상세는 기능별 구현 설계 또는 필요한 공통 설계에 배치한다. 모든 행을 요약 README의 긴 절로 복제하지 않는다. 각 항목을 실제 코드·데이터·행동으로 설명한다.

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

plan은 무엇을 어떤 순서로 진행하고 언제 완료로 볼지 관리한다. 함수 구현 설명을 복제하지 않고 해당 구현 설계를 연결한다.

각 단계는 `입력/진입 조건 → 기존 경로에서 바꿀 부분 → 산출물 → 검증할 시퀀스·AC → 종료 gate → 실패 시 유지/복귀 범위`로 설명한다. 데이터 migration이 없더라도 무엇이 유지되고 어떤 metadata가 추가되는지 적는다. 연결 비활성화와 이미 저장된 사용자 변경의 rollback을 구분한다.

번호별 기능은 `구현 → 필수 검증 통과 → 문서 갱신 → 기능별 커밋 → 다음 기능` 순서로 진행한다. plan이 기능 ID·의존 순서·완료 커밋을 관리하며, 검증이나 커밋이 실패하면 다음 기능에 착수하지 않는다. 커밋 성공 후 해시를 기록하고 그 기록은 다음 커밋에 포함할 수 있다. 실제 커밋 범위와 권한은 [workflow의 기능별 커밋 규칙](../SKILL.md#finish-and-commit-each-numbered-feature)을 따른다.

### 인수인계

handoff는 작업 진행 상황을 공유하고 다시 작업할 때 출발점으로 사용한다. 현재 구현 상태, 실제 검증 결과, 남은 문제·주의점, 다음 행동을 갱신한다. 시간순 작업 일지나 설계 복사본으로 만들지 않는다.

`기준 날짜·HEAD → 사용자 지시 → 이번 변경 → 실제 수행한 검사와 결과 → 실행하지 않은 검증 → 미결정 Oxx → 다음 시작점`으로 기록한다. 각 검사에 대상 커밋 또는 기준 HEAD와 미커밋 작업 트리 범위를 붙인다. 과거 수치에는 당시 날짜·커밋·근거를 붙여 기존 결과 인용으로 표시하고 최신 검증과 섞지 않는다. 문서·Mermaid 검사 통과를 제품 연동 검증으로 표현하지 않는다.

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

기획·공통 설계의 기존 적용 사례는 저장소의 docs/11-agent-tools-mcp다. 이 사례에는 새 implementation 분리 양식을 소급 적용하지 않았다. 사례의 도구 수나 ID 범위를 다음 작업의 필수 구조로 복제하지 않는다.
