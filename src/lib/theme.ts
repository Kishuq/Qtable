// Design-studio theme engine: owner picks colours/fonts/patterns,
// customer pages render from these values. No redeploy needed.

export type Theme = {
  primary: string;
  accent: string;
  bg: string;
  bgMode: "solid" | "gradient";
  pattern: "none" | "dots" | "grid" | "waves";
  font: string;
  radius: "rounded" | "soft" | "sharp";
};

export const DEFAULT_THEME: Theme = {
  primary: "#c2410c",
  accent: "#f59e0b",
  bg: "#0c0a09",
  bgMode: "solid",
  pattern: "none",
  font: "inter",
  radius: "rounded",
};

export const FONTS: Record<string, { label: string; family: string; href: string }> = {
  inter: { label: "Inter (clean modern)", family: "'Inter', system-ui, sans-serif", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" },
  poppins: { label: "Poppins (friendly round)", family: "'Poppins', system-ui, sans-serif", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" },
  nunito: { label: "Nunito (soft & warm)", family: "'Nunito', system-ui, sans-serif", href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" },
  space: { label: "Space Grotesk (edgy)", family: "'Space Grotesk', system-ui, sans-serif", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" },
  playfair: { label: "Playfair (premium serif)", family: "'Playfair Display', Georgia, serif", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&display=swap" },
  dmserif: { label: "DM Serif (elegant)", family: "'DM Serif Display', Georgia, serif", href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap" },
  lora: { label: "Lora (bookish serif)", family: "'Lora', Georgia, serif", href: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap" },
  quicksand: { label: "Quicksand (playful geometric)", family: "'Quicksand', system-ui, sans-serif", href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" },
};

export const PATTERNS = [
  { id: "none", label: "Plain", emoji: "⬛" },
  { id: "dots", label: "Dots", emoji: "🔘" },
  { id: "grid", label: "Grid", emoji: "◼️" },
  { id: "waves", label: "Waves", emoji: "🌊" },
] as const;

export const THEME_PRESETS: { name: string; vibe: string; theme: Theme }[] = [
  { name: "Espresso", vibe: "Classic cafe", theme: { ...DEFAULT_THEME } },
  { name: "Matcha", vibe: "Fresh & green", theme: { ...DEFAULT_THEME, primary: "#15803d", accent: "#a3e635", bg: "#052e16", font: "nunito" } },
  { name: "Berry", vibe: "Bold & sweet", theme: { ...DEFAULT_THEME, primary: "#be185d", accent: "#f472b6", bg: "#1c0a12", bgMode: "gradient", font: "poppins" } },
  { name: "Royal", vibe: "Premium serif", theme: { ...DEFAULT_THEME, primary: "#6d28d9", accent: "#fbbf24", bg: "#0f0a1e", bgMode: "gradient", pattern: "dots", font: "playfair" } },
  { name: "Ocean", vibe: "Cool & edgy", theme: { ...DEFAULT_THEME, primary: "#0369a1", accent: "#22d3ee", bg: "#082f49", pattern: "waves", font: "space" } },
  { name: "Cream", vibe: "Light & elegant", theme: { ...DEFAULT_THEME, primary: "#b45309", accent: "#dc2626", bg: "#faf6ef", pattern: "dots", font: "dmserif" } },
  { name: "Sunset", vibe: "Warm gradient", theme: { ...DEFAULT_THEME, primary: "#ea580c", accent: "#facc15", bg: "#1c0f08", bgMode: "gradient", pattern: "waves", font: "poppins", radius: "soft" } },
  { name: "Midnight", vibe: "Neon night", theme: { ...DEFAULT_THEME, primary: "#38bdf8", accent: "#818cf8", bg: "#020617", bgMode: "gradient", pattern: "dots", font: "space", radius: "sharp" } },
  { name: "Rosewood", vibe: "Deep red serif", theme: { ...DEFAULT_THEME, primary: "#b91c1c", accent: "#fda4af", bg: "#160608", pattern: "none", font: "lora", radius: "soft" } },
  { name: "Lemon", vibe: "Light & zesty", theme: { ...DEFAULT_THEME, primary: "#a16207", accent: "#4d7c0f", bg: "#fffbeb", pattern: "grid", font: "quicksand" } },
  { name: "Cocoa", vibe: "Dark chocolate", theme: { ...DEFAULT_THEME, primary: "#92400e", accent: "#e7b958", bg: "#120b06", pattern: "none", font: "dmserif", radius: "sharp" } },
  { name: "Forest", vibe: "Deep woods", theme: { ...DEFAULT_THEME, primary: "#166534", accent: "#4ade80", bg: "#04120b", bgMode: "gradient", pattern: "waves", font: "inter" } },
  { name: "Lavender", vibe: "Soft purple", theme: { ...DEFAULT_THEME, primary: "#7c3aed", accent: "#c4b5fd", bg: "#14101f", pattern: "dots", font: "nunito", radius: "soft" } },
  { name: "Noir", vibe: "Minimal mono", theme: { ...DEFAULT_THEME, primary: "#e7e5e4", accent: "#a8a29e", bg: "#000000", pattern: "grid", font: "space", radius: "sharp" } },
];

export function themeFromCafe(cafe: Record<string, string | undefined> | null | undefined): Theme {
  if (!cafe) return DEFAULT_THEME;
  const hex = (v: string | undefined, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(v || "") ? v! : fb);
  const pick = (...keys: string[]) => { for (const k of keys) if (cafe[k]) return cafe[k]; return undefined; };
  const bgMode = pick("bgMode", "themeBgMode");
  const pattern = pick("pattern", "themePattern");
  const font = pick("font", "themeFont");
  const radius = pick("radius", "themeRadius");
  return {
    primary: hex(pick("primary", "themePrimary"), DEFAULT_THEME.primary),
    accent: hex(pick("accent", "themeAccent"), DEFAULT_THEME.accent),
    bg: hex(pick("bg", "themeBg"), DEFAULT_THEME.bg),
    bgMode: bgMode === "gradient" ? "gradient" : "solid",
    pattern: (["dots", "grid", "waves"] as const).includes(pattern as never) ? (pattern as Theme["pattern"]) : "none",
    font: font && FONTS[font] ? font : "inter",
    radius: (["soft", "sharp"] as const).includes(radius as never) ? (radius as Theme["radius"]) : "rounded",
  };
}

// Is the bg light? Used to flip text colours for light themes like Cream.
export function isLight(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
