import { useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Modal, PasswordInput, SegmentedControl, Stack, Switch, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { IconEdit, IconPlus } from '@tabler/icons-react';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { notifyError, notifySuccess } from '../notify';
import { useApi } from '../useApi';

const ROLES = [
  { value: 'cashier', label: 'Cajero' },
  { value: 'admin', label: 'Administrador' },
];

export default function UsersPage() {
  const { user: me } = useAuth();
  const { data: users, reload } = useApi('/users');
  const [editing, setEditing] = useState(null); // {} nuevo, {...} editar
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const open = (user) => {
    setForm(user
      ? { full_name: user.full_name || '', role: user.role, is_active: user.is_active, password: '' }
      : { username: '', full_name: '', role: 'cashier', password: '' });
    setEditing(user || {});
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing.user_id) {
        const { password, ...rest } = form;
        await api.put(`/users/${editing.user_id}`, password ? { ...rest, password } : rest);
      } else {
        await api.post('/users', form);
      }
      notifySuccess('Usuario guardado.');
      setEditing(null);
      reload();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Usuarios" description="Quién puede entrar al sistema y qué puede hacer">
        <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>Nuevo usuario</Button>
      </PageHeader>
      <Card padding={0}>
        <Table.ScrollContainer minWidth={520}>
          <Table>
            <Table.Thead>
              <Table.Tr><Table.Th>Usuario</Table.Th><Table.Th>Nombre</Table.Th><Table.Th>Rol</Table.Th><Table.Th>Estado</Table.Th><Table.Th w={60} /></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users?.map((u) => (
                <Table.Tr key={u.user_id}>
                  <Table.Td fw={600}>{u.username}{u.user_id === me.user_id && <Text span c="dimmed" size="xs"> (tú)</Text>}</Table.Td>
                  <Table.Td>{u.full_name}</Table.Td>
                  <Table.Td><Badge variant="light" color={u.role === 'admin' ? 'grape' : 'blue'}>{u.role === 'admin' ? 'Administrador' : 'Cajero'}</Badge></Table.Td>
                  <Table.Td><Badge variant="dot" color={u.is_active ? 'teal' : 'gray'}>{u.is_active ? 'Activo' : 'Desactivado'}</Badge></Table.Td>
                  <Table.Td><Tooltip label="Editar"><ActionIcon variant="subtle" onClick={() => open(u)}><IconEdit size={16} /></ActionIcon></Tooltip></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Text size="sm" c="dimmed" mt="md">
        Los <b>cajeros</b> pueden facturar, ver productos y registrar clientes. Los <b>administradores</b> además gestionan
        productos, entradas de mercancía, reportes, usuarios y la configuración.
      </Text>

      <Modal opened={editing !== null} onClose={() => setEditing(null)} title={editing?.user_id ? `Editar ${editing.username}` : 'Nuevo usuario'}>
        <form onSubmit={save}>
          <Stack>
            {!editing?.user_id && (
              <TextInput label="Usuario" description="Sin espacios" required data-autofocus autoCapitalize="none" minLength={3} maxLength={50}
                pattern="[A-Za-z0-9._\-]+" value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            )}
            <TextInput label="Nombre completo" value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <div>
              <Text size="sm" fw={500} mb={4}>Rol</Text>
              <SegmentedControl fullWidth data={ROLES} value={form.role} onChange={(role) => setForm({ ...form, role })} />
            </div>
            <PasswordInput
              label={editing?.user_id ? 'Nueva contraseña' : 'Contraseña'}
              description={editing?.user_id ? 'Déjala vacía para no cambiarla' : 'Mínimo 6 caracteres'}
              required={!editing?.user_id} minLength={6} value={form.password || ''}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {editing?.user_id && (
              <Switch label="Usuario activo (puede iniciar sesión)" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })} />
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Guardar</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
