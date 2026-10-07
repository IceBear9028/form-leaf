export type PaginationUnit = {
  id: string;
  keepWithNext?: boolean;
  forceNewPage?: boolean;
};

export type PaginatedPage<T extends PaginationUnit> = {
  id: string;
  units: T[];
  overflow: boolean;
};

export function reconcileVisiblePages<T extends PaginationUnit>(
  pages: PaginatedPage<T>[],
  units: T[],
): PaginatedPage<T>[] {
  if (!units.length) return [{ id: "page-1", units: [], overflow: false }];
  if (!pages.length) return [{ id: "page-1", units, overflow: false }];
  const pageStarts = new Map(
    pages.slice(1).flatMap((page, index) =>
      page.units[0] ? [[page.units[0].id, index + 1] as const] : [],
    ),
  );
  const result: PaginatedPage<T>[] = [{
    id: pages[0].id,
    units: [],
    overflow: pages[0].overflow,
  }];
  units.forEach((unit) => {
    const pageIndex = pageStarts.get(unit.id);
    if (pageIndex !== undefined && result.at(-1)?.units.length) {
      result.push({
        id: pages[pageIndex]?.id ?? `page-${result.length + 1}`,
        units: [],
        overflow: pages[pageIndex]?.overflow ?? false,
      });
    }
    result.at(-1)!.units.push(unit);
  });
  return result;
}

export function paginate<T extends PaginationUnit>(
  units: T[],
  heights: Map<string, number>,
  capacity: number,
): PaginatedPage<T>[] {
  if (!units.length) return [{ id: "page-1", units: [], overflow: false }];
  const pages: PaginatedPage<T>[] = [];
  let current: T[] = [];
  let used = 0;
  let overflow = false;

  const flush = () => {
    pages.push({ id: `page-${pages.length + 1}`, units: current, overflow });
    current = [];
    used = 0;
    overflow = false;
  };

  units.forEach((unit, index) => {
    if (unit.forceNewPage && current.length) flush();
    const height = heights.get(unit.id) ?? 0;
    let required = height;
    let lookaheadIndex = index;
    let lookahead = unit;
    while (lookahead.keepWithNext && lookaheadIndex + 1 < units.length) {
      lookaheadIndex += 1;
      lookahead = units[lookaheadIndex];
      required += heights.get(lookahead.id) ?? 0;
    }
    if (current.length && used + required > capacity) flush();
    current.push(unit);
    used += height;
    if (height > capacity || used > capacity + 1) overflow = true;
  });
  if (current.length || !pages.length) flush();
  return pages;
}
