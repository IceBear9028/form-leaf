# App data directory migration

## 상태

Backlog

## 문제

앱 표시 이름은 `Document`이지만 `client/src/main/index.ts`는 Electron `userData`를 과거 이름인 `Resume Studio` 디렉터리에 명시적으로 고정한다. 이는 현재 사용자 데이터 위치를 유지하는 호환 장치이므로 canonical document migration과 함께 이름만 바꾸면 기존 문서가 사라진 것처럼 보일 수 있다.

## 목표

- 현재 디렉터리와 새 canonical app data 디렉터리의 존재·내용·충돌 조건을 먼저 판별한다.
- 기존 workspace, backup, legacy 원본과 Electron 설정을 손실 없이 새 위치로 이관한다.
- 중단 후 재실행 가능하고 rollback 가능한 명시적 migration marker와 단계별 저장 방식을 사용한다.
- 새 위치 검증이 끝난 뒤에만 앱의 `userData` 경로를 전환한다.
- 기존 디렉터리의 삭제 여부와 보존 기간은 별도로 결정한다.

## 검토 범위

- `LEGACY_APP_DIRECTORY_NAME`과 `app.setPath("userData", ...)`의 책임 분리
- 이전 위치만 존재, 새 위치만 존재, 양쪽 모두 존재하는 경우
- 동일 파일, 상이한 파일과 손상 파일의 충돌 처리
- 앱 동시 실행과 파일 사용 중 상태
- workspace 문서·trash·component library·backup·migration marker
- Electron이 함께 저장하는 cache와 설정 중 이관 대상 구분
- 실패 시 원래 위치로 되돌리는 절차와 사용자 오류 보고

## 완료 조건

- [ ] 실제 사용자 디렉터리 inventory와 충돌 정책을 문서화한다.
- [ ] 기존 데이터 전체를 보존하는 idempotent migration을 구현한다.
- [ ] 양쪽 디렉터리 조합과 중단·손상·충돌 테스트가 통과한다.
- [ ] 실제 데이터 복사본에서 migration, 재실행과 rollback을 검증한다.
- [ ] 새 `userData` 위치에서 문서 열기·저장·PDF와 component library를 검증한다.
- [ ] 기존 디렉터리 정리 정책을 사용자와 별도로 확정한다.
