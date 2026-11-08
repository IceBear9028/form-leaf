# F07. 접근성과 Fast Refresh 검사

2026-11-08 · 구현·필수 검증 완료 · 적용 기준 `74c05a8` + F07 작업 트리

[기능 목록](README.md) · [대응 구현 설계](../implementation/07-accessibility-refresh.md) · [계획](../plan.md) · [테스트 계획·결과](../tests/07-accessibility-refresh.md)

## 1. 문제와 사용자

**접근성·export 경계의 정적 진단과 wrapper 오탐을 구분할 기준이 필요하다.**

- 목표: 개발자는 명확한 접근성 오류를 잡고 사용자는 기존 focus·편집 동작을 유지한다.
- 사용자: 제품·테스트를 수정하는 개발자와 리뷰어, 해당 동작을 사용하는 문서 편집 사용자.

## 2. 사용 흐름과 요구

**수정 후 검사를 실행하고 동작 계약까지 확인한다.**

1. 개발자가 label·ARIA·focus 동작 또는 컴포넌트 export를 수정한다.
2. 검사는 명확한 오류와 맥락 검토가 필요한 경고를 구분해 표시한다.
3. 개발자는 실제 DOM 연결과 편집 동작을 확인해 수정하거나 예외를 기록한다.

- label·alt·ARIA 오류와 키보드·focus 경고를 구분한다.
- Vite에 맞는 Refresh 옵션을 사용한다.
- prop 정렬·포맷·불필요한 prop-types는 범위에 넣지 않는다.

## 3. 범위·대안·의존성

- 정책 추적: 추가 접근성·Refresh 정책, AC03·AC04·AC07; 정확한 설정값은 [공통 정책](../implementation/policy.md)이 소유한다.
- 선행 기능: F06.
- 제외: 다른 기능의 규칙 수정과 사용자 데이터·schema migration.
- 선택 이유: recommended preset 전체 오류화 대신 확정한 규칙만 적용한다. mapping을 유지하는 비용으로 wrapper의 실제 계약을 반영한다.
- 실패 시: 기존 저장·편집 계약을 유지하고 이 기능의 수정 범위에서 재검토한다.

## 4. 인수 조건

| ID | Given — 전제 | When — 행동 | Then — 관찰 결과 |
|---|---|---|---|
| F07-AC1 | label wrapper·ARIA·이미지 | lint와 실제 DOM 연결 확인 | 오류는 해결하고 wrapper 예외는 정확한 사유를 가진다 |
| F07-AC2 | canvas 클릭·자동 focus·혼합 export | 경고 규칙 실행 | 진단이 표시되고 경고만으로 검사를 실패시키지 않는다 |

- 영향 파일은 [구현 설계](../implementation/07-accessibility-refresh.md), 테스트 절차·통과 기준·실행 결과는 [테스트 문서](../tests/07-accessibility-refresh.md)가 소유한다.
- 기능 상태·커밋은 [계획](../plan.md), 결과 요약·재개 지점은 [인수인계](../handoff.md)에 기록한다.

## 적용 결과

접근성 필수 5개 규칙을 error, focus·interaction 4개와 Refresh를 warn으로 적용했다. Label·FieldLabel은 htmlFor 전달을 명시하고 정확한 wrapper 목록으로 label 연결을 검사한다. 실제 DOM 연결·이름 변경 focus·Enter 저장과 최종 회귀를 검증했다. 경고 69개는 합의한 정책에 따라 표시하며 검사 실패로 처리하지 않는다. 상세 결과는 [테스트 기록](../tests/07-accessibility-refresh.md)을 따른다.
