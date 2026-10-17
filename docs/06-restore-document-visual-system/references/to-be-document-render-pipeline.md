# To-Be Document 입력·렌더링·저장 과정

## 문서 목적

이 문서는 [현재 Document 입력·렌더링·저장 과정](current-document-render-pipeline.md)에서 확인한 병목을 제거하기 위한 목표 구조를 정의한다.

목표는 다음 세 경로를 서로 분리하는 것이다.

1. 키보드 입력을 즉시 화면에 표시하는 편집 경로
2. 문서 레이아웃과 페이지네이션을 갱신하는 파생 계산 경로
3. 확정된 document revision을 디스크와 PDF로 출력하는 저장·출력 경로

이 문서는 구현 순서보다 편집기의 최종 책임과 이벤트 순서를 먼저 확정한다. 구현 과정에서 성능을 이유로 caret, 한국어 IME, Undo/Redo와 페이지 분할 정확성을 약화하지 않는다.

## 목표와 성능 계약

- 평상시 편집에는 `screen renderer` 하나와 공유 measure surface 하나만 존재한다.
- `print renderer`는 PDF 내보내기를 요청한 동안에만 생성한다.
- 활성 편집 요소는 전체 `DocumentData` render가 끝나기 전에 변경 문자를 표시한다.
- 같은 Markdown source와 revision은 한 번만 파싱하고 pagination과 모든 fragment가 결과를 공유한다.
- 저장 상태 `dirty`, `saving`, `saved`는 document renderer를 다시 실행하지 않는다.
- 같은 document revision에서 페이지 측정 요청은 한 프레임에 한 번으로 합친다.
- pagination 결과가 같으면 page state를 갱신하지 않는다.

| 사용자 동작 | 목표 |
|---|---:|
| 일반 문자 표시 | 16ms 이내, 최악 50ms 이내 |
| 한국어 조합 문자 표시 | 브라우저 IME frame 안에서 즉시 |
| 요소 추가·삭제·복제 결과 표시 | 100ms 이내 |
| 페이지네이션 후속 정착 | 300ms 이내 |
| 입력 중 50ms 이상 renderer long task | 0회 |
| 변경되지 않은 Markdown source 재파싱 | 0회 |
| save state 변경으로 인한 document renderer 실행 | 0회 |
| 평상시 편집 중 print render·measure | 0회 |

## 전체 목표 과정

```mermaid
flowchart TD
    A["키보드 입력"] --> B["활성 요소 local edit buffer"]
    B --> C["변경 문자 즉시 표시"]
    B --> D["한 frame 안에서 Document transaction commit"]
    D --> E["새 Document revision"]

    E --> F["영향받은 selector만 무효화"]
    F --> G["변경 source만 Markdown parse"]
    F --> H["screen render plan 갱신"]
    G --> H
    H --> I["screen visible tree 갱신"]
    H --> J["공유 measure surface 갱신"]
    J --> K["한 번의 coalesced layout measure"]
    K --> L{"pagination 결과 변경?"}
    L -->|"예"| M["screen page stack 갱신"]
    L -->|"아니오"| N["page state 유지"]

    E --> O["autosave snapshot 예약"]
    O --> P["main process 비동기 저장"]
    P --> Q["격리된 SaveIndicator만 갱신"]

    E -. "PDF 요청 시점의 확정 revision" .-> R["PrintExportSurface 일시 mount"]
    R --> S["pagination 결과 확인"]
    S --> T["printReady"]
    T --> U["Electron printToPDF"]
    U --> V["PrintExportSurface unmount"]

    class C fast
    class G,J,K optimized
    classDef fast fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px
    classDef optimized fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
```

## 목표 화면 렌더링 토폴로지

### 평상시 편집

