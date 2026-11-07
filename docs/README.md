# Document 작업 문서

이 디렉터리는 제품의 미래 작업을 미리 계획하는 공간이 아니다. 실제로 시작한 작업 단위의 목표, 결정, 설계와 결과를 시간순으로 기록한다.

## 문서 원칙

1. 작업 단위는 시작할 때만 생성한다.
2. 아직 시작하지 않은 `01`, `02` 등의 디렉터리를 미리 만들지 않는다.
3. 진행 중인 작업 단위의 문서는 구현 과정에서 계속 수정할 수 있다.
4. 완료된 작업 단위는 당시 결정의 기록으로 보존한다.
5. 완료된 결정을 변경해야 할 때는 과거 문서를 몰래 고치지 않고 새로운 작업 단위에서 변경 이유와 대체 범위를 기록한다.
6. 제품 전체의 미래 방향을 추측해 문서화하지 않는다.
7. 확장성은 사용하지 않는 기능을 미리 구현하는 방식이 아니라 데이터 구조와 코드 경계로 확보한다.

## 공통 문서 양식

[docs 템플릿 안내](templates/README.md)를 기준으로 새 작업과 진행 중 문서를 작성한다. 완료된 과거 docs는 사용자 요청 없이 일괄 변경하지 않는다. 11번은 2026-11-08의 명시적 요청에 따라 새 구조로 정리했다.

- 루트 README는 작업 소개·핵심 변화·문서 안내를 짧게 담는다.
- features/README.md가 전체 기획·범위·기능 목록을, features/NN-name.md가 기능별 상세 기획을 소유한다.
- implementation/README.md는 기술 구조와 공통 결정의 요약·목차이며, implementation/NN-name.md는 같은 번호의 기능을 구현할 코드·목적·흐름·입출력 계약·실패·검증 설계를 담는다. 코드 작업 전에 작성한다.
- 실행 흐름·계약 문서를 기본 생성하지 않는다. 여러 기능이 공유하는 긴 기술 내용만 implementation/ 내부에서 분리한다.
- tests/NN-name.md가 같은 번호 기능의 상세 시나리오·통과 기준·실행 결과를 소유하며 tests/README.md는 공통 검사와 목차를 제공한다.
- plan은 실행 순서·완료 조건·진행 상태·기능별 커밋, handoff는 실제 구현·검증 요약·tests 링크와 재개 지점을 관리한다.
- 기능 번호별로 구현→필수 검증 통과→문서 갱신→커밋을 마친 뒤 다음 기능으로 넘어간다.
- 기능 목록을 먼저 정하고 [분리·통합 기준](../.codex/skills/resume-studio-task-workflow/references/documentation.md#기능-분리와-통합-판단)에 따라 번호별 문서를 대응시킨다. 통합 예외에는 이유와 실제 내용 위치를 남긴다.
- 문서 완료 전 [구조 검토](../.codex/skills/resume-studio-task-workflow/references/documentation.md#구조-검토와-문법-검사를-분리한다)와 문법 검사를 따로 수행한다. 여러 기능의 plan·handoff는 작업 루트에 둔다.
- 템플릿 원본은 workflow assets, [PR 양식](../.github/PULL_REQUEST_TEMPLATE.md)은 .github 한 곳에서 관리한다. PR은 변경의 요약과 상세 docs 링크를 제공한다.

## 현재 작업

| ID | 작업 | 상태 | 문서 |
|---|---|---|---|
| 00 | 첨부 PDF 재현 및 PDF 내보내기 | 완료 | [00-reference-pdf](00-reference-pdf/README.md) |
| 01 | 이력서 편집 기능 및 데이터 구조 단순화 | 검증 중 | [01-resume-feature-improvement](01-resume-feature-improvement/README.md) |
| 02 | 미리보기 Markdown 직접 편집 | 1차 구현 완료·사용자 검증 중 | [02-preview-markdown-editing](02-preview-markdown-editing/README.md) |
| 03 | 여러 이력서 보관함과 CRUD | 1차 구현·검증 완료 | [03-resume-library](03-resume-library/README.md) |
| 04 | 레이어 경계와 테스트 단위 리팩터링 | 12단계 구현·회귀 검증 완료 | [04-layered-architecture-refactor](04-layered-architecture-refactor/README.md) |
| 05 | 범용 문서·컴포넌트 모델 | 완료 | [05-document-components](05-document-components/README.md) |
| 06 | 범용 문서 시각 시스템 복구 | 구현 중 | [06-restore-document-visual-system](06-restore-document-visual-system/README.md) |
| 07 | Canonical Document migration | 완료 | [07-canonical-document-migration](07-canonical-document-migration/README.md) |
| 08 | Preview와 Component 선택 경계 분리 | 완료 | [08-preview-component-selection-boundary](08-preview-component-selection-boundary/README.md) |
| 09 | Preview Markdown 작성 사용성 | 자동 검증 완료·사용자 실제 앱 확인 대기 | [09-preview-markdown-authoring](09-preview-markdown-authoring/README.md) |
| 10 | Markdown 편집 DOM 단일 소유권 | 제품 통합·자동 검증 완료 | [10-markdown-editor-ownership](10-markdown-editor-ownership/README.md) |
| 11 | 에이전트 도구 명세 및 MCP 구현 | main 병합·문서 구조 개정, Claude 로그인/타 OS 미검증 | [11-agent-tools-mcp](11-agent-tools-mcp/README.md) |
| 12 | 정적 분석 정책과 적용 설계 | 정책·문서 완료, 제품 적용 대기 | [12-static-analysis-policy](12-static-analysis-policy/README.md) |

## References

- [현재 Document 입력·렌더링·저장 과정](06-restore-document-visual-system/references/current-document-render-pipeline.md)
- [To-Be Document 입력·렌더링·저장 과정](06-restore-document-visual-system/references/to-be-document-render-pipeline.md)

## Backlog

- [향후 구조 개선 작업](backlog/README.md)

`04`의 승인된 12단계 계획은 단계별 검증과 커밋까지 완료했다.

`05`는 특정 문서 목적을 코드에 내장하지 않는 범용 문서 편집기를 구현했다. 범용 core, DOM editor, component 재사용, preview 직접 편집, 저장소·library·IPC와 앱 진입점 전환을 완료하고 과거 runtime을 제거했다.

`06`은 `05` 전환 중 함께 사라진 작업 전 문서 스타일과 editor 시각 품질을 범용 CSS·style definition 위에 복구한다.

`07`은 과거 파일을 schemaVersion 4로 한 번 migration하고 최신 runtime의 legacy identity와 과거 원본 의존성을 제거한다.

`08`은 내용 preview에서 component definition 내부 선택을 제거하고, 데이터 소유 단위의 직접 편집과 component 구조 편집 화면의 책임을 분리한다.

`09`는 Jira 분석 문서를 기준으로 Preview Markdown의 자동 서식, 연속 목록 작성, 단축키와 빠른 삽입 경험을 구현한다.

`10`은 React와 IME가 같은 editable DOM을 수정하는 구조를 제거하고, 활성 Markdown editor가 DOM·selection·composition을 단독 소유하도록 편집 경계를 교체한다.

`11`은 외부 AI 에이전트가 Formleaf 기능을 조회·조작하도록 도구 계약과 MCP 서버를 만든다. AI 로그인과 앱 내부 채팅 UX는 다음 작업으로 분리한다.

`12`는 TypeScript·ESLint의 검사 범위와 허용 기준을 확정하고, 테스트 TS 전환과 편집 동작 보존을 포함한 적용 설계를 기록한다.
