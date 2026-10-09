# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 범용 core·레거시 importer·renderer·node tree·inspector 완료
- 현재 단계: 6. component·repeater 재사용 구현
- 완료 커밋: `e6542b4` 계약·계획, `2e80fbe` 범용 core, `04ac9fc` 레거시 importer, `325fc4d` 범용 renderer
- 커밋 정책: 각 계획 단계 완료 후 검증·문서 갱신과 함께 커밋

## 완료된 작업

- `schemaVersion: 3` document model, strict validator와 불변 transaction을 구현했다.
- v1/v2 입력을 범용 graph로 바꾸는 원본 비변경 legacy importer를 구현했다.
- component active prop의 override·default를 binding target에 적용하는 pure render tree resolver를 구현했다.
- component instance와 repeater item마다 이름과 무관한 stable render path를 만든다.
- screen·measure·print mode가 같은 `NodeRenderer`와 style adapter를 사용한다.
- container, text, rich-text, Markdown, image, component와 repeater를 읽기 전용 DOM으로 렌더링한다.
- raw HTML과 외부 Markdown image를 실행하지 않고 위험 URL protocol을 비활성화한다.
- root child subtree 기반 pagination unit, keep·break·overflow와 page reconcile을 구현했다.
- 하나의 node property에 여러 component prop binding을 연결하는 모호한 계약을 validator에서 거부한다.
- 범용 document selection과 local fixture session을 추가하고 node ID를 기준으로 tree와 preview 선택을 동기화했다.
- 빈 root에서 container, text, rich-text, Markdown과 image node를 추가할 수 있다.
- node 이름 변경, 같은 parent 내 drag·버튼 이동, 표시, 복제, 보관과 복원을 구현했다.
- inspector에서 container layout, image 참조, typography와 pagination을 검증된 transaction으로 편집한다.
- 직접 편집 대상인 text, rich-text와 Markdown 본문은 inspector에 중복 입력 UI를 두지 않았다.
- 독립 `GenericDocumentEditorHarness`에 structure panel, preview와 inspector를 연결했으며 앱 route는 변경하지 않았다.

## 변경 파일

- `client/src/foundation/documentTransactions.ts`
- `client/src/renderer/src/pages/document-editor/documentSelection.ts`
- `client/src/renderer/src/pages/document-editor/useGenericDocumentSession.ts`
- `client/src/renderer/src/pages/document-editor/DocumentStructurePanel.tsx`
- `client/src/renderer/src/pages/document-editor/PropertyInspector.tsx`
- `client/src/renderer/src/pages/document-editor/GenericDocumentEditorHarness.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/NodeRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/DocumentRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/document.css`
- `client/test/document-editor.test.mjs`
- `client/package.json`
- `docs/README.md`
- `docs/05-document-components/README.md`
- `docs/05-document-components/design.md`
- `docs/05-document-components/plan.md`
- `docs/05-document-components/handoff.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `npm run test:editor` | 통과, 4개 |
| `npm test` | 통과, 전체 51개 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| generic editor 목적별 domain token 검색 | 결과 없음 |
| `git diff --check` | 통과 |

## 현재 제한

- 새 renderer는 독립 모듈로 구현됐으며 현재 앱 route에는 아직 연결하지 않았다.
- pagination은 root child subtree를 atomic unit으로 취급한다. 긴 subtree 내부 분할은 이후 실제 측정 결과를 근거로 확장한다.
- preview node 선택은 구현됐지만 본문 직접 편집 overlay와 inline selection은 7단계 범위다.
- component definition·instance와 repeater 생성 UI는 6단계 범위다.

## 다음 작업

선택한 document subtree를 component definition으로 옮기고 원래 위치를 instance로 교체하는 pure transaction부터 구현한다. 이어서 prop 노출·보관, instance override, repeater item 편집과 새 ID 기반 library package export/import를 독립 harness에 연결한다. 기존 앱 route는 8단계까지 유지한다.
