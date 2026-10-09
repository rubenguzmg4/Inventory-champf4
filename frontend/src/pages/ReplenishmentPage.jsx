import { useState } from 'react';
import { Alert, Badge, Button, Card, Center, Group, Loader, SimpleGrid, Table, Tabs, Text } from '@mantine/core';
import { IconAlertTriangle, IconClockHour4, IconDownload, IconInfoCircle, IconPackageOff, IconPlus, IconReceipt, IconTruckDelivery } from '@tabler/icons-react';
import DateRangeFilter from '../components/DateRangeFilter';
import EntryModal from '../components/EntryModal';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useMoney, useSettings } from '../context/SettingsContext';
import { useApi } from '../useApi';
import { downloadCsv } from '../utils/csv';
import { browserTz, datePresets, formatDateTime, formatInt, formatNumber } from '../utils/format';

const STATUS = {
  out: { label: 'Agotado', color: 'red' },
  low: { label: 'Bajo mínimo', color: 'orange' },
  soon: { label: 'Por agotarse', color: 'yellow' },
};

export default function ReplenishmentPage() {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const { money } = useMoney();
  const [tab, setTab] = useState('reponer');
  const [entry, setEntry] = useState(null); // { productId, quantity }
  const [range, setRange] = useState(datePresets()[3].value);

  const { data: items, loading, reload } = useApi('/products/replenishment');
  const { data: products, reload: reloadProducts } = useApi(isAdmin ? '/products' : null);
  const hasRange = range[0] && range[1];
  const { data: entries, reload: reloadEntries } = useApi(tab === 'entradas' ? '/entries' : null, {
    date_from: hasRange ? range[0] : null, date_to: hasRange ? range[1] : null, tz: browserTz,
  });

  const count = (status) => (items || []).filter((i) => i.status === status).length;
  const estimated = (items || []).reduce((sum, i) => sum + i.estimated_cost, 0);
  const afterSave = () => {
    reload();
    reloadProducts();
    reloadEntries();
  };

  const exportOrder = () => downloadCsv('pedido-reposicion', [
    { label: 'Código', value: (i) => i.code },
    { label: 'Producto', value: (i) => i.name },
    { label: 'Categoría', value: (i) => i.category_name },
    { label: 'Stock', value: (i) => i.stock },
    { label: 'Mínimo', value: (i) => i.min_stock },
    { label: 'Venta diaria', value: (i) => i.avg_daily_sales },
    { label: 'Cantidad a pedir', value: (i) => i.suggested_quantity },
    ...(isAdmin ? [{ label: 'Costo estimado', value: (i) => i.estimated_cost }] : []),
  ], items || []);

  return (
    <>
      <PageHeader title="Reposición de stock" description="Qué comprar, cuánto pedir y la mercancía que llegó">
        {isAdmin && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEntry({})}>Registrar entrada</Button>
        )}
      </PageHeader>

      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="reponer" leftSection={<IconAlertTriangle size={16} />}>
            Por reponer {items?.length ? <Badge size="sm" ml={4} color="red">{items.length}</Badge> : null}
          </Tabs.Tab>
          <Tabs.Tab value="entradas" leftSection={<IconTruckDelivery size={16} />}>Entradas de mercancía</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="reponer">
          <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} mb="md">
            <StatCard label="Agotados" value={count('out')} icon={IconPackageOff} color="red" />
            <StatCard label="Bajo el mínimo" value={count('low')} icon={IconAlertTriangle} color="orange" />
            <StatCard label="Se agotan pronto" value={count('soon')} icon={IconClockHour4} color="yellow"
              hint={`En menos de ${settings.reorder_cover_days} días`} />
            {isAdmin && <StatCard label="Costo del pedido" value={money(estimated)} icon={IconReceipt} hint="Según el último costo" />}
          </SimpleGrid>

          <Alert variant="light" icon={<IconInfoCircle size={18} />} mb="md">
            <b>Cantidad sugerida</b> = stock mínimo + lo que se vende en {settings.reorder_cover_days} días (según el promedio
            de los últimos 30) − stock actual. Si no hubo ventas, se sugiere llegar al doble del mínimo.
            {isAdmin && ' Puedes cambiar los días a cubrir en Configuración.'}
          </Alert>

          <Card padding={0}>
            <Group justify="flex-end" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
              <Button variant="default" size="xs" leftSection={<IconDownload size={14} />} onClick={exportOrder} disabled={!items?.length}>
                Descargar lista de pedido
              </Button>
            </Group>
            {loading && !items ? (
              <Center p="xl"><Loader /></Center>
            ) : (
              <Table.ScrollContainer minWidth={940}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Producto</Table.Th><Table.Th miw={130}>Estado</Table.Th>
                      <Table.Th ta="center">Stock</Table.Th><Table.Th ta="center">Mínimo</Table.Th>
                      <Table.Th ta="center">Venta diaria</Table.Th><Table.Th ta="center">Alcanza para</Table.Th>
                      <Table.Th ta="center">Pedir</Table.Th>
                      {isAdmin && <Table.Th ta="right">Costo est.</Table.Th>}
                      {isAdmin && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items?.length === 0 && (
                      <Table.Tr><Table.Td colSpan={9}><Text c="dimmed" ta="center" py="lg">🎉 Todo el inventario está en orden.</Text></Table.Td></Table.Tr>
                    )}
                    {items?.map((i) => (
                      <Table.Tr key={i.product_id}>
                        <Table.Td>
                          <Text size="sm" fw={600}>{i.name}</Text>
                          <Text size="xs" c="dimmed">{[i.code, i.category_name].filter(Boolean).join(' · ')}</Text>
                        </Table.Td>
                        <Table.Td><Badge variant="light" color={STATUS[i.status].color} style={{ flexShrink: 0 }} miw="max-content">{STATUS[i.status].label}</Badge></Table.Td>
                        <Table.Td ta="center" fw={700}>{i.stock}</Table.Td>
                        <Table.Td ta="center" c="dimmed">{i.min_stock}</Table.Td>
                        <Table.Td ta="center">{formatNumber(i.avg_daily_sales)}</Table.Td>
                        <Table.Td ta="center">{i.days_left === null ? '—' : `${formatInt(i.days_left)} días`}</Table.Td>
                        <Table.Td ta="center"><Text fw={800} c="brand">{i.suggested_quantity || '—'}</Text></Table.Td>
                        {isAdmin && <Table.Td ta="right" className="money">{money(i.estimated_cost)}</Table.Td>}
                        {isAdmin && (
                          <Table.Td>
                            <Button size="xs" variant="light" onClick={() => setEntry({ productId: i.product_id, quantity: i.suggested_quantity })}>
                              Recibir
                            </Button>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="entradas">
          <Card padding="md" mb="md">
            <DateRangeFilter value={range} onChange={setRange} />
          </Card>
          <Card padding={0}>
            <Table.ScrollContainer minWidth={760}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Fecha</Table.Th><Table.Th>Producto</Table.Th><Table.Th ta="center">Cantidad</Table.Th>
                    {isAdmin && <Table.Th ta="right">Costo unit.</Table.Th>}
                    <Table.Th>Proveedor</Table.Th><Table.Th>Nota</Table.Th><Table.Th>Usuario</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {entries?.length === 0 && (
                    <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center" py="lg">No hay entradas en este período.</Text></Table.Td></Table.Tr>
                  )}
                  {entries?.map((e) => (
                    <Table.Tr key={e.entry_id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.date)}</Table.Td>
                      <Table.Td fw={600}>{e.product_name}</Table.Td>
                      <Table.Td ta="center"><Badge variant="light" color="teal">+{formatInt(e.quantity)}</Badge></Table.Td>
                      {isAdmin && <Table.Td ta="right" className="money">{e.unit_cost === null ? '—' : money(e.unit_cost)}</Table.Td>}
                      <Table.Td>{e.supplier}</Table.Td>
                      <Table.Td c="dimmed">{e.note}</Table.Td>
                      <Table.Td>{e.user_name}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <EntryModal opened={entry !== null} onClose={() => setEntry(null)} products={products}
        productId={entry?.productId} quantity={entry?.quantity} onSaved={afterSave} />
    </>
  );
}
