import electron from 'electron';
import assert from 'node:assert/strict';
function executablePath(value: unknown): string {
  assert.ok(typeof value === 'string');
  return value;
}
export default executablePath(electron);
