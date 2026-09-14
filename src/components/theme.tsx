"use client";
import { FONTS, Theme, isLight } from "@/lib/theme";

// Wraps customer-facing pages: injects the owner's theme (colours, font,
// background, pattern) via CSS variables. Everything inside uses t-* classes.
export function ThemeStyles({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const font = FONTS[theme.font] || FONTS.inter;
  const light = isLight(theme.bg);
  const bg =
    theme.bgMode === "gradient"
      ? `linear-gradient(160deg, ${theme.bg} 0%, ${theme.primary}33 130%)`
      : theme.bg;

  return (
    <div
      className={`t-scope t-pattern-${theme.pattern} t-radius-${theme.radius} min-h-full flex-1 flex flex-col ${light ? "t-light" : "t-dark"}`}
      style={{
        ["--tp" as string]: theme.primary,
        ["--ta" as string]: theme.accent,
        ["--tbg" as string]: theme.bg,
        ["--tfont" as string]: font.family,
        background: bg,
      }}
    >
      <link rel="stylesheet" href={font.href} />
      {children}
    </div>
  );
}
