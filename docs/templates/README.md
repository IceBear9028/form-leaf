# 작업 문서 템플릿

2026-11-07 개정. 새 작업과 진행 중 문서 개편에 적용한다. 완료된 과거 작업은 당시 기록으로 보존한다.

## 기본 구조

전체 기획은 작업 README에 모으고, 다른 문서는 각자 다른 질문에 답한다. 별도의 features.md를 기본 생성하지 않는다.

여러 단계의 작업은 아래 기본 구성을 사용한다. 단순 오타·링크·국소 수정은 기존 작업 문서나 PR 요약으로 설명할 수 있으며 네 문서를 새로 만들 필요는 없다.

| 문서 | 역할 | 복사할 원본 |
|---|---|---|
| README.md | 문제·사용자·목표·성공 기준·범위·기능 목록·읽는 순서 | [README 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/task-readme.md.template) |
| design.md | 공통 As-Is/To-Be·구조·상태 소유권·기능 관계·결정; 단일 기능이면 코드 설계 통합 | [공통 설계 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/design.md.template) |
| plan.md | 전환 순서·단계별 진입/종료 조건·호환성·롤백·진행 상태 | [계획 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/plan.md.template) |
| handoff.md | 실제 변경·검증 증거·한계·남은 일·다음 시작점 | [인수인계 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/handoff.md.template) |

## 필요할 때 추가하는 문서

| 문서 | 추가하는 경우 | 복사할 원본 |
|---|---|---|
| features/NN-name.md | 여러 독립 기능의 흐름·예외·트레이드오프·인수 조건을 상세히 설명할 때 | [기능 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/feature.md.template) |
| designs/NN-name.md | 분리한 각 feature의 코드 착수 전 변경 파일·symbol·목적·구현 방식·흐름·검증을 설계할 때 | [기능별 구현 설계 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/feature-design.md.template) |
| runtime-flows.md | design 안의 현재/목표 시퀀스가 길어 별도 탐색이 필요할 때 | [실행 흐름 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/runtime-flows.md.template) |
| tool-contracts.md | 정확한 외부/API/IPC 호출 목록·입출력·권한·오류·재시도를 관리할 때 | [계약 템플릿](../../.codex/skills/resume-studio-task-workflow/assets/tool-contracts.md.template) |

features는 기획, designs는 코드 구현 설계다. 같은 번호·이름으로 대응시키고 README의 기능 목록에서 둘을 함께 연결한다. 공통 설계는 여러 기능의 공유 구조를 소유한다. 코드 변경이 없는 기획 항목에는 그 사실만 적고 구현 설계 파일을 생략한다.

작은 기능의 기획은 README, 코드 설계와 짧은 시퀀스·계약은 design에 넣는다. 선택 파일을 만들지 않았다면 해당 링크도 넣지 않는다. 도구/명령 목록은 계약에서 한 번, 구현 체크리스트는 plan에서 한 번 관리한다.

## 사용하는 방법

1. 기존 작업을 이어가는지 새 작업인지 확인한다. 양식 개편만으로 새 번호를 만들지 않는다.
2. 위 원본을 작업 폴더의 목적에 맞게 사용한다. `{{PLACEHOLDER}}`를 실제 내용으로 바꾸고 작성 안내 주석·불필요한 절을 제거한다.
3. 현재 구조는 코드 링크·symbol·HEAD로 근거를 남기고, 목표 구조는 제안/구현/검증 상태를 표시한다.
4. 코드 작업 전에 기능별 변경 파일·symbol·목적·처리 방식·호출부 영향을 설계한다. 구조도·데이터 경로·기능 관계·핵심 정상/실패 시퀀스는 이해에 도움이 될 때 사용한다. 단순 변경은 짧은 설명으로 충분하다.
5. 문서 연결·호출 예시·그림·공백을 검증하고 실제 제품 시험과 구별해 handoff에 기록한다.

세부 규칙과 BMAD·OpenSpec·Spec Kit·arc42·C4·Senior Architect의 채택 근거는 [공통 작성 규칙](../../.codex/skills/resume-studio-task-workflow/references/documentation.md)에 있다. 실제 문서 생성 절차는 [작업 workflow](../../.codex/skills/resume-studio-task-workflow/SKILL.md)를 따른다.

작업 문서 템플릿 원본은 workflow의 assets 한 곳에서 관리한다. 이 디렉터리는 사람이 찾기 위한 안내이며 사본을 중복 관리하지 않는다. [11번 작업](../11-agent-tools-mcp/README.md)은 기획·공통 설계의 기존 사례이며 새 designs 분리는 소급 적용하지 않는다.

## PR 요약 양식

[GitHub PR 템플릿](../../.github/PULL_REQUEST_TEMPLATE.md)은 작업 요약→기능별 As-Is/To-Be→핵심 코드 변경과 리뷰 순서→검증·한계→필요한 전환·복구→관련 문서 순서다. 작은 수정은 요약에 전후 차이를 담고 검증만 남길 수 있다.

PR 본문 양식은 `.github/PULL_REQUEST_TEMPLATE.md` 한 곳에서 관리한다. [PR 작성 규칙과 작은/큰 작업 예시](../../.codex/skills/resume-studio-task-workflow/references/pull-requests.md)를 따르고, 기획·구현 설계 전체를 복사하지 않고 리뷰할 내용만 요약해 연결한다.
