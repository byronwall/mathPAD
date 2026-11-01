export function placeExampleRows<T extends { x: number; y: number }>(
  rows: T[], visibleTop: number, viewportWidth: number
): T[] {
  if (!rows.length) return rows;
  const shift = Math.max(0, visibleTop - Math.min(...rows.map((row) => row.y)));
  return rows.map((row) => ({
    ...row,
    x: viewportWidth <= 600 ? 12 : row.x,
    y: row.y + shift
  }));
}
