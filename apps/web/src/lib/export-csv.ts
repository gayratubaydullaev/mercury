/** BOM + CSV for Excel-friendly UTF-8 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (cell: string | number) => {
    const s = String(cell ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  const body = `\ufeff${lines.join('\r\n')}`;
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
