# F04. 타입 안전성과 제어 흐름

2026-11-08 · 기획 확정 · 구현·검증 완료 · 코드 기준 `989a7f6`

[기능 목록](README.md) · [대응 구현 설계](../implementation/04-type-safety.md) · [계획](../plan.md) · [테스트 계획·결과](../tests/04-type-safety.md)

## 1. 문제와 사용자

**인덱스 부재·외부 입력·미사용 값·반환 경로가 현재 검사에서 충분히 드러나지 않는다.**

- 목표: 개발자가 실제 부재와 오류 계약을 유지하면서 타입 진단을 해결한다.
- 사용자: 제품·테스트를 수정하는 개발자와 리뷰어, 해당 동작을 사용하는 문서 편집 사용자.

## 2. 사용 흐름과 요구

**수정 후 검사를 실행하고 동작 계약까지 확인한다.**

1. 개발자가 ID 조회 결과나 외부 응답을 처리하는 코드를 수정한다.
2. 검사는 부재 가능성·검증되지 않은 값·누락된 반환을 드러낸다.
3. 개발자는 정상 부재와 오류를 구분해 기존 계약에 맞게 처리한다.

- 일반 미사용 값은 제거하고 필요한 위치 인자·rest 제외만 허용한다.
- 전역 exactOptionalPropertyTypes는 끄고 skipLibCheck는 유지한다.
- Error 원인과 기존 실패 코드·정상 반환 의미를 보존한다.

## 3. 범위·대안·의존성

- 정책 추적: D02·D03·D07–D12, 추가 TS 규칙, AC02·AC03; 정확한 설정값은 [공통 정책](../implementation/policy.md)이 소유한다.
- 선행 기능: F03.
- 제외: 다른 기능의 규칙 수정과 사용자 데이터·schema migration.
- 선택 이유: cast와 non-null assertion은 수정량이 적지만 보장을 추가하지 않는다. 부재 검사·기존 validator 재사용을 선택한다.
- 실패 시: 기존 저장·편집 계약을 유지하고 이 기능의 수정 범위에서 재검토한다.

## 4. 인수 조건

| ID | Given — 전제 | When — 행동 | Then — 관찰 결과 |
|---|---|---|---|
| F04-AC1 | 부재할 수 있는 인덱스나 검증되지 않은 외부 값 | 조회·파싱·사용 | 부재 분기 또는 경계 검증을 거친 값만 사용한다 |
| F04-AC2 | 미지원 operation·정상 선택 속성·정리 코드 | 엄격 규칙 적용 | undefined 반환·선택 속성 허용·finally cleanup을 유지한다 |

- 영향 파일은 [구현 설계](../implementation/04-type-safety.md), 테스트 절차·통과 기준·실행 결과는 [테스트 문서](../tests/04-type-safety.md)가 소유한다.
- 기능 상태·커밋은 [계획](../plan.md), 결과 요약·재개 지점은 [인수인계](../handoff.md)에 기록한다.

## 적용 결과

확정 compiler 옵션과 JS/TS recommendedTypeChecked 규칙을 활성화했다. 정상 부재는 optional 분기로, 필수 node/component/prop/배열 offset은 기존 오류 또는 requiredValue의 실제 검사로 좁혔다. IPC context/reply·cursor·font JSON·screenshot SDK 응답은 unknown에서 schema/guard를 거친다. 미지원 operation의 undefined 반환을 명시하고 저장·migration 오류의 원본/cause를 보존했다. CSS 선언은 전역 css.d.ts가 소유하며 제어 문자 거부 regex 3곳만 사유를 남겨 국소 예외로 유지한다.
