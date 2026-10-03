# Main Process

Electron 앱 생명주기, BrowserWindow, 로컬 파일 저장, 파일 선택과 PDF 내보내기를 담당한다.

구현 기준은 `docs/00-reference-pdf/` 문서를 따른다. 활성 문서를 앱 데이터 디렉터리에 원자적으로 저장하고, 직전 정상 저장본을 백업한다.
