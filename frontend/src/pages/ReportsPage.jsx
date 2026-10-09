import { useState } from 'react';
import { Button, Card, Center, ColorSwatch, Grid, Group, Loader, Progress, SimpleGrid, Table, Tabs, Text, Title } from '@mantine/core';
import { AreaChart, BarChart, DonutChart } from '@mantine/charts';
import {
  IconBuildingWarehouse, IconCash, IconChartBar, IconCoin, IconDownload, IconPackages, IconPrinter, IconReceipt2,
  IconReceiptOff, IconReceiptTax, IconTrendingUp,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import BusinessLogo from '../components/BusinessLogo';
import DateRangeFilter from '../components/DateRangeFilter';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useMoney, useSettings } from '../context/SettingsContext';
import { useApi } from '../useApi';
import { usePrint } from '../usePrint';
import { downloadCsv } from '../utils/csv';
import { browserTz, datePresets, formatDate, formatInt, formatNumber } from '../utils/format';

const PALETTE = ['blue.6', 'teal.6', 'grape.6', 'yellow.6', 'cyan.6', 'pink.6', 'lime.7', 'indigo.6', 'orange.6', 'red.6'];

function PrintHeader({ title, subtitle }) {
  const { settings } = useSettings();
  return (
    <div className="print-only" style={{ marginBottom: 16 }}>
      <Group gap="md">
        <BusinessLogo size={48} />
        <div>
          <Text fw={800} size="lg">{settings.business_name}</Text>
          <Text size="sm">{title} · {subtitle}</Text>
        </div>
      </Group>
    </div>
  );
}

