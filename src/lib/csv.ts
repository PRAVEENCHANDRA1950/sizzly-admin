type Cell = string | number | null | undefined;

const escape = (cell: Cell) => {
  const value = cell == null ? '' : String(cell);
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  // BOM so Excel opens UTF-8 (₹, non-English names) correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
