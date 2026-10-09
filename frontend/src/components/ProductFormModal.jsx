import { useEffect, useState } from 'react';
import { Autocomplete, Badge, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { api } from '../api';
import { useMoney } from '../context/SettingsContext';
import { notifyError, notifySuccess } from '../notify';
import { useApi } from '../useApi';

const EMPTY = { code: '', name: '', brand: '', description: '', price: '', cost: '', stock: 0, min_stock: 0, category_id: null, is_active: true };

export default function ProductFormModal({ opened, onClose, product, categories, onSaved }) {
  const editing = Boolean(product);
  const { symbol } = useMoney();
  const { data: brands } = useApi(opened ? '/products/brands' : null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setForm(product
      ? { ...EMPTY, ...product, code: product.code || '', brand: product.brand || '', description: product.description || '', category_id: String(product.category_id) }
      : EMPTY);
  }, [opened, product]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const margin = Number(form.price) > 0 && Number(form.cost) > 0
    ? ((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100
    : null;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      code: form.code,
      name: form.name,
      brand: form.brand,
      description: form.description,
      price: Number(form.price).toFixed(2),
      cost: Number(form.cost || 0).toFixed(2),
      min_stock: Number(form.min_stock || 0),
      category_id: Number(form.category_id),
    };
    try {
      if (editing) {
        await api.put(`/products/${product.product_id}`, { ...payload, is_active: form.is_active });
      } else {
        await api.post('/products', { ...payload, stock: Number(form.stock || 0) });
      }
      notifySuccess(editing ? 'Producto actualizado.' : 'Producto creado.');
      onSaved?.();
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Editar producto' : 'Nuevo producto'} size="lg">
      <form onSubmit={submit}>
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Código / código de barras" value={form.code} maxLength={50}
              onChange={(e) => set('code')(e.target.value)} />
            <TextInput label="Nombre" required value={form.name} maxLength={150} style={{ gridColumn: 'span 2' }}
              onChange={(e) => set('name')(e.target.value)} data-autofocus />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Categoría" required placeholder="Elegir categoría" searchable
              data={(categories || []).map((c) => ({ value: String(c.category_id), label: c.name }))}
              value={form.category_id} onChange={set('category_id')}
              nothingFoundMessage="No hay categorías. Créalas en el menú Categorías." />
            <Autocomplete label="Marca" placeholder="Ej. Polar (opcional)" maxLength={100}
              data={brands || []} value={form.brand} onChange={set('brand')} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput label={`Precio de venta (${symbol})`} required min={0} decimalScale={2} fixedDecimalScale
              value={form.price} onChange={set('price')} />
            <NumberInput label={`Costo de compra (${symbol})`} min={0} decimalScale={2} fixedDecimalScale
              value={form.cost} onChange={set('cost')}
              rightSection={margin !== null ? <Badge size="xs" variant="light" color={margin >= 0 ? 'teal' : 'red'}>{margin.toFixed(0)}%</Badge> : null}
              rightSectionWidth={56} />
            {!editing && (
              <NumberInput label="Stock inicial" min={0} allowDecimal={false} value={form.stock} onChange={set('stock')}
                description="Queda registrado como entrada" />
            )}
            <NumberInput label="Stock mínimo" min={0} allowDecimal={false} value={form.min_stock} onChange={set('min_stock')}
              description="Al llegar a este número se avisa para reponer" />
          </SimpleGrid>
          <Textarea label="Descripción" autosize minRows={2} value={form.description}
            onChange={(e) => set('description')(e.target.value)} />
          {editing && (
            <Switch label="Producto activo (se puede vender)" checked={form.is_active}
              onChange={(e) => set('is_active')(e.currentTarget.checked)} />
          )}
          {margin !== null && (
            <Text size="sm" c="dimmed">Margen de ganancia: <b>{margin.toFixed(1)}%</b> sobre el precio de venta.</Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