function SalesReport({ range }) {
  const { money } = useMoney();
  const [from, to] = range;
  const { data, loading } = useApi(from && to ? '/reports/sales' : null, { date_from: from, date_to: to, tz: browserTz });

  if (loading && !data) return <Center p="xl"><Loader /></Center>;
  if (!data) return <Text c="dimmed">Elige un período.</Text>;

  const s = data.summary;
  const margin = s.subtotal > 0 ? (s.gross_profit / s.subtotal) * 100 : 0;
  const days = data.by_day.map((d) => ({ ...d, label: dayjs(d.date).format('DD/MM') }));
  const maxCashier = Math.max(...data.by_cashier.map((c) => c.total), 1);

  const exportProducts = () => downloadCsv(`productos-vendidos_${from}_${to}`, [
    { label: 'Código', value: (p) => p.code },
    { label: 'Producto', value: (p) => p.name },
    { label: 'Unidades', value: (p) => p.quantity },
    { label: 'Ventas (sin impuesto)', value: (p) => p.total },
    { label: 'Ganancia', value: (p) => p.profit },
  ], data.top_products);

  const exportDays = () => downloadCsv(`ventas-por-dia_${from}_${to}`, [
    { label: 'Fecha', value: (d) => formatDate(d.date) },
    { label: 'Facturas', value: (d) => d.count },
    { label: 'Total', value: (d) => d.total },
  ], data.by_day);

  return (
    <div className="print-area report-print">
      <PrintHeader title="Reporte de ventas" subtitle={`${formatDate(from)} al ${formatDate(to)}`} />
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} mb="md">
        <StatCard label="Total vendido" value={money(s.total)} icon={IconCoin} hint="Incluye impuestos" />
        <StatCard label="Facturas" value={formatInt(s.bills_count)} icon={IconReceipt2} color="grape"
          hint={`Ticket promedio ${money(s.avg_ticket)}`} />
        <StatCard label="Ganancia bruta" value={money(s.gross_profit)} icon={IconTrendingUp} color="teal"
          hint={`Margen ${formatNumber(margin)}% · costo ${money(s.cost_total)}`} />
        <StatCard label="Unidades vendidas" value={formatInt(s.items_sold)} icon={IconPackages} color="orange" />
        <StatCard label="Impuestos cobrados" value={money(s.tax)} icon={IconReceiptTax} color="cyan" />
        <StatCard label="Ventas sin impuesto" value={money(s.subtotal)} icon={IconCash} color="indigo" />
        <StatCard label="Anuladas" value={formatInt(s.voided_count)} icon={IconReceiptOff} color="red"
          hint={s.voided_count ? `Por ${money(s.voided_total)}` : 'Ninguna'} />
      </SimpleGrid>

      {data.by_day.length > 1 && (
        <Card padding="lg" mb="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Ventas por día</Title>
            <Button variant="subtle" size="xs" leftSection={<IconDownload size={14} />} onClick={exportDays} className="no-print">CSV</Button>
          </Group>
          {days.length <= 45 ? (
            <BarChart h={260} data={days} dataKey="label" series={[{ name: 'total', label: 'Ventas', color: 'brand.6' }]}
              valueFormatter={(v) => money(v)} gridAxis="y" tickLine="none" />
          ) : (
            <AreaChart h={260} data={days} dataKey="label" curveType="monotone" withDots={false}
              series={[{ name: 'total', label: 'Ventas', color: 'brand.6' }]} valueFormatter={(v) => money(v)} gridAxis="y" tickLine="none" />
          )}
        </Card>
      )}

      <Grid mb="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card padding="lg" h="100%">
            <Title order={4} mb="md">Por forma de pago</Title>
            {data.by_payment_method.length === 0 ? <Text c="dimmed" size="sm">Sin ventas.</Text> : (
              <Group align="center" wrap="nowrap" gap="lg">
                <DonutChart size={160} thickness={26} withTooltip={false}
                  data={data.by_payment_method.map((p, i) => ({ name: p.method, value: p.total, color: PALETTE[i % PALETTE.length] }))} />
                <Table style={{ flex: 1 }}>
                  <Table.Tbody>
                    {data.by_payment_method.map((p, i) => (
                      <Table.Tr key={p.method}>
                        <Table.Td><Group gap={6} wrap="nowrap"><ColorSwatch size={10} color={`var(--mantine-color-${PALETTE[i % PALETTE.length].replace('.', '-')})`} />{p.method}</Group></Table.Td>
                        <Table.Td ta="right" c="dimmed">{p.count}</Table.Td>
                        <Table.Td ta="right" fw={600} className="money">{money(p.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Group>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card padding="lg" h="100%">
            <Title order={4} mb="md">Por categoría (sin impuesto)</Title>
            {data.by_category.length === 0 ? <Text c="dimmed" size="sm">Sin ventas.</Text> : (
              <BarChart h={Math.max(160, data.by_category.length * 36)} data={data.by_category} dataKey="category" orientation="vertical"
                series={[{ name: 'total', label: 'Ventas', color: 'teal.6' }]} valueFormatter={(v) => money(v)}
                yAxisProps={{ width: 110 }} gridAxis="none" />
            )}
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card padding="lg" h="100%">
            <Title order={4} mb="md">Por cajero</Title>
            {data.by_cashier.length === 0 && <Text c="dimmed" size="sm">Sin ventas.</Text>}
            {data.by_cashier.map((c) => (
              <div key={c.user} style={{ marginBottom: 12 }}>
                <Group justify="space-between" gap="xs"><Text size="sm" fw={500}>{c.user}</Text><Text size="sm" fw={600} className="money">{money(c.total)}</Text></Group>
                <Progress value={(c.total / maxCashier) * 100} size="sm" mt={4} />
                <Text size="xs" c="dimmed">{c.count} facturas</Text>
              </div>
            ))}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card padding={0} h="100%">
            <Group justify="space-between" p="md">
              <Title order={4}>Productos vendidos</Title>
              <Button variant="subtle" size="xs" leftSection={<IconDownload size={14} />} onClick={exportProducts} className="no-print">CSV</Button>
            </Group>
            <Table.ScrollContainer minWidth={480}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr><Table.Th>Producto</Table.Th><Table.Th ta="right">Unidades</Table.Th><Table.Th ta="right">Ventas</Table.Th><Table.Th ta="right">Ganancia</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.top_products.length === 0 && (
                    <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" size="sm">Sin ventas.</Text></Table.Td></Table.Tr>
                  )}
                  {data.top_products.map((p) => (
                    <Table.Tr key={p.product_id}>
                      <Table.Td>{p.name}</Table.Td>
                      <Table.Td ta="right">{formatInt(p.quantity)}</Table.Td>
                      <Table.Td ta="right" className="money">{money(p.total)}</Table.Td>
                      <Table.Td ta="right" className="money" c={p.profit >= 0 ? 'teal' : 'red'}>{money(p.profit)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  );
}

function InventoryReport() {
  const { money } = useMoney();
  const { data, loading } = useApi('/reports/inventory');
  if (loading && !data) return <Center p="xl"><Loader /></Center>;
  if (!data) return null;
  const t = data.totals;

  const exportCsv = () => downloadCsv(`inventario_${dayjs().format('YYYY-MM-DD')}`, [
    { label: 'Código', value: (p) => p.code },
    { label: 'Producto', value: (p) => p.name },
    { label: 'Categoría', value: (p) => p.category_name },
    { label: 'Stock', value: (p) => p.stock },
    { label: 'Costo', value: (p) => p.cost },
    { label: 'Precio', value: (p) => p.price },
    { label: 'Valor al costo', value: (p) => p.value_cost },
    { label: 'Valor a precio de venta', value: (p) => p.value_price },
  ], data.items);

  return (
    <div className="print-area report-print">
      <PrintHeader title="Inventario valorizado" subtitle={dayjs().format('DD/MM/YYYY')} />
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} mb="md">
        <StatCard label="Productos" value={formatInt(t.products)} icon={IconPackages} hint={`${formatInt(t.units)} unidades en total`} />
        <StatCard label="Valor al costo" value={money(t.value_cost)} icon={IconBuildingWarehouse} color="orange" hint="Lo que invertiste" />
        <StatCard label="Valor a precio de venta" value={money(t.value_price)} icon={IconCoin} color="teal" />
        <StatCard label="Ganancia potencial" value={money(t.potential_profit)} icon={IconTrendingUp} color="grape" />
      </SimpleGrid>
      <Card padding={0}>
        <Group justify="flex-end" p="sm" className="no-print">
          <Button variant="default" size="xs" leftSection={<IconDownload size={14} />} onClick={exportCsv}>Exportar</Button>
        </Group>
        <Table.ScrollContainer minWidth={760}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Producto</Table.Th><Table.Th>Categoría</Table.Th><Table.Th ta="right">Stock</Table.Th>
                <Table.Th ta="right">Costo</Table.Th><Table.Th ta="right">Precio</Table.Th>
                <Table.Th ta="right">Valor costo</Table.Th><Table.Th ta="right">Valor venta</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((p) => (
                <Table.Tr key={p.product_id}>
                  <Table.Td fw={500}>{p.name}</Table.Td>
                  <Table.Td c="dimmed">{p.category_name}</Table.Td>
                  <Table.Td ta="right" c={p.is_low_stock ? 'red' : undefined} fw={p.is_low_stock ? 700 : undefined}>{p.stock}</Table.Td>
                  <Table.Td ta="right" className="money">{money(p.cost)}</Table.Td>
                  <Table.Td ta="right" className="money">{money(p.price)}</Table.Td>
                  <Table.Td ta="right" className="money">{money(p.value_cost)}</Table.Td>
                  <Table.Td ta="right" className="money" fw={600}>{money(p.value_price)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('ventas');
  const [range, setRange] = useState(datePresets()[3].value);
  const print = usePrint();

  return (
    <>
      <PageHeader title="Reportes" description="Ventas, ganancias e inventario">
        {tab === 'ventas' && <DateRangeFilter value={range} onChange={setRange} />}
        <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={print}>Imprimir</Button>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md" className="no-print">
          <Tabs.Tab value="ventas" leftSection={<IconChartBar size={16} />}>Ventas</Tabs.Tab>
          <Tabs.Tab value="inventario" leftSection={<IconBuildingWarehouse size={16} />}>Inventario valorizado</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="ventas"><SalesReport range={range} /></Tabs.Panel>
        <Tabs.Panel value="inventario"><InventoryReport /></Tabs.Panel>
      </Tabs>
    </>
  );
}
