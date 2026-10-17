# Document 렌더링 아키텍처 개선

## 상태

1차 구현 및 실제 Electron 검증 완료

## 목적

실시간 편집에 필요하지 않은 작업을 렌더 파이프라인에서 제거하고, Document 변경의 영향 범위에 따라 특정 node 또는 전체 문서를 선택적으로 갱신할 수 있는 아키텍처를 만든다.

이번 작업은 다음 세 가지로 나눈다.

1. **Print 파이프라인 분리:** 평상시 편집에 필요하지 않은 print render·measure를 PDF 내보내기 생명주기로 이동한다.
2. **편집기 상태 레이어링:** Document, interaction, render derived, lifecycle 상태의 소유권과 구독 경계를 분리한다.
3. **부분 갱신 렌더 파이프라인 재설계:** `DocumentUpdate → RenderScope → RenderWorkPlan`으로 필요한 node와 계산만 갱신한다.

## 문서

- [아키텍처](architecture.md)
- [작업 계획](plan/README.md)
- [구현 결과와 계측](implementation-report.md)
  - [1. Print 파이프라인 분리](plan/01-print-pipeline-isolation.md)
  - [2. 편집기 상태 레이어링](plan/02-editor-state-layering.md)
  - [3. 부분 갱신 렌더 파이프라인](plan/03-incremental-render-pipeline.md)
- [현재 Document 입력·렌더링·저장 과정](../references/current-document-render-pipeline.md)
- [목표 Document 입력·렌더링·저장 과정](../references/to-be-document-render-pipeline.md)

## 범위

- 편집 중 불필요한 render·parse·measure 제거
- Document 변경 정보 표현
- 부분 갱신과 전체 갱신 조건 분류
- 변경 영향 판정과 실제 렌더 실행의 책임 분리
- frame 단위 작업 병합과 cache 무효화 경계
- 정확성을 보장하는 전체 무효화 fallback

## 비범위

- Document 데이터 모델의 의미 기반 타입 추가
- 브라우저 layout을 직접 계산하는 자체 레이아웃 엔진
- PDF 출력 결과나 페이지네이션 정확도 변경
- 성능을 위해 IME, caret, Undo/Redo 동작을 약화하는 변경
