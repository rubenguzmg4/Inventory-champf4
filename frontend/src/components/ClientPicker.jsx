import { useMemo, useState } from 'react';
import { ActionIcon, Group, Select, Tooltip } from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { IconUserPlus } from '@tabler/icons-react';
import { useApi } from '../useApi';
import ClientFormModal from './ClientFormModal';
import { EXAMPLES } from '../examples';

const label = (c) => `${c.name} ${c.lastname}`.trim() + ` · ${c.client_id}`;

/** Buscador de clientes por cédula o nombre, con botón para registrar uno nuevo. */
export default function ClientPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 250);
  const [opened, modal] = useDisclosure();
  const searching = debounced && (!value || debounced !== label(value));
  const { data } = useApi('/clients', { search: searching ? debounced : '', limit: 20 });

  const clients = useMemo(() => {
    const list = [...(data || [])];
    if (value && !list.some((c) => c.client_id === value.client_id)) list.unshift(value);
    return list;
  }, [data, value]);

  return (
    <Group gap="xs" wrap="nowrap" align="flex-end">
      <Select
        label="Cliente"
        placeholder={EXAMPLES.clientPickerSearch}
        searchable
        style={{ flex: 1 }}
        data={clients.map((c) => ({ value: c.client_id, label: label(c) }))}
        value={value?.client_id ?? null}
        onChange={(id) => onChange(clients.find((c) => c.client_id === id) || null)}
        searchValue={search}
        onSearchChange={setSearch}
        filter={({ options }) => options}
        nothingFoundMessage="Sin resultados · usa el botón + para registrarlo"
      />
      <Tooltip label="Registrar cliente nuevo">
        <ActionIcon size={36} variant="light" onClick={modal.open} aria-label="Registrar cliente nuevo">
          <IconUserPlus size={18} />
        </ActionIcon>
      </Tooltip>
      <ClientFormModal
        opened={opened}
        onClose={modal.close}
        initialId={/\d/.test(search) && !value ? search : ''}
        onSaved={(client) => onChange(client)}
      />
    </Group>
  );
}
