# Foundation

main, preload, renderer 중 둘 이상의 실행 환경이 공유하는 환경 독립 소스만 둔다.

- `documentModel.ts`, `documentValidation.ts`: 범용 document graph와 검증 계약
- `documentTransactions.ts`, `documentEditing.ts`: 불변 구조·직접 편집 transaction
- `documentComponentOperations.ts`: component 생성과 독립 package export/import
- `documentLibrary.ts`, `componentLibrary.ts`: 목록·휴지통·개인 library와 IPC 응답 계약
- `ipc.ts`: 실행 환경이 공유하는 channel 이름

과거 입력 형식과 변환 코드는 `main/document/legacy`에만 둔다.
