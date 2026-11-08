import { assertDocumentData } from '../../src/foundation/documentValidation.ts';
import { CallToolResultSchema, BlobResourceContentsSchema } from '@modelcontextprotocol/sdk/types.js';
import assert from 'node:assert/strict';
import type { z } from 'zod';
import { toolOutputSchemas } from '../../src/foundation/documentToolResults.ts';
import { CommandFailure, type ToolName, type CommandError } from '../../src/foundation/documentCommands.ts';
import type { DocumentData, DocumentNode } from '../../src/foundation/documentModel.ts';
export function present<T>(value: T, description: string): NonNullable<T> {
  assert.ok(value !== undefined && value !== null, description);
  return value;
}
export function expectCode(code: string) {
  return (error: unknown): boolean => error instanceof CommandFailure && error.detail.code === code;
}
export function node<T extends DocumentNode['type']>(document: DocumentData, id: string, type: T): Extract<DocumentNode, { type: T }> {
  const value = document.nodes[id];
  assert.ok(value && value.type === type, `Expected ${type} node ${id}`);
  return value as Extract<DocumentNode, { type: T }>;
}
export function toolResult<T extends ToolName>(name: T, value: unknown): z.output<(typeof toolOutputSchemas)[T]> {
  // The selected schema verifies the matching tool response before this generic correlation.
  return toolOutputSchemas[name].parse(value) as z.output<(typeof toolOutputSchemas)[T]>;
}
export function success<T>(value: { ok: true; data: T } | { ok: false; error: CommandError }): { ok: true; data: T } {
  assert.ok(value.ok, JSON.stringify(value));
  return value;
}
export function failed<T>(value: { ok: true; data: T } | { ok: false; error: CommandError }): { ok: false; error: CommandError } {
  assert.ok(!value.ok, JSON.stringify(value));
  return value;
}
export function asNode<T extends DocumentNode['type']>(value: DocumentNode | undefined, type: T): Extract<DocumentNode, { type: T }> {
  assert.ok(value && value.type === type, `Expected ${type} node`);
  return value as Extract<DocumentNode, { type: T }>;
}
export function port(server: import('node:net').Server): number {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}
export function mdParent(value: import('mdast').Nodes): Extract<import('mdast').Nodes, { children: unknown }> {
  assert.ok('children' in value);
  return value;
}
export function mdValue(value: import('mdast').Nodes): Extract<import('mdast').Nodes, { value: string }> {
  assert.ok('value' in value && typeof value.value === 'string');
  return value;
}
export function mdHeading(value: import('mdast').Nodes): import('mdast').Heading {
  assert.equal(value.type, 'heading');
  assert.ok(value.type === 'heading');
  return value;
}
export function mdList(value: import('mdast').Nodes): import('mdast').List {
  assert.ok(value.type === 'list');
  return value;
}
export function richValue(value: import('../../src/foundation/documentModel.ts').ComponentPropValue | undefined): import('../../src/foundation/documentModel.ts').RichTextValue {
  assert.ok(value && typeof value === 'object' && 'runs' in value);
  return value;
}
export function field<T, K extends PropertyKey>(value: T, key: K): Extract<T, Partial<Record<K, unknown>>> {
  assert.ok(value !== null && typeof value === 'object' && key in value, `Expected field ${String(key)}`);
  return value as Extract<T, Partial<Record<K, unknown>>>;
}

export function property(value: object, key: string): unknown {
  assert.ok(key in value, `Expected property ${key}`);
  return Reflect.get(value, key);
}
export function string(value: unknown): string {
  assert.ok(typeof value === 'string');
  return value;
}

export const wireResult = (value: unknown) => CallToolResultSchema.parse(value);
export const blobResource = (value: unknown) => BlobResourceContentsSchema.parse(value);

export function jsonObject(source: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source);
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
export function documentJson(source: string): DocumentData {
  const value: unknown = JSON.parse(source);
  assertDocumentData(value);
  return value;
}
