# F03. 기존 문서의 내용 수정 맡기기

상태: 구현 기준안 · 우선순위: P0 · 사용자 여정: UJ-03

[기능 전체](../README.md) · [도구 계약](../tool-contracts.md)

## 1. 문제와 배경

에이전트가 문장을 잘 고쳐도 사용자가 복사해 다시 붙여 넣어야 한다면 작성 지원의 마지막 단계가 남는다. 반대로 AI가 과거에 읽은 문서 전체를 저장하면 사용자가 그 사이 입력한 내용이나 관련 없는 서식을 잃을 수 있다.

이 기능은 사용자가 지정한 값에 수정 결과를 적용하고 저장 여부를 확인하게 한다. 문장을 생성하는 판단은 외부 에이전트에 있으며, Formleaf는 대상·원문 일치·revision·편집 상태를 확인한 변경만 적용한다. node, component prop, repeater item prop의 문장 수정 경험을 같은 계약으로 제공한다.

## 2. 사용자와 역할

문서 작성자는 '이 설명을 짧게', '이 문장을 교체'처럼 원하는 결과를 말한다. 에이전트는 F02로 현재 값을 읽고 변경안을 계산한다. Formleaf는 허용된 target에 저장하고 변경 요약과 revision을 돌려준다. 내용의 사실성이나 표현 품질을 서버가 자동으로 승인한다는 뜻은 아니다.

## 3. 목표와 성공 기준

- 요청한 값과 필요한 metadata만 바뀌고 다른 문서·항목·Markdown 원문은 보존된다.
- 동시 입력·오래된 snapshot·모호한 문자열 교체를 성공으로 처리하지 않는다.
- 저장 성공과 UI 반영 성공을 구분해 사용자가 실제 상태를 판단할 수 있다.
- 목표 검증은 세 target 유형의 정상 수정과 충돌 fixture 전체 통과다. AI 문장 품질에 대한 사용자 평가나 향상률은 아직 측정하지 않았다.

## 4. 사용 시나리오 — UJ-03

사용자는 경력 설명의 긴 문장을 짧게 바꾸려 한다. 에이전트가 대상과 현재 저장 revision을 읽었고 문서는 idle 상태다.

1. 에이전트가 원문과 요청을 바탕으로 새 문장을 만든다.
2. 일부 교체면 정확한 oldText/newText, 값 전체 교체면 전체 새 값을 구성한다.
3. 필요한 경우 dryRun으로 대상·형식·변경 영향을 검사한다. 모든 수정 전에 dryRun을 필수로 요구하지 않는다.
4. requestId와 expectedRevision을 붙여 적용한다. Formleaf가 idle 상태를 재확인하고 사본에 변경을 적용한다.
5. 저장 결과에 바뀐 target과 새 revision을 반환한다. 열린 clean 문서는 갱신한다.
6. 에이전트가 변경된 값을 다시 확인하거나 F07로 페이지를 확인하고, 사용자에게 변경 결과를 설명한다.

사용자가 그 사이 입력을 시작했다면 4단계에서 busy로 끝난다. 에이전트는 편집을 강제로 종료하지 않고, 사용자가 편집을 끝낸 뒤 재조회하고 다시 시도해야 한다.

## 5. 상세 요구와 예외

- **F03-R01 — 교체 의도 표현:** set_edit_value는 같은 선언 유형의 전체 값 교체다. replace_text는 text/Markdown에서 oldText가 정확히 한 번 일치할 때만 변경한다. 겹치는 일치도 여러 번으로 센다.
- **F03-R02 — 값 단위 identity:** 전체 Markdown의 DocumentEditTarget을 사용한다. pagination fragment나 editor의 활성 block을 별도 저장 대상으로 삼지 않는다.
- **F03-R03 — 입력 보호:** dirty·saving·active editor·component draft 또는 renderer handshake 실패면 DOCUMENT_BUSY. 최신 revision이 아니면 REVISION_CONFLICT다. 에이전트가 강제 적용 flag로 우회할 수 없다.
- **F03-R04 — 원문 보존:** Markdown을 editor codec으로 왕복하지 않는다. 지원하지 않는 문법을 원문 그대로 조회하고 명시된 문자열만 교체한다. 전체 교체를 명시했다면 제공한 새 값으로 교체한다.
- **F03-R05 — 한 요청의 일관성:** 하나의 batch에 포함한 변경 중 하나가 실패하면 전부 저장하지 않는다. dryRun은 저장·예약·권한 확대를 하지 않는다.
- **F03-R06 — 결과 정직성:** 저장 후 UI acknowledgement만 실패하면 persisted=true/uiSynced=false로 알린다. 같은 requestId로 중복 적용하지 않는다.

