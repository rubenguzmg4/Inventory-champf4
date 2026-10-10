import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionIcon, Button, Card, Group, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconEdit, IconPlus, IconReceipt2, IconSearch, IconTrash } from '@tabler/icons-react';
import { api } from '../api';
import ClientFormModal from '../components/ClientFormModal';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { notifyError, notifySuccess } from '../notify';
import { useApi } from '../useApi';
import { EXAMPLES } from '../examples';

export default function ClientsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 250);
  const { data: clients, reload } = useApi('/clients', { search: debounced });
  const [modal, setModal] = useState(null); // { client }

  const remove = (client) => modals.openConfirmModal({
    title: `¿Eliminar a ${client.name} ${client.lastname}?`,
    children: <Text size="sm">Solo se pueden eliminar clientes sin facturas.</Text>,
    labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await api.del(`/clients/${encodeURIComponent(client.client_id)}`);
        notifySuccess('Cliente eliminado.');
        reload();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <>
      <PageHeader title="Clientes" description="Personas y empresas a las que les facturas">
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({})}>Nuevo cliente</Button>
      </PageHeader>
      <Card padding="md" mb="md">
        <TextInput placeholder={EXAMPLES.clientListSearch} leftSection={<IconSearch size={16} />}
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      <Card padding={0}>
        <Table.ScrollContainer minWidth={700}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cédula / RIF</Table.Th><Table.Th>Nombre</Table.Th><Table.Th>Teléfono</Table.Th>
                <Table.Th>Correo</Table.Th><Table.Th>Dirección</Table.Th><Table.Th w={120} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clients?.length === 0 && (
                <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="lg">No se encontraron clientes.</Text></Table.Td></Table.Tr>
              )}
              {clients?.map((c) => (
                <Table.Tr key={c.client_id}>
                  <Table.Td fw={600}>{c.client_id}</Table.Td>
                  <Table.Td>{c.name} {c.lastname}</Table.Td>
                  <Table.Td>{c.phone}</Table.Td>
                  <Table.Td>{c.email}</Table.Td>
                  <Table.Td c="dimmed"><Text size="sm" lineClamp={1}>{c.address}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="Ver facturas">
                        <ActionIcon variant="subtle" onClick={() => navigate(`/facturas?cliente=${encodeURIComponent(c.client_id)}`)}><IconReceipt2 size={16} /></ActionIcon>
                      </Tooltip>
                      <Tooltip label="Editar"><ActionIcon variant="subtle" onClick={() => setModal({ client: c })}><IconEdit size={16} /></ActionIcon></Tooltip>
                      {isAdmin && (
                        <Tooltip label="Eliminar"><ActionIcon variant="subtle" color="red" onClick={() => remove(c)}><IconTrash size={16} /></ActionIcon></Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <ClientFormModal opened={modal !== null} onClose={() => setModal(null)} client={modal?.client} onSaved={reload} />
    </>
  );
}
