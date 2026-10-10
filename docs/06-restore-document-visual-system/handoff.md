# 범용 문서 시각 시스템 복구 세션 인수인계

## 현재 상태

- 상태: 범용 style preset·기본 문서 스타일 복구 완료
- 현재 단계: 4. editor chrome·preview zoom 복구
- 작업 트리: 단계 3 구현 및 문서 변경
- 마지막 커밋: `3b0a603 style: restore document page rendering`

## 완료된 작업

- 작업 전 기준을 `c59f33b`로 확정했다.
- 삭제된 331줄 page/Markdown CSS와 style preset·registry·zoom 경로를 확인했다.
- 과거 목적별 runtime을 복원하지 않고 generic CSS와 embedded style 값으로 이전하는 방향을 정했다.
- generic A4 surface에 상단 64pt, 좌우·하단 48pt 여백과 Pretendard typography를 복구했다.
- 제목, 본문, 목록, 인용, code, table, footnote와 직접 편집 상태의 Markdown 스타일을 복구했다.
- 모든 screen·print 페이지에 같은 footer와 페이지 번호를 추가하고 measurement content 높이를 731pt로 맞췄다.
- 목적 중립적인 일반·조밀 preset을 추가하고 root `StyleDefinition` 값으로 복사하도록 했다.
- 새 문서는 빈 root 구조를 유지하면서 일반 preset 값을 포함한 root style로 시작한다.
- inspector에서 root preset을 적용한 뒤 개별 layout·typography 값을 계속 수정할 수 있다.
- root의 글자 크기·줄 높이·간격을 Markdown 계층 CSS 변수에도 전달한다.

## 변경 파일

- `client/src/foundation/documentStylePresets.ts`
- `client/src/foundation/documentModel.ts`
- `client/src/foundation/document.ts`
- `client/src/renderer/src/pages/document-editor/PropertyInspector.tsx`
- `client/src/renderer/src/pages/document-editor/rendering/styleToCss.ts`
- `client/test/document-style-presets.test.mjs`
- `client/test/document-core.test.mjs`
- `client/test/document-editor.test.mjs`
- `client/test/document-renderer.test.mjs`
- `client/test/document-component-reuse.test.mjs`
- `client/package.json`
- `docs/06-restore-document-visual-system/README.md`
- `docs/06-restore-document-visual-system/plan.md`
- `docs/06-restore-document-visual-system/handoff.md`

## 검증 결과

| 명령 또는 확인 | 결과 |
|---|---|
| `git show c59f33b:.../resumeDocument.css` | 작업 전 page·Markdown 스타일 수치 확인 |
| `git show c59f33b:.../style/presets.ts` | reference·compact preset 값 확인 |
| reference PDF 경로 | 파일 존재 확인 |
| `npm run test:markdown` | 16개 통과 |
| `npm run test:pagination` | 3개 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| 격리 Electron snapshot | A4 크기·여백·Markdown·footer 확인 |
| `npm test` | 전체 통과 |
| 일반→조밀 적용 후 저장 | root style 값과 화면 `7.5pt/1.5/5.5pt` 반영 확인 |
| 격리 Electron 재실행 | 조밀 style과 계산값 유지 확인 |

## 남은 작업

- 단계 4 editor chrome과 screen-only preview zoom 복구

## 미결정 사항과 위험

- 이미 범용 파일로 변환된 legacy 문서의 사용자 편집을 자동 style migration이 덮어쓰면 안 된다.
- 과거 목적별 grid를 그대로 복구하지 않고도 reference 수준의 hierarchy를 generic layout으로 표현해야 한다.

## 다음 세션의 첫 작업

작업 전 toolbar의 50~115% zoom을 범용 editor에 복구하고, 3개 panel의 hierarchy와 spacing을 정돈한다. zoom은 screen preview wrapper에만 적용한다.
