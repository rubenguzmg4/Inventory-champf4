import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';

/** Imprime siempre en modo claro (en modo oscuro el texto saldría blanco sobre el papel). */
export function usePrint() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  return () => {
    if (scheme === 'dark') setColorScheme('light');
    setTimeout(() => {
      window.print();
      if (scheme === 'dark') setColorScheme('dark');
    }, 150);
  };
}
