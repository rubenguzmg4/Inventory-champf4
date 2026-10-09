import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { IconPlugConnectedX } from '@tabler/icons-react';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import PosPage from './pages/PosPage';
import BillsPage from './pages/BillsPage';
import BillDetailPage from './pages/BillDetailPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import ReplenishmentPage from './pages/ReplenishmentPage';
import ClientsPage from './pages/ClientsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

function Screens() {
  const { status, isAdmin, retry } = useAuth();

  if (status === 'loading') {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (status === 'offline') {
    return (
      <Center h="100vh" p="md">
        <Stack align="center" gap="sm">
          <IconPlugConnectedX size={48} stroke={1.5} />
          <Title order={3}>No se pudo conectar con el servidor</Title>
          <Text c="dimmed" ta="center">Verifica que la aplicación (Docker) esté encendida.</Text>
          <Button onClick={retry}>Reintentar</Button>
        </Stack>
      </Center>
    );
  }
  if (status === 'setup') return <SetupPage />;
  if (status === 'anonymous') return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={isAdmin ? <DashboardPage /> : <Navigate to="/facturar" replace />} />
        <Route path="facturar" element={<PosPage />} />
        <Route path="facturas" element={<BillsPage />} />
        <Route path="facturas/:billId" element={<BillDetailPage />} />
        <Route path="productos" element={<ProductsPage />} />
        <Route path="categorias" element={<AdminOnly><CategoriesPage /></AdminOnly>} />
        <Route path="reposicion" element={<ReplenishmentPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="reportes" element={<AdminOnly><ReportsPage /></AdminOnly>} />
        <Route path="usuarios" element={<AdminOnly><UsersPage /></AdminOnly>} />
        <Route path="configuracion" element={<AdminOnly><SettingsPage /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter>
          <Screens />
        </BrowserRouter>
      </AuthProvider>
    </SettingsProvider>
  );
}
