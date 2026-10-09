import { useState } from 'react';
import { ActionIcon, Button, Card, Group, Modal, Stack, Table, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import { notifyError, notifySuccess } from '../notify';
import { useApi } from '../useApi';

export default function CategoriesPage() {
  const { data: categories, reload } = useApi('/categories');
  const [editing, setEditing] = useState(null); // null = cerrado, {} = nueva, {...} = editar
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const open = (category) => {
    setForm({ name: category?.name || '', description: category?.description || '' });
    setEditing(category || {});
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing.category_id) await api.put(`/categories/${editing.category_id}`, form);
      else await api.post('/categories', form);
      notifySuccess('Categoría guardada.');
      setEditing(null);
      reload();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = (category) => modals.openConfirmModal({
    title: `¿Eliminar la categoría "${category.name}"?`,
    labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await api.del(`/categories/${category.category_id}`);
        notifySuccess('Categoría eliminada.');
        reload();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <>
      <PageHeader title="Categorías" description="Agrupa tus productos para encontrarlos más rápido">
        <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>Nueva categoría</Button>
      </PageHeader>
      <Card padding={0}>
        <Table.ScrollContainer minWidth={500}>
          <Table>
            <Table.Thead>
              <Table.Tr><Table.Th>Nombre</Table.Th><Table.Th>Descripción</Table.Th><Table.Th ta="center">Productos</Table.Th><Table.Th w={90} /></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categories?.length === 0 && (
                <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="lg">Crea tu primera categoría (ej. Bebidas, Víveres, Limpieza).</Text></Table.Td></Table.Tr>
              )}
              {categories?.map((c) => (
                <Table.Tr key={c.category_id}>
                  <Table.Td fw={600}>{c.name}</Table.Td>
                  <Table.Td c="dimmed">{c.description}</Table.Td>
                  <Table.Td ta="center">{c.product_count}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="Editar"><ActionIcon variant="subtle" onClick={() => open(c)}><IconEdit size={16} /></ActionIcon></Tooltip>
                      <Tooltip label="Eliminar"><ActionIcon variant="subtle" color="red" onClick={() => remove(c)}><IconTrash size={16} /></ActionIcon></Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Modal opened={editing !== null} onClose={() => setEditing(null)} title={editing?.category_id ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={save}>
          <Stack>
            <TextInput label="Nombre" required data-autofocus maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea label="Descripción" autosize minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
