import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Badge, Button, Card, Center, Group, Loader, Select, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconDownload, IconSearch } from '@tabler/icons-react';
import DateRangeFilter from '../components/DateRangeFilter';
import PageHeader from '../components/PageHeader';
import { useMoney } from '../context/SettingsContext';
import { useApi } from '../useApi';
import { downloadCsv } from '../utils/csv';
import { billNumber, browserTz, datePresets, formatDateTime, formatInt } from '../utils/format';

export default function BillsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { money } = useMoney();
  const clientId = params.get('cliente');
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const [range, setRange] = useState(clientId ? [null, null] : datePresets()[3].value); // Este mes
  const [status, setStatus] = useState(null);

  const hasRange = range[0] && range[1];
  const { data: bills, loading } = useApi('/bills', {
    search: debounced,
    client_id: clientId,
    date_from: hasRange ? range[0] : null,
    date_to: hasRange ? range[1] : null,
    tz: browserTz,
    status,
  });

  const paid = (bills || []).filter((b) => b.status === 'paid');
  const total = paid.reduce((sum, b) => sum + b.total, 0);

  const exportCsv = () => downloadCsv('facturas', [
    { label: 'N°', value: (b) => billNumber(b.bill_id) },
    { label: 'Fecha', value: (b) => formatDateTime(b.date) },
    { label: 'Cédula/RIF', value: (b) => b.client_id },
    { label: 'Cliente', value: (b) => b.client_name },
    { label: 'Cajero', value: (b) => b.cashier_name },
    { label: 'Forma de pago', value: (b) => b.payment_method },
    { label: 'Artículos', value: (b) => b.items_count },
    { label: 'Total', value: (b) => b.total },
    { label: 'Estado', value: (b) => (b.status === 'void' ? 'Anulada' : 'Pagada') },
  ], bills || []);

  return (
    <>
      <PageHeader title="Facturas" description={clientId ? `Facturas del cliente ${clientId}` : 'Historial de ventas'}>
        <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportCsv} disabled={!bills?.length}>
          Exportar
        </Button>
        <Button onClick={() => navigate('/facturar')}>Nueva venta</Button>
      </PageHeader>

      <Card padding="md" mb="md">
        <Group gap="sm" wrap="wrap">
          <TextInput placeholder="N° de factura, cédula o cliente" leftSection={<IconSearch size={16} />}
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <DateRangeFilter value={range} onChange={setRange} clearable />
          <Select placeholder="Estado" clearable w={150} value={status} onChange={setStatus}
            data={[{ value: 'paid', label: 'Pagadas' }, { value: 'void', label: 'Anuladas' }]} />
        </Group>
      </Card>

      <Card padding={0}>
        {loading && !bills ? (
          <Center p="xl"><Loader /></Center>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>N°</Table.Th><Table.Th>Fecha</Table.Th><Table.Th>Cliente</Table.Th>
                  <Table.Th>Cajero</Table.Th><Table.Th>Pago</Table.Th><Table.Th ta="right">Total</Table.Th><Table.Th>Estado</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bills?.length === 0 && (
                  <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center" py="lg">No hay facturas con estos filtros.</Text></Table.Td></Table.Tr>
                )}
                {bills?.map((b) => (
                  <Table.Tr key={b.bill_id} className="clickable-row" onClick={() => navigate(`/facturas/${b.bill_id}`)}>
                    <Table.Td fw={600}>{billNumber(b.bill_id)}</Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(b.date)}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{b.client_name}</Text>
                      <Text size="xs" c="dimmed">{b.client_id}</Text>
                    </Table.Td>
                    <Table.Td>{b.cashier_name}</Table.Td>
                    <Table.Td>{b.payment_method}</Table.Td>
                    <Table.Td ta="right" fw={600} className="money" td={b.status === 'void' ? 'line-through' : undefined}>{money(b.total)}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={b.status === 'void' ? 'red' : 'teal'}>{b.status === 'void' ? 'Anulada' : 'Pagada'}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        {paid.length > 0 && (
          <Group justify="flex-end" p="md" gap="xl" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="sm" c="dimmed">{formatInt(paid.length)} facturas pagadas</Text>
            <Text fw={700}>Total: <span className="money">{money(total)}</span></Text>
          </Group>
        )}
      </Card>
    </>
  );
}
