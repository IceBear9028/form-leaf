# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 범용 core·레거시 importer 구현 완료
- 현재 단계: 4. 읽기 전용 범용 DOM renderer 구현
- 완료 커밋: `e6542b4` 계약·계획, `2e80fbe` 범용 core
- 커밋 정책: 각 계획 단계 완료 후 검증·문서 갱신과 함께 커밋

## 완료된 작업

- `schemaVersion: 3`의 범용 document model, strict validator와 불변 transaction을 구현했다.
- node·component graph의 dangling reference, 다중 parent와 cycle을 검증한다.
- node 추가·이동·복제·표시·보관·복원과 component·repeater transaction을 구현했다.
- 과거 v1 → v2 내용 변환을 `main/document/legacy` 아래로 이동하고 기존 caller에는 호환 export를 유지했다.
- v1/v2 입력을 범용 node·component·repeater·style·asset graph로 바꾸는 pure importer를 구현했다.
- importer는 원본 객체를 수정하지 않으며 지원하지 않는 이미지와 잘못된 최종 graph를 위치가 포함된 오류로 중단한다.
- 새 core와 importer는 기존 `WorkspaceDocument`·화면·repository를 아직 전환하지 않는다.

## 변경 파일

- `client/src/main/document/documentMigration.ts`
- `client/src/main/document/legacy/legacySchema.ts`
- `client/src/main/document/legacy/migrateLegacyV1.ts`
- `client/src/main/document/legacy/importLegacyDocument.ts`
- `client/test/legacy-document-import.test.mjs`
- `client/package.json`
- `docs/README.md`
- `docs/05-document-components/README.md`
- `docs/05-document-components/design.md`
- `docs/05-document-components/plan.md`
- `docs/05-document-components/handoff.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `npm run test:legacy-import` | 통과, 3개 |
| `npm test` | 통과, 전체 42개 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| generic core 목적별 domain token 검색 | 결과 없음 |
| `git diff --check`와 새 파일 공백 검사 | 통과 |

## 전환 중 주의점

- `legacySchema.ts`는 앱 전환 전까지 기존 타입 정의를 adapter로 공유한다. generic core·renderer·editor는 이를 import하면 안 된다.
- repository 반환 타입과 앱 route는 8단계에서 새 editor가 준비된 뒤 한 번에 전환한다.
- 기존 사용자 파일은 변환과 새 파일 저장이 성공하기 전까지 수정하거나 삭제하지 않는다.

## 다음 작업

목적과 무관한 fixture에서 component prop override를 적용한 render tree resolver부터 구현한다. 그 다음 일반 node renderer와 범용 pagination module을 추가한다. 기존 `ResumePreview`와 앱 route는 8단계 전환 전까지 유지한다.
