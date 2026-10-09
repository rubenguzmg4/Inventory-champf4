import { useState } from 'react';
import { Alert, Box, Button, Center, Grid, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle, IconLogin } from '@tabler/icons-react';
import BusinessLogo from '../components/BusinessLogo';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Grid gutter={0} mih="100vh" styles={{ inner: { minHeight: '100vh' } }}>
      <Grid.Col span={{ base: 12, md: 6 }} visibleFrom="md" className="login-hero">
        <Center h="100%" p="xl">
          <Stack align="center" gap="lg" maw={420} ta="center">
            <Box bg="white" p="lg" style={{ borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <BusinessLogo size={120} />
            </Box>
            <Title order={1} c="inherit">{settings.business_name}</Title>
            <Text size="lg" opacity={0.85}>Inventario, facturación y reportes de tu negocio en un solo lugar.</Text>
          </Stack>
        </Center>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Center h="100%" p="md" className="app-main">
          <Paper p="xl" radius="lg" shadow="md" w="100%" maw={420}>
            <form onSubmit={submit}>
              <Stack>
                <Stack align="center" gap="xs" hiddenFrom="md">
                  <BusinessLogo size={72} />
                  <Title order={3} ta="center">{settings.business_name}</Title>
                </Stack>
                <div>
                  <Title order={2}>Iniciar sesión</Title>
                  <Text c="dimmed" size="sm">Ingresa con tu usuario y contraseña</Text>
                </div>
                {error && <Alert color="red" icon={<IconAlertCircle size={18} />}>{error}</Alert>}
                <TextInput label="Usuario" required autoFocus autoComplete="username" autoCapitalize="none"
                  value={username} onChange={(e) => setUsername(e.target.value)} />
                <PasswordInput label="Contraseña" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="submit" size="md" loading={loading} leftSection={<IconLogin size={18} />}>Entrar</Button>
              </Stack>
            </form>
          </Paper>
        </Center>
      </Grid.Col>
    </Grid>
  );
}
