/**
 * STORM TIPS design tokens.
 *
 * Single source of truth for the visual language, consumed by
 *  • the web + admin apps  (emitted as CSS custom properties, see `cssVariables()`)
 *  • the React Native app  (imported directly as a JS object)
 *
 * Direction: dark, premium, sporty. A spring-green "profit" accent for odds and
 * predictions, a gold accent for commerce/premium surfaces, and a pink badge
 * colour reserved for "Most Popular" style flags.
 */

export const colors = {
  /** Page and surface backgrounds, darkest → lightest. */
  bg: {
    base: '#070A12',
    subtle: '#0C101A',
    raised: '#121826',
    card: '#161C2A',
    cardAlt: '#1E2637',
    input: '#0F1420',
    overlay: 'rgba(6, 8, 12, 0.86)',
    scrim: 'rgba(6, 8, 12, 0.55)',
  },
  border: {
    subtle: '#242c3c',
    default: '#303A4D',
    strong: '#414E63',
    accent: '#12E17F',
    gold: '#FFC93C',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A6B0C2',
    muted: '#7B8699',
    disabled: '#58627A',
    inverse: '#070A12',
    onGold: '#14100A',
  },
  /** Primary brand accent — profit green. */
  accent: {
    50: '#E6FFF3',
    100: '#B8FFDD',
    200: '#7DF9C1',
    300: '#45F0A5',
    400: '#21E88E',
    500: '#12E17F',
    600: '#0BB966',
    700: '#0A8F50',
    800: '#0A6A3D',
    900: '#084D2D',
    DEFAULT: '#12E17F',
    soft: 'rgba(18, 225, 127, 0.12)',
    glow: 'rgba(18, 225, 127, 0.35)',
  },
  /** Commerce / premium accent — gold. */
  gold: {
    100: '#FFF3CC',
    200: '#FFE594',
    300: '#FFD65C',
    400: '#FFC93C',
    500: '#F5BA15',
    600: '#D09A08',
    DEFAULT: '#FFC93C',
    soft: 'rgba(255, 201, 60, 0.14)',
    glow: 'rgba(255, 201, 60, 0.35)',
  },
  /** Badge / urgency accent. */
  pink: {
    400: '#FF6B93',
    500: '#FF3D71',
    600: '#E11D50',
    DEFAULT: '#FF3D71',
    soft: 'rgba(255, 61, 113, 0.14)',
  },
  cyan: {
    400: '#5EE7FF',
    500: '#28D8F5',
    DEFAULT: '#28D8F5',
    soft: 'rgba(40, 216, 245, 0.12)',
  },
  purple: {
    400: '#A78BFA',
    500: '#8B5CF6',
    DEFAULT: '#8B5CF6',
    soft: 'rgba(139, 92, 246, 0.14)',
  },
  /** Tip outcome colours — used by StatusBadge and statistics charts. */
  status: {
    PENDING: '#7A8496',
    LIVE: '#FF3D71',
    WON: '#12E17F',
    LOST: '#FF4D5E',
    VOID: '#8B94A6',
    HALF_WON: '#7DE3A6',
    HALF_LOST: '#FF9B6B',
  },
  feedback: {
    success: '#12E17F',
    warning: '#FFC93C',
    danger: '#FF4D5E',
    info: '#28D8F5',
  },
  /** Per-product accent used on cards, tabs and paywalls. */
  product: {
    FREE: '#12E17F',
    COMBO: '#FFC93C',
    EXTRA: '#28D8F5',
    VIP: '#FFD65C',
    FIX_ODDS: '#8B5CF6',
  },
} as const;

export const gradients = {
  promo: ['#2B1B5E', '#5B2BA8', '#8B5CF6'],
  promoNeon: ['#12E17F', '#28D8F5'],
  gold: ['#FFD65C', '#FFC93C'],
  vip: ['#3A2D06', '#151821'],
  card: ['#1B2029', '#121826'],
  paywall: ['#12151C', '#070A12'],
} as const;

export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 999,
} as const;

export const fontSize = {
  '2xs': 10,
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 30,
  '5xl': 38,
  '6xl': 48,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

export const lineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.45,
  relaxed: 1.6,
} as const;

export const letterSpacing = {
  tighter: -0.4,
  tight: -0.2,
  normal: 0,
  wide: 0.3,
  wider: 0.6,
  widest: 1.2,
} as const;

export const shadows = {
  card: '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.28)',
  raised: '0 12px 32px rgba(0,0,0,0.45)',
  accentGlow: '0 0 0 1px rgba(18,225,127,0.35), 0 8px 28px rgba(18,225,127,0.18)',
  goldGlow: '0 0 0 1px rgba(255,201,60,0.4), 0 10px 30px rgba(255,201,60,0.2)',
  tabBar: '0 -8px 24px rgba(0,0,0,0.5)',
} as const;

export const durations = {
  instant: 80,
  fast: 150,
  normal: 220,
  slow: 340,
} as const;

export const easings = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

/** Fixed component sizes derived from the reference layout. */
export const sizes = {
  tabBarHeight: 56,
  headerHeight: 52,
  teamCrest: 20,
  teamCrestLarge: 28,
  statCircle: { sm: 52, md: 62, lg: 84 },
  cardPadding: 14,
  pageGutter: 14,
  dateChipWidth: 58,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  touchTarget: 44,
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  header: 20,
  tabBar: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
} as const;

export const breakpoints = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const tokens = {
  colors,
  gradients,
  spacing,
  radii,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  shadows,
  durations,
  easings,
  sizes,
  zIndex,
  breakpoints,
} as const;

export type Tokens = typeof tokens;

/** Flattens the palette into CSS custom properties for the web apps. */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  const walk = (prefix: string, value: unknown): void => {
    if (typeof value === 'string' || typeof value === 'number') {
      vars[`--st-${prefix}`] = String(value);
      return;
    }
    if (Array.isArray(value)) {
      vars[`--st-${prefix}`] = value.join(', ');
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const suffix = key === 'DEFAULT' ? '' : `-${key.toLowerCase()}`;
        walk(`${prefix}${suffix}`, child);
      }
    }
  };
  walk('color', colors);
  walk('gradient', gradients);
  walk('radius', radii);
  walk('shadow', shadows);
  return vars;
}

export function cssVariablesBlock(selector = ':root'): string {
  const entries = Object.entries(cssVariables())
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `${selector} {\n${entries}\n}`;
}
