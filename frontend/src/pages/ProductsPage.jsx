import { useState } from 'react';
import { ActionIcon, Badge, Button, Card, Center, Checkbox, Group, Loader, Menu, SegmentedControl, Select, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import {
  IconAdjustmentsHorizontal, IconDots, IconDownload, IconEdit, IconHistory, IconPlus, IconSearch, IconTrash, IconTruckDelivery,
} from '@tabler/icons-react';
import { api } from '../api';
import AdjustStockModal from '../components/AdjustStockModal';
import EntryModal from '../components/EntryModal';
import MovementsDrawer from '../components/MovementsDrawer';
import PageHeader from '../components/PageHeader';
import ProductFormModal from '../components/ProductFormModal';
import { useAuth } from '../context/AuthContext';
import { useMoney } from '../context/SettingsContext';
import { notifyError, notifySuccess } from '../notify';
import { useApi } from '../useApi';
import { downloadCsv } from '../utils/csv';

export function StockBadge({ product }) {
  if (product.stock <= 0) return <Badge color="red" variant="filled">Agotado</Badge>;
  if (product.is_low_stock) return <Badge color="orange" variant="light">{product.stock}</Badge>;
  return <Badge color="gray" variant="light">{product.stock}</Badge>;
}

export default function ProductsPage() {
  const { isAdmin } = useAuth();
  const { money } = useMoney();
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 250);
  const [categoryId, setCategoryId] = useState(null);
  const [brand, setBrand] = useState(null);
  const [stockStatus, setStockStatus] = useState('all');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modal, setModal] = useState(null); // { type: 'form' | 'adjust' | 'entry', product }
  const [historyOf, setHistoryOf] = useState(null);

  const { data: categories } = useApi('/categories');
  const { data: brands, reload: reloadBrands } = useApi('/products/brands');
  const { data: allProducts, reload: reloadAll } = useApi(isAdmin ? '/products' : null);
  const { data: products, loading, reload } = useApi('/products', {
    search: debounced,
    category_id: categoryId,
    brand,
    stock_status: stockStatus === 'all' ? null : stockStatus,
    include_inactive: includeInactive || null,
  });

  const refresh = () => {
    reload();
    reloadAll();
    reloadBrands();
  };

  const remove = (product) => modals.openConfirmModal({
    title: `¿Eliminar "${product.name}"?`,
    children: <Text size="sm">Si el producto ya tiene ventas, se desactivará para conservar el historial.</Text>,
    labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        const result = await api.del(`/products/${product.product_id}`);
        notifySuccess(result.detail);
        refresh();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  const exportCsv = () => downloadCsv('productos', [
    { label: 'Código', value: (p) => p.code },
    { label: 'Producto', value: (p) => p.name },
    { label: 'Marca', value: (p) => p.brand },
    { label: 'Categoría', value: (p) => p.category_name },
    { label: 'Precio', value: (p) => p.price },
    ...(isAdmin ? [{ label: 'Costo', value: (p) => p.cost }] : []),
    { label: 'Stock', value: (p) => p.stock },
    { label: 'Stock mínimo', value: (p) => p.min_stock },
    { label: 'Activo', value: (p) => (p.is_active ? 'Sí' : 'No') },
  ], products || []);

  return (
    <>
      <PageHeader title="Productos" description="Catálogo, precios y existencias">
        <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportCsv} disabled={!products?.length}>Exportar</Button>
        {isAdmin && <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({ type: 'form' })}>Nuevo producto</Button>}
      </PageHeader>

      <Card padding="md" mb="md">
        <Group gap="sm" wrap="wrap">
          <TextInput placeholder="Buscar por nombre, marca o código" leftSection={<IconSearch size={16} />} value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <Select placeholder="Todas las categorías" clearable w={200} value={categoryId} onChange={setCategoryId}
            data={(categories || []).map((c) => ({ value: String(c.category_id), label: c.name }))} />
          <Select placeholder="Todas las marcas" clearable searchable w={200} value={brand} onChange={setBrand}
            data={brands || []} nothingFoundMessage="Sin marcas" />
          <SegmentedControl value={stockStatus} onChange={setStockStatus}
            data={[{ value: 'all', label: 'Todos' }, { value: 'low', label: 'Bajo stock' }, { value: 'out', label: 'Agotados' }]} />
          {isAdmin && <Checkbox label="Ver desactivados" checked={includeInactive} onChange={(e) => setIncludeInactive(e.currentTarget.checked)} />}
        </Group>
      </Card>

      <Card padding={0}>
        {loading && !products ? (
          <Center p="xl"><Loader /></Center>
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Producto</Table.Th>
                  <Table.Th>Marca</Table.Th>
                  <Table.Th ta="right">Precio</Table.Th>
                  {isAdmin && <Table.Th ta="right">Costo</Table.Th>}
                  <Table.Th ta="center">Stock</Table.Th>
                  <Table.Th ta="center">Mínimo</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {products?.length === 0 && (
                  <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" ta="center" py="lg">No hay productos con estos filtros.</Text></Table.Td></Table.Tr>
                )}
                {products?.map((p) => (
                  <Table.Tr key={p.product_id} opacity={p.is_active ? 1 : 0.55}>
                    <Table.Td c="dimmed">{p.code || '—'}</Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Text size="sm" fw={600}>{p.name}</Text>
                        {!p.is_active && <Badge size="xs" color="gray">Desactivado</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed">{p.category_name}</Text>
                    </Table.Td>
                    <Table.Td>{p.brand || <Text span c="dimmed">—</Text>}</Table.Td>
                    <Table.Td ta="right" fw={600} className="money">{money(p.price)}</Table.Td>
                    {isAdmin && <Table.Td ta="right" c="dimmed" className="money">{money(p.cost)}</Table.Td>}
                    <Table.Td ta="center"><StockBadge product={p} /></Table.Td>
                    <Table.Td ta="center" c="dimmed">{p.min_stock}</Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end" shadow="md" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label="Acciones"><IconDots size={18} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconHistory size={16} />} onClick={() => setHistoryOf(p)}>Historial de movimientos</Menu.Item>
                          {isAdmin && (
                            <>
                              <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => setModal({ type: 'form', product: p })}>Editar</Menu.Item>
                              <Menu.Item leftSection={<IconTruckDelivery size={16} />} onClick={() => setModal({ type: 'entry', product: p })}>Registrar entrada</Menu.Item>
                              <Menu.Item leftSection={<IconAdjustmentsHorizontal size={16} />} onClick={() => setModal({ type: 'adjust', product: p })}>Ajustar stock</Menu.Item>
                              <Menu.Divider />
                              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => remove(p)}>Eliminar</Menu.Item>
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <ProductFormModal opened={modal?.type === 'form'} onClose={() => setModal(null)} product={modal?.product}
        categories={categories} onSaved={refresh} />
      <AdjustStockModal opened={modal?.type === 'adjust'} onClose={() => setModal(null)} product={modal?.product} onSaved={refresh} />
      <EntryModal opened={modal?.type === 'entry'} onClose={() => setModal(null)} products={allProducts}
        productId={modal?.product?.product_id} onSaved={refresh} />
      <MovementsDrawer product={historyOf} onClose={() => setHistoryOf(null)} />
    </>
  );
}
