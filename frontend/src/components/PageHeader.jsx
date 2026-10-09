import { Group, Stack, Text, Title } from '@mantine/core';

export default function PageHeader({ title, description, children }) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap" gap="sm" className="no-print">
      <Stack gap={2}>
        <Title order={2}>{title}</Title>
        {description && <Text c="dimmed" size="sm">{description}</Text>}
      </Stack>
      {children && <Group gap="xs">{children}</Group>}
    </Group>
  );
}
