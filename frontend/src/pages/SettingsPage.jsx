import { useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, ColorInput, ColorSwatch, FileButton, Grid, Group, NumberInput, Paper, SegmentedControl,
  SimpleGrid, Stack, Tabs, TagsInput, Text, TextInput, Textarea, Title, UnstyledButton, useMantineColorScheme,
} from '@mantine/core';
import { IconAlertTriangle, IconBrush, IconBuildingStore, IconCheck, IconDeviceFloppy, IconPhotoUp, IconReceipt, IconRefresh, IconTrash } from '@tabler/icons-react';
import { api } from '../api';
import BusinessLogo from '../components/BusinessLogo';
import PageHeader from '../components/PageHeader';
import { useSettings } from '../context/SettingsContext';
import { notifyError, notifySuccess } from '../notify';
import { COLOR_PRESETS, sidebarVars } from '../theme';
import { formatDate, formatDateTime, formatRate } from '../utils/format';

const FIELDS = [
  'business_name', 'tax_id', 'address', 'phone', 'email', 'invoice_footer', 'currency_symbol', 'tax_name', 'tax_rate',
  'secondary_currency_symbol', 'exchange_rate', 'exchange_rate_mode', 'payment_methods', 'receipt_format', 'reorder_cover_days',
  'primary_color', 'sidebar_color', 'color_scheme', 'radius',
];

const RADIUS = [
  { value: 'xs', label: 'Recto' }, { value: 'sm', label: 'Suave' }, { value: 'md', label: 'Medio' },
  { value: 'lg', label: 'Redondo' }, { value: 'xl', label: 'Muy redondo' },
];

const SWATCHES = ['#228be6', '#1c7ed6', '#0c8599', '#12b886', '#2f9e44', '#82c91e', '#f59f00', '#e8590c', '#e03131', '#d6336c', '#ae3ec9', '#7048e8', '#4263eb', '#495057', '#212529'];

function pick(settings) {
  const empty = { payment_methods: [], exchange_rate_mode: 'bcv' };
  return Object.fromEntries(FIELDS.map((f) => [f, settings[f] ?? (f in empty ? empty[f] : '')]));
}

/** Estado de la tasa automática del BCV: valor vigente, de dónde salió y cuándo se consultó. */
function RateStatus({ saved, active, onRefresh, refreshing }) {
  const rate = Number(saved.exchange_rate);
  return (
    <Paper p="md" radius="md" bg="var(--mantine-color-default-hover)" withBorder={false}>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Tasa vigente</Text>
          {rate > 0 ? (
            <Text fw={800} fz={28} className="money">
              {formatRate(rate)} <Text span size="sm" c="dimmed" fw={500}>{saved.secondary_currency_symbol} por 1 {saved.currency_symbol}</Text>
            </Text>
          ) : (
            <Text fw={600} c="dimmed" mt={4}>Todavía no se ha consultado</Text>
          )}
          {saved.exchange_rate_source && (
            <Text size="sm" c="dimmed">
              {saved.exchange_rate_source}
              {saved.exchange_rate_date && ` · fecha valor ${formatDate(saved.exchange_rate_date)}`}
            </Text>
          )}
          {saved.exchange_rate_updated_at && (
            <Text size="xs" c="dimmed">Última consulta: {formatDateTime(saved.exchange_rate_updated_at)}</Text>
          )}
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} loading={refreshing} disabled={!active} onClick={onRefresh}>
          Actualizar ahora
        </Button>
      </Group>
      {!active && <Text size="xs" c="orange" mt="xs">Guarda los cambios para activar la tasa automática.</Text>}
      {saved.exchange_rate_error && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />} mt="sm">{saved.exchange_rate_error}</Alert>
      )}
      <Text size="xs" c="dimmed" mt="sm">
        Se consulta al iniciar el sistema y luego cada hora. Para el día siguiente, el BCV publica su tasa en la tarde o noche.
      </Text>
    </Paper>
  );
}