```mermaid
flowchart LR
    PAGE["GenericDocumentEditorPage"]

    PAGE --> CHROME["Editor chrome"]
    PAGE --> PANELS["Layer·Component·Inspector selectors"]
    PAGE --> SCREEN["Memoized ScreenDocumentRenderer"]

    SCREEN --> PLAN["Shared RenderPlan"]
    PLAN --> VISIBLE["screen visible page stack"]
    PLAN --> MEASURE["single shared measure surface"]

    class SCREEN,PLAN,VISIBLE,MEASURE active
    classDef active fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
```

| 렌더 surface | 존재 시점 | 목표 책임 |
|---|---|---|
| screen visible page stack | 평상시 편집 | 편집 결과와 현재 페이지 표시 |
| shared measure surface | 평상시 편집 | 페이지 높이 계산의 유일한 소유자 |
| print visible page stack | PDF 내보내기 중 | 확정 snapshot의 출력 DOM 제공 |
| print measure surface | screen 결과를 재사용할 수 없을 때만 | 출력 조건이 다를 때 한 번만 측정 |

### PDF 내보내기 중

```mermaid
flowchart LR
    EXPORT["PdfExportCoordinator"] --> SNAPSHOT["immutable revision snapshot"]
    SNAPSHOT --> PRINT["PrintExportSurface"]
    PRINT --> RESULT{"screen PaginationResult<br/>재사용 가능?"}
    RESULT -->|"예"| PAGES["print page stack"]
    RESULT -->|"아니오"| MEASURE["on-demand print measure"]
    MEASURE --> PAGES
    PAGES --> READY["printReady"]
    READY --> PDF["Electron printToPDF"]
    PDF --> CLEANUP["surface unmount"]

    class PRINT,MEASURE ondemand
    classDef ondemand fill:#f3e8ff,stroke:#9333ea,color:#581c87
```

일반 편집 화면에는 print surface가 존재하지 않는다. 내보내기 요청이 들어오면 확정 revision snapshot으로만 일시적으로 생성하고, 성공·실패와 관계없이 제거한다.

## 일반 text·rich-text 키보드 입력 순서

활성 편집 요소는 Document 전체 renderer와 분리된 local edit buffer를 가진다. 입력 이벤트는 local buffer와 DOM만 먼저 갱신하고, Document transaction은 같은 frame 안에서 별도 경로로 commit한다.

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant DOM as Active Editable DOM
    participant Buffer as Local EditBuffer
    participant Commit as EditCommitCoordinator
    participant Tx as Document transaction
    participant Store as DocumentStore
    participant Plan as RenderPlan selector
    participant Screen as Screen renderer
    participant Page as Pagination coordinator
    participant Save as Autosave coordinator

    User->>DOM: 문자 입력
    DOM->>Buffer: selection과 replacement 계산
    Buffer->>DOM: local value 즉시 반영
    Note over User,DOM: 전체 문서 render를 기다리지 않고 문자가 보인다.
    Buffer->>Commit: target + value + selection 전달
    Commit->>Commit: 같은 animation frame의 입력 병합
    Commit->>Tx: Document transaction 1회
    Tx->>Store: 새 revision commit
    Store-->>Buffer: committed revision 확인

    par 영향받은 화면 갱신
        Store->>Plan: changed node/prop key 무효화
        Plan->>Screen: 변경된 render subtree 전달
        Screen->>DOM: 주변 DOM 최소 commit
    and 페이지네이션 갱신
        Store->>Page: layout-affecting revision 알림
        Page->>Page: measure 요청 한 frame으로 병합
    and 자동 저장
        Store->>Save: immutable snapshot 예약
    end

    Screen-->>Buffer: local value와 committed value reconcile
    Buffer->>DOM: caret 유지
```

### local edit buffer 계약

```mermaid
stateDiagram-v2
    [*] --> Synced
    Synced --> Editing: focus + beforeinput
    Editing --> Composing: compositionstart
    Composing --> Editing: compositionend / local value 확정
    Editing --> CommitPending: frame commit 예약
    CommitPending --> Editing: 추가 입력을 같은 commit으로 병합
    CommitPending --> Synced: Document revision commit 확인
    Editing --> Synced: blur + 마지막 commit 완료
    Editing --> Synced: Escape 또는 외부 revision reconcile
