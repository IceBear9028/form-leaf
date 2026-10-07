# Main Process

Electron 앱 생명주기, BrowserWindow, 로컬 파일 저장, 파일 선택과 PDF 내보내기를 담당한다.

`ResumeRepository`가 목록 index와 ID별 문서를 원자적으로 저장하고 직전 정상본을 백업한다. 기존 단일 파일 이전, CRUD, 휴지통과 복원도 이 계층에서 처리하며 renderer에는 실제 파일 경로를 노출하지 않는다.

저장 데이터의 v1→v2 변환은 main 전용 `resumeMigration.ts`가 담당한다.
