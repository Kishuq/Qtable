"use client";
import { FONTS, Theme, isLight } from "@/lib/theme";

// Wraps customer-facing pages: injects the owner's theme (colours, font,
// background, pattern, layout style) via CSS variables. Everything inside
// uses t-* classes. An optional brand photo can sit behind the whole menu,
// washed with the theme colour so prices stay readable on any image.
export function ThemeStyles({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const font = FONTS[theme.font] || FONTS.inter;
  const light = isLight(theme.bg);
  const gradient =
    theme.bgMode === "gradient"
      ? `linear-gradient(160deg, ${theme.bg} 0%, ${theme.primary}33 130%)`
      : theme.bg;
  const image = theme.image || "";
  const background = image
    ? `linear-gradient(180deg, ${theme.bg}e6 0%, ${theme.bg}f2 55%, ${theme.bg}fa 100%), url("${image}")`
    : gradient;

  return (
    <div
      className={`t-scope t-pattern-${theme.pattern} t-radius-${theme.radius} t-style-${theme.style} ${image ? "t-has-image" : ""} min-h-full flex-1 flex flex-col ${light ? "t-light" : "t-dark"}`}
      style={{
        ["--tp" as string]: theme.primary,
        ["--ta" as string]: theme.accent,
        ["--tbg" as string]: theme.bg,
        ["--tfont" as string]: font.family,
        background,
        ...(image ? { backgroundSize: "cover", backgroundPosition: "center top" } : {}),
      }}
    >
      <link rel="stylesheet" href={font.href} />
      {children}
    </div>
  );
}