```

local buffer는 저장되지 않는 별도 문서 모델이 아니다. 활성 편집 요소의 즉각적인 표시와 caret을 책임지는 짧은 수명의 projection이다.

- 최종 데이터 권위는 계속 `DocumentData`에 있다.
- blur, navigation, PDF export 전에 pending commit을 반드시 flush한다.
- `Ctrl/Cmd+Z` history에는 글자마다 거대한 document snapshot을 추가하지 않고 연속 입력 transaction을 시간·target 기준으로 묶는다.
- IME composition 중에는 browser DOM을 덮어쓰지 않는다.
- 외부 transaction이 같은 target을 변경하면 local revision과 document revision을 비교해 명시적으로 reconcile한다.

## Markdown 키보드 입력 순서

Markdown은 local source buffer와 revision 기반 parsed document를 분리한다. 한 source revision을 pagination과 fragment renderer가 독립적으로 파싱하지 않는다.

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant Host as Markdown editing host
    participant Buffer as MarkdownEditBuffer
    participant Parser as MarkdownParseCache
    participant Tx as Document transaction
    participant Plan as RenderPlan
    participant Fragment as Markdown fragments
    participant Page as Pagination coordinator

    User->>Host: 문자·Enter·삭제 입력
    Host->>Buffer: DOM selection을 source range로 변환
    Buffer->>Buffer: local source 변경
    Buffer->>Parser: parse(source, sourceRevision)
    Parser-->>Buffer: parsed blocks 1회 반환
    Buffer->>Host: 활성 block 즉시 갱신 + caret 유지

    Buffer->>Tx: coalesced source commit
    Tx->>Plan: 새 Document revision
    Plan->>Parser: 같은 sourceRevision 조회
    Parser-->>Plan: 기존 parsed blocks 재사용
    Plan->>Page: block metadata 전달
    Page->>Fragment: pagination fragment는 block index만 참조
    Fragment->>Parser: parsed blocks 조회
    Parser-->>Fragment: 같은 객체 반환

    Note over Parser,Fragment: 한 source revision에서 unified/remark parse는 1회만 실행한다.
```

### Markdown parse cache key

```mermaid
flowchart LR
    INPUT["Markdown source"] --> KEY["source identity + revision/hash"]
    KEY --> CACHE{"parse cache hit?"}
    CACHE -->|"예"| AST["기존 ParsedMarkdown 재사용"]
    CACHE -->|"아니오"| PARSE["unified + remark parse 1회"]
    PARSE --> AST

    AST --> BLOCKS["block list"]
    AST --> DEFINITIONS["definitions·footnotes"]
    AST --> POSITIONS["source position map"]

    BLOCKS --> PAGINATION["pagination"]
    BLOCKS --> SCREEN["screen fragments"]
    BLOCKS --> MEASURE["measure fragments"]
    DEFINITIONS --> SCREEN
    POSITIONS --> EDIT["caret·selection editing"]
```

`ParsedMarkdown`은 최소한 다음 파생 데이터를 한 번에 소유한다.

- MDAST root
- block 목록과 block ID
- source 시작·종료 offset
- 추가 빈 줄 정보
- definition과 footnote index
- pagination에 필요한 `keepWithNext` 판단용 block metadata
- editing selection 복원에 필요한 source map

## Document 상태와 selector 경계

최상위 `DocumentData` identity 변경을 모든 UI가 직접 구독하지 않는다. Store는 변경된 key와 revision을 기록하고 각 consumer는 필요한 slice만 구독한다.

