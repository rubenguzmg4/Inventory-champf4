import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, Button, Center, Group, Loader, Modal, SegmentedControl, Stack, Textarea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowLeft, IconBan, IconPrinter } from '@tabler/icons-react';
import { api } from '../api';
import Invoice from '../components/Invoice';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { notifyError, notifySuccess } from '../notify';
import { useApi } from '../useApi';
import { billNumber } from '../utils/format';

export default function BillDetailPage() {
  const { billId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const { data: bill, loading, error, reload } = useApi(`/bills/${billId}`);
  const [format, setFormat] = useState(settings.receipt_format || 'a4');
  const [voidOpened, voidModal] = useDisclosure();
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const printed = useRef(false);

  // Si se llegó desde "Imprimir" en el punto de venta, abre el diálogo de impresión
  useEffect(() => {
    if (bill && params.get('imprimir') && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [bill, params]);

  if (loading && !bill) return <Center p="xl"><Loader /></Center>;
  if (error) return <Alert color="red">{error.message}</Alert>;
  if (!bill) return null;

  const voidBill = async () => {
    setVoiding(true);
    try {
      await api.post(`/bills/${bill.bill_id}/void`, { reason });
      notifySuccess('La factura fue anulada y los productos regresaron al inventario.');
      voidModal.close();
      reload();
    } catch (err) {
      notifyError(err);
    } finally {
      setVoiding(false);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="lg" className="no-print" wrap="wrap">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/facturas'))}>Volver</Button>
        <Group gap="xs">
          <SegmentedControl value={format} onChange={setFormat}
            data={[{ value: 'a4', label: 'Hoja' }, { value: 'ticket', label: 'Ticket 80 mm' }]} />
          {isAdmin && bill.status === 'paid' && (
            <Button variant="light" color="red" leftSection={<IconBan size={16} />} onClick={voidModal.open}>Anular</Button>
          )}
          <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>Imprimir</Button>
        </Group>
      </Group>

      <Invoice bill={bill} format={format} />

      <Modal opened={voidOpened} onClose={voidModal.close} title={`Anular factura N° ${billNumber(bill.bill_id)}`}>
        <Stack>
          <Alert color="orange" variant="light">
            Los productos de esta factura regresarán al inventario. Esta acción no se puede deshacer.
          </Alert>
          <Textarea label="Motivo de la anulación" required autosize minRows={2} value={reason}
            onChange={(e) => setReason(e.target.value)} data-autofocus />
          <Group justify="flex-end">
            <Button variant="default" onClick={voidModal.close}>Cancelar</Button>
            <Button color="red" loading={voiding} disabled={!reason.trim()} onClick={voidBill}>Anular factura</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
