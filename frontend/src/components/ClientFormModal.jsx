import { useEffect, useState } from 'react';
import { Button, Group, Modal, SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core';
import { api } from '../api';
import { notifyError, notifySuccess } from '../notify';
import { EXAMPLES } from '../examples';

const EMPTY = { client_id: '', name: '', lastname: '', phone: '', email: '', address: '' };

/** Crear o editar un cliente. Si `client` viene con datos, se edita. */
export default function ClientFormModal({ opened, onClose, client, initialId = '', onSaved }) {
  const editing = Boolean(client);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) setForm(client ? { ...EMPTY, ...client } : { ...EMPTY, client_id: initialId });
  }, [opened, client, initialId]);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { client_id: clientId, ...rest } = form;
      const saved = editing
        ? await api.put(`/clients/${encodeURIComponent(clientId)}`, rest)
        : await api.post('/clients', form);
      notifySuccess(editing ? 'Cliente actualizado.' : 'Cliente registrado.');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Editar cliente' : 'Nuevo cliente'} size="lg">
      <form onSubmit={submit}>
        <Stack>
          <TextInput label="Cédula / RIF" placeholder={EXAMPLES.clientId} required disabled={editing} data-autofocus
            value={form.client_id} onChange={set('client_id')} maxLength={20} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Nombre o razón social" required placeholder={EXAMPLES.clientName} value={form.name} onChange={set('name')} maxLength={100} />
            <TextInput label="Apellido" placeholder={EXAMPLES.clientLastname} value={form.lastname} onChange={set('lastname')} maxLength={100} />
            <TextInput label="Teléfono" placeholder={EXAMPLES.clientPhone} value={form.phone || ''} onChange={set('phone')} maxLength={20} />
            <TextInput label="Correo" type="email" placeholder={EXAMPLES.clientEmail} value={form.email || ''} onChange={set('email')} maxLength={120} />
          </SimpleGrid>
          <Textarea label="Dirección" placeholder={EXAMPLES.clientAddress} autosize minRows={2} value={form.address || ''} onChange={set('address')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
