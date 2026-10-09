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

## 현재 작업

| ID | 작업 | 상태 | 문서 |
|---|---|---|---|
| 00 | 첨부 PDF 재현 및 PDF 내보내기 | 완료 | [00-reference-pdf](00-reference-pdf/README.md) |
| 01 | 이력서 편집 기능 및 데이터 구조 단순화 | 검증 중 | [01-resume-feature-improvement](01-resume-feature-improvement/README.md) |
| 02 | 미리보기 Markdown 직접 편집 | 1차 구현 완료·사용자 검증 중 | [02-preview-markdown-editing](02-preview-markdown-editing/README.md) |
| 03 | 여러 이력서 보관함과 CRUD | 1차 구현·검증 완료 | [03-resume-library](03-resume-library/README.md) |
| 04 | 레이어 경계와 테스트 단위 리팩터링 | 12단계 구현·회귀 검증 완료 | [04-layered-architecture-refactor](04-layered-architecture-refactor/README.md) |
| 05 | 범용 문서·컴포넌트 모델 | 계약 확정·범용 core 구현 중 | [05-document-components](05-document-components/README.md) |

`04`의 승인된 12단계 계획은 단계별 검증과 커밋까지 완료했다.

`05`는 이력서·포트폴리오 같은 목적을 코드에 내장하지 않는 범용 문서 편집기를 구현한다. 범용 저장 계약과 전환 정책을 확정했으며, 범용 document core부터 단계별로 구현한다.
