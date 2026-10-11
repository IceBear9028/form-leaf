export type AxisRect = {
  start: number;
  end: number;
};

export function autoLayoutDropPosition(pointer: number, siblingRects: AxisRect[]): number {
  const index = siblingRects.findIndex((rect) => pointer < (rect.start + rect.end) / 2);
  return index < 0 ? siblingRects.length : index;
}

export function childInsertionIndex(
  childIds: string[],
  draggedNodeId: string,
  visibleSiblingIds: string[],
  dropPosition: number,
): number {
  const remaining = childIds.filter((nodeId) => nodeId !== draggedNodeId);
  const beforeNodeId = visibleSiblingIds[dropPosition];
  if (beforeNodeId) {
    const beforeIndex = remaining.indexOf(beforeNodeId);
    if (beforeIndex >= 0) return beforeIndex;
  }
  const lastVisibleNodeId = visibleSiblingIds.at(-1);
  if (!lastVisibleNodeId) return 0;
  const lastIndex = remaining.indexOf(lastVisibleNodeId);
  return lastIndex < 0 ? remaining.length : lastIndex + 1;
}

export function pixelsToPoints(value: number): number {
  return value * 72 / 96;
}

export function roundLayoutPoint(value: number): number {
  return Math.round(value * 10) / 10;
}
