import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { colors, radii, spacing, themes, type BadgeVariant, type ButtonSize, type ButtonVariant, type ThemeMode } from "./index";

const buttonColors: Record<ButtonVariant, { backgroundColor: string; color: string }> = {
  primary: { backgroundColor: colors.forest, color: colors.white },
  secondary: { backgroundColor: colors.lime, color: colors.forest },
  outline: { backgroundColor: "transparent", color: colors.forest },
  ghost: { backgroundColor: "transparent", color: colors.forest },
  danger: { backgroundColor: colors.coral, color: colors.white },
};

const buttonPadding: Record<ButtonSize, number> = { small: 8, medium: 12, large: 16 };

export type ButtonProps = { children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; disabled?: boolean; onPress?: () => void; accessibilityLabel?: string };

export function Button({ variant = "primary", size = "medium", loading = false, disabled = false, children, ...props }: ButtonProps) {
  const palette = buttonColors[variant];
  return <Pressable {...props} accessibilityRole="button" disabled={disabled || loading} style={[styles.button, { backgroundColor: palette.backgroundColor, borderColor: variant === "outline" ? colors.forest : "transparent", borderWidth: variant === "outline" ? 1 : 0, opacity: disabled || loading ? 0.55 : 1, paddingVertical: buttonPadding[size] }]}><Text style={{ color: palette.color, fontWeight: "700" }}>{loading ? "Loading…" : children}</Text></Pressable>;
}

export function Input({ invalid = false, style, ...props }: TextInputProps & { invalid?: boolean; style?: StyleProp<TextStyle> }) {
  return <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? props.placeholder} style={[styles.input, { borderColor: invalid ? themes.light.danger : themes.light.border }, style]} />;
}

const badgeColors: Record<BadgeVariant, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: themes.light.surfaceSecondary, color: themes.light.textSecondary },
  success: { backgroundColor: "#DDEFE2", color: themes.light.success },
  warning: { backgroundColor: "#F8EBD6", color: themes.light.warning },
  danger: { backgroundColor: "#F9DFDC", color: themes.light.danger },
  category: { backgroundColor: themes.light.accent, color: themes.light.text },
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  const palette = badgeColors[variant];
  return <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}><Text style={{ color: palette.color, fontSize: 12, fontWeight: "700" }}>{children}</Text></View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <Card style={styles.centered}><Text style={styles.title}>{title}</Text>{description && <Text style={styles.secondary}>{description}</Text>}</Card>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <Card><Text style={styles.secondary}>{label}…</Text></Card>;
}

export function ThemePreview({ mode }: { mode: ThemeMode }) {
  const theme = mode === "dark" ? themes.dark : themes.light;
  return <View style={{ backgroundColor: theme.background, borderRadius: radii.panel, padding: spacing["3xl"] }}><Text style={{ color: theme.text, fontWeight: "700" }}>{mode[0].toUpperCase() + mode.slice(1)} theme</Text><Text style={{ color: theme.textSecondary, marginTop: spacing.sm }}>Shared SideQuest tokens</Text></View>;
}

const styles = StyleSheet.create({
  button: { alignItems: "center", borderRadius: radii.control, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.xl },
  input: { backgroundColor: themes.light.surface, borderRadius: radii.control, borderWidth: 1, color: themes.light.text, minHeight: 44, paddingHorizontal: spacing.lg },
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  card: { backgroundColor: themes.light.surface, borderColor: themes.light.border, borderRadius: radii.card, borderWidth: 1, padding: spacing["2xl"] },
  centered: { alignItems: "center" },
  title: { color: themes.light.text, fontWeight: "700" },
  secondary: { color: themes.light.textSecondary, marginTop: spacing.sm },
});
