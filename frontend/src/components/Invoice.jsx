import { useSettings } from '../context/SettingsContext';
import { billNumber, bsAmounts, formatDateTime, formatMoney, formatNumber, formatRate } from '../utils/format';
import './invoice.css';

/**
 * Factura lista para imprimir. format = 'a4' (hoja carta/A4) o 'ticket' (impresora térmica 80 mm).
 * Usa HTML sencillo (no componentes de Mantine) para que se imprima igual en modo claro u oscuro.
 */
export default function Invoice({ bill, format = 'a4' }) {
  const { settings } = useSettings();
  const symbol = settings.currency_symbol || '$';
  const money = (value) => formatMoney(value, symbol);
  const rate = Number(bill.exchange_rate) || 0;
  const bs = bsAmounts(bill);
  const bsMoney = (value) => formatMoney(value, settings.secondary_currency_symbol);
  const client = bill.client;
  const clientName = `${client.name} ${client.lastname}`.trim();
  const taxLabel = `${settings.tax_name || 'IVA'} (${formatNumber(bill.tax_rate)}%)`;

  return (
    <div className={`print-area invoice invoice-${format}`}>
      <style>{format === 'ticket' ? '@page { size: 80mm auto; margin: 3mm; }' : '@page { size: auto; margin: 12mm; }'}</style>
      {bill.status === 'void' && <div className="invoice-void-stamp">ANULADA</div>}

      <header className="invoice-header">
        {settings.logo_url && <img src={settings.logo_url} alt="Logo" className="invoice-logo" />}
        <div className="invoice-business">
          <div className="invoice-business-name">{settings.business_name}</div>
          {settings.tax_id && <div>RIF: {settings.tax_id}</div>}
          {settings.address && <div>{settings.address}</div>}
          {(settings.phone || settings.email) && (
            <div>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</div>
          )}
        </div>
        <div className="invoice-number">
          <div className="invoice-title">FACTURA</div>
          <div className="invoice-number-value">N° {billNumber(bill.bill_id)}</div>
          <div>{formatDateTime(bill.date)}</div>
        </div>
      </header>

      <section className="invoice-parties">
        <div>
          <div className="invoice-label">Cliente</div>
          <div className="invoice-strong">{clientName}</div>
          <div>C.I./RIF: {client.client_id}</div>
          {client.phone && <div>Tel.: {client.phone}</div>}
          {client.address && <div>{client.address}</div>}
        </div>
        <div className="invoice-meta">
          <div><span className="invoice-label">Atendido por:</span> {bill.cashier_name}</div>
          <div><span className="invoice-label">Forma de pago:</span> {bill.payment_method}</div>
        </div>
      </section>

      <table className="invoice-table">
        <thead>
          <tr>
            <th className="num">Cant.</th>
            <th>Descripción</th>
            <th className="num">P. unit.</th>
            <th className="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {bill.details.map((d) => (
            <tr key={d.detail_id}>
              <td className="num">{d.quantity}</td>
              <td>{d.product_name}</td>
              <td className="num">{money(d.unit_price)}</td>
              <td className="num">{money(d.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="invoice-totals">
        <table className="invoice-totals-table">
          {bs && (
            <thead>
              <tr><th /><th>{symbol}</th><th>{settings.secondary_currency_symbol}</th></tr>
            </thead>
          )}
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td>{money(bill.subtotal)}</td>
              {bs && <td>{bsMoney(bs.subtotal)}</td>}
            </tr>
            {Number(bill.tax_rate) > 0 && (
              <tr>
                <td>{taxLabel}</td>
                <td>{money(bill.tax_amount)}</td>
                {bs && <td>{bsMoney(bs.tax)}</td>}
              </tr>
            )}
            <tr className="invoice-total">
              <td>TOTAL</td>
              <td>{money(bill.total)}</td>
              {bs && <td>{bsMoney(bs.total)}</td>}
            </tr>
          </tbody>
        </table>
        {bs && (
          <div className="invoice-secondary">
            Tasa de cambio: {formatRate(rate)} {settings.secondary_currency_symbol} por 1 {symbol}
          </div>
        )}
      </section>

      {bill.note && <p className="invoice-note"><b>Nota:</b> {bill.note}</p>}
      {bill.status === 'void' && (
        <p className="invoice-note invoice-void-reason">
          Anulada el {formatDateTime(bill.voided_at)} por {bill.voided_by_name}. Motivo: {bill.void_reason}
        </p>
      )}
      {settings.invoice_footer && <footer className="invoice-footer">{settings.invoice_footer}</footer>}
    </div>
  );
}
