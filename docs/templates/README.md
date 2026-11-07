# 작업 문서 템플릿

2026-11-08 개정. 새 작업과 진행 중 문서 개편에 적용한다. 완료된 문서는 사용자 요청 없이 일괄 변경하지 않는다. 11번은 명시적 요청에 따라 구조와 코드 설명을 갱신했다.

## 문서 구조와 책임

```text
docs/NN-task/
├─ README.md                 # 짧은 작업 소개·핵심 변화·문서 안내
├─ features/
│  ├─ README.md              # 전체 기획·범위·기능 목록
│  └─ NN-name.md             # 기능별 기획
├─ implementation/
│  ├─ README.md              # 기술 구조·공통 결정 요약·설계 목차
│  └─ NN-name.md             # 코드 변경·흐름·계약·실패·검증 설계
├─ tests/
│  ├─ README.md              # 공통 검사·환경·기능별 테스트 목차
│  └─ NN-name.md             # 시나리오·통과 기준·실제 실행 결과
├─ plan.md                   # 실행 순서·진행 상태·완료 커밋
└─ handoff.md                # 실제 상태·검증 근거·재개 지점
```

루트 README는 상세 기획을 담지 않는다. 전체 기능 목록은 features/README.md가 소유하며 기획과 구현 설계를 연결한다. implementation/은 UI 디자인이 아닌 기술 설계 전체를 담당한다. 같은 번호·이름의 기능 기획·구현 설계·테스트 문서를 대응시킨다. 상세 테스트 계획·실행 결과는 tests가, 결과 요약·재개 지점은 handoff가 소유한다.

| 문서 | 복사할 원본 |
|---|---|
| README.md | [작업 진입점](../../.codex/skills/resume-studio-task-workflow/assets/task-readme.md.template) |
| features/README.md | [전체 기획](../../.codex/skills/resume-studio-task-workflow/assets/features-readme.md.template) |
| features/NN-name.md | [기능별 기획](../../.codex/skills/resume-studio-task-workflow/assets/feature.md.template) |
| implementation/README.md | [구현 설계 요약](../../.codex/skills/resume-studio-task-workflow/assets/implementation-readme.md.template) |
| implementation/NN-name.md | [기능별 구현 설계](../../.codex/skills/resume-studio-task-workflow/assets/feature-implementation.md.template) |
| tests/README.md | [테스트 목차](../../.codex/skills/resume-studio-task-workflow/assets/tests-readme.md.template) |
| tests/NN-name.md | [기능별 테스트](../../.codex/skills/resume-studio-task-workflow/assets/feature-tests.md.template) |
| plan.md | [실행 계획](../../.codex/skills/resume-studio-task-workflow/assets/plan.md.template) |
| handoff.md | [진행 공유·인수인계](../../.codex/skills/resume-studio-task-workflow/assets/handoff.md.template) |

## 규모에 따른 통합과 분리

