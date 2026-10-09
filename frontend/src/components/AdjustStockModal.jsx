import { useEffect, useState } from 'react';
import { Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { api } from '../api';
import { notifyError, notifySuccess } from '../notify';

const REASONS = ['Conteo físico', 'Mercancía dañada', 'Producto vencido', 'Pérdida o robo', 'Consumo interno', 'Otro'];

/** Corrige el stock a mano y deja el motivo registrado en el historial. */
export default function AdjustStockModal({ opened, onClose, product, onSaved }) {
  const [newStock, setNewStock] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened && product) {
      setNewStock(product.stock);
      setReason(REASONS[0]);
      setDetail('');
    }
  }, [opened, product]);

  if (!product) return null;
  const diff = Number(newStock || 0) - product.stock;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/products/${product.product_id}/adjust`, {
        new_stock: Number(newStock),
        reason: detail ? `${reason}: ${detail}` : reason,
      });
      notifySuccess(`El stock de "${product.name}" ahora es ${newStock}.`, 'Stock ajustado');
      onSaved?.();
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Ajustar stock · ${product.name}`}>
      <form onSubmit={submit}>
        <Stack>
          <Text size="sm">Stock actual en el sistema: <b>{product.stock}</b></Text>
          <NumberInput label="Stock real" description="La cantidad que hay físicamente" min={0} allowDecimal={false}
            required value={newStock} onChange={setNewStock} data-autofocus />
          {diff !== 0 && (
            <Text size="sm" c={diff > 0 ? 'teal' : 'red'}>
              {diff > 0 ? `Se sumarán ${diff}` : `Se restarán ${-diff}`} unidades
            </Text>
          )}
          <Select label="Motivo" data={REASONS} value={reason} onChange={(v) => setReason(v || REASONS[0])} allowDeselect={false} />
          <TextInput label="Detalle (opcional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving} disabled={diff === 0}>Guardar ajuste</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
