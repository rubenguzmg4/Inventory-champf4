import dayjs from 'dayjs';

const numberFormat = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Las tasas de cambio se muestran con hasta 4 decimales (como las publica el BCV)
const rateFormat = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const intFormat = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });

export const formatNumber = (value) => numberFormat.format(Number(value || 0));
export const formatRate = (value) => rateFormat.format(Number(value || 0));
export const formatInt = (value) => intFormat.format(Number(value || 0));
export const formatMoney = (value, symbol = '$') => `${symbol} ${formatNumber(value)}`;
export const formatDate = (iso) => (iso ? dayjs(iso).format('DD/MM/YYYY') : '');
export const formatDateTime = (iso) => (iso ? dayjs(iso).format('DD/MM/YYYY h:mm a') : '');
// Texto sin acentos ni mayúsculas, para comparar búsquedas ("cafe" encuentra "Café")
export const fold = (text = '') => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const billNumber = (id) => String(id).padStart(6, '0');

// Zona horaria del equipo, para que los reportes agrupen por el día local
export const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const today = () => dayjs().format('YYYY-MM-DD');

// Rangos de fecha rápidos para filtros y reportes
export function datePresets() {
  const d = dayjs();
  const fmt = (x) => x.format('YYYY-MM-DD');
  return [
    { label: 'Hoy', value: [fmt(d), fmt(d)] },
    { label: 'Ayer', value: [fmt(d.subtract(1, 'day')), fmt(d.subtract(1, 'day'))] },
    { label: 'Últimos 7 días', value: [fmt(d.subtract(6, 'day')), fmt(d)] },
    { label: 'Este mes', value: [fmt(d.startOf('month')), fmt(d)] },
    { label: 'Mes anterior', value: [fmt(d.subtract(1, 'month').startOf('month')), fmt(d.subtract(1, 'month').endOf('month'))] },
    { label: 'Este año', value: [fmt(d.startOf('year')), fmt(d)] },
  ];
}

// Variación porcentual entre dos valores (para "vs ayer", "vs mes anterior")
export function percentChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
