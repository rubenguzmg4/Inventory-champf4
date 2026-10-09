import { Image, ThemeIcon } from '@mantine/core';
import { IconBuildingStore } from '@tabler/icons-react';
import { useSettings } from '../context/SettingsContext';

/** Muestra el logo del negocio o, si no hay, un ícono con el color principal. */
export default function BusinessLogo({ size = 40, logoUrl }) {
  const { settings } = useSettings();
  const src = logoUrl === undefined ? settings.logo_url : logoUrl;
  if (src) {
    return <Image src={src} h={size} w="auto" maw={size * 3} fit="contain" alt="Logo del negocio" />;
  }
  return (
    <ThemeIcon size={size} radius="md" variant="filled">
      <IconBuildingStore size={size * 0.6} stroke={1.6} />
    </ThemeIcon>
  );
}
