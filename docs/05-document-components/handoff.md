# 범용 문서·컴포넌트 모델 세션 인수인계

## 현재 상태

- 상태: 범용 core·레거시 importer·읽기 전용 renderer 완료
- 현재 단계: 5. node tree·inspector 편집기 구현
- 완료 커밋: `e6542b4` 계약·계획, `2e80fbe` 범용 core, `04ac9fc` 레거시 importer
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

## 변경 파일

- `client/src/foundation/documentValidation.ts`
- `client/src/renderer/src/pages/document-editor/rendering/renderTree.ts`
- `client/src/renderer/src/pages/document-editor/rendering/pagination.ts`
- `client/src/renderer/src/pages/document-editor/rendering/safeHref.ts`
- `client/src/renderer/src/pages/document-editor/rendering/styleToCss.ts`
- `client/src/renderer/src/pages/document-editor/rendering/MarkdownView.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/NodeRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/DocumentRenderer.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/document.css`
- `client/test/document-core.test.mjs`
- `client/test/document-renderer.test.mjs`
- `client/package.json`
- `docs/README.md`
- `docs/05-document-components/README.md`
- `docs/05-document-components/design.md`
- `docs/05-document-components/plan.md`
- `docs/05-document-components/handoff.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `npm run test:renderer` | 통과, 4개 |
| `npm test` | 통과, 전체 47개 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| generic renderer 목적별 domain token 검색 | 결과 없음 |
| `git diff --check`와 새 파일 공백 검사 | 통과 |

## 현재 제한

- 새 renderer는 독립 모듈로 구현됐으며 현재 앱 route에는 아직 연결하지 않았다.
- pagination은 root child subtree를 atomic unit으로 취급한다. 긴 subtree 내부 분할은 이후 실제 측정 결과를 근거로 확장한다.
- 직접 편집 overlay와 selection은 7단계 범위다.

## 다음 작업

범용 `DocumentSelection`과 editor session을 먼저 정의한다. 그 다음 빈 root에서 node 추가·이동·복제·표시·보관을 실행하는 `DocumentStructurePanel`과 선택 node의 container·image·style property를 편집하는 `PropertyInspector`를 fixture harness에 연결한다. 기존 앱 route는 8단계까지 유지한다.
