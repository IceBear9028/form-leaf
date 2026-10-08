# shadcn/ui 적용 계획

## 목적

직접 만든 공통 UI primitive와 화면마다 반복되는 색상·테두리·focus class를 걷어내고 애플리케이션 UI를 shadcn/ui의 공식 스타일과 접근성 동작으로 통일한다.

이 작업은 애플리케이션 chrome에만 적용한다. 저장된 문서의 내용, 이력서 미리보기, A4 출력, PDF, Markdown 본문 스타일과 사용자가 설정하는 document style token은 변경하지 않는다.

## 조사 기준

2026-10-08 기준 다음 공식 문서를 확인했다.

- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [shadcn/ui Vite 설치](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Monorepo와 aliases](https://ui.shadcn.com/docs/monorepo)

shadcn/ui는 완성된 UI 패키지를 import해 숨겨진 구현을 사용하는 방식이 아니다. CLI로 필요한 컴포넌트 소스를 프로젝트에 추가하고 애플리케이션이 그 소스를 직접 소유한다. 생성된 UI 파일은 `renderer/src/shared/ui`에 두고, 페이지 컴포넌트는 해당 primitive를 조합한다. 현재 선택한 공식 `base-vega` registry는 Base UI와 `cn` 패키지를 사용한다.

## 스타일 기준

- 앱 UI는 공식 `base-vega`, Neutral base color, Lime theme·chart color, CSS variables, `lucide` 아이콘 구성을 기준으로 한다.
- shadcn 컴포넌트의 기본 색상, radius, shadow, typography, focus ring을 현재 앱 디자인에 맞춰 다시 덮어쓰지 않는다.
- `className` 추가는 grid, flex, width, spacing, Electron drag region처럼 화면 배치에 필요한 경우로 제한한다.
- 애플리케이션 UI theme은 `background`, `foreground`, `primary`, `muted`, `destructive`, `border`, `ring` 같은 shadcn semantic token을 사용한다.
- `--resume-*`, `--markdown-*` document token은 shadcn theme과 분리한다.
- dark mode는 이번 작업에 포함하지 않는다. token 구조만 향후 추가 가능하게 유지한다.

## 설치와 파일 위치

구조 리팩터링과 `app` → `client` 이름 변경이 끝난 뒤 `client`에서 Vite 기존 프로젝트 방식으로 초기화한다.

```text
client/
├─ components.json
└─ src/renderer/src/
   ├─ app/
   │  └─ global.css
   └─ shared/
      ├─ ui/                        # shadcn CLI가 추가한 primitive
      ├─ components/                # 여러 페이지가 공유하는 조합 컴포넌트
      ├─ hooks/
      └─ lib/
         └─ utils.ts               # cn helper
```

`components.json`의 목표 설정은 다음과 같다.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-vega",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/app/global.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/shared/components",
    "ui": "@/shared/ui",
    "hooks": "@/shared/hooks",
    "lib": "@/shared/lib",
    "utils": "@/shared/lib/utils"
  }
}
```

`@`는 `client/src/renderer/src`를 가리키도록 TypeScript와 electron-vite의 renderer alias를 함께 설정한다. CLI가 `global.css`, TypeScript 설정 또는 build 설정을 덮어쓰도록 두지 않고 생성 diff를 검토해 병합한다.

Electron Vite 프로젝트는 shadcn CLI의 자동 framework 판별 대상이 아니므로 공식 manual installation 절차를 적용한다. `shadcn`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`와 Base UI 의존성을 설치하고, `shared/lib/utils.ts`에서는 공식 예시대로 `cn`을 재노출한다. 컴포넌트 소스 자체는 CLI `add`로 생성한다.

## 필요한 컴포넌트

