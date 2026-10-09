import { useState } from 'react';
import { Button, Group, Modal, PasswordInput, Stack } from '@mantine/core';
import { api } from '../api';
import { notifyError, notifySuccess } from '../notify';

export default function ChangePasswordModal({ opened, onClose }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const mismatch = form.confirm && form.next !== form.confirm;

  const submit = async (event) => {
    event.preventDefault();
    if (mismatch) return;
    setSaving(true);
    try {
      await api.put('/me/password', { current_password: form.current, new_password: form.next });
      notifySuccess('Tu contraseña fue actualizada.');
      setForm({ current: '', next: '', confirm: '' });
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Cambiar contraseña">
      <form onSubmit={submit}>
        <Stack>
          <PasswordInput label="Contraseña actual" required value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <PasswordInput label="Nueva contraseña" description="Mínimo 6 caracteres" required minLength={6}
            value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <PasswordInput label="Repite la nueva contraseña" required value={form.confirm}
            error={mismatch ? 'Las contraseñas no coinciden' : null}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
