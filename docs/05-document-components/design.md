# 범용 문서·컴포넌트 모델 기술 설계

## 설계 상태

범용 `schemaVersion: 3` 계약과 전환 정책을 확정했다. 현재 앱은 기존 `WorkspaceDocument`를 유지한 채 새 core를 병렬 구현하고, 새 stack이 준비된 뒤 앱 진입점을 전환한다.

## 제품 불변 조건

범용 core는 사용자가 만드는 문서의 의미를 알지 못한다.

```text
허용: document, node, container, text, markdown, image,
      repeater, component, instance, prop, style, asset, page

금지: resume, portfolio, profile, career, education, project처럼
      문서 목적이나 사용자 카테고리를 나타내는 production 분기
```

사용자 데이터의 `name` 또는 text value에는 어떤 문자열도 들어갈 수 있다. renderer, validator, repository와 editor는 문자열의 의미를 해석하지 않는다.

## 현재 결합

현재 구현은 다음 지점에서 특정 문서 도메인에 결합되어 있다.

| 영역 | 현재 결합 |
|---|---|
| 공통 문서 | `WorkspaceDocument = ResumeDocument` |
| 저장 schema | 고정 `ResumeSection` union과 `profile`, `timeline`, `project-group` |
| 목록 | `resumes`, `profileName`, `제목 없는 이력서` |
| repository | `.resume.json`, 이력서 전용 validation과 메시지 |
| editor | `ResumeDocument`, `EditorPanel`, `ResumePreview` 직접 조립 |
| renderer | section type별 layout unit과 전용 view 분기 |
| 스타일·인쇄 | `resumeDocument.css`, `--resume-*`, 이력서 preset ID |

이번 작업은 이 결합 위에 새 기능을 추가하지 않고 범용 계약으로 대체한다.

## 목표 구조

```text
client/src/foundation/
├─ document.ts                 # 기존 경계와 새 core의 임시 export barrel
├─ documentModel.ts            # 범용 envelope·node·component·style·asset 계약
├─ documentValidation.ts       # strict schema와 graph validation
├─ documentTransactions.ts     # 불변 document transaction
├─ documentLibrary.ts          # 범용 summary와 CRUD 계약
└─ componentLibrary.ts         # 개인 component template 계약

client/src/main/document/
└─ legacy/                     # 격리된 과거 입력 타입과 importer

client/src/renderer/src/pages/document-editor/
├─ DocumentEditorPage.tsx
├─ DocumentStructurePanel.tsx
├─ PropertyInspector.tsx
├─ ComponentEditor.tsx
├─ DocumentCanvas.tsx
└─ rendering/
   ├─ NodeRenderer.tsx
   ├─ nodeRegistry.ts
   ├─ pagination.ts
   └─ document.css
```

이 구조는 폴더를 미리 만들겠다는 의미가 아니다. 실제 책임이 구현될 때만 필요한 파일을 만든다.

## 범용 저장 계약

```ts
type DocumentData = {
  schemaVersion: 3;
  documentId: string;
  name: string;
  rootNodeId: string;
  nodes: Record<string, DocumentNode>;
  components: Record<string, ComponentDefinition>;
  styles: Record<string, StyleDefinition>;
  assets: Record<string, DocumentAsset>;
  updatedAt: string;
};
```

문서 종류를 나타내는 `kind`는 두지 않는다. 문서의 목적은 node tree와 사용자가 입력한 이름·내용의 조합으로만 나타난다.

### Node

```ts
type DocumentNode =
  | ContainerNode
  | TextNode
  | RichTextNode
  | MarkdownNode
  | ImageNode
  | RepeaterNode
  | ComponentInstanceNode;

type NodeBase = {
  id: string;
  name: string;
  visible: boolean;
  styleId?: string;
  archivedFrom?: { parentId: string; index: number };
};

type ContainerNode = NodeBase & {
  type: "container";
  childIds: string[];
};

type TextNode = NodeBase & {
  type: "text";
  value: string;
};

type RichTextNode = NodeBase & {
  type: "rich-text";
  value: RichTextValue;
};

type MarkdownNode = NodeBase & {
  type: "markdown";
  source: string;
};

type ImageNode = NodeBase & {
  type: "image";
  assetId?: string;
  alt: string;
};

type RepeaterNode = NodeBase & {
  type: "repeater";
  itemComponentId: string;
  items: ComponentInstanceValue[];
};

type ComponentInstanceNode = NodeBase & {
  type: "component-instance";
  componentId: string;
  props: Record<string, ComponentPropValue>;
};
```