```mermaid
flowchart TD
    TX["Document transaction"] --> STORE["DocumentStore commit"]
    STORE --> REV["document revision"]
    STORE --> CHANGE["changed keys<br/>node·style·component·asset"]

    CHANGE --> RENDERSEL["RenderPlan selector"]
    CHANGE --> LAYERSEL["Layer selector"]
    CHANGE --> PROPSEL["Selected property selector"]
    CHANGE --> COMPSEL["Component usage selector"]
    REV --> SAVESEL["Autosave snapshot selector"]

    RENDERSEL --> SCREEN["Memoized screen subtree"]
    LAYERSEL --> LAYER["영향받은 layer rows"]
    PROPSEL --> INSPECTOR["선택된 property fields"]
    COMPSEL --> COMPONENTS["변경된 component entries"]
    SAVESEL --> SAVE["Persistence queue"]

    SAVESTATE["SaveStateStore"] --> INDICATOR["SaveIndicator only"]
    SAVESTATE -. "document renderer와 연결하지 않음" .-> SCREEN
```

### renderer component 경계

```mermaid
flowchart LR
    SHELL["DocumentEditorShell"] --> HEADER["Header"]
    SHELL --> WORKSPACE["Workspace"]
    SHELL --> EXPORT["Conditional PrintExportSurface"]

    HEADER --> SAVE["SaveIndicator subscriber"]
    WORKSPACE --> LAYER["Memoized LayerPanel"]
    WORKSPACE --> PREVIEW["Memoized ScreenDocumentRenderer"]
    WORKSPACE --> INSPECTOR["Memoized PropertyInspector"]

    PREVIEW --> PAGES["Memoized Page[]"]
    PAGES --> UNITS["Memoized RenderUnit[]"]
    UNITS --> NODES["Memoized NodeRenderer subtree"]

    class SAVE isolated
    class EXPORT ondemand
    class PREVIEW,PAGES,UNITS,NODES memo
    classDef isolated fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef ondemand fill:#f3e8ff,stroke:#9333ea,color:#581c87
    classDef memo fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
```

`SaveIndicator`가 `saving`에서 `saved`로 바뀌어도 `ScreenDocumentRenderer` props와 element identity가 유지되어야 한다. 상위 shell이 render되더라도 memo boundary 아래 document subtree는 실행하지 않는다.

## 목표 페이지네이션 계산 순서

페이지네이션은 단일 coordinator가 소유하며 document revision마다 측정 요청을 병합한다.

```mermaid
sequenceDiagram
    autonumber
    participant Store as DocumentStore
    participant Plan as RenderPlan
    participant Coordinator as PaginationCoordinator
    participant Measure as SharedMeasureSurface
    participant Browser as Browser layout
    participant Pages as PaginationStore
    participant Screen as Screen pages

    Store->>Plan: layout에 영향 있는 changed keys
    Plan-->>Coordinator: changed render units + layout fingerprints
    Coordinator->>Coordinator: 이전 height cache에서 재사용 가능한 unit 유지
    Coordinator->>Measure: 변경된 unit 또는 필요한 연속 범위만 render
    Coordinator->>Coordinator: 같은 revision의 measure 요청 병합
    Coordinator->>Browser: requestAnimationFrame measure 1회
    Browser->>Measure: 필요한 element height read
    Measure-->>Coordinator: unit height map
    Coordinator->>Coordinator: 첫 변경 unit부터 repaginate
    Coordinator->>Pages: candidate PaginationResult
    Pages->>Pages: page IDs·unit 배치·overflow 비교
    alt 결과가 변경됨
        Pages->>Screen: 새 PaginationResult publish
        Screen->>Screen: 영향받은 page만 render
    else 결과가 동일함
        Pages-->>Screen: 기존 state identity 유지
    end
```

### 측정 요청 병합

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Scheduled: revision R measure 요청
    Scheduled --> Scheduled: 같은 frame의 추가 요청을 R에 병합
    Scheduled --> Measuring: requestAnimationFrame
    Measuring --> Published: height read + paginate
    Published --> Idle: 결과 publish 또는 equality bail-out
    Measuring --> Scheduled: 측정 중 새 revision R+1 수신
