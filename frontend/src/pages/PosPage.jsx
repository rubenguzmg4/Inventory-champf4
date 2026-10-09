import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ActionIcon, Affix, Badge, Button, Card, Chip, Divider, Grid, Group, Kbd, Modal, NumberInput, Paper, ScrollArea, SimpleGrid,
  Stack, Text, TextInput, Textarea, ThemeIcon, Title,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { IconCheck, IconMinus, IconPlus, IconPrinter, IconSearch, IconShoppingCart, IconTrash } from '@tabler/icons-react';
import { api } from '../api';
import ClientPicker from '../components/ClientPicker';
import { useMoney, useSettings } from '../context/SettingsContext';
import { notifyError } from '../notify';
import { useApi } from '../useApi';
import { billNumber, fold, formatNumber } from '../utils/format';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function PosPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { money, secondary, rate } = useMoney();
  const { data: products, reload: reloadProducts } = useApi('/products');
  const { data: categories } = useApi('/categories');
  const searchRef = useRef(null);
  const cartRef = useRef(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [client, setClient] = useState(null);
  const [payment, setPayment] = useState(settings.payment_methods?.[0] || 'Efectivo');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  // Cliente por defecto: "Consumidor Final"
  const loadDefaultClient = () => api.get('/clients/0').then(setClient).catch(() => setClient(null));
  useEffect(() => {
    loadDefaultClient();
  }, []);

  const filtered = useMemo(() => {
    const term = fold(search);
    return (products || []).filter((p) =>
      (category === 'all' || String(p.category_id) === category) &&
      (!term || fold(p.name).includes(term) || fold(p.code || '').includes(term)));
  }, [products, search, category]);

  const addProduct = (product) => {
    if (product.stock <= 0) {
      notifyError(`"${product.name}" está agotado.`, 'Sin stock');
      return;
    }
    setCart((current) => {
      const line = current.find((l) => l.product.product_id === product.product_id);
      if (!line) return [...current, { product, quantity: 1 }];
      if (line.quantity >= product.stock) {
        notifyError(`Solo hay ${product.stock} unidades de "${product.name}".`, 'Stock insuficiente');
        return current;
      }
      return current.map((l) => (l === line ? { ...l, quantity: l.quantity + 1 } : l));
    });
  };

  const setQuantity = (productId, quantity) => {
    setCart((current) => current.map((l) => {
      if (l.product.product_id !== productId) return l;
      const q = Math.max(1, Math.min(Number(quantity) || 1, l.product.stock));
      return { ...l, quantity: q };
    }));
  };

  const removeLine = (productId) => setCart((current) => current.filter((l) => l.product.product_id !== productId));

  // Enter en el buscador: si el código coincide exacto (lector de código de barras) se agrega directo
  const onSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    const term = search.trim().toLowerCase();
    const exact = (products || []).find((p) => p.code && p.code.toLowerCase() === term);
    const match = exact || (filtered.length === 1 ? filtered[0] : null);
    if (match) {
      addProduct(match);
      setSearch('');
    }
  };

  const subtotal = round2(cart.reduce((sum, l) => sum + round2(l.product.price * l.quantity), 0));
  const taxRate = Number(settings.tax_rate) || 0;
  const tax = round2((subtotal * taxRate) / 100);
  const total = round2(subtotal + tax);
  const units = cart.reduce((sum, l) => sum + l.quantity, 0);

  const submit = async () => {
    if (!cart.length || !client || submitting) return;
    setSubmitting(true);
    try {
      const bill = await api.post('/bills', {
        client_id: client.client_id,
        payment_method: payment,
        note,
        items: cart.map((l) => ({ product_id: l.product.product_id, quantity: l.quantity })),
      });
      setCreated(bill);
      setCart([]);
      setNote('');
      loadDefaultClient();
      reloadProducts();
    } catch (error) {
      notifyError(error, 'No se pudo facturar');
      reloadProducts();
    } finally {
      setSubmitting(false);
    }
  };

  useHotkeys([
    ['F2', () => searchRef.current?.focus()],
    ['F9', submit],
  ], []);

  const newSale = () => {
    setCreated(null);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  return (
    <>
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7, xl: 8 }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={2}>Facturar</Title>
              <Text size="xs" c="dimmed" visibleFrom="sm"><Kbd>F2</Kbd> buscar · <Kbd>F9</Kbd> cobrar</Text>
            </Group>
            <TextInput
              ref={searchRef}
              size="md"
              autoFocus
              placeholder="Buscar por nombre o código de barras"
              leftSection={<IconSearch size={18} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <ScrollArea type="never">
              <Chip.Group value={category} onChange={setCategory}>
                <Group gap={6} wrap="nowrap">
                  <Chip value="all" size="sm">Todas</Chip>
                  {(categories || []).filter((c) => c.product_count > 0).map((c) => (
                    <Chip key={c.category_id} value={String(c.category_id)} size="sm">{c.name}</Chip>
                  ))}
                </Group>
              </Chip.Group>
            </ScrollArea>
            {products && filtered.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">No se encontraron productos.</Text>
            )}
            <SimpleGrid cols={{ base: 2, sm: 3, xl: 4 }} spacing="sm">
              {filtered.slice(0, 80).map((p) => (
                <Card key={p.product_id} padding="sm" className="product-tile" data-disabled={p.stock <= 0 || undefined}
                  onClick={() => addProduct(p)}>
                  <Text fw={600} size="sm" lineClamp={2} mih={40}>{p.name}</Text>
                  <Text size="xs" c="dimmed" truncate>{p.code || p.category_name}</Text>
                  <Group justify="space-between" mt="xs" gap={4} wrap="nowrap">
                    <Text fw={700} c="brand" className="money">{money(p.price)}</Text>
                    <Badge size="sm" variant="light" title="Disponibles" style={{ flexShrink: 0 }} color={p.stock <= 0 ? 'red' : p.is_low_stock ? 'orange' : 'gray'}>
                      {p.stock <= 0 ? 'Agotado' : p.stock}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5, xl: 4 }}>
          <Card ref={cartRef} padding="md" style={{ position: 'sticky', top: 76, scrollMarginTop: 76 }}>
            <Stack gap="sm">
              <ClientPicker value={client} onChange={setClient} />
              <Divider label={<Group gap={6}><IconShoppingCart size={14} />{units} artículo(s)</Group>} labelPosition="left" />

              {cart.length === 0 ? (
                <Stack align="center" gap={4} py="lg">
                  <ThemeIcon size={48} radius="xl" variant="light"><IconShoppingCart size={26} /></ThemeIcon>
                  <Text c="dimmed" size="sm">Toca un producto para agregarlo</Text>
                </Stack>
              ) : (
                <ScrollArea.Autosize mah="40vh" offsetScrollbars>
                  <Stack gap="xs">
                    {cart.map(({ product, quantity }) => (
                      <Paper key={product.product_id} p="xs" radius="md">
                        <Group justify="space-between" gap="xs" wrap="nowrap">
                          <Text size="sm" fw={600} lineClamp={1}>{product.name}</Text>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeLine(product.product_id)} aria-label="Eliminar">
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                        <Group justify="space-between" gap="xs" wrap="nowrap" mt={4}>
                          <Group gap={4} wrap="nowrap">
                            <ActionIcon variant="default" size="sm" onClick={() => (quantity > 1 ? setQuantity(product.product_id, quantity - 1) : removeLine(product.product_id))} aria-label="Quitar uno">
                              <IconMinus size={14} />
                            </ActionIcon>
                            <NumberInput size="xs" w={52} hideControls min={1} max={product.stock} allowDecimal={false}
                              value={quantity} onChange={(v) => setQuantity(product.product_id, v)} styles={{ input: { textAlign: 'center' } }} />
                            <ActionIcon variant="default" size="sm" onClick={() => addProduct(product)} aria-label="Agregar uno">
                              <IconPlus size={14} />
                            </ActionIcon>
                            <Text size="xs" c="dimmed" className="money">× {money(product.price)}</Text>
                          </Group>
                          <Text size="sm" fw={700} className="money">{money(product.price * quantity)}</Text>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              )}

              <Divider />
              <Stack gap={4}>
                <Group justify="space-between"><Text size="sm">Subtotal</Text><Text size="sm" className="money">{money(subtotal)}</Text></Group>
                {taxRate > 0 && (
                  <Group justify="space-between">
                    <Text size="sm">{settings.tax_name} ({formatNumber(taxRate)}%)</Text>
                    <Text size="sm" className="money">{money(tax)}</Text>
                  </Group>
                )}
                <Group justify="space-between" align="baseline">
                  <Text fw={700} size="lg">Total</Text>
                  <Text fw={800} fz={28} c="brand" className="money">{money(total)}</Text>
                </Group>
                {rate > 0 && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Tasa {formatNumber(rate)}</Text>
                    <Text size="sm" fw={600} className="money">{secondary(total)}</Text>
                  </Group>
                )}
              </Stack>

              <div>
                <Text size="sm" fw={500} mb={6}>Forma de pago</Text>
                <Chip.Group value={payment} onChange={setPayment}>
                  <Group gap={6}>
                    {(settings.payment_methods || ['Efectivo']).map((m) => <Chip key={m} value={m} size="sm">{m}</Chip>)}
                  </Group>
                </Chip.Group>
              </div>
              <Textarea placeholder="Nota (opcional)" autosize minRows={1} maxRows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="lg" fullWidth leftSection={<IconCheck size={20} />} loading={submitting}
                disabled={!cart.length || !client} onClick={submit}>
                Cobrar {cart.length ? money(total) : ''}
              </Button>
              {cart.length > 0 && (
                <Button variant="subtle" color="gray" size="xs" onClick={() => setCart([])}>Vaciar carrito</Button>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* En el celular el carrito queda abajo: esta barra lleva directo a él */}
      {cart.length > 0 && (
        <Affix position={{ bottom: 16, left: 16, right: 16 }} hiddenFrom="md">
          <Button fullWidth size="lg" radius="xl" leftSection={<IconShoppingCart size={20} />}
            onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{ boxShadow: 'var(--mantine-shadow-lg)' }}>
            Ver carrito ({units}) · {money(total)}
          </Button>
        </Affix>
      )}

      <Modal opened={Boolean(created)} onClose={newSale} withCloseButton={false} size="sm">
        {created && (
          <Stack align="center" ta="center" gap="sm" py="md">
            <ThemeIcon size={64} radius="xl" color="teal"><IconCheck size={36} /></ThemeIcon>
            <Title order={3}>¡Venta registrada!</Title>
            <Text c="dimmed">Factura N° {billNumber(created.bill_id)} · {created.client.name} {created.client.lastname}</Text>
            <Text fw={800} fz={32} className="money">{money(created.total)}</Text>
            {secondary(created.total, created.exchange_rate) && (
              <Text c="dimmed">{secondary(created.total, created.exchange_rate)}</Text>
            )}
            <Group grow w="100%" mt="sm">
              <Button variant="default" leftSection={<IconPrinter size={18} />}
                onClick={() => navigate(`/facturas/${created.bill_id}?imprimir=1`)}>
                Imprimir
              </Button>
              <Button onClick={newSale} data-autofocus>Nueva venta</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