| shadcn/ui | 현재 교체 대상 | 적용 위치 |
|---|---|---|
| `Button` | `primaryButtonClass`, `secondaryButtonClass`, `dangerButtonClass`, `AddButton`, icon button | 전체 앱 toolbar, 목록, 편집기 |
| `ButtonGroup` | 직접 만든 확대·축소 3버튼 그룹 | document editor toolbar |
| `Card` | 문서 tile, 휴지통 row, 편집 항목 card | document library, document editor |
| `Dialog` | 직접 만든 이름 변경 `Modal` | document library |
| `AlertDialog` | 휴지통 이동 및 완전 삭제 확인 `Modal` | document library, trash |
| `DropdownMenu` | 문서 card의 이름 변경·삭제 icon action | document library |
| `Field` | 직접 만든 `Field` label/layout와 도움말 | document editor, 이름 변경 dialog |
| `Input` | 일반 input, 링크 label/URL, 날짜 범위 | document editor |
| `Textarea` | Markdown 원문 textarea | document editor |
| `Select` | 스타일 preset native select | document editor |
| `Accordion` | 이력서 섹션의 직접 만든 `<details>` | resume editor |
| `Collapsible` | 경력·프로젝트 개별 항목의 `<details>` | resume editor |
| `Switch` | 섹션과 항목의 표시/숨김 checkbox | resume editor |
| `Empty` | 문서 목록과 휴지통의 직접 만든 빈 상태 | document library, trash |
| `Alert` | 목록 로드 오류, 저장 오류의 직접 만든 banner | app, document library |
| `Badge` | 휴지통 개수, 항목 개수, 저장 상태 보조 표시 | toolbar, library, editor |
| `Tooltip` | 이름 변경·삭제·정렬·확대/축소 icon button의 `title` | 전체 앱 UI |
| `Spinner` | 전체 로딩 spinner, button busy text의 보조 indicator, card busy overlay | app, library, editor |
| `Toast` | PDF 저장 완료와 복원 완료의 직접 만든 status UI | app root |

아이콘은 현재 파일 안에 직접 작성한 `DocumentIcon`, `TrashIcon`, `EditIcon`, `BackIcon`, `PdfIcon` SVG를 제거하고 `lucide-react` 아이콘을 사용한다.

## 적용하지 않을 컴포넌트

| 컴포넌트 | 제외 이유 |
|---|---|
| `Data Table` | 문서 목록은 card가 핵심이며 표 정렬·열 기능이 없다. |
| `Sidebar` / `Navigation Menu` | 현재 최상위 화면은 목록·휴지통·편집뿐이며 상시 탐색 구조가 없다. |
| `Resizable` | 편집기와 미리보기 폭 조절은 기존 기능이 아니므로 UI 교체에 새 동작을 섞지 않는다. |
| `Scroll Area` | 현재 native scrolling으로 충분하며 Electron의 스크롤 동작을 바꿀 이유가 없다. |
| `Checkbox` | 현재 boolean 제어는 표시/숨김이므로 `Switch`가 의미에 더 맞다. |
| `Form` 및 외부 form library | 현재 입력은 자동 저장되는 controlled field이고 submit validation form이 아니다. |
| `Skeleton` | 초기 목록은 짧은 로컬 로딩이며 `Spinner` 하나로 충분하다. |
| `Table`, `Calendar`, `Date Picker` | 현재 날짜는 자유 형식 문자열이고 표·달력 기능이 없다. |

필요하지 않은 컴포넌트를 미래 사용 가능성만으로 설치하지 않는다.

## 현재 직접 구현 코드의 처리

다음 코드는 shadcn 적용 단계에서 제거한다.

- `DocumentLibraryPage.tsx`의 `Modal`, `ModalActions`, `CardAction`, `ErrorBanner`, `EmptyLibrary`, button class 상수
- `EditorPrimitives.tsx`의 `Field`, `Accordion`, `AddButton`과 input/button class 상수
- `EditorPanel.tsx`의 반복 input, checkbox, details/summary visual class
- `App.tsx`의 zoom button class, 직접 만든 loading spinner, PDF 성공 status UI
- 공통 목적으로 직접 작성한 SVG icon

