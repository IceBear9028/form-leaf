# 06. 범용 문서 시각 시스템 복구

## 상태

구현 중

## 문제

`05`의 범용 문서 전환에서 과거 목적별 runtime을 제거할 때, 그 위에 있던 문서 출력 스타일과 편집 화면의 완성도까지 함께 삭제했다. 현재 범용 renderer에는 A4 크기와 최소한의 선택 표시만 남아 있어 작업 전 문서의 여백, 타이포그래피, Markdown 계층, 페이지 번호, 스타일 프리셋과 미리보기 배율이 사라졌다.

도메인 결합 제거는 필요했지만 시각 회귀까지 허용한 것은 잘못이다. 이 작업은 `05`의 범용 데이터·컴포넌트 경계를 유지하면서 작업 전 시각 품질을 복구한다.

## 사용자 경험

1. 기존 문서를 열면 작업 전과 같은 A4 종이 비율, 여백, 글꼴, 색상과 페이지 구분을 볼 수 있다.
2. Markdown 제목·본문·목록·인용·코드·표·각주가 브라우저 기본값이 아니라 일관된 문서 스타일로 표시된다.
3. 툴바에서 미리보기 배율을 줄이거나 키우고 기본 배율로 돌아갈 수 있다.
4. 각 페이지 하단에는 작업 전과 같은 구분선과 페이지 번호가 표시된다.
5. 새 문서와 기존 범용 문서에 일반 또는 조밀한 스타일을 적용할 수 있다.
6. 화면, 숨겨진 측정 DOM과 PDF는 같은 스타일과 페이지 분할을 사용한다.

## 목표

- 작업 전 기준 커밋 `c59f33b`의 시각값을 범용 document renderer와 style definition으로 이전한다.
- 특정 문서 목적이나 category 이름 없이 스타일을 선택·저장·렌더링한다.
- 기존 generic graph, 직접 편집, component 재사용과 저장 데이터를 유지한다.

## 포함 범위

- A4 page surface, 여백, 그림자, 페이지 간격과 페이지 번호
- 문서 기본 typography와 전체 Markdown 스타일
- 일반·조밀한 범용 root style preset
- preview zoom control과 정돈된 editor chrome
- legacy importer가 만드는 generic graph의 시각 스타일 보강
- screen·measure·print 시각 회귀 검증

## 제외 범위

- 과거 목적별 editor·renderer·section type의 복구
- 특정 category 이름을 기준으로 한 CSS 분기
- 자유 배치 canvas 또는 임의 CSS 입력
- 사용자 문서 내용 변경

## 완료 조건

- [ ] 작업 전 기준과 동일한 A4 여백·기본 typography·페이지 footer가 복구된다.
- [ ] 모든 Markdown 요소가 범용 stylesheet로 일관되게 표시된다.
- [ ] 일반·조밀한 preset이 사용자 내용이나 문서 목적과 무관하게 적용된다.
- [ ] 기존 generic document를 손상시키지 않고 새 시각 시스템에서 연다.
- [ ] screen과 print의 페이지 수와 줄바꿈이 일치한다.
- [ ] reference PDF와 같은 배율의 시각 비교에서 주요 계층과 간격이 회복된다.
- [ ] 전체 테스트, 타입 검사, production build와 Electron smoke가 통과한다.

## 관련 문서

- [구현 계획](plan.md)
- [기술 설계](design.md)
- [세션 인수인계](handoff.md)
