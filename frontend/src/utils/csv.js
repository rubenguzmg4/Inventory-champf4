/**
 * Descarga una tabla como archivo CSV que Excel (en español) abre correctamente:
 * separador ";" , decimales con coma y codificación UTF-8 con BOM.
 *   downloadCsv('productos', [{ label: 'Nombre', value: (p) => p.name }], productos)
 */
export function downloadCsv(filename, columns, rows) {
  const cell = (value) => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'number' ? String(value).replace('.', ',') : String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    columns.map((c) => cell(c.label)).join(';'),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(';')),
  ];
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
