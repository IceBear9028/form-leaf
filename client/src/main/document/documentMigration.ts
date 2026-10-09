import {
  isLegacyV1Document,
  isLegacyV2Document,
  type LegacyV1Document,
  type LegacyV2Document,
} from "./legacy/legacySchema.ts";
import { migrateLegacyV1 } from "./legacy/migrateLegacyV1.ts";

/** 현재 repository가 사용하는 임시 과거 계약 migration이다. */
export function migrateStoredDocument(value: unknown): LegacyV2Document {
  if (isLegacyV2Document(value)) return value;
  if (isLegacyV1Document(value)) return migrateLegacyV1(value);
  throw new Error("저장된 문서의 데이터 형식이 올바르지 않습니다.");
}

/** 기존 caller와 테스트를 위한 전환기 호환 export다. */
export function migrateResumeDocumentV1(document: LegacyV1Document): LegacyV2Document {
  return migrateLegacyV1(document);
}