- 상세 작성 전에 [기능 분리와 통합 기준](../../.codex/skills/resume-studio-task-workflow/references/documentation.md#기능-분리와-통합-판단)으로 기능 목록을 정한다. 번호별 기능은 같은 번호·이름의 기획·구현·테스트 문서를 대응시킨다.
- 단일 기능 통합은 위 기준을 충족할 때만 적용하고 이유·내용 위치를 남긴다. 코드 변경이 없는 기획 항목은 구현 설계를 생략한 이유를 적는다.
- 실행 흐름·입출력 계약은 기능별 구현 설계의 일부다. runtime-flows.md와 tool-contracts.md를 기본 생성하지 않는다.
- 여러 기능이 공유하는 긴 기술 내용만 implementation/ 안에 주제별 문서로 분리한다. 필요한 경우 [실행 흐름](../../.codex/skills/resume-studio-task-workflow/assets/runtime-flows.md.template)·[계약](../../.codex/skills/resume-studio-task-workflow/assets/tool-contracts.md.template) 양식을 활용한다. 파일명은 주제에 맞게 정하고 단일 원본을 링크한다.
- 여러 기능이면 plan·handoff를 작업 루트에 둔다. 작은 작업의 통합·생략은 위 기준을 따르며 필요한 계획·현재 상태·검증·재개 지점의 위치를 안내한다.

## 작성과 실행

**핵심 문장 아래에 한 문장짜리 세부 불릿을 둔다.**

- 대표 문장은 해당 항목의 목적이나 결론을 설명한다.
- 세부 불릿은 이유·동작·조건·영향을 하나씩 설명한다.
- 긴 문단을 입력칸 하나에 채우지 않는다.
- 비교표와 실행 순서 목록은 유지한다.
- 자세한 기준은 [문장 작성 방식](../../.codex/skills/resume-studio-task-workflow/references/documentation.md#문장-작성-방식)을 따른다.

1. 기존 작업을 이어가는지 확인한다. 양식 개편만으로 새 작업 번호를 만들지 않는다.
2. features/README.md의 기능 목록과 번호별 문서 대응을 먼저 정한 뒤 원본을 채운다. `{{PLACEHOLDER}}`, 안내 주석·불필요한 절·없는 파일 링크를 제거한다.
3. 코드 착수 전에 해당 구현 설계에 현재 파일·symbol·근거 커밋, 변경 내용·이유, 호출·데이터 흐름, 계약·실패 처리, 대안과 검증 방법을 작성한다.
4. 기능 번호별로 구현→필수 검증 통과→문서 갱신→커밋 성공 후 다음 기능에 착수한다. plan에 완료 커밋을 기록하고 handoff에 현재 실제 상태와 다음 시작점을 남긴다.
5. [구조 검토](../../.codex/skills/resume-studio-task-workflow/references/documentation.md#구조-검토와-문법-검사를-분리한다)와 링크·Mermaid 등 문법 검사를 별도로 수행한다. 두 결과와 제품 검증을 구별하고 과거 결과 인용에는 날짜·커밋을 명시한다.
6. 완료 보고에서 기능 목록·tests·plan·handoff의 실제 위치를 안내한다.

**구현 설계의 도식은 설명 목적에 맞춰 선택한다.**

- 코드 흐름·로직·조건 분기: 플로우차트(`flowchart`).
- 데이터 전달·레이어 간 상호작용: 시퀀스 다이어그램(`sequenceDiagram`).
- 클래스·함수의 호출·의존·소유 관계: 클래스 다이어그램(`classDiagram`).
- 일반 함수는 소속 모듈의 멤버로 표시하며 실제 클래스와 구분한다.
- 변경·보존할 핵심 동작을 이해하는 데 필요한 관점은 기존 흐름이어도 도식으로 작성한다.
- 새 레이어·클래스가 없다는 이유만으로 생략하지 않으며, 불필요한 범위나 이미 설명한 도식 위치를 근거로 남긴다.
- 세부 작성 기준은 [Mermaid 작성 규칙](../../.codex/skills/resume-studio-task-workflow/references/documentation.md#6-mermaid-작성-규칙)을 따른다.

세부 규칙과 외부 양식의 채택 근거는 [공통 작성 규칙](../../.codex/skills/resume-studio-task-workflow/references/documentation.md), 실행 절차와 기능별 커밋 규칙은 [작업 workflow](../../.codex/skills/resume-studio-task-workflow/SKILL.md)를 따른다. 템플릿 원본은 workflow assets 한 곳이며 이 디렉터리는 안내 역할이다.

## PR 요약 양식

[GitHub PR 템플릿](../../.github/PULL_REQUEST_TEMPLATE.md)은 작업 요약→기능별 As-Is/To-Be→핵심 변경·리뷰 순서→검증·한계→필요한 전환·복구→관련 문서 순서다. 상세 docs를 복사하지 않고 요약과 링크로 연결한다. 작은 수정은 요약과 검증만 남길 수 있다.

PR 양식 원본은 .github 한 곳에서 관리한다. [PR 작성 규칙과 작은/큰 작업 예시](../../.codex/skills/resume-studio-task-workflow/references/pull-requests.md)를 참고한다.
