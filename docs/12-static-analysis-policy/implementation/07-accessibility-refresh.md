# F07. 접근성과 Fast Refresh 검사 구현 설계

2026-11-08 · 구현·필수 검증 완료 · As-Is 코드 `989a7f6`, 적용 기준 `74c05a8`

[기능 기획](../features/07-accessibility-refresh.md) · [설계 요약](README.md) · [정책](policy.md) · [계획](../plan.md) · [테스트 계획·결과](../tests/07-accessibility-refresh.md)

## 1. 목표와 현재 근거

**명확한 접근성 오류와 검토가 필요한 경고를 구분하고 Vite export 경계를 검사한다.**

- 관련 인수 조건: F07-AC1·F07-AC2, 공통 AC03·AC04·AC07.
- 별도 plugin 실험에서 a11y 13건·Refresh 11건이 있었으며 실제 결함 개수로 단정하지 않는다.
- plugin 규칙과 severity는 [policy](policy.md)의 접근성·Fast Refresh 절을 따른다.

## 2. 수정 파일과 방식

| 파일·대상 | As-Is | To-Be |
|---|---|---|
| [label.tsx](../../../client/src/renderer/src/shared/ui/label.tsx)·[ComponentReusePanel](../../../client/src/renderer/src/pages/document-editor/ComponentReusePanel.tsx) | wrapper·label 정적 진단 | htmlFor·id·중첩 연결을 확인하고 custom mapping 또는 국소 예외 |
| [EditableTextValue](../../../client/src/renderer/src/pages/document-editor/rendering/EditableTextValue.tsx) | focus 관련 진단 | 실제 focus 계약 확인 후 경고 이유 기록 |
| [DocumentLibraryPage](../../../client/src/renderer/src/pages/document-library/DocumentLibraryPage.tsx) | 이름 수정 autoFocus | 사용자 입력 진입 동작 유지하며 경고 검토 |
| client/eslint.config.mjs | 미구현 | 확정한 a11y 규칙과 only-export-components warn 추가 |
| 혼합 export 파일 | Refresh 경고 후보 | Vite allowConstantExport=true 적용 후 실제 진단 목록 확정 |

- alt·ARIA·label 오류를 먼저 해결하고 키보드·focus·static interaction은 warn으로 둔다.
- wrapper는 실제 DOM 연결을 확인한 뒤 mapping을 지정하며 component 이름만으로 모든 label을 허용하지 않는다.
- 캔버스 클릭에 키 이벤트를 기계적으로 더해 선택·편집을 중복 실행하지 않는다.
- Refresh를 위해 public export 구조를 무조건 쪼개지 않고 필요한 경우 import 호출부와 함께 수정한다.

## 3. 계약·대안·검증

- 새 저장 데이터·비동기 protocol은 없고 기존 focus·selection·접근 가능한 이름을 보존한다.
- 대안: recommended 전체 오류화는 wrapper·편집 영역의 맥락을 놓쳐 채택하지 않는다.
- 검증 범위·절차·통과 기준·실행 결과: [대응 테스트 문서](../tests/07-accessibility-refresh.md).
- 클릭·focus 변경 시 기존 직접 편집·keyboard·IME 회귀를 F06 기준으로 확인한다.
- F07 완료 후 [plan](../plan.md)의 전체 검사 gate를 실행한다.
- 실패 시 관련 mapping·UI 변경만 수정하고 오류 규칙 전체를 끄지 않는다.
- 이 문서의 범위는 규칙 severity와 label/ARIA 속성 대응이며 처리 순서나 상태 전이가 선택 기준이 아니다. 파일별 속성·mapping 표로 설명하고 별도 도식은 생략한다. 실제 focus·편집 수명을 바꾸는 수정이 필요해지면 [F06](06-react-behavior.md)의 수명 도식과 함께 해당 흐름을 설계에 추가한다.

## 착수 시 확인한 적용 방식

- jsx-a11y 6.10.2의 eslint peer는 9까지다. F06과 같은 공식 compat adapter와 이 plugin에 한정한 eslint peer override를 사용한다. 이는 공식 ESLint 10 지원 선언이 아니며 실제 선택 규칙 실행으로 호환성을 검증한다.
- renderer TSX 범위에 확정한 접근성 규칙과 Refresh warn을 추가한다. Refresh는 설치된 0.5.7의 plugin export를 확인해 연결하며 allowConstantExport=true를 명시한다.
- Label·FieldLabel은 htmlFor를 명시적으로 전달한다. labelComponents는 Label·FieldLabel, controlComponents는 확인한 Input·Switch·SelectControl만 지정하고 depth=3·assert=either로 검사한다. 소문자 native label 오류는 계속 검사한다. SelectControl은 Base UI SelectTrigger의 labelable button을 반환하며 실제 DOM label.control·labels를 시험한다. 전체 label 규칙을 끄거나 포괄적인 이름 wildcard를 사용하지 않는다.
- 테스트는 오류/경고 fixture와 실제 DOM label-control 관계, 경고만 있는 CLI 종료 코드, 기존 canvas·이름 수정 진입 회귀를 사용한다. 제품 focus·키보드 handler를 추가하는 변경은 계획하지 않는다.

## 적용 후 확인한 동작

- Label·FieldLabel의 htmlFor 전달을 명시해 두 wrapper 내부의 검사 경계를 드러냈다. children·나머지 props 전달과 실제 DOM 동작은 유지한다.
- 별도 접근성 disable 없이 labelComponents/controlComponents의 정확한 목록으로 오류를 해결했다. 실제 Label·FieldLabel의 input.labels와 SelectControl의 label.control/button.labels 연결을 확인했다.
- `test/accessibility-refresh.test.ts`와 실제 컴포넌트 harness가 alt·ARIA·native/custom label 오류, 접근성 경고 4종, Refresh 상수/함수 export, 이름 변경 focus·Enter 단일 실행을 검증한다. `npm run test:accessibility`를 기본 suite에 연결했다.
- root README에는 최종 `npm run check`와 정책·검증 문서 경로를 추가한다. 최종 파일 목록과 effective config는 공통 G02, 전체 검사 결과는 G03이 소유한다.
- focus·canvas handler·editor activation은 수정하지 않았다. 기존 F06 실제 native IME와 최종 Electron 회귀 결과를 연결한다.

- 최종 오류는 0개이며 경고 69개를 유지한다. Hooks 45개는 F06의 수명 보존 판단, 접근성 13개는 기존 canvas/직접 편집·focus 계약, Refresh 11개는 혼합 export에 해당한다. 상세 위치·검증 한계는 [F07 테스트](../tests/07-accessibility-refresh.md)에 기록했다.
- 최종 G02·G03과 이 기능의 필수 검증을 모두 통과했다. 도식이 필요한 새로운 흐름이나 상태 전이는 추가하지 않았다.

- 최종 통합에서 F06 테스트의 dirty 알림과 DOM 반영 사이 대기 경쟁이 드러나 `aria-checked` 조건 대기로 수정했다. 제품 상태나 편집 수명 변경 없이 대상 회귀와 전체 suite를 재검증했다.