`name`은 layer panel에서 보여주는 사용자 데이터다. validator와 renderer는 이름을 기준으로 분기하지 않는다.

### Component

```ts
type ComponentDefinition = {
  id: string;
  name: string;
  rootNodeId: string;
  propDefinitions: ComponentPropDefinition[];
};

type ComponentPropDefinition = {
  id: string;
  name: string;
  status: "active" | "archived";
  valueType: ComponentPropValueType;
  binding: ComponentPropBinding;
  defaultValue: ComponentPropValue;
};

type ComponentInstanceValue = {
  id: string;
  componentId: string;
  visible: boolean;
  props: Record<string, ComponentPropValue>;
};
```

component는 범용 node subtree와 노출할 prop만 정의한다. prop binding은 `text.value`, `rich-text.value`, `markdown.source`, `image.value` 중 하나를 component subtree의 node에 연결한다. prop 제거 시 definition 상태만 `archived`로 바꿔 instance 값을 유지한다. 타입 변경은 기존 prop을 archive하고 새 prop을 만드는 방식으로 제한한다.

`single/list` 같은 문서 카테고리 개념은 schema에 두지 않고, 한 instance는 `component-instance`, 반복은 `repeater`로 조합한다.

### Style

style은 임의 CSS 문자열이 아니라 validation 가능한 값만 저장한다.

```ts
type StyleDefinition = {
  id: string;
  name: string;
  layout?: {
    direction?: "row" | "column";
    gapPt?: number;
    paddingPt?: [number, number, number, number];
    align?: "start" | "center" | "end" | "stretch";
    width?:
      | { mode: "auto" | "fill" }
      | { mode: "fixed"; valuePt: number };
  };
  typography?: {
    fontFamily?: string;
    fontSizePt?: number;
    lineHeight?: number;
    fontWeight?: number;
    color?: ColorValue;
  };
  decoration?: {
    background?: ColorValue;
    borderColor?: ColorValue;
    borderWidthPt?: number;
    radiusPt?: number;
  };
  pagination?: {
    keepTogether?: boolean;
    keepWithNext?: boolean;
    forcePageBreakBefore?: boolean;
  };
};
```

초기 구현에서는 위 property만 허용한다. validator는 정의되지 않은 key와 raw CSS를 거부해 schema가 CSS 전체를 복제하거나 우회하지 않게 한다.

### Asset

첫 범위의 asset은 document가 독립적으로 재현할 수 있는 image data URL이다. `image/png`, `image/jpeg`, `image/webp`, `image/gif`만 허용하고 node와 image prop은 asset ID를 참조한다.

### 보관과 graph 소유권

- document root, component root와 보관된 subtree root만 parent가 없는 node가 될 수 있다.
- 일반 node는 정확히 하나의 container parent를 가진다.
- 보관된 node는 `archivedFrom`에 이전 parent와 index를 저장하고 tree에서는 분리한다.
- node를 복원하면 저장된 위치를 우선 사용하되 현재 child 수에 맞게 index를 보정한다.
- document와 component root는 다른 container의 child가 될 수 없다.
- 구조 node와 component 참조 모두 순환을 허용하지 않는다.

### Validation

`validateDocumentData`는 구조 검증 뒤 ID와 graph 관계를 검증한다.

- schema에 없는 top-level key를 거부하므로 `kind`, `categories` 같은 우회 필드를 저장할 수 없다.
- record key와 내부 ID, root와 parent 소유권, style·asset·component 참조를 확인한다.
- prop binding target과 value type, instance override type을 확인한다.
- node cycle, component cycle, dangling reference와 repeater item 충돌을 보고한다.
- 사용자 `name`과 text value의 의미는 검사하지 않는다.

## 화면의 카테고리와 저장 node의 관계

사용자가 화면에서 `카테고리`라고 부르는 것은 document root container의 직접 child다.

```text
root container
├─ component-instance  사용자 이름: A
├─ container           사용자 이름: B
└─ repeater            사용자 이름: C
```

