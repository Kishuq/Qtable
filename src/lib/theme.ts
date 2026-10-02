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
  { name: "Tandoor", vibe: "Ember & smoke", theme: { ...DEFAULT_THEME, primary: "#ea580c", accent: "#fbbf24", bg: "#170806", bgMode: "gradient", pattern: "waves", font: "dmserif", radius: "soft" } },
  { name: "Marigold", vibe: "Festive light", theme: { ...DEFAULT_THEME, primary: "#b45309", accent: "#dc2626", bg: "#fff7e6", pattern: "dots", font: "dmserif", radius: "soft" } },
  { name: "Monsoon", vibe: "Teal ink rain", theme: { ...DEFAULT_THEME, primary: "#14b8a6", accent: "#a5f3fc", bg: "#062a2e", pattern: "waves", font: "space", radius: "sharp" } },
  { name: "Gilt", vibe: "Gold on charcoal", theme: { ...DEFAULT_THEME, primary: "#d4af37", accent: "#f5f5f4", bg: "#101010", pattern: "none", font: "playfair", radius: "sharp" } },
  { name: "Broadsheet", vibe: "Newspaper light", theme: { ...DEFAULT_THEME, primary: "#1c1917", accent: "#c2410c", bg: "#faf8f2", pattern: "grid", font: "lora", radius: "sharp" } },
  { name: "Palm Court", vibe: "Tropical green", theme: { ...DEFAULT_THEME, primary: "#16a34a", accent: "#fde047", bg: "#04160c", pattern: "dots", font: "nunito", radius: "rounded" } },
  { name: "Neon Diner", vibe: "Retro after-dark", theme: { ...DEFAULT_THEME, primary: "#ff2d78", accent: "#22d3ee", bg: "#0a0a12", bgMode: "gradient", pattern: "grid", font: "space", radius: "sharp" } },
  { name: "Blueprint", vibe: "Drafting-table blue", theme: { ...DEFAULT_THEME, primary: "#1d4ed8", accent: "#f97316", bg: "#eef2fd", pattern: "grid", font: "space", radius: "sharp" } },
  { name: "Rose Gold", vibe: "Blush premium", theme: { ...DEFAULT_THEME, primary: "#9d174d", accent: "#f9a8d4", bg: "#fdf2f4", pattern: "none", font: "playfair", radius: "soft" } },
  { name: "Masala Night", vibe: "Chili & ghee", theme: { ...DEFAULT_THEME, primary: "#dc2626", accent: "#fbbf24", bg: "#0d0204", bgMode: "gradient", pattern: "dots", font: "poppins", radius: "rounded" } },
  { name: "Lagoon Pearl", vibe: "Deep sea calm", theme: { ...DEFAULT_THEME, primary: "#0ea5e9", accent: "#99f6e0", bg: "#031824", pattern: "none", font: "quicksand", radius: "soft" } },
  { name: "Matcha House", vibe: "Stone-ground calm", theme: { ...DEFAULT_THEME, primary: "#4d7c0f", accent: "#d9f99d", bg: "#0c1a0e", pattern: "grid", font: "lora", radius: "rounded" } },
  { name: "Sage & Stone", vibe: "Muted garden calm", theme: { ...DEFAULT_THEME, primary: "#4d6a4f", accent: "#b7791f", bg: "#edf0e8", pattern: "none", font: "inter", radius: "soft" } },
  { name: "Jaipur Blush", vibe: "Pink-city neon", theme: { ...DEFAULT_THEME, primary: "#ec4899", accent: "#fde68a", bg: "#25060f", pattern: "dots", font: "poppins", radius: "rounded" } },
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
