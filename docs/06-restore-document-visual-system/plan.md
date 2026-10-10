# 범용 문서 시각 시스템 복구 구현 계획

## 진행 상태

| 단계 | 작업 | 상태 | 검증 |
|---|---|---|---|
| 1 | 시각 회귀 기준과 복구 계약 확정 | 완료 | 기준 커밋·PDF와 현재 구현의 차이 기록 |
| 2 | A4 surface·Markdown·페이지 footer 복구 | 진행 중 | screen·measure·print 공통 CSS와 snapshot 확인 |
| 3 | 범용 style preset·기본 문서 스타일 복구 | 대기 | 일반·조밀 preset 저장·재실행 회귀 |
| 4 | editor chrome·preview zoom 복구 | 대기 | 50~115% zoom과 panel usability 확인 |
| 5 | legacy import 시각 호환 보강 | 대기 | 기존 v1/v2 fixture와 reference PDF 비교 |
| 6 | 전체 시각·기능 회귀 검증 | 대기 | 전체 검사와 격리 Electron smoke 통과 |

상태는 `대기`, `진행 중`, `완료`, `차단` 중 하나만 사용한다. 동시에 하나의 단계만 `진행 중`으로 둔다.

## 구현 순서

### 1. 시각 회귀 기준과 복구 계약 확정

- `c59f33b`의 page CSS, preset, toolbar와 reference PDF를 기준으로 보존할 수치를 기록한다.
- 도메인 전용 selector와 범용으로 이전할 시각값을 구분한다.
- 현재 generic style schema에서 부족한 표현과 안전한 확장 범위를 정한다.

### 2. A4 surface·Markdown·페이지 footer 복구

- A4 상단 64pt, 좌우·하단 48pt 여백과 기존 종이 그림자를 복구한다.
- Pretendard 기반 기본 typography와 색상 token을 page surface에 둔다.
- 제목, 본문, 목록, 인용, code, table, footnote와 편집 focus style을 범용 Markdown CSS로 옮긴다.
- 화면과 print에 같은 page footer와 페이지 번호를 렌더링한다.
- 측정 content 높이를 새 page inset과 정확히 맞춘다.

### 3. 범용 style preset·기본 문서 스타일 복구

- 과거 reference·compact의 시각값을 목적 중립적인 일반·조밀 preset으로 바꾼다.
- preset은 root `StyleDefinition`에 복사되어 문서와 함께 저장되게 한다.
- 새 문서는 빈 root 구조를 유지하면서 기본 root style을 가진다.
- inspector에서 root preset을 적용하고 이후 개별 속성을 계속 수정할 수 있게 한다.

### 4. editor chrome·preview zoom 복구

- 작업 전의 zoom control을 범용 editor toolbar에 복구한다.
- 3개 panel의 hierarchy, spacing, surface와 selected state를 정돈한다.
- zoom은 screen preview에만 적용하고 measurement·print에는 영향을 주지 않는다.

### 5. legacy import 시각 호환 보강

- legacy importer가 생성하는 generic root, section, heading, item style을 새 page inset과 맞춘다.
- 필요한 경우 목적 중립적인 row, fixed/fill width, alignment와 side border style 표현을 추가한다.
- 과거 입력 의미는 importer 내부에만 두고 출력은 generic node/style 조합으로 만든다.

### 6. 전체 시각·기능 회귀 검증

- reference PDF와 같은 page·scale로 화면 및 PDF 결과를 비교한다.
- 직접 편집, component, 저장·재실행, pagination과 PDF 회귀를 확인한다.
- production code의 목적별 domain 분기가 다시 생기지 않았는지 검색한다.

## 회귀 검증

- [ ] reference PDF와 페이지별 시각 비교
- [ ] 빈 문서·legacy import·일반 fixture 수동 확인
- [ ] screen·measure·print 페이지 수 일치
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] 개인정보와 로컬 사용자 데이터가 Git diff에 없는지 확인