저장 schema에는 `DocumentCategory`, `ProfileSection` 같은 타입이 없다. 최상위 node의 이름이나 component 구성에 어떤 의미를 부여할지는 사용자에게만 속한다.

## 구조화된 DOM layout

자유 좌표 canvas를 사용하지 않는다. renderer는 container layout과 node style을 DOM으로 변환한다.

```text
DocumentData
→ root node 해석
→ component instance 확장
→ React DOM
→ 숨겨진 동일 DOM에서 높이 측정
→ pagination
→ 화면 / printToPDF
```

- text와 Markdown은 `contentEditable` 및 source transaction으로 편집한다.
- container는 row·column flow와 gap·padding을 제공한다.
- repeater는 같은 component definition으로 item DOM을 반복한다.
- selection outline과 toolbar는 측정에 영향을 주지 않는 overlay다.
- PDF는 편집 UI를 제외하고 동일한 document DOM을 출력한다.

## 직접 편집과 서식

편집 target은 node 또는 component prop의 안정적인 경로로 식별한다.

```ts
type EditTarget =
  | { nodeId: string }
  | { instanceNodeId: string; propId: string }
  | { repeaterNodeId: string; itemId: string; propId: string };
```

- `text`: plain string transaction
- `rich-text`: run과 mark transaction
- `markdown`: source range transaction
- `image`, asset, 여러 값을 가진 property: inspector transaction

굵게, 기울임, 밑줄, 취소선, 링크와 inline color는 rich-text mark에 저장한다. node 전체 글꼴·크기·색상은 style에서 관리한다. Markdown은 표준 marker와 승인된 확장만 원문에 저장한다.

## Component library와 문서 간 재사용

document 안의 component definition은 해당 파일이 완전한 결과를 소유하도록 문서에 포함한다.

다른 문서에서 재사용할 때는 개인 library의 template을 복사한다.

```text
document component
→ 내 component library에 저장
→ 다른 document에서 가져오기
→ 새 ID로 component·node·style·asset dependency 복사
```

첫 범위에서는 live link를 두지 않는다. library 원본을 수정해도 이미 만들어진 문서가 바뀌지 않아야 PDF 재현성과 로컬 파일 독립성이 유지된다.

template에는 사용자 콘텐츠를 기본으로 포함하지 않는다. 사용자가 명시적으로 예시 값을 포함해 저장하는 기능은 별도 결정으로 둔다.

## 범용 문서 library와 저장

현재 `DocumentLibraryIndex.resumes`와 `profileName`은 제거 대상이다.

```ts
type DocumentSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentLibraryIndex = {
  schemaVersion: 2;
  documents: DocumentSummary[];
  trash: DeletedDocumentSummary[];
};
```

- 새 파일 suffix는 특정 목적이 없는 이름을 사용한다.
- 기존 경로와 suffix는 migration 입력으로만 읽는다.
- preload와 IPC는 이미 `document:*`, `window.documents`를 사용하므로 범용 계약을 유지한다.
- repository error와 UI 문구에서 특정 문서 목적을 제거한다.

## 레거시 데이터 경계

기존 v1/v2 데이터 보존에는 과거 domain type을 읽는 변환기가 필요하다. 이 코드는 범용 core와 분리해야 한다.

허용되는 의존 방향은 다음과 같다.

```text
legacy importer ──→ generic document factory

generic document core ──X──→ legacy domain types
generic renderer      ──X──→ legacy domain types
generic editor        ──X──→ legacy domain types
```

legacy importer만 과거 type string과 입력 구조를 알게 한다. 앱 전환 전에는 기존 화면이 현재 계약을 계속 사용하되, 새 generic core·renderer·editor는 과거 타입을 import하지 않는다. 8단계 앱 전환 후 실제 과거 타입과 validator를 이 폴더에 격리하고 9단계에서 다른 runtime import를 제거한다.

importer는 v1을 먼저 v2 내용으로 정규화한 뒤 일반 node·component·repeater·style·asset으로 변환한다. 원본 객체는 수정하지 않으며, 이미지 형식이나 최종 graph가 유효하지 않으면 경로가 포함된 오류로 전체 변환을 중단한다. 변환 이후 runtime은 원본 문서 목적을 알지 못한다.

