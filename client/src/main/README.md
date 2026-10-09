# Main process

Electron window, 로컬 JSON 저장소, IPC와 PDF 출력을 담당한다.

- `document/documentRepository.ts`: 범용 문서·휴지통과 원자적 backup
- `document/componentLibraryRepository.ts`: 개인 component library
- `document/legacy/`: 과거 입력 경로, schema와 범용 document importer
- `registerDocumentHandlers.ts`, `registerPdfHandlers.ts`: renderer에 노출할 IPC

과거 파일은 원본을 수정하지 않고 새 범용 파일로 복사 변환하며 모든 저장이 성공한 뒤에만 완료 표식을 남긴다.
