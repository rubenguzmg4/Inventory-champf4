import { Badge, Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';

/** Tarjeta con un número importante, su ícono y (opcional) la variación vs. otro período. */
export default function StatCard({ label, value, icon: Icon, color = 'brand', change, changeLabel, hint, onClick }) {
  const up = change !== null && change !== undefined && change >= 0;
  return (
    <Card padding="lg" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.4}>{label}</Text>
          <Text fw={700} fz={26} mt={4} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
        </div>
        {Icon && (
          <ThemeIcon size={44} radius="md" variant="light" color={color}>
            <Icon size={24} stroke={1.6} />
          </ThemeIcon>
        )}
      </Group>
      {(change !== null && change !== undefined) || hint ? (
        <Group gap={6} mt="sm">
          {change !== null && change !== undefined && (
            <Badge
              variant="light"
              color={up ? 'teal' : 'red'}
              leftSection={up ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
            >
              {Math.abs(change).toFixed(0)}%
            </Badge>
          )}
          <Text size="xs" c="dimmed">{changeLabel || hint}</Text>
        </Group>
      ) : null}
    </Card>
  );
}
