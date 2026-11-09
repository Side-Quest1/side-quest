import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { colors, radii, spacing, themes, type BadgeVariant, type ButtonSize, type ButtonVariant, type Theme, type ThemeMode } from "./index";

const ThemeContext = createContext<{ mode: ThemeMode; theme: Theme; setMode: (mode: ThemeMode) => void }>({
  mode: "light",
  theme: themes.light,
  setMode: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem("sidequest-theme")
      .then((saved) => {
        if (active && (saved === "light" || saved === "dark" || saved === "system")) setMode(saved);
      })
      .catch((error: unknown) => console.warn("Unable to load saved theme preference.", error));
    return () => { active = false; };
  }, []);
  const system = useColorScheme();
  const theme = mode === "dark" || (mode === "system" && system === "dark") ? themes.dark : themes.light;
  const updateMode = (next: ThemeMode) => {
    setMode(next);
    void AsyncStorage.setItem("sidequest-theme", next).catch((error: unknown) => console.warn("Unable to save theme preference.", error));
  };
  const value = useMemo(() => ({ mode, theme, setMode: updateMode }), [mode, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

const buttonColors: Record<ButtonVariant, { backgroundColor: string; color: string }> = {
  primary: { backgroundColor: colors.forest, color: colors.white },
  secondary: { backgroundColor: colors.lime, color: colors.forest },
  outline: { backgroundColor: "transparent", color: themes.light.primary },
  ghost: { backgroundColor: "transparent", color: themes.light.textPrimary },
  danger: { backgroundColor: colors.coral, color: colors.white },
};

const buttonPadding: Record<ButtonSize, number> = { small: 8, medium: 12, large: 16 };

export type ButtonProps = { children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; disabled?: boolean; onPress?: () => void; accessibilityLabel?: string };

export function Button({ variant = "primary", size = "medium", loading = false, disabled = false, children, ...props }: ButtonProps) {
  const { theme } = useTheme();
  const palette = buttonColors[variant];
  const foreground = variant === "primary" ? theme.primaryForeground : variant === "secondary" ? theme.secondaryForeground : variant === "danger" ? theme.textInverse : palette.color;
  return <Pressable {...props} accessibilityRole="button" disabled={disabled || loading} style={[styles.button, { backgroundColor: variant === "primary" ? theme.primary : variant === "secondary" ? theme.secondary : variant === "danger" ? theme.error : "transparent", borderColor: variant === "outline" ? theme.primary : "transparent", borderWidth: variant === "outline" ? 1 : 0, opacity: disabled || loading ? 0.55 : 1, paddingVertical: buttonPadding[size] }]}><Text style={{ color: variant === "outline" || variant === "ghost" ? theme.primary : foreground, fontWeight: "700" }}>{loading ? "Loading…" : children}</Text></Pressable>;
}

export function Input({ invalid = false, style, ...props }: TextInputProps & { invalid?: boolean; style?: StyleProp<TextStyle> }) {
  const { theme } = useTheme();
  return <TextInput {...props} placeholderTextColor={theme.textMuted} accessibilityLabel={props.accessibilityLabel ?? props.placeholder} style={[styles.input, { backgroundColor: theme.surface, borderColor: invalid ? theme.error : theme.border, color: theme.textPrimary }, style]} />;
}

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  const { theme } = useTheme();
  const backgroundColor = variant === "category" ? theme.accent : theme.surfaceSecondary;
  const color = variant === "category" ? theme.accentForeground : variant === "success" ? theme.success : variant === "warning" ? theme.warning : variant === "danger" ? theme.error : theme.textSecondary;
  return <View style={[styles.badge, { backgroundColor }]}><Text style={{ color, fontSize: 12, fontWeight: "700" }}>{children}</Text></View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <Card style={styles.centered}><Text style={styles.title}>{title}</Text>{description && <Text style={styles.secondary}>{description}</Text>}</Card>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <Card><Text style={styles.secondary}>{label}…</Text></Card>;
}

export function ThemePreview({ mode }: { mode: ThemeMode }) {
  const theme = mode === "dark" ? themes.dark : themes.light;
  return <View style={{ backgroundColor: theme.background, borderRadius: radii.panel, padding: spacing["3xl"] }}><Text style={{ color: theme.textPrimary, fontWeight: "700" }}>{mode[0].toUpperCase() + mode.slice(1)} theme</Text><Text style={{ color: theme.textSecondary, marginTop: spacing.sm }}>Shared SideQuest tokens</Text></View>;
}

const styles = StyleSheet.create({
  button: { alignItems: "center", borderRadius: radii.control, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.xl },
  input: { backgroundColor: themes.light.surface, borderRadius: radii.control, borderWidth: 1, color: themes.light.textPrimary, minHeight: 44, paddingHorizontal: spacing.lg },
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  card: { backgroundColor: themes.light.surface, borderColor: themes.light.border, borderRadius: radii.card, borderWidth: 1, padding: spacing["2xl"] },
  centered: { alignItems: "center" },
  title: { color: themes.light.textPrimary, fontWeight: "700" },
  secondary: { color: themes.light.textSecondary, marginTop: spacing.sm },
});