```

측정 정책:

- `document.fonts.ready`는 editor 생명주기에서 한 번만 기다리고 매 revision마다 새 measure를 예약하지 않는다.
- `ResizeObserver` callback과 document revision callback은 같은 scheduler를 사용한다.
- 이미 예약된 animation frame이 있으면 추가 frame을 만들지 않는다.
- width, font, style, content fingerprint가 같은 unit의 height는 재사용한다.
- unit height가 달라졌다면 해당 unit이 포함된 page부터 뒤쪽만 다시 배치한다.
- 기존 `PaginationResult`와 새 결과가 구조적으로 같으면 state를 유지한다.

## 목표 자동 저장 순서

자동 저장은 현재 650ms trailing debounce 의미를 유지하되, save state와 document renderer 상태를 분리한다.

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant Buffer as Local EditBuffer
    participant Store as DocumentStore
    participant Save as AutosaveCoordinator
    participant Status as SaveStateStore
    participant Preload as preload IPC
    participant Main as DocumentRepository
    participant Indicator as SaveIndicator
    participant Renderer as ScreenDocumentRenderer

    User->>Buffer: 연속 입력
    Buffer->>Store: coalesced document commits
    Store->>Save: revision snapshot 전달
    Save->>Save: 이전 650ms timer 취소 후 재등록
    Save->>Status: dirty(revision)
    Status->>Indicator: dirty
    Note over Status,Renderer: Renderer는 SaveStateStore를 구독하지 않는다.

    Save->>Save: 마지막 pending edit flush 확인
    Save->>Status: saving(revision R)
    Status->>Indicator: 상태 표시만 갱신
    Save->>Preload: saveDocument(snapshot R)
    Preload->>Main: IPC
    Main-->>Preload: summary R
    Preload-->>Save: 완료

    alt 저장 중 새 revision 없음
        Save->>Status: saved(revision R)
    else 저장 중 revision R+1 발생
        Save->>Status: dirty(revision R+1)
        Save->>Save: 다음 snapshot 저장 예약
    end
    Status->>Indicator: 상태 표시만 갱신
    Save->>Save: library summary cache 갱신
    Note over Save,Renderer: summary 갱신도 document renderer를 실행하지 않는다.
```

### 저장 불변 조건

- 동시에 둘 이상의 document 파일 쓰기를 실행하지 않는다.
- 저장 요청에는 mutable ref가 아니라 확정된 revision snapshot을 전달한다.
- 저장 완료 summary가 더 최신 revision의 `dirty` 상태를 `saved`로 덮어쓰지 않는다.
- PDF, 문서 닫기, library 이동 전에는 local edit와 autosave를 모두 flush한다.
- 파일 쓰기 실패는 `SaveIndicator`와 retry action에만 반영하고 편집 DOM을 재생성하지 않는다.

## PDF 내보내기 목표 순서

`print`는 상시 renderer mode가 아니라 export job이 소유하는 일시적인 output surface가 된다.

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant Page as DocumentEditorPage
    participant Buffer as Active EditBuffer
    participant Save as AutosaveCoordinator
    participant Export as PdfExportCoordinator
    participant Print as PrintExportSurface
    participant Paginator as PaginationResult
    participant Main as Electron main process

    User->>Page: PDF 내보내기 클릭
    Page->>Buffer: pending edit flush
    Buffer-->>Page: committed revision R
    Page->>Save: saveUntilRevision(R)
    Save-->>Page: revision R 저장 완료
    Page->>Export: export(snapshot R)
    Export->>Print: snapshot R로 mount
    Export->>Paginator: revision R pagination 요청
    Paginator-->>Print: page units 전달
    Print->>Print: print DOM commit
    Print->>Export: printReady(revision R, pageCount)
    Export->>Main: exportPdf(revision R)
    Main->>Main: webContents.printToPDF()
    Main-->>Export: PDF buffer 저장 완료
    Export->>Print: unmount
    Export-->>User: PDF 경로 표시