oldText가 없거나 여러 번 나오면 에이전트는 원문을 다시 읽고 문맥을 포함해 요청해야 한다. rich text는 mark 보존을 추측하지 않고 전체 runs를 명시한다. 성공한 AI 변경은 기존 editor의 undo 항목으로 자동 편입되지 않는다.

## 6. 대안과 트레이드오프

| 대안 | 이점 | 비용·한계 | 판단 |
|---|---|---|---|
| 문서 전체 JSON 덮어쓰기 | 구현과 요청이 단순하다 | 무관한 내용 손실·공유 정의 변경·stale 저장 위험 | 미선택 |
| 자동 병합·자동 대기 | 사용자의 수동 재시도가 줄 수 있다 | IME·구조 변경에서 합의된 병합 규칙 필요, 대기 후 의도가 낡을 수 있다 | 후속 검토 |
| target 변경 + revision + busy 거절 | 변경 범위를 확인하고 현재 입력을 보호한다 | 활성 편집만 켜져 있어도 거절되며 재조회가 필요하다 | 선택, D03/D04/D05 |

partial replace는 호출량을 줄일 수 있지만 의미적으로 같은 문장까지 찾아주지는 않는다. 자동 fuzzy matching은 첫 버전에 포함하지 않는다.

## 7. 범위와 의존성

F01의 write와 F02의 target 조회가 필요하다. 텍스트·rich text·Markdown 원문 변경을 포함한다. 구조적 Markdown block 명령, 강제 IME 종료, 편집기 undo 통합은 제외한다. F08은 연결 단절·저장 결과 불명을 처리한다.

## 8. 인수 조건

| ID | Given | When | Then |
|---|---|---|---|
| F03-AC01 | 세 target 유형별 저장 fixture | 지정한 문장만 수정 | 해당 값·저장 metadata만 변경, 다른 값 불변 |
| F03-AC02 | 한글 조합 중 부모 rerender/publish 발생 | MCP 수정 요청 | busy, editor root·caret·composition 보존 |
| F03-AC03 | 읽은 뒤 UI가 새 revision 저장 | 과거 revision으로 적용 | 충돌, 새 저장값 불변 |
| F03-AC04 | oldText 0회/여러 회 일치 | replace_text | 해당 오류, 부분 저장 없음 |
| F03-AC05 | 두 번째 명령의 target이 잘못됨 | 두 명령 batch 적용 | 첫 명령도 저장되지 않음 |
| F03-AC06 | table/reference 원문이 있는 Markdown | 다른 문장만 교체 | 미지정 원문 byte 내용 유지, UI fallback 정책 유지 |
| F03-AC07 | 같은 입력으로 dryRun 수행 | 결과 확인 후 원문 조회 | 저장 revision·본문 불변 |

## 9. 기술 연결과 남은 확인

T05/T07/T12, set_edit_value/replace_text. `documentEditing`, 공통 documentService, renderer idle handshake와 journal을 사용한다. 계획 2단계 및 4-1에 대응한다.

busy를 만났을 때 사용자에게 어떤 표현으로 안내할지는 실제 외부 에이전트 시나리오에서 확인한다. busy 빈도와 재시도 횟수는 조사 대상이며 정해진 성능 개선 수치는 없다. 동시 편집이 핵심 요구가 되면 D03을 다시 검토한다.

기술 실행 흐름: [실행 시퀀스](../runtime-flows.md)의 AS01→TB02의 저장 경로 전환과 TB05의 결과 복구를 함께 읽는다. 기능 간 의존성은 [설계](../design.md)의 기능 관계 절을 따른다.
