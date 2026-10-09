import { createTheme } from '@mantine/core';
import { generateColorsMap } from '@mantine/colors-generator';
import chroma from 'chroma-js';

export const DEFAULT_APPEARANCE = {
  primary_color: '#228be6',
  sidebar_color: null,
  color_scheme: 'light',
  radius: 'md',
};

// Paletas sugeridas en la pantalla de configuración
export const COLOR_PRESETS = [
  { name: 'Océano', primary: '#228be6', sidebar: '#1c3d5a' },
  { name: 'Bosque', primary: '#2f9e44', sidebar: '#1f3b2c' },
  { name: 'Atardecer', primary: '#e8590c', sidebar: '#3b2417' },
  { name: 'Uva', primary: '#7048e8', sidebar: '#2a1f4d' },
  { name: 'Frambuesa', primary: '#d6336c', sidebar: '#3d1a2a' },
  { name: 'Turquesa', primary: '#0c8599', sidebar: '#123a40' },
  { name: 'Grafito', primary: '#495057', sidebar: '#212529' },
  { name: 'Dorado', primary: '#f59f00', sidebar: '#2b2a26' },
];

const FONT = "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function isValidColor(color) {
  return typeof color === 'string' && chroma.valid(color);
}

/** Construye el tema de Mantine a partir del color principal elegido por el negocio. */
export function buildTheme({ primary_color, radius }) {
  const base = isValidColor(primary_color) ? primary_color : DEFAULT_APPEARANCE.primary_color;
  const { colors, baseColorIndex } = generateColorsMap(base);
  return createTheme({
    primaryColor: 'brand',
    colors: { brand: colors.map((c) => c.hex()) },
    // Usa exactamente el tono elegido para botones y elementos activos
    primaryShade: { light: baseColorIndex, dark: Math.max(baseColorIndex, 5) },
    autoContrast: true,
    defaultRadius: radius || 'md',
    fontFamily: FONT,
    headings: { fontFamily: FONT, fontWeight: '700' },
    components: {
      Card: { defaultProps: { withBorder: true, shadow: 'xs' } },
      Paper: { defaultProps: { withBorder: true } },
      Modal: { defaultProps: { centered: true, overlayProps: { blur: 2 } } },
      Table: { defaultProps: { highlightOnHover: true, verticalSpacing: 'sm' } },
      NumberInput: { defaultProps: { decimalSeparator: ',', thousandSeparator: '.' } },
    },
  });
}

/** Colores de la barra lateral (fondo, texto, hover y activo) según el color elegido. */
export function sidebarVars(sidebarColor) {
  if (!isValidColor(sidebarColor)) return null;
  const light = chroma(sidebarColor).luminance() > 0.45;
  return {
    '--sidebar-bg': sidebarColor,
    '--sidebar-fg': light ? '#1a1b1e' : '#ffffff',
    '--sidebar-dimmed': light ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)',
    '--sidebar-hover': light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
    '--sidebar-active': light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)',
    '--sidebar-border': light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)',
  };
}