/** Vista previa en miniatura de cómo se verá la barra lateral y los botones. */
function ThemePreview({ form }) {
  const vars = sidebarVars(form.sidebar_color) || {};
  return (
    <Paper radius="md" style={{ overflow: 'hidden' }}>
      <Group gap={0} align="stretch" wrap="nowrap" h={190}>
        <Stack gap={6} p="sm" w={150}
          style={{ background: vars['--sidebar-bg'] || 'var(--mantine-color-body)', color: vars['--sidebar-fg'], borderRight: '1px solid var(--mantine-color-default-border)' }}>
          <Group gap={6} wrap="nowrap"><BusinessLogo size={22} /><Text size="xs" fw={700} truncate>{form.business_name}</Text></Group>
          <div className="nav-link active" style={{ ...vars, padding: '5px 8px', fontSize: 12 }}>Facturar</div>
          <div className="nav-link" style={{ padding: '5px 8px', fontSize: 12 }}>Productos</div>
          <div className="nav-link" style={{ padding: '5px 8px', fontSize: 12 }}>Reportes</div>
        </Stack>
        <Stack gap="xs" p="md" style={{ flex: 1 }} className="app-main">
          <Text fw={700}>Vista previa</Text>
          <Group gap="xs">
            <Button size="xs">Cobrar</Button>
            <Button size="xs" variant="light">Exportar</Button>
          </Group>
          <Group gap="xs"><Badge>Nuevo</Badge><Badge variant="light">12 disp.</Badge></Group>
          <Text c="brand" fw={800} fz="xl">$ 125,00</Text>
        </Stack>
      </Group>
    </Paper>
  );
}

