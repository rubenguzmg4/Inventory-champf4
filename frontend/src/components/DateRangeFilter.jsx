import { Button, Group, Menu } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconChevronDown } from '@tabler/icons-react';
import { datePresets } from '../utils/format';
import { EXAMPLES } from '../examples';

/** Selector de período con atajos (Hoy, Este mes...). value = ['YYYY-MM-DD', 'YYYY-MM-DD'] */
export default function DateRangeFilter({ value, onChange, clearable = false }) {
  return (
    <Group gap={6} wrap="nowrap">
      <DatePickerInput
        type="range"
        value={value}
        onChange={onChange}
        valueFormat="DD/MM/YYYY"
        placeholder={EXAMPLES.dateRange}
        leftSection={<IconCalendar size={16} />}
        clearable={clearable}
        allowSingleDateInRange
        miw={230}
      />
      <Menu position="bottom-end" shadow="md">
        <Menu.Target>
          <Button variant="default" rightSection={<IconChevronDown size={14} />}>Rápido</Button>
        </Menu.Target>
        <Menu.Dropdown>
          {datePresets().map((preset) => (
            <Menu.Item key={preset.label} onClick={() => onChange(preset.value)}>{preset.label}</Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