페이지 의미를 담은 `DocumentCard`, `SaveIndicator`, `EditorSection` 같은 조합 컴포넌트는 유지할 수 있다. 이들은 스타일 primitive를 새로 만들지 않고 shadcn 컴포넌트를 조합해야 한다. `AppButton`, `AppDialog`처럼 shadcn API를 그대로 한 번 더 감싸는 wrapper는 만들지 않는다.

Markdown 선택 toolbar는 문서 내용이 아니라 편집용 UI chrome이다. `ButtonGroup`, `Button`, `Tooltip`으로 바꾸되 selection, source offset, keyboard shortcut과 `contentEditable` 동작은 변경하지 않는다. 기존 `resumeDocument.css`에서 toolbar의 시각 규칙만 애플리케이션 UI 쪽으로 제거하고, 문서 본문 규칙은 유지한다.

## document 스타일 보호 규칙

shadcn 적용은 다음 파일과 결과를 변경하지 않아야 한다.

- `resumeDocument.css`의 A4 크기, pagination, typography와 Markdown 본문 규칙
- `pages/document-editor/style`의 preset schema와 CSS variable 변환
- style preset과 `toCssVariables.ts`가 만드는 `--resume-*`, `--markdown-*` 값
- 실제 미리보기와 측정용 DOM에 같은 변수를 적용하는 흐름
- PDF 출력 결과

현재 Tailwind 설정은 theme과 utilities를 사용하지만 일반적인 preflight 전체를 가져오지 않는다. shadcn CLI 초기화 결과가 `@import "tailwindcss"` 또는 광범위한 base reset을 추가하면 document DOM의 heading, list, button, border 측정이 달라질 수 있다. 따라서 CLI가 CSS를 자동으로 덮어쓰게 하지 않고 다음 원칙으로 병합한다.

1. shadcn semantic token과 UI용 base rule은 `app/global.css`에서 관리한다.
2. document 전용 selector와 token은 `resumeDocument.css`에 유지한다.
3. 전역 reset을 추가하기 전 preview와 PDF 계산에 미치는 영향을 확인한다.
4. UI 교체 전후 동일 fixture의 페이지 수, overflow, 주요 computed style과 PDF를 비교한다.

10단계 설정에서는 `@import "tailwindcss"` 전체와 전역 `* { @apply ... }`를 추가하지 않았다. 기존 theme/utilities import를 유지한 채 `tw-animate-css`, `shadcn/tailwind.css`, semantic token mapping만 병합했다. 이 상태에서 기준 fixture의 preview 2페이지, overflow 0개, 1123.992px 높이, 문서 글꼴과 흰 배경이 9단계 기준값과 동일함을 확인했다.

## 구현 순서

shadcn/ui 변경은 이번 구조 리팩터링의 마지막 코드 변경으로 진행한다.

1. `client`, `foundation`, main/preload/renderer 경계 이동 완료
2. document 명칭 변경과 저장·IPC·migration 테스트 통과
3. Renderer `app/pages/shared` 구조 이동과 기존 UI 그대로 회귀 검증
4. 큰 컴포넌트의 상태·순수 로직·DOM adapter 분리 완료
5. 전체 테스트와 production build 통과
6. 그 다음에만 shadcn/ui 초기화와 공통 UI 교체 시작
7. shared UI primitive 추가
8. document library와 trash 교체
9. document editor form과 toolbar 교체
10. 직접 구현 primitive와 사용하지 않는 class 제거
11. 최종 UI·키보드·document preview·PDF 회귀 검증

구조 이동 중에는 shadcn 컴포넌트를 일부만 섞지 않는다. 기존 구조가 안정된 시점에 UI 교체를 별도 커밋 묶음으로 진행한다.

## 완료 기준

