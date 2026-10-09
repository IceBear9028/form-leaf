# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 범용 document core 구현 완료
- 현재 단계: 3. 레거시 importer 구현
- 기준 커밋: `e6542b4 docs: define generic document component plan`
- 커밋 정책: 각 계획 단계 완료 후 검증·문서 갱신과 함께 커밋

## 완료된 작업

- `schemaVersion: 3`의 범용 `DocumentData`, node·component·style·asset 계약을 구현했다.
- 새 문서를 범용 metadata와 빈 root container만으로 만드는 factory를 구현했다.
- 정의되지 않은 key, `kind`, `categories`, raw CSS와 잘못된 참조를 거부하는 strict validator를 구현했다.
- node·component graph의 dangling reference, 다중 parent와 cycle 검증을 구현했다.
- node 추가·이동·복제·표시·보관·복원 transaction을 구현했다.
- component definition·instance·prop archive와 repeater item transaction을 구현했다.
- prop archive 뒤에도 instance override 값을 유지한다.
- 새 core는 기존 `WorkspaceDocument`와 병행 export하며 현재 앱 경로를 바꾸지 않았다.

## 변경 파일

- `client/src/foundation/document.ts`
- `client/src/foundation/documentModel.ts`
- `client/src/foundation/documentValidation.ts`
- `client/src/foundation/documentTransactions.ts`
- `client/test/document-core.test.mjs`
- `client/package.json`
- `docs/README.md`
- `docs/05-document-components/README.md`
- `docs/05-document-components/design.md`
- `docs/05-document-components/plan.md`
- `docs/05-document-components/handoff.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `npm run test:document-core` | 통과, 6개 |
| `npm test` | 통과, 전체 39개 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| generic core 목적별 domain token 검색 | 결과 없음 |
| `git diff --check`와 새 파일 공백 검사 | 통과 |

## 다음 작업

`client/src/main/document/legacy/`에 과거 계약 adapter와 v1 내용 변환을 격리하고, v1/v2 입력을 범용 `DocumentData`로 변환하는 pure importer를 구현한다. 기존 repository 반환 타입과 화면은 8단계 전환 전까지 유지한다.
