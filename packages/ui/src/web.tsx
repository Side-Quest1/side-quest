import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { colors, radii, spacing, themes, type BadgeVariant, type ButtonSize, type ButtonVariant, type ThemeMode } from "./index";

const buttonColors: Record<ButtonVariant, CSSProperties> = {
  primary: { background: colors.forest, color: colors.white },
  secondary: { background: colors.lime, color: colors.forest },
  outline: { background: "transparent", border: `1px solid ${colors.forest}`, color: colors.forest },
  ghost: { background: "transparent", color: colors.forest },
  danger: { background: colors.coral, color: colors.white },
};

const buttonPadding: Record<ButtonSize, string> = {
  small: "8px 12px",
  medium: "10px 16px",
  large: "13px 20px",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ variant = "primary", size = "medium", loading = false, disabled, children, style, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        ...buttonColors[variant],
        borderRadius: radii.control,
        border: buttonColors[variant].border ?? "0",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        fontWeight: 700,
        minHeight: 44,
        opacity: disabled || loading ? 0.55 : 1,
        padding: buttonPadding[size],
        ...style,
      }}
    >
      {loading ? "Loading…" : children}
    </button>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ invalid = false, style, ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      style={{
        background: themes.light.surface,
        border: `1px solid ${invalid ? themes.light.danger : themes.light.border}`,
        borderRadius: radii.control,
        color: themes.light.text,
        minHeight: 44,
        padding: `0 ${spacing.lg}px`,
        width: "100%",
        ...style,
      }}
    />
  );
}

const badgeColors: Record<BadgeVariant, CSSProperties> = {
  neutral: { background: themes.light.surfaceSecondary, color: themes.light.textSecondary },
  success: { background: "#DDEFE2", color: themes.light.success },
  warning: { background: "#F8EBD6", color: themes.light.warning },
  danger: { background: "#F9DFDC", color: themes.light.danger },
  category: { background: themes.light.accent, color: themes.light.text },
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span style={{ ...badgeColors[variant], borderRadius: radii.pill, display: "inline-flex", fontSize: 12, fontWeight: 700, padding: "6px 10px" }}>{children}</span>;
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <section style={{ background: themes.light.surface, border: `1px solid ${themes.light.border}`, borderRadius: radii.card, padding: spacing["2xl"], ...style }}>{children}</section>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <Card style={{ textAlign: "center" }}><strong style={{ color: themes.light.text }}>{title}</strong>{description && <p style={{ color: themes.light.textSecondary, marginBottom: 0 }}>{description}</p>}</Card>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <Card><span aria-live="polite" style={{ color: themes.light.textSecondary }}>{label}…</span></Card>;
}

export function ThemePreview({ mode }: { mode: ThemeMode }) {
  const theme = mode === "dark" ? themes.dark : themes.light;
  return <div style={{ background: theme.background, borderRadius: radii.panel, color: theme.text, padding: spacing["3xl"] }}><strong>{mode[0].toUpperCase() + mode.slice(1)} theme</strong><p style={{ color: theme.textSecondary, marginBottom: 0 }}>Shared SideQuest tokens</p></div>;
}
