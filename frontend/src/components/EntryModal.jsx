import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { api } from '../api';
import { useMoney } from '../context/SettingsContext';
import { notifyError, notifySuccess } from '../notify';
import { fold } from '../utils/format';
import { EXAMPLES } from '../examples';

/**
 * Registrar mercancía que llegó (suma stock). Se puede abrir con un producto y
 * una cantidad ya elegidos (por ejemplo, desde la lista de reposición).
 */
export default function EntryModal({ opened, onClose, products, productId, quantity, onSaved }) {
  const { money, symbol } = useMoney();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const product = products?.find((p) => p.product_id === productId);
    setForm({
      product_id: productId ? String(productId) : null,
      quantity: quantity || '',
      unit_cost: product ? product.cost : '',
      supplier: '',
      note: '',
    });
  }, [opened, productId, quantity, products]);

  const options = useMemo(
    () => (products || []).map((p) => ({ value: String(p.product_id), label: `${p.code ? `${p.code} · ` : ''}${p.name}` })),
    [products],
  );
  const selected = products?.find((p) => String(p.product_id) === form.product_id);

  const selectProduct = (value) => {
    const product = products.find((p) => String(p.product_id) === value);
    setForm({ ...form, product_id: value, unit_cost: product ? product.cost : '' });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/entries', {
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        unit_cost: form.unit_cost === '' || form.unit_cost === null ? null : Number(form.unit_cost).toFixed(2),
        supplier: form.supplier,
        note: form.note,
      });
      notifySuccess(`Se sumaron ${form.quantity} unidades a "${selected?.name}".`, 'Entrada registrada');
      onSaved?.();
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  const total = Number(form.quantity || 0) * Number(form.unit_cost || 0);

  return (
    <Modal opened={opened} onClose={onClose} title="Registrar entrada de mercancía" size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Select label="Producto" placeholder={EXAMPLES.entryProduct} data={options} searchable required
            value={form.product_id} onChange={selectProduct} nothingFoundMessage="Sin resultados"
            filter={({ options, search }) => options.filter((o) => fold(o.label).includes(fold(search)))} />
          {selected && (
            <Text size="sm" c="dimmed">
              Stock actual: <b>{selected.stock}</b> · Mínimo: {selected.min_stock} · Quedará en{' '}
              <b>{selected.stock + Number(form.quantity || 0)}</b>
            </Text>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput label="Cantidad recibida" required min={1} allowDecimal={false} data-autofocus
              value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            <NumberInput label={`Costo unitario (${symbol})`} description="Actualiza el costo del producto"
              min={0} decimalScale={2} value={form.unit_cost} onChange={(v) => setForm({ ...form, unit_cost: v })} />
            <TextInput label="Proveedor" placeholder={EXAMPLES.entrySupplier} value={form.supplier || ''} maxLength={150}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            <TextInput label="Nota / N° de factura del proveedor" placeholder={EXAMPLES.entryNote} value={form.note || ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </SimpleGrid>
          {total > 0 && <Alert variant="light">Costo total de la entrada: <b>{money(total)}</b></Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Registrar entrada</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