```

### print readiness 계약

```mermaid
flowchart TD
    MOUNT["PrintExportSurface mount"] --> FONT{"fonts ready?"}
    FONT -->|"아니오"| WAITFONT["fonts.ready 대기"]
    WAITFONT --> PLAN
    FONT -->|"예"| PLAN["snapshot RenderPlan 준비"]
    PLAN --> PAGE{"PaginationResult revision 일치?"}
    PAGE -->|"아니오"| MEASURE["on-demand measure"]
    MEASURE --> COMMIT
    PAGE -->|"예"| COMMIT["print page DOM commit"]
    COMMIT --> FRAME["commit 이후 animation frame 확인"]
    FRAME --> READY["printReady(revision, pageCount)"]
```

`afterNextPaint()`를 두 번 호출하는 암묵적인 준비 방식은 제거한다. Export coordinator는 다음 값이 일치해야만 `printToPDF`를 호출한다.

- 요청한 document revision
- print surface가 보고한 revision
- pagination result revision
- render 완료된 page count
- font readiness

PDF 생성이 성공하거나 실패하면 `finally`에서 print surface를 반드시 unmount한다.

## Current에서 To-Be로 바뀌는 계산

```mermaid
flowchart LR
    subgraph Current["Current"]
        C1["입력마다 screen render"]
        C2["입력마다 print render"]
        C3["screen measure"]
        C4["print measure"]
        C5["fragment마다 Markdown parse"]
        C6["saving/saved마다 전체 render"]
    end

    subgraph Target["To-Be"]
        T1["local input 즉시 표시"]
        T2["screen 영향 subtree만 render"]
        T3["shared measure 1회"]
        T4["source revision마다 parse 1회"]
        T5["save indicator만 render"]
        T6["PDF 요청 때 print mount"]
    end

    C1 --> T1
    C1 --> T2
    C2 --> T6
    C3 --> T3
    C4 --> T3
    C5 --> T4
    C6 --> T5
```

| Current | To-Be | 제거되는 작업 |
|---|---|---|
| 편집 중 print renderer 상시 mount | PDF 요청 중에만 mount | 일반 입력 시 print visible·measure render 전체 |
| screen과 print가 각각 pagination 측정 | screen 결과 공유, 다를 때만 on-demand print 측정 | 같은 document의 중복 높이 측정 |
| fragment마다 전체 Markdown source 파싱 | source revision별 `ParsedMarkdown` 공유 | 동일 AST 재생성과 GC |
| `preventDefault` 후 전체 document commit을 기다려 표시 | local edit buffer에서 먼저 표시 | 입력 표시가 전체 renderer 시간에 종속되는 문제 |
| save state가 page 최상단을 갱신 | 별도 `SaveStateStore`와 indicator subscriber | `saving`, `saved` 시 document subtree 실행 |
| 모든 panel이 전체 `DocumentData` 구독 | changed-key selector 구독 | 선택과 무관한 row·field render |
| 측정 요청마다 새 animation frame | revision-aware scheduler로 병합 | initial/font/resize 중복 measure |
| `setPages` 항상 실행 | pagination equality bail-out | 결과가 같은 page stack render |

## 목표 모듈 책임 지도

```mermaid
flowchart LR
    subgraph Input["입력"]
        TEXT["TextEditBuffer"]
        MARKDOWN["MarkdownEditBuffer"]
        COMMIT["EditCommitCoordinator"]
    end

    subgraph State["상태"]
        STORE["DocumentStore"]
        HISTORY["DocumentHistory"]
        SELECTORS["changed-key selectors"]
    end

    subgraph Derived["파생 계산"]
        MDCACHE["MarkdownParseCache"]
        PLAN["RenderPlanCache"]
        PAGINATION["PaginationCoordinator"]
        HEIGHTS["UnitHeightCache"]
    end

    subgraph UI["화면"]
        SCREEN["ScreenDocumentRenderer"]
        PANELS["Layer·Component·Inspector"]
        SAVEUI["SaveIndicator"]
    end

    subgraph Persistence["저장·출력"]
        AUTOSAVE["AutosaveCoordinator"]
        SAVESTATE["SaveStateStore"]
        EXPORT["PdfExportCoordinator"]
        PRINT["PrintExportSurface"]
        IPC["preload·main repository"]
    end

    TEXT --> COMMIT
    MARKDOWN --> MDCACHE
    MARKDOWN --> COMMIT
    COMMIT --> STORE
    STORE --> HISTORY
    STORE --> SELECTORS
    SELECTORS --> PLAN
    PLAN --> MDCACHE
    PLAN --> PAGINATION
    PAGINATION --> HEIGHTS
    PLAN --> SCREEN
    PAGINATION --> SCREEN
    SELECTORS --> PANELS
    STORE --> AUTOSAVE
    AUTOSAVE --> SAVESTATE
    SAVESTATE --> SAVEUI
    AUTOSAVE --> IPC
    EXPORT --> PRINT
    EXPORT --> IPC
    PLAN --> PRINT
    PAGINATION --> PRINT
