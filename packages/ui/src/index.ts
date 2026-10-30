export type ThemeMode = "light" | "dark" | "system";
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large";
export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "category";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
} as const;

export const radii = {
  control: 10,
  card: 18,
  panel: 24,
  pill: 999,
} as const;

export const colors = {
  forest: "#172B25",
  lime: "#C8F169",
  ivory: "#F6F5EF",
  sage: "#E8EBDD",
  slate: "#68756D",
  coral: "#E97861",
  white: "#FFFFFF",
} as const;

export const themes = {
  light: {
    background: colors.ivory,
    surface: colors.white,
    surfaceSecondary: colors.sage,
    primary: colors.forest,
    primaryForeground: colors.white,
    text: colors.forest,
    textSecondary: colors.slate,
    border: "#DCE1D6",
    accent: colors.lime,
    success: "#397B53",
    warning: "#A66A20",
    danger: "#C94F45",
  },
  dark: {
    background: "#101B17",
    surface: colors.forest,
    surfaceSecondary: "#20342B",
    primary: colors.lime,
    primaryForeground: colors.forest,
    text: colors.ivory,
    textSecondary: "#B5C2B8",
    border: "#34483D",
    accent: colors.lime,
    success: "#91D6A5",
    warning: "#F2BC69",
    danger: "#FF8274",
  },
} as const;

export type Theme = (typeof themes)[keyof typeof themes];
