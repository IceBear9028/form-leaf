/** Checked lookup for references and offsets already required by an invariant. */
export function requiredValue<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`필수 값을 찾을 수 없습니다: ${description}`);
  return value;
}
