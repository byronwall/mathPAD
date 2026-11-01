export function placeExampleRows<T extends { x: number; y: number }>(
  rows: T[], visibleTop: number, viewportWidth: number
): T[] {
  if (!rows.length) return rows;
  const shift = Math.max(0, visibleTop - Math.min(...rows.map((row) => row.y)));
  const firstY = Math.min(...rows.map((row) => row.y));
  return rows.map((row, index) => ({
    ...row,
    x: viewportWidth <= 600 ? 12 : row.x,
    y: viewportWidth <= 600 ? firstY + shift + index * 88 : row.y + shift
  }));
}
