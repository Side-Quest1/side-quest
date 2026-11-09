import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { colors, radii, spacing, themes, type BadgeVariant, type ButtonSize, type ButtonVariant, type ThemeMode } from "./index";

const buttonColors: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--primary)", color: "var(--primary-foreground)" },
  secondary: { background: "var(--secondary)", color: "var(--secondary-foreground)" },
  outline: { background: "transparent", border: "1px solid var(--primary)", color: "var(--primary)" },
  ghost: { background: "transparent", color: "var(--text-primary)" },
  danger: { background: "var(--error)", color: "var(--text-inverse)" },
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
      aria-busy={loading || undefined}
      style={{
        ...buttonColors[variant],
        borderRadius: radii.control,
        border: buttonColors[variant].border ?? "0",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        fontWeight: 700,
        minHeight: 44,
        opacity: disabled || loading ? 0.55 : 1,
        padding: buttonPadding[size],
        transition: "background-color 160ms ease, transform 160ms ease, opacity 160ms ease",
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
        background: "var(--surface)",
        border: `1px solid ${invalid ? "var(--error)" : "var(--border)"}`,
        borderRadius: radii.control,
        color: "var(--text-primary)",
        minHeight: 44,
        padding: `0 ${spacing.lg}px`,
        width: "100%",
        ...style,
      }}
    />
  );
}

const badgeColors: Record<BadgeVariant, CSSProperties> = {
  neutral: { background: "var(--surface-secondary)", color: "var(--text-secondary)" },
  success: { background: "#DDEFE2", color: "var(--success)" },
  warning: { background: "#F8EBD6", color: "var(--warning)" },
  danger: { background: "#F9DFDC", color: "var(--error)" },
  category: { background: "var(--accent)", color: "var(--accent-foreground)" },
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span style={{ ...badgeColors[variant], borderRadius: radii.pill, display: "inline-flex", fontSize: 12, fontWeight: 700, padding: "6px 10px" }}>{children}</span>;
}

export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <section className={className} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: radii.card, padding: spacing["2xl"], ...style }}>{children}</section>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <Card style={{ textAlign: "center" }}><strong style={{ color: "var(--text-primary)" }}>{title}</strong>{description && <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>{description}</p>}</Card>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <Card><span aria-live="polite" style={{ color: "var(--text-secondary)" }}>{label}…</span></Card>;
}

export function ThemePreview({ mode }: { mode: ThemeMode }) {
  const theme = mode === "dark" ? themes.dark : themes.light;
  return <div style={{ background: theme.background, borderRadius: radii.panel, color: theme.textPrimary, padding: spacing["3xl"] }}><strong>{mode[0].toUpperCase() + mode.slice(1)} theme</strong><p style={{ color: theme.textSecondary, marginBottom: 0 }}>Shared SideQuest tokens</p></div>;
}
