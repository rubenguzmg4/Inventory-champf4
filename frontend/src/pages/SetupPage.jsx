import { useState } from 'react';
import { Alert, Button, Center, Paper, PasswordInput, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { IconAlertCircle, IconRocket } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { EXAMPLES } from '../examples';

/** Primera vez que se abre la aplicación: nombre del negocio y usuario administrador. */
export default function SetupPage() {
  const { setup } = useAuth();
  const [form, setForm] = useState({ business_name: '', full_name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const mismatch = form.confirm && form.password !== form.confirm;

  const submit = async (event) => {
    event.preventDefault();
    if (mismatch) return;
    setError(null);
    setLoading(true);
    try {
      const { confirm, ...data } = form; // eslint-disable-line no-unused-vars
      await setup(data);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Center mih="100vh" p="md" className="app-main">
      <Paper p="xl" radius="lg" shadow="md" w="100%" maw={560}>
        <form onSubmit={submit}>
          <Stack>
            <ThemeIcon size={56} radius="xl" variant="light"><IconRocket size={30} /></ThemeIcon>
            <div>
              <Title order={2}>¡Bienvenido!</Title>
              <Text c="dimmed">Configura tu negocio y crea el usuario administrador. Luego podrás subir tu logo y elegir los colores.</Text>
            </div>
            {error && <Alert color="red" icon={<IconAlertCircle size={18} />} style={{ whiteSpace: 'pre-line' }}>{error}</Alert>}
            <TextInput label="Nombre del negocio" required autoFocus placeholder={EXAMPLES.setupBusinessName} value={form.business_name} onChange={set('business_name')} maxLength={150} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Tu nombre" placeholder={EXAMPLES.setupFullName} value={form.full_name} onChange={set('full_name')} maxLength={100} />
              <TextInput label="Usuario" placeholder={EXAMPLES.setupUsername} description="Sin espacios" required autoCapitalize="none"
                value={form.username} onChange={set('username')} minLength={3} maxLength={50} pattern="[A-Za-z0-9._\-]+" />
              <PasswordInput label="Contraseña" description="Mínimo 6 caracteres" required minLength={6}
                value={form.password} onChange={set('password')} />
              <PasswordInput label="Repite la contraseña" required value={form.confirm} onChange={set('confirm')}
                error={mismatch ? 'No coinciden' : null} />
            </SimpleGrid>
            <Button type="submit" size="md" loading={loading}>Comenzar</Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
