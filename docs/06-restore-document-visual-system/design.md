# 범용 문서 시각 시스템 복구 기술 설계

## 현재 구조

`PaginatedDocumentRenderer`가 동일한 `NodeRenderer`를 screen·measure·print에 사용하지만, `document.css`에는 종이 크기와 직접 편집에 필요한 최소 규칙만 있다. `StyleDefinition`은 node별 layout·typography·decoration을 저장하지만 새 문서 root는 style을 갖지 않으며, Markdown renderer가 사용하는 계층별 class에도 완성된 stylesheet가 없다.

`c59f33b`에는 A4 64pt/48pt inset, Pretendard typography, 색상 token, Markdown 전체 요소, page footer, zoom과 일반·조밀 preset이 있었다. 목적별 selector는 재사용할 수 없지만 시각값 자체는 범용 문서에서도 보존해야 한다.

## 변경 구조

```text
DocumentData
└─ root StyleDefinition ← 일반·조밀 preset을 값으로 복사

GenericDocumentEditorPage
├─ editor chrome + screen-only zoom
└─ PaginatedDocumentRenderer
   ├─ document-page + page-content + footer
   ├─ hidden measurement page
   └─ print pages

document.css
├─ page surface tokens
├─ generic node defaults
├─ generic Markdown element styles
└─ screen/edit/print states
```

## 데이터 흐름

사용자가 preset을 선택하면 preset ID를 runtime 분기로 저장하지 않고 승인된 `StyleDefinition` 값을 root style에 복사한다. 이후 inspector에서 값을 개별 수정할 수 있다. renderer는 기존과 같이 node가 참조하는 style 값만 CSS로 변환한다. Markdown 내부 계층은 범용 class와 page typography를 상속한다.

## 사용자 흐름

문서 열기 → 복구된 A4 surface 확인 → 필요하면 toolbar에서 zoom 변경 → root 선택 → 일반/조밀 preset 적용 → 직접 편집 → 자동 저장 → 같은 pagination으로 PDF 출력

## 영향받는 코드

| 영역 | 파일 또는 모듈 | 변경 책임 |
|---|---|---|
| page renderer | `rendering/PaginatedDocumentRenderer.tsx` | page content·footer·zoom-compatible DOM |
| document CSS | `rendering/document.css` | 작업 전 시각값의 범용 stylesheet 이전 |
| preset | `foundation/documentStylePresets.ts` | 목적 중립 root style 값과 적용 transaction |
| document factory | `foundation/documentModel.ts` | 빈 root 구조와 기본 style 생성 |
| inspector | `PropertyInspector.tsx` | root preset 적용 UI |
| toolbar | `GenericDocumentEditorPage.tsx` | screen preview zoom 복구 |
| importer | `main/document/legacy/importLegacyDocument.ts` | 기존 입력을 styled generic graph로 변환 |

## 저장과 복구

스타일은 별도 runtime registry ID에 의존하지 않고 기존 `DocumentData.styles`에 포함한다. 기존 문서는 있는 style을 그대로 유지한다. 새 기본값이나 preset은 새 문서 생성 또는 사용자의 명시적 적용에만 사용한다. legacy importer가 이미 만든 식별 가능한 기본 style은 원본이 남아 있으므로 재변환 없이도 CSS baseline을 상속하며, 구조 변경이 필요한 경우 기존 사용자 편집을 덮어쓰지 않는 별도 호환 transaction으로 제한한다.

## 오류와 경계 조건

- zoom이 측정 높이나 PDF 크기에 영향을 주면 안 된다.
- footer가 content capacity를 침범하거나 추가 페이지를 만들면 안 된다.
- root style preset 적용이 child의 사용자 style을 덮어쓰면 안 된다.
- Markdown 빈 block과 직접 편집 caret이 시각 스타일 복구 후에도 유지되어야 한다.
- 기존 문서에 없는 token은 안전한 page 기본값으로 fallback해야 한다.

## 결정과 근거

| 결정 | 근거 | 대안 |
|---|---|---|
| 작업 전 시각값을 generic CSS와 style 값으로 이전 | 도메인 결합 없이 회귀를 복구한다. | 과거 renderer 전체 복원은 목적별 분기를 되살린다. |
| preset은 root style 값으로 복사 | 문서 독립성과 재실행 재현성을 유지한다. | registry ID만 저장하면 registry 변경에 따라 문서가 달라진다. |
| page footer는 renderer chrome으로 처리 | 모든 문서에서 동일한 page artifact이며 node data가 아니다. | footer node 저장은 편집 tree와 component에 불필요하게 노출된다. |
| zoom은 CSS transform이 아닌 screen wrapper zoom 사용 | page layout 좌표와 toolbar 위치를 안정적으로 유지한다. | transform은 scroll size와 selection rect 보정이 필요하다. |

## 검증 전략

pure preset 적용 테스트, renderer pagination 테스트와 기존 Markdown transaction 테스트를 먼저 실행한다. 이후 production build를 격리 사용자 데이터로 실행해 screen/print page 수, zoom과 autosave를 확인한다. reference PDF 첫 페이지와 결과를 같은 A4 크기의 이미지로 비교해 여백, heading hierarchy, body density와 footer 위치를 확인한다.