## 영향받는 코드

| 영역 | 현재 파일 또는 모듈 | 변경 책임 |
|---|---|---|
| 공통 계약 | `foundation/document.ts`, `content/resume.ts` | generic envelope·node·component 계약으로 교체 |
| 문서 목록 | `foundation/documentLibrary.ts` | `documents`와 범용 summary로 migration |
| migration | `main/document/documentMigration.ts` | generic core와 격리된 legacy importer |
| repository | `main/document/documentRepository.ts`, `documentPaths.ts` | 범용 validation, index와 suffix |
| editor | `pages/document-editor/DocumentEditorPage.tsx` | generic canvas·structure·inspector 조립 |
| current form | `resume/components` | 범용 node/component editor로 대체 |
| current preview | `resume/preview` | generic node renderer·pagination·print CSS로 대체 |
| Markdown | `pages/document-editor/markdown` | generic edit target에 연결 |
| styles | `pages/document-editor/style` | document style validation과 CSS 변수 adapter |
| 테스트 | `client/test` | domain label과 무관한 schema·render·storage 회귀 |

## 오류와 경계 조건

- root가 없거나 node graph에 cycle이 있는 문서
- 존재하지 않는 child, component, style 또는 asset ID 참조
- component가 자신을 직접 또는 간접적으로 instance화하는 cycle
- prop definition과 instance value type 불일치
- repeater item component 삭제 또는 변경
- component library 복사 중 ID collision과 dependency 누락
- font load 후 pagination 결과 변경
- 편집 중인 node가 숨김·보관·삭제되는 경우
- legacy import 일부 실패와 원본 파일 보존

## 결정과 근거

| 결정 | 근거 | 대안 |
|---|---|---|
| 문서 `kind`를 저장하지 않는다 | 목적은 사용자가 구성하며 core 동작에 영향을 주지 않는다. | 문서 종류 union은 domain 분기를 다시 만든다. |
| category 대신 root node tree를 저장한다 | 최상위 분류도 범용 node 조합으로 표현할 수 있다. | category schema는 특정 정보 구조를 강제한다. |
| structured DOM flow를 사용한다 | 텍스트 선택, IME, 접근성, pagination과 PDF를 유지한다. | Canvas나 절대 좌표 layout은 흐름형 문서와 충돌한다. |
| renderer는 node type만 분기한다 | 사용자 이름이나 문서 목적을 코드에서 제거한다. | 이름·template ID 분기는 숨은 domain coupling이다. |
| component는 문서에 포함한다 | 문서가 library 외부 상태 없이 재현된다. | live link는 외부 version과 충돌 처리가 필요하다. |
| 다른 문서에는 component를 복사한다 | 기존 문서가 library 변경으로 바뀌지 않는다. | linked instance는 자동 전파와 버전 UX가 필요하다. |
| 임의 CSS를 저장하지 않는다 | validation, 보안, PDF와 다른 renderer 재사용을 보장한다. | raw CSS는 표현력은 높지만 계약을 우회한다. |
| legacy 의미는 변환 경계에만 둔다 | 기존 데이터를 보존하면서 generic core를 보호한다. | core가 과거 section type을 계속 이해한다. |

## 검증 전략

1. schema fixture의 모든 사용자 이름을 무관한 단어로 바꿔도 validation과 render tree가 같음을 확인한다.
2. production core에서 금지된 domain token import와 type 분기가 없는지 정적 검색한다.
3. node graph, component cycle, reference와 prop value validation을 단위 테스트한다.
4. component instance와 repeater가 같은 definition을 결정적으로 렌더링하는지 확인한다.
5. rich-text와 Markdown selection transaction, IME와 undo/redo를 검증한다.
6. component library 복사가 새 ID와 전체 dependency를 만들고 원본 문서에 연결되지 않는지 확인한다.
7. repository create·save·load·trash·restore·backup을 generic fixture로 검증한다.
8. 선택한 legacy 정책에 따라 원본 보존과 generic 변환 결과를 검증한다.
9. 동일한 generic DOM으로 화면 측정과 PDF를 비교한다.
10. 전체 `npm test`, `npm run typecheck`, `npm run build`와 `git diff --check`를 실행한다.
