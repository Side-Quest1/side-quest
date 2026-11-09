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
    surfaceElevated: colors.white,
    surfaceSecondary: colors.sage,
    textPrimary: colors.forest,
    textSecondary: colors.slate,
    textMuted: "#526158",
    textInverse: colors.white,
    border: "#DCE1D6",
    divider: "#E8EBE3",
    primary: colors.forest,
    primaryForeground: colors.white,
    secondary: colors.lime,
    secondaryForeground: colors.forest,
    accent: colors.lime,
    accentForeground: colors.forest,
    success: "#397B53",
    warning: "#A66A20",
    error: "#C94F45",
    disabled: "#A8B1AA",
    focus: "#4B7D52",
    overlay: "rgba(23, 43, 37, 0.45)",
  },
  dark: {
    background: "#101312",
    surface: "#171C19",
    surfaceElevated: "#202722",
    surfaceSecondary: "#202722",
    primary: colors.lime,
    primaryForeground: colors.forest,
    textPrimary: colors.ivory,
    textSecondary: "#B5C2B8",
    textMuted: "#9EAEA2",
    textInverse: colors.forest,
    border: "#35413A",
    divider: "#29332E",
    secondary: "#C8F169",
    secondaryForeground: colors.forest,
    accent: colors.lime,
    accentForeground: colors.forest,
    success: "#91D6A5",
    warning: "#F2BC69",
    error: "#FF8274",
    disabled: "#64746A",
    focus: "#C8F169",
    overlay: "rgba(0, 0, 0, 0.62)",
  },
} as const;

export type Theme = (typeof themes)[keyof typeof themes];
