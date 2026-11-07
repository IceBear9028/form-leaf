# F07. 접근성과 Fast Refresh 검사 구현 설계

2026-11-08 · 설계 확정·구현 대기 · As-Is 코드 `989a7f6`

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
