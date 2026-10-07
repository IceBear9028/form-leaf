# 단계별 이동 계획

## 현재 상태

구조안과 12단계 실행 순서를 승인했다. 1단계 기준 상태 검증을 완료했으며 각 단계를 별도 커밋으로 진행한다.

| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | 기준 상태 검증 및 구조 설계 문서 커밋 | 완료 |
| 2 | 루트 `app` 디렉터리를 `client`로 변경 | 완료 |
| 3 | `main/preload/renderer/foundation` 실행 환경 경계 정리 | 완료 |
| 4 | 공통 저장·CRUD·IPC 명칭을 `document`로 변경 | 완료 |
| 5 | main process 저장소·migration·파일 I/O 책임 분리 | 완료 |
| 6 | Renderer를 `app/pages/shared` 구조로 이동 | 완료 |
| 7 | `App.tsx`의 목록·휴지통·문서 세션 상태 분리 | 완료 |
| 8 | document editor의 Markdown·DOM·pagination·style 책임 분리 | 완료 |
| 9 | 구조 리팩터링 전체 회귀 검증 | 완료 |
| 10 | shadcn/ui 기반 설정 및 `shared/ui` primitive 추가 | 완료 |
| 11 | 앱 UI를 shadcn/ui 공식 스타일로 교체하고 직접 구현 primitive 제거 | 진행 중 |
| 12 | 최종 UI·document preview·PDF 회귀 검증 및 문서화 | 대기 |

## 현재 확정된 이동 후보

- `app` 디렉터리 이름을 `client`로 변경 완료
- `shared`의 프로세스 공용 파일을 `foundation`으로 이동 완료
- `resumeRepository.ts`를 `documentRepository.ts`로 변경 완료
- `resumeLibrary.ts`와 공통 CRUD 타입을 `documentLibrary.ts`와 `Document*`로 변경 완료
- preload API 타입과 진입점을 `ResumeStudioApi`·`window.resumeStudio`에서 `DocumentApi`·`window.documents`로 변경 완료
- `resume.ts`를 공통 `document.ts`와 이력서 전용 `content/resume.ts`로 분리 완료
- `shared/markdown.ts`를 `renderer/src/pages/document-editor/markdown/parser.ts`로 이동 완료
- `shared/markdownEdits.ts`를 `renderer/src/pages/document-editor/markdown/edits.ts`로 이동 완료
- `shared/resumeMigration.ts`를 `main/document/documentMigration.ts`로 이동 완료
- `ipc.ts`, `markdownSerialization.ts`는 `foundation`에 유지
- `ResumeEditor`, `ResumePreview`, `ResumeContent`처럼 이력서 구조에 종속된 이름은 유지

목표 경로까지 한 번에 이동하지 않는다. 3단계에서는 실행 환경 소유권만 분리했고, 이름과 세부 폴더는 이후 단계에서 변경한다.

## 마지막 UI 교체 단계

shadcn/ui 적용은 main, preload, foundation, Renderer 구조 이동과 로직 분리가 모두 끝나고 기존 UI 상태로 전체 회귀 검증을 통과한 뒤 시작한다. 필요한 컴포넌트와 적용 범위는 [shadcn/ui 적용 계획](shadcn-ui.md)을 따른다.

- `components.json`, Renderer `@` alias와 `shared/lib/utils.ts` 설정
- `shared/ui`에 필요한 shadcn component만 추가
- 공식 `base-nova`·`neutral`·CSS variables·Lucide 스타일 적용
- 직접 만든 button/input/modal/accordion/empty/loading primitive 제거
- 앱 chrome만 교체하고 document preview·Markdown 본문·PDF 스타일은 보존

shadcn 변경은 구조 이동 커밋에 섞지 않으며 이번 작업의 마지막 기능 코드 커밋 묶음으로 만든다.

## 실행 단위

각 단계는 별도 커밋으로 만든다. 한 단계에서 다음을 함께 하지 않는다.

- 구조 이동과 기능 추가
- 구조 이동과 데이터 schema 변경
- main과 renderer의 대규모 분리를 동시에 진행
- 테스트 이동과 테스트 의미 변경

## 단계별 통과 조건

각 단계마다 다음을 만족해야 다음 단계로 넘어간다.

1. 기존 public behavior가 유지된다.
2. 관련 단위·통합 테스트가 통과한다.
3. production build가 통과한다.
4. 순환 import가 없다.
5. 새 파일의 책임과 테스트 위치가 구조 문서와 일치한다.
6. 실제 사용자 이력서 파일은 검증 fixture로 사용하지 않는다.

## 커밋 규칙

- 각 단계가 해당 검증을 통과한 뒤 한 개 이상의 독립 커밋으로 완료한다.
- 다음 단계의 변경을 이전 단계 커밋에 섞지 않는다.
- 단계 안에서도 main과 renderer처럼 회귀 범위가 크면 안전한 하위 커밋으로 나눌 수 있다.
- shadcn/ui는 9단계 전체 회귀 검증이 끝나기 전에 설치하거나 일부 화면에 적용하지 않는다.
