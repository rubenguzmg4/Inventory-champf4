import { Badge, Center, Drawer, Loader, Table, Text } from '@mantine/core';
import { useApi } from '../useApi';
import { formatDateTime } from '../utils/format';

const TYPE_COLORS = { entrada: 'teal', venta: 'blue', ajuste: 'orange', 'anulación': 'grape' };

/** Kárdex: todo lo que ha movido el stock de un producto. */
export default function MovementsDrawer({ product, onClose }) {
  const { data, loading } = useApi(product ? `/products/${product.product_id}/movements` : null);

  return (
    <Drawer opened={Boolean(product)} onClose={onClose} position="right" size="xl"
      title={<Text fw={700}>Historial · {product?.name}</Text>}>
      {loading && <Center p="xl"><Loader /></Center>}
      {!loading && data?.length === 0 && <Text c="dimmed">Este producto aún no tiene movimientos.</Text>}
      {!loading && data?.length > 0 && (
        <Table.ScrollContainer minWidth={520}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th ta="right">Cantidad</Table.Th>
                <Table.Th>Detalle</Table.Th>
                <Table.Th>Usuario</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((m, i) => (
                <Table.Tr key={i}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(m.date)}</Table.Td>
                  <Table.Td><Badge variant="light" color={TYPE_COLORS[m.type]}>{m.type}</Badge></Table.Td>
                  <Table.Td ta="right" fw={600} c={m.quantity > 0 ? 'teal' : 'red'}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </Table.Td>
                  <Table.Td>{m.reference}</Table.Td>
                  <Table.Td>{m.user_name}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Drawer>
  );
}