```

이 이름들은 반드시 새 파일 하나씩을 만들라는 의미가 아니다. 중요한 것은 책임과 구독 경계를 코드에서 분리하는 것이다. 기존 모듈을 확장해도 해당 경계와 불변 조건을 지키면 된다.

## 단계별 변경 순서

```mermaid
flowchart TD
    P0["0. 성능 계측과 회귀 기준 고정"] --> P1["1. print renderer on-demand 전환"]
    P1 --> P2["2. save state와 renderer 경계 분리"]
    P2 --> P3["3. Markdown parse 결과 공유"]
    P3 --> P4["4. pagination 단일 coordinator·측정 병합"]
    P4 --> P5["5. local edit buffer와 subtree memoization"]
    P5 --> P6["6. selector 기반 panel 갱신"]
    P6 --> P7["7. 전체 Electron 성능·PDF 회귀 검증"]

    class P1,P2 quick
    class P3,P4 core
    class P5,P6 interaction
    classDef quick fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef core fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef interaction fill:#fef3c7,stroke:#d97706,color:#78350f
```

### 0. 계측 고정

- 실제 이력서 fixture로 입력, 요소 추가, 저장, PDF 시간을 측정한다.
- `MarkdownParseCache` miss 횟수, renderer commit 횟수, pagination measure 횟수를 기록한다.
- React commit과 browser long task 기준을 자동화한다.

### 1. print renderer on-demand

- 일반 editor JSX에서 상시 `.document-print-surface`를 제거한다.
- `exportDocument` snapshot이 있을 때만 `PrintExportSurface`를 mount한다.
- `printReady(revision)` 후 `printToPDF`를 호출하고 완료 후 unmount한다.
- PDF의 페이지 수, 줄바꿈, decoration, continuation border를 기존 결과와 비교한다.

### 2. save state 격리

- `SaveIndicator`가 save state를 직접 구독하게 한다.
- document renderer props가 save lifecycle 동안 동일 identity를 유지하도록 한다.
- library summary updater를 stable callback으로 만들고 editor subtree와 분리한다.

### 3. Markdown parse 공유

- `parseMarkdownBlocks(source)` 결과를 source revision 기준으로 캐시한다.
- pagination, editable renderer, read-only renderer가 같은 `ParsedMarkdown`을 받는다.
- cache invalidation은 변경된 Markdown source에만 적용한다.

### 4. 페이지네이션 단일화

- screen과 print의 pagination 소유권을 하나로 합친다.
- font, resize, revision callback을 scheduler 하나로 모은다.
- 동일한 page 배치에는 state update를 생략한다.
- 이후 unit fingerprint와 부분 높이 재측정을 적용한다.

### 5. 입력 fast path

- 활성 text·rich-text·Markdown에 local buffer를 도입한다.
- IME composition, paste, Enter, 삭제, inline format과 caret을 회귀 테스트한다.
- Document commit과 Undo history를 coalescing한다.
- 무거운 파생 계산은 입력 DOM commit 이후 우선순위로 실행한다.

### 6. panel selector와 memoization

- 레이어 row는 자신의 node, selection, collapse, drag 상태만 구독한다.
- Inspector는 선택된 target과 연결된 style·prop만 구독한다.
- component 사용 횟수는 component/repeater 관련 변경 때만 다시 계산한다.

### 7. Electron 검증

- production build에서 실제 한국어 입력을 측정한다.
- 요소 추가·삭제·복제·숨김·drag reorder를 측정한다.
- 자동 저장 중 입력이 끊기지 않는지 확인한다.
- PDF 직전 pending edit flush와 snapshot revision 일치를 확인한다.
- screen과 PDF의 페이지 수 및 시각 결과를 스크린샷으로 비교한다.

## 회귀 방지 테스트 계약

| 영역 | 필수 검증 |
|---|---|
| text·rich-text | 문자 입력, 삭제, 줄바꿈, paste, caret, selection format |
| 한국어 IME | composition 중 DOM 보존, compositionend 이후 값·caret 일치 |
| Markdown | block shortcut, 인용문, 목록, 빈 줄, link, inline format, source map |
| component | instance prop 직접 편집과 definition 격리 |
| repeater | item별 prop 편집과 selection identity 유지 |
| history | 연속 입력 Undo/Redo, 구조 transaction과 입력 transaction 순서 |
| pagination | keepTogether, keepWithNext, forced break, continuation style |
| save | debounce, in-flight 변경, 실패 retry, 최신 revision 보존 |
| PDF | pending edit flush, font readiness, page count, print surface cleanup |
| UI | selection outline과 action UI가 measure·PDF에 포함되지 않음 |

## 완료 조건

- [ ] 일반 편집 상태에서 `PrintExportSurface`가 DOM에 존재하지 않는다.
- [ ] PDF 내보내기 중에만 print surface가 mount되고 완료 후 제거된다.
- [ ] PDF가 요청한 document revision과 print-ready revision이 일치한다.
- [ ] 동일 Markdown source revision의 실제 parse 횟수가 1회다.
- [ ] save state 변경만으로 screen renderer commit이 발생하지 않는다.
- [ ] 입력 중 screen과 print의 독립 pagination 계산이 동시에 실행되지 않는다.
- [ ] 동일 pagination 결과에는 page state update가 발생하지 않는다.
- [ ] 일반 입력 표시가 50ms 이내이며 50ms 이상의 long task가 없다.
- [ ] 요소 추가·삭제·복제 결과가 100ms 이내에 표시된다.
- [ ] 한국어 IME, caret, 직접 Markdown 편집과 Undo/Redo가 유지된다.
- [ ] screen과 PDF의 페이지 수·줄바꿈·스타일이 일치한다.
- [ ] typecheck, 전체 테스트, production build와 Electron 실제 동작 검증이 통과한다.

## 이 문서에서 확정하는 결정

1. `print`는 상시 renderer mode가 아니라 PDF export job이 소유하는 on-demand output surface로 변경한다.
2. 평상시 편집의 페이지네이션 측정 소유자는 하나만 둔다.
3. 활성 입력은 전체 document render보다 먼저 local buffer에서 표시한다.
4. Markdown parsing 결과는 pagination과 renderer가 source revision 단위로 공유한다.
5. 저장 상태와 library summary 갱신은 document renderer render 경계 밖에서 처리한다.
6. 페이지네이션은 revision-aware scheduler와 equality bail-out을 사용한다.
7. 성능 개선은 출력 정확도, IME, caret, Undo/Redo를 희생하지 않는다.
