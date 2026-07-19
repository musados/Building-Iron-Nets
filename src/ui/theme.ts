// IronNets design tokens — drop into src/ui/theme.ts
// Modern redesign (steel-blue). All values final (hi-fi).

export const colors = {
  // brand / accent
  primary: '#3273b8',
  primaryPressed: '#2a619c',
  primaryDeep: '#1e4e7c', // gradient end, text-on-tint
  primaryTint: '#e7f0f9', // tonal buttons, badges, banners
  onPrimary: '#ffffff',
  // AI hero gradient (fallback flat: #2a619c)
  gradientStart: '#1e4e7c',
  gradientEnd: '#3273b8',

  // surfaces
  bg: '#f2f2f7', // iOS grouped background (web/Android: #f7f8fa acceptable)
  bgWeb: '#f7f8fa',
  card: '#ffffff',
  fillSubtle: '#f0f1f4', // gray icon tiles, tonal gray buttons
  fillInput: 'rgba(118,118,128,0.12)', // search / inputs
  thinking: '#f6f8fa', // AI "model thinking" box

  // text
  text: '#0f1720',
  textSecondary: '#6b7280',
  textTertiary: '#9aa0a6',

  // semantic
  success: '#2f9e6e',
  successTint: '#e8f5ee',
  warningText: '#8a5a00',
  warningTint: '#fdf3e3',
  danger: '#d64545',
  dangerTint: '#fdecec',

  // borders
  hairline: 'rgba(60,60,67,0.12)',
  chipOutline: '#dfe3e9',
  dashedAdd: '#b6c6d8',
  disabled: '#d0d6dd',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // screen padding
  xxl: 24,
} as const;

export const radius = {
  tile: 12, // icon tiles, search field
  cardAndroid: 14,
  banner: 16,
  card: 18,
  hero: 22, // gradient hero / AI cards
  sheet: 28, // bottom-sheet top corners
  pill: 999, // buttons, chips, badges
} as const;

export const type = {
  family: 'Heebo', // load 400/500/600/700/800 via expo-font; system fallback
  largeTitle: { fontSize: 32, fontWeight: '800' as const },
  screenTitle: { fontSize: 24, fontWeight: '800' as const },
  heroNumber: { fontSize: 40, fontWeight: '800' as const },
  sectionLabel: { fontSize: 13, fontWeight: '700' as const }, // gray section headers in cards
  cardTitle: { fontSize: 16, fontWeight: '700' as const },
  rowTitle: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  secondary: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  badge: { fontSize: 11, fontWeight: '700' as const },
  button: { fontSize: 16, fontWeight: '700' as const },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0f1720',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  primaryButton: {
    shadowColor: '#3273b8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheet: {
    shadowColor: '#0f1720',
    shadowOpacity: 0.2,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 },
    elevation: 12,
  },
} as const;

export const hit = {
  minTarget: 44, // every tappable element (chips, ✕, rows)
  buttonPrimary: 54,
  buttonSecondary: 50,
  chip: 44,
  input: 44,
} as const;

// expo-google-fonts רושם משפחה נפרדת לכל משקל — RN לא מסנתז משקלים
// לפונט מותאם, לכן ממפים fontWeight למשפחה המתאימה.
const weightToFamily: Record<string, string> = {
  '400': 'Heebo_400Regular',
  '500': 'Heebo_500Medium',
  '600': 'Heebo_600SemiBold',
  '700': 'Heebo_700Bold',
  '800': 'Heebo_800ExtraBold',
};

export function typo(
  t: { fontSize: number; fontWeight: string },
  overrides?: { color?: string }
): { fontSize: number; fontFamily: string; color?: string } {
  return {
    fontSize: t.fontSize,
    fontFamily: weightToFamily[t.fontWeight] ?? weightToFamily['400'],
    ...(overrides?.color ? { color: overrides.color } : {}),
  };
}

export const theme = { colors, spacing, radius, type, shadow, hit };
export default theme;
