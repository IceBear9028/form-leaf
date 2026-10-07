# 04. 레이어 경계와 테스트 단위 리팩터링

## 상태

구조안 승인 · 12단계 구현 진행

## 배경

다음 작업에서는 사용자가 이력서 스타일 토큰과 Markdown 표현 방식을 직접 설정할 수 있어야 한다. 현재도 스타일 프리셋과 Markdown 파서가 존재하지만, 화면 상태·DOM 편집·페이지 계산·저장 흐름이 큰 React 파일에 함께 있어 변경 책임과 테스트 위치를 예측하기 어렵다. 구조 정리가 끝난 뒤 직접 구현한 앱 UI primitive도 shadcn/ui 공식 스타일로 교체한다.

폴더 구조와 의존 규칙을 합의했으며, 각 단계를 검증하고 별도 커밋으로 완료한 뒤 다음 단계로 진행한다.

## 이번 설계에서 결정할 것

- `client/src/main`, `preload`, `renderer`, `foundation` 사이의 책임과 의존 방향
- 공통 문서 기능의 `document` 명칭과 이력서 전용 `resume` 명칭의 경계
- main과 renderer 내부에서 실제로 분리가 필요한 파일과 책임
- 순수 단위 테스트, repository 통합 테스트, DOM 통합 테스트의 위치
- 향후 스타일 설정과 Markdown 기능 설정이 들어갈 확장 지점
- 구조 리팩터링 마지막에 적용할 shadcn/ui 컴포넌트와 document 스타일 보호 범위
- 기존 파일을 안전하게 옮기는 순서와 호환 규칙

## 리팩터링 목표

- 파일 위치만 보고 책임과 실행 환경을 예측할 수 있다.
- 환경 독립 규칙은 React·Electron·DOM 없이 테스트할 수 있다.
- 목록과 편집 상태는 저장소나 브라우저 API를 대체해 테스트할 수 있다.
- React 컴포넌트는 화면 조합과 이벤트 전달에 집중한다.
- 파일 시스템, IPC, Selection, contentEditable, CSS 변수 변환은 adapter로 격리한다.
- 테스트 파일은 대상 모듈과 일대일로 대응하고, 거대한 통합 테스트 파일에 계속 쌓지 않는다.
- 앱 UI는 shadcn/ui의 semantic token과 공식 컴포넌트 스타일을 사용한다.

## 비목표

- 스타일 커스터마이징 UI 구현
- 사용자 정의 Markdown 문법 구현
- document preview와 PDF 디자인 변경
- 저장 데이터 schema 변경
- 기존 편집 동작 변경

## 승인 절차

1. [구조안](architecture.md)의 폴더 구조와 의존 규칙을 검토한다.
2. 열린 결정 항목을 확정한다.
3. 승인 후 [이동 계획](plan.md)에 따라 한 단계씩 구현한다.
4. 각 단계는 구조 변경만 포함하며 기능 변경과 섞지 않는다.

## 현재 합의

- 루트 애플리케이션 디렉터리는 `app`에서 `client`로 변경한다.
- `main`, `preload`, `renderer`, `foundation`을 `client/src`의 최상위 경계로 사용한다.
- `renderer/src`는 현행대로 유지한다.
- `foundation`은 둘 이상의 실행 환경이 사용하는 환경 독립 기반 코드만 포함한다.
- 저장·목록·CRUD·휴지통·편집 진입점은 `document`로, 이력서 content·미리보기·출력은 `resume`로 명명한다.
- renderer 전용 Markdown parser/edit 코드는 document editor로, main 전용 migration은 main으로 이동한다.
- Renderer는 `app`, `pages`, `shared`로 나누고 공용 UI·hook·helper는 Renderer의 `shared`에서 관리한다.
- 구조 리팩터링의 마지막 코드 변경으로 `renderer/src/shared/ui`에 shadcn/ui를 도입한다.
- shadcn 스타일은 앱 UI에만 적용하고 document preview와 PDF에는 적용하지 않는다.
- FSD와 반복적인 `domain/application/adapter/ui` 구조는 현재 범위에 적용하지 않는다.

## 문서

- [구조안과 선택지](architecture.md)
- [단계별 이동 계획](plan.md)
- [현재 상태와 인수인계](handoff.md)
- [shadcn/ui 적용 계획](shadcn-ui.md)
