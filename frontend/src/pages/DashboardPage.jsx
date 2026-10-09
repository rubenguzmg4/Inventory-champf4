import { Link, useNavigate } from 'react-router';
import { Alert, Anchor, Badge, Button, Card, Center, Grid, Group, Loader, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { IconAlertTriangle, IconCalendarMonth, IconCashRegister, IconCoin, IconPalette, IconReceipt2 } from '@tabler/icons-react';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { useMoney, useSettings } from '../context/SettingsContext';
import { useApi } from '../useApi';
import { billNumber, browserTz, formatDateTime, formatInt, percentChange } from '../utils/format';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { money } = useMoney();
  const { data, loading } = useApi('/reports/dashboard', { tz: browserTz });

  if (loading && !data) return <Center p="xl"><Loader /></Center>;
  if (!data) return null;

  const chart = data.sales_by_day.map((d) => ({ ...d, label: dayjs(d.date).format('DD MMM') }));
  const topMax = Math.max(...data.top_products.map((p) => p.total), 1);

  return (
    <>
      <PageHeader title={`Hola, ${(user.full_name || user.username).split(' ')[0]}`} description={dayjs().format('dddd, D [de] MMMM [de] YYYY')}>
        <Button leftSection={<IconCashRegister size={18} />} component={Link} to="/facturar">Nueva venta</Button>
      </PageHeader>

      {settings.exchange_rate_mode === 'bcv' && settings.exchange_rate_error && (
        <Alert icon={<IconAlertTriangle size={20} />} mb="lg" color="orange" variant="light" title="No se pudo actualizar la tasa del BCV">
          {Number(settings.exchange_rate) > 0
            ? `Se está usando la última tasa guardada (${Number(settings.exchange_rate).toLocaleString('es-VE')}). `
            : 'Todavía no hay tasa guardada, por eso no se muestra el total en bolívares. '}
          Revisa la conexión a internet o escribe la tasa a mano en{' '}
          <Anchor component={Link} to="/configuracion">Configuración</Anchor>.
        </Alert>
      )}

      {!settings.logo_url && (
        <Alert icon={<IconPalette size={20} />} mb="lg" variant="light" title="Personaliza tu negocio">
          Sube el logo de tu local y elige tus colores en{' '}
          <Anchor component={Link} to="/configuracion">Configuración</Anchor>.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} mb="lg">
        <StatCard label="Ventas de hoy" value={money(data.today.total)} icon={IconCoin}
          change={percentChange(data.today.total, data.yesterday.total)} changeLabel="vs. ayer" />
        <StatCard label="Ventas del mes" value={money(data.month.total)} icon={IconCalendarMonth} color="teal"
          change={percentChange(data.month.total, data.prev_month.total)} changeLabel="vs. mismo período del mes anterior" />
        <StatCard label="Facturas de hoy" value={formatInt(data.today.count)} icon={IconReceipt2} color="grape"
          hint={`${formatInt(data.month.count)} en el mes`} />
        <StatCard label="Por reponer" value={formatInt(data.low_stock_count)} icon={IconAlertTriangle}
          color={data.low_stock_count ? 'red' : 'gray'} onClick={() => navigate('/reposicion')}
          hint={data.out_of_stock_count ? `${data.out_of_stock_count} agotados · Ver lista` : 'Ver lista de reposición'} />
      </SimpleGrid>

      <Grid mb="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding="lg" h="100%">
            <Title order={4} mb="md">Ventas de los últimos 30 días</Title>
            <AreaChart h={280} data={chart} dataKey="label" curveType="monotone" withDots={false}
              series={[{ name: 'total', label: 'Ventas', color: 'brand.6' }]}
              valueFormatter={(v) => money(v)} gridAxis="y" tickLine="none" />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card padding="lg" h="100%">
            <Title order={4} mb="md">Lo más vendido del mes</Title>
            {data.top_products.length === 0 && <Text c="dimmed" size="sm">Aún no hay ventas este mes.</Text>}
            <Stack gap="md">
              {data.top_products.map((p) => (
                <div key={p.product_id}>
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} truncate>{p.name}</Text>
                    <Text size="sm" fw={600} className="money">{money(p.total)}</Text>
                  </Group>
                  <Progress value={(p.total / topMax) * 100} size="sm" mt={4} />
                  <Text size="xs" c="dimmed">{formatInt(p.quantity)} unidades</Text>
                </div>
              ))}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card padding="lg">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Últimas facturas</Title>
          <Anchor component={Link} to="/facturas" size="sm">Ver todas</Anchor>
        </Group>
        {data.recent_bills.length === 0 ? (
          <Text c="dimmed" size="sm">Todavía no hay facturas.</Text>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>N°</Table.Th><Table.Th>Fecha</Table.Th><Table.Th>Cliente</Table.Th>
                  <Table.Th>Pago</Table.Th><Table.Th ta="right">Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.recent_bills.map((b) => (
                  <Table.Tr key={b.bill_id} className="clickable-row" onClick={() => navigate(`/facturas/${b.bill_id}`)}>
                    <Table.Td fw={600}>{billNumber(b.bill_id)}</Table.Td>
                    <Table.Td>{formatDateTime(b.date)}</Table.Td>
                    <Table.Td>{b.client_name}</Table.Td>
                    <Table.Td>{b.payment_method}</Table.Td>
                    <Table.Td ta="right" className="money">
                      {b.status === 'void' ? <Badge color="red" variant="light">Anulada</Badge> : money(b.total)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </>
  );
}
