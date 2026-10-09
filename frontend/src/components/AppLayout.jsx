import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  ActionIcon, AppShell, Avatar, Badge, Box, Burger, Group, Menu, ScrollArea, Text, Tooltip,
  UnstyledButton, useComputedColorScheme, useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCashRegister, IconCategory, IconChartBar, IconChevronRight, IconKey, IconLayoutDashboard, IconLogout,
  IconMoon, IconPackage, IconReceipt2, IconSettings, IconSun, IconTruckDelivery, IconUserShield, IconUsers,
} from '@tabler/icons-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { sidebarVars } from '../theme';
import BusinessLogo from './BusinessLogo';
import ChangePasswordModal from './ChangePasswordModal';

const NAV = [
  { to: '/', label: 'Inicio', icon: IconLayoutDashboard, admin: true, end: true },
  { to: '/facturar', label: 'Facturar', icon: IconCashRegister },
  { to: '/facturas', label: 'Facturas', icon: IconReceipt2 },
  { section: 'Inventario' },
  { to: '/productos', label: 'Productos', icon: IconPackage },
  { to: '/categorias', label: 'Categorías', icon: IconCategory, admin: true },
  { to: '/reposicion', label: 'Reposición', icon: IconTruckDelivery, badge: true },
  { section: 'Gestión' },
  { to: '/clientes', label: 'Clientes', icon: IconUsers },
  { to: '/reportes', label: 'Reportes', icon: IconChartBar, admin: true },
  { to: '/usuarios', label: 'Usuarios', icon: IconUserShield, admin: true },
  { to: '/configuracion', label: 'Configuración', icon: IconSettings, admin: true },
];

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const [passwordOpened, passwordModal] = useDisclosure();
  const { user, isAdmin, logout } = useAuth();
  const { settings } = useSettings();
  const { setColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme('light');
  const location = useLocation();
  const [lowStock, setLowStock] = useState(0);

  // Cantidad de productos bajo el mínimo (se actualiza al cambiar de pantalla)
  useEffect(() => {
    api.get('/products', { stock_status: 'low' }).then((items) => setLowStock(items.length)).catch(() => {});
    close();
  }, [location.pathname, close]);

  const customSidebar = sidebarVars(settings.sidebar_color);
  const displayName = user.full_name || user.username;
  const items = NAV.filter((item) => !item.admin || isAdmin);

  return (
    <AppShell
      layout="alt"
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="xs" hiddenFrom="sm" wrap="nowrap">
              <BusinessLogo size={30} />
              <Text fw={700} truncate maw={180}>{settings.business_name}</Text>
            </Group>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label={colorScheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Cambiar modo de color"
                onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
              >
                {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
            <Menu position="bottom-end" shadow="md" width={220}>
              <Menu.Target>
                <UnstyledButton className="user-button">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar color="brand" radius="xl" size={34}>{initials(displayName)}</Avatar>
                    <Box visibleFrom="xs">
                      <Text size="sm" fw={600} lh={1.2}>{displayName}</Text>
                      <Text size="xs" c="dimmed" lh={1.2}>{isAdmin ? 'Administrador' : 'Cajero'}</Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.username}</Menu.Label>
                <Menu.Item leftSection={<IconKey size={16} />} onClick={passwordModal.open}>Cambiar contraseña</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>Cerrar sesión</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={`sidebar no-print ${customSidebar ? 'sidebar-custom' : ''}`} style={customSidebar || undefined}>
        <AppShell.Section p="md" className="sidebar-brand">
          <Group gap="sm" wrap="nowrap">
            {/* Sobre una barra de color, el logo va en un recuadro blanco para que siempre se vea */}
            {customSidebar && settings.logo_url ? (
              <Box bg="white" p={4} style={{ borderRadius: 'var(--mantine-radius-md)', lineHeight: 0 }}>
                <BusinessLogo size={36} />
              </Box>
            ) : (
              <BusinessLogo size={42} />
            )}
            <Text fw={800} size="lg" lh={1.15} lineClamp={2}>{settings.business_name}</Text>
          </Group>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} px="sm" py="xs">
          {items.map((item, index) => {
            if (item.section) {
              return <Text key={item.section} className="nav-section" mt={index ? 'md' : 0}>{item.section}</Text>;
            }
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                <Icon size={20} stroke={1.7} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && lowStock > 0 && (
                  <Badge size="sm" color="red" variant="filled" circle={lowStock < 10}>{lowStock}</Badge>
                )}
              </NavLink>
            );
          })}
        </AppShell.Section>

        <AppShell.Section p="sm" className="sidebar-footer">
          <NavLink to="/facturar" className="nav-cta">
            <IconCashRegister size={20} />
            <span style={{ flex: 1 }}>Nueva venta</span>
            <IconChevronRight size={16} />
          </NavLink>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="app-main">
        <Box maw={1400} mx="auto">
          <Outlet />
        </Box>
      </AppShell.Main>

      <ChangePasswordModal opened={passwordOpened} onClose={passwordModal.close} />
    </AppShell>
  );
}