- 앱 UI가 shadcn/ui 공식 semantic token, spacing, radius, focus, destructive variant를 따른다.
- 기존 hard-coded 앱 UI 색상과 button/input/modal class 상수가 제거된다.
- 키보드 focus, Escape 닫기, dialog focus trap, tooltip과 destructive confirmation이 동작한다.
- Electron draggable header 안의 interactive control에는 `-webkit-app-region: no-drag`가 유지된다.
- 목록 CRUD, 휴지통, 복원, 완전 삭제, 자동 저장, PDF 내보내기 동작이 유지된다.
- Markdown 직접 편집, IME, selection toolbar와 source offset 동작이 유지된다.
- document preview의 페이지 수, overflow 판정, typography, Markdown 스타일과 PDF가 UI 교체 전과 동일하다.
- 관련 테스트, typecheck와 production build가 통과한다.

## 11단계 적용 결과

- document library card와 action을 `Card`, `DropdownMenu`, `Button`, `Badge`, `Tooltip`로 교체했다.
- 이름 변경은 `Dialog`, 휴지통 이동과 완전 삭제는 `AlertDialog`를 사용한다.
- 빈 목록·휴지통은 `Empty`, 오류는 `Alert`, 처리 중 상태는 `Spinner`, 복원·PDF 완료는 `Toast`를 사용한다.
- editor toolbar는 `Button`, `ButtonGroup`, `Badge`, Lucide 아이콘으로 교체했다.
- editor form은 `Field`, `Input`, `Textarea`, `Select`, `Accordion`, `Collapsible`, `Switch`로 교체했다.
- Markdown selection toolbar는 `ButtonGroup`, `Button`, `Tooltip`을 사용하되 selection과 source offset 로직은 유지했다.
- 앱 UI의 직접 작성 button/input/modal class 상수와 공통 목적 SVG 아이콘을 제거했다.
- `resumeDocument.css`에서는 selection toolbar의 앱 UI 시각 규칙만 제거했고 A4·본문·pagination·인쇄 규칙은 유지했다.

실제 Electron에서 Dropdown, Dialog autofocus와 Escape 닫기, AlertDialog 취소, Accordion, Switch, Select, Markdown toolbar, 휴지통 복원 Toast를 확인했다. 자동 테스트 33개와 production build도 통과했다.

## 12단계 최종 검증

신규 임시 저장소에서 생성·자동 저장·최근 수정 순·이름 변경·휴지통 이동·복원·완전 삭제와 재실행 영속성을 확인했다. Markdown selection toolbar로 적용한 굵게 원문도 재실행 후 유지됐다. 앱 UI 변경 전후 preview의 2페이지, overflow 0개, 1123.992px 높이와 문서 typography가 같고, 실제 UI에서 생성한 42KB PDF가 유효한 PDF 1.4 1페이지 파일임을 확인했다.

## 후속 Vega·Lime 전환

- 사용자가 선택한 공식 preset `b3REd6hAe`를 기준으로 `base-vega`, Neutral base color, Lime theme·chart color를 적용했다.
- 설치된 UI primitive는 `base-vega` registry 원본으로 다시 생성했다.
- 전체 Tailwind preflight를 사용하지 않는 구조에서는 단순 `border`가 브라우저 기본 검정색을 상속할 수 있으므로, 앱 chrome의 Empty·header·editor panel·accordion 경계에 `border-border`를 명시했다.
- 검은색을 임의의 포인트 색상으로 사용하지 않고 primary action과 Switch는 공식 Lime semantic token을 사용한다. dialog backdrop의 `bg-black/10`처럼 콘텐츠 가독성을 위한 투명 overlay만 유지한다.
- 실제 Electron에서 Empty 점선, toolbar, editor panel과 accordion 경계가 Neutral border로 표시되고 주요 action이 Lime으로 표시되는 것을 확인했다.
- document preview는 2페이지, overflow 0개, 1123.992px 높이, 기존 Pretendard와 흰 배경을 유지했다.