export default function SettingsPage() {
  const { saved, setSettings, setPreview, loadFull } = useSettings();
  const { setColorScheme } = useMantineColorScheme();
  const [form, setForm] = useState(() => pick(saved));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const setText = (field) => (event) => set(field)(event.target.value);

  // Muestra los cambios de apariencia en vivo; al salir sin guardar se descartan
  useEffect(() => {
    setPreview({ primary_color: form.primary_color, sidebar_color: form.sidebar_color || null, radius: form.radius });
  }, [form.primary_color, form.sidebar_color, form.radius, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        tax_rate: Number(form.tax_rate || 0).toFixed(2),
        exchange_rate: form.exchange_rate === '' || form.exchange_rate === null || Number(form.exchange_rate) <= 0
          ? null : Number(form.exchange_rate).toFixed(4),
        reorder_cover_days: Number(form.reorder_cover_days) || 15,
        sidebar_color: form.sidebar_color || null,
      };
      if (payload.exchange_rate_mode === 'bcv') delete payload.exchange_rate; // La tasa automática no se escribe a mano
      const data = await api.put('/settings', payload);
      setSettings((s) => ({ ...s, ...data }));
      setForm(pick(data));
      notifySuccess('Los cambios se guardaron.', 'Configuración');
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const data = await api('/settings/logo', { method: 'PUT', form: body });
      setSettings((s) => ({ ...s, logo_url: data.logo_url }));
      notifySuccess('Logo actualizado.');
    } catch (error) {
      notifyError(error);
    } finally {
      setUploading(false);
    }
  };

  const refreshRate = async () => {
    setRefreshing(true);
    try {
      const data = await api.post('/settings/exchange-rate/refresh');
      setSettings((s) => ({ ...s, ...data }));
      setForm((f) => ({ ...f, exchange_rate: data.exchange_rate ?? '' }));
      notifySuccess(`Tasa actualizada: ${formatRate(data.exchange_rate)}`, 'Tasa del BCV');
    } catch (error) {
      notifyError(error, 'Tasa del BCV');
      loadFull().catch(() => {}); // Para mostrar el error guardado
    } finally {
      setRefreshing(false);
    }
  };

  const removeLogo = async () => {
    try {
      await api.del('/settings/logo');
      setSettings((s) => ({ ...s, logo_url: null }));
    } catch (error) {
      notifyError(error);
    }
  };

  const changeScheme = (value) => {
    set('color_scheme')(value);
    setColorScheme(value);
  };

  return (
    <>
      <PageHeader title="Configuración" description="Datos del negocio, apariencia y facturación">
        <Button leftSection={<IconDeviceFloppy size={16} />} loading={saving} onClick={save}>Guardar cambios</Button>
      </PageHeader>

      <Tabs defaultValue="apariencia">
        <Tabs.List mb="md">
          <Tabs.Tab value="apariencia" leftSection={<IconBrush size={16} />}>Apariencia</Tabs.Tab>
          <Tabs.Tab value="negocio" leftSection={<IconBuildingStore size={16} />}>Negocio</Tabs.Tab>
          <Tabs.Tab value="facturacion" leftSection={<IconReceipt size={16} />}>Facturación</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="apariencia">
          <Grid>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Stack>
                <Card padding="lg">
                  <Title order={4} mb={4}>Logo del local</Title>
                  <Text size="sm" c="dimmed" mb="md">Aparece en el menú, la pantalla de inicio de sesión, las facturas y los reportes. PNG, JPG o WEBP de hasta 2 MB (mejor con fondo transparente).</Text>
                  <Group>
                    <Paper p="md" radius="md" bg="white" style={{ minWidth: 120, display: 'flex', justifyContent: 'center' }}>
                      <BusinessLogo size={80} />
                    </Paper>
                    <Stack gap="xs">
                      <FileButton onChange={uploadLogo} accept="image/png,image/jpeg,image/webp,image/gif">
                        {(props) => <Button {...props} loading={uploading} leftSection={<IconPhotoUp size={16} />}>Subir logo</Button>}
                      </FileButton>
                      {saved.logo_url && (
                        <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={removeLogo}>Quitar logo</Button>
                      )}
                    </Stack>
                  </Group>
                </Card>

                <Card padding="lg">
                  <Title order={4} mb={4}>Colores</Title>
                  <Text size="sm" c="dimmed" mb="md">Elige una paleta lista o tus propios colores. Los cambios se ven al instante; recuerda guardarlos.</Text>
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="lg">
                    {COLOR_PRESETS.map((p) => {
                      const active = form.primary_color === p.primary && form.sidebar_color === p.sidebar;
                      return (
                        <UnstyledButton key={p.name} onClick={() => setForm((f) => ({ ...f, primary_color: p.primary, sidebar_color: p.sidebar }))}>
                          <Paper p="xs" radius="md" style={{ borderColor: active ? p.primary : undefined, borderWidth: active ? 2 : 1 }}>
                            <Group gap={4} mb={4}>
                              <ColorSwatch color={p.sidebar} size={22} />
                              <ColorSwatch color={p.primary} size={22}>{active && <IconCheck size={14} color="#fff" />}</ColorSwatch>
                            </Group>
                            <Text size="xs" fw={500}>{p.name}</Text>
                          </Paper>
                        </UnstyledButton>
                      );
                    })}
                  </SimpleGrid>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <ColorInput label="Color principal" description="Botones, enlaces y elementos activos" format="hex"
                      swatches={SWATCHES} swatchesPerRow={8} value={form.primary_color} onChange={set('primary_color')} />
                    <div>
                      <ColorInput label="Color de la barra lateral" description="Vacío = color neutro" format="hex"
                        swatches={['#1c3d5a', '#1f3b2c', '#3b2417', '#2a1f4d', '#3d1a2a', '#123a40', '#212529', '#ffffff', '#f1f3f5']}
                        swatchesPerRow={9} value={form.sidebar_color || ''} onChange={set('sidebar_color')} placeholder="Neutro" />
                      {form.sidebar_color && (
                        <Button variant="subtle" size="compact-xs" mt={4} onClick={() => set('sidebar_color')('')}>Usar color neutro</Button>
                      )}
                    </div>
                  </SimpleGrid>
                </Card>

                <Card padding="lg">
                  <Title order={4} mb="md">Estilo</Title>
                  <Stack>
                    <div>
                      <Text size="sm" fw={500} mb={4}>Modo de color predeterminado</Text>
                      <SegmentedControl value={form.color_scheme} onChange={changeScheme}
                        data={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'auto', label: 'Según el equipo' }]} />
                      <Text size="xs" c="dimmed" mt={4}>Cada usuario puede cambiarlo con el botón de la luna en la parte superior.</Text>
                    </div>
                    <div>
                      <Text size="sm" fw={500} mb={4}>Bordes</Text>
                      <SegmentedControl value={form.radius} onChange={set('radius')} data={RADIUS} />
                    </div>
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <div style={{ position: 'sticky', top: 76 }}>
                <ThemePreview form={form} />
              </div>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="negocio">
          <Card padding="lg" maw={800}>
            <Text size="sm" c="dimmed" mb="md">Estos datos aparecen en el encabezado de las facturas.</Text>
            <Stack>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Nombre del negocio" required value={form.business_name} onChange={setText('business_name')} maxLength={150} />
                <TextInput label="RIF / Identificación fiscal" value={form.tax_id} onChange={setText('tax_id')} maxLength={50} />
                <TextInput label="Teléfono" value={form.phone} onChange={setText('phone')} maxLength={50} />
                <TextInput label="Correo" type="email" value={form.email} onChange={setText('email')} maxLength={120} />
              </SimpleGrid>
              <Textarea label="Dirección" autosize minRows={2} value={form.address} onChange={setText('address')} />
              <Textarea label="Mensaje al pie de la factura" autosize minRows={2} value={form.invoice_footer} onChange={setText('invoice_footer')} />
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="facturacion">
          <Stack maw={800}>
            <Card padding="lg">
              <Title order={4} mb="md">Moneda e impuestos</Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <TextInput label="Símbolo de la moneda" value={form.currency_symbol} onChange={setText('currency_symbol')} maxLength={5} />
                <TextInput label="Nombre del impuesto" value={form.tax_name} onChange={setText('tax_name')} maxLength={20} />
                <NumberInput label="Porcentaje del impuesto" description="0 = no cobrar impuesto" suffix=" %" min={0} max={100}
                  decimalScale={2} value={form.tax_rate} onChange={set('tax_rate')} />
              </SimpleGrid>
            </Card>
            <Card padding="lg">
              <Title order={4} mb={4}>Segunda moneda (opcional)</Title>
              <Text size="sm" c="dimmed" mb="md">Muestra el total también en bolívares (u otra moneda) usando la tasa del día. Si no quieres mostrarla, usa el modo manual y deja la tasa vacía.</Text>
              <Stack>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput label="Símbolo" value={form.secondary_currency_symbol} onChange={setText('secondary_currency_symbol')} maxLength={5} />
                  <div>
                    <Text size="sm" fw={500} mb={4}>Origen de la tasa</Text>
                    <SegmentedControl fullWidth value={form.exchange_rate_mode} onChange={set('exchange_rate_mode')}
                      data={[{ value: 'bcv', label: 'Automática (BCV)' }, { value: 'manual', label: 'Manual' }]} />
                  </div>
                </SimpleGrid>
                {form.exchange_rate_mode === 'bcv' ? (
                  <RateStatus saved={saved} active={saved.exchange_rate_mode === 'bcv'} onRefresh={refreshRate} refreshing={refreshing} />
                ) : (
                  <NumberInput label={`Tasa (${form.secondary_currency_symbol || 'Bs.'} por 1 ${form.currency_symbol || '$'})`} min={0}
                    decimalScale={4} value={form.exchange_rate ?? ''} onChange={set('exchange_rate')} placeholder="Ej. 874,73"
                    description="Escribe la tasa que quieras usar; se mantiene hasta que la cambies" />
                )}
              </Stack>
            </Card>
            <Card padding="lg">
              <Title order={4} mb="md">Ventas</Title>
              <Stack>
                <TagsInput label="Formas de pago" description="Escribe y presiona Enter para agregar" value={form.payment_methods}
                  onChange={set('payment_methods')} clearable />
                <div>
                  <Text size="sm" fw={500} mb={4}>Formato de impresión predeterminado</Text>
                  <SegmentedControl value={form.receipt_format} onChange={set('receipt_format')}
                    data={[{ value: 'a4', label: 'Hoja carta / A4' }, { value: 'ticket', label: 'Ticket 80 mm' }]} />
                </div>
                <NumberInput label="Días de venta a cubrir al reponer" description="Se usa para calcular cuánto pedir en Reposición"
                  min={1} max={365} allowDecimal={false} w={260} value={form.reorder_cover_days} onChange={set('reorder_cover_days')} />
              </Stack>
            </Card>
            <Alert variant="light" color="gray">
              Nota: este sistema emite facturas de control interno. Para facturas fiscales con validez ante el SENIAT se requiere
              una impresora fiscal o un proveedor de facturación digital autorizado.
            </Alert>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
