import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { api } from '../api';
import { buildTheme, DEFAULT_APPEARANCE } from '../theme';
import { formatMoney } from '../utils/format';

const SettingsContext = createContext(null);

/**
 * Guarda la configuración del negocio (nombre, logo, colores, impuestos...) y
 * aplica el tema de colores a toda la aplicación.
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  // Cambios de apariencia que se ven en vivo antes de guardarlos
  const [preview, setPreview] = useState(null);

  const loadPublic = useCallback(async () => {
    try {
      const data = await api.get('/settings/public');
      setSettings((s) => ({ ...s, ...data }));
    } catch {
      setSettings((s) => s ?? { business_name: 'Inventario', ...DEFAULT_APPEARANCE });
    }
  }, []);

  const loadFull = useCallback(async () => {
    const data = await api.get('/settings');
    setSettings((s) => ({ ...s, ...data }));
    return data;
  }, []);

  useEffect(() => {
    loadPublic();
  }, [loadPublic]);

  const effective = useMemo(() => ({ ...DEFAULT_APPEARANCE, ...settings, ...preview }), [settings, preview]);
  const theme = useMemo(
    () => buildTheme(effective),
    [effective.primary_color, effective.radius], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Título de la pestaña y favicon con el nombre y logo del negocio
  useEffect(() => {
    if (!settings) return;
    document.title = settings.business_name || 'Inventario';
    const icon = document.getElementById('favicon');
    if (icon) {
      icon.href = settings.logo_url || '/favicon.svg';
      icon.type = settings.logo_url ? '' : 'image/svg+xml';
    }
  }, [settings]);

  const value = useMemo(
    () => ({ settings: effective, saved: settings, setSettings, loadFull, setPreview }),
    [effective, settings, loadFull],
  );

  if (!settings) return null;

  return (
    <SettingsContext.Provider value={value}>
      <MantineProvider theme={theme} defaultColorScheme={settings.color_scheme || 'light'}>
        <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1 }}>
          <ModalsProvider labels={{ confirm: 'Confirmar', cancel: 'Cancelar' }}>
            <Notifications position="top-right" />
            {children}
          </ModalsProvider>
        </DatesProvider>
      </MantineProvider>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

/** Formateadores de dinero según la moneda configurada. */
export function useMoney() {
  const { settings } = useSettings();
  return useMemo(() => {
    const symbol = settings.currency_symbol || '$';
    const secondarySymbol = settings.secondary_currency_symbol || 'Bs.';
    return {
      symbol,
      secondarySymbol,
      rate: Number(settings.exchange_rate) || 0,
      money: (value) => formatMoney(value, symbol),
      // Da formato a un monto ya convertido a la segunda moneda (ej. bolívares); ver bsAmounts()
      secondaryMoney: (value) => formatMoney(value, secondarySymbol),
    };
  }, [settings.currency_symbol, settings.secondary_currency_symbol, settings.exchange_rate]);
}
