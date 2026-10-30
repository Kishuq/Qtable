// Design-studio theme engine: owner picks colours/fonts/patterns + a menu
// layout, customer pages render from these values. No redeploy needed.

export type ThemeStyle = "cards" | "editorial" | "list" | "poster" | "tickets";

export type Theme = {
  primary: string;
  accent: string;
  bg: string;
  bgMode: "solid" | "gradient";
  pattern: "none" | "dots" | "grid" | "waves";
  font: string;
  radius: "rounded" | "soft" | "sharp";
  style: ThemeStyle;
  /** Optional uploaded brand photo used as the menu backdrop. */
  image?: string;
};

export const DEFAULT_THEME: Theme = {
  primary: "#c2410c",
  accent: "#f59e0b",
  bg: "#0c0a09",
  bgMode: "solid",
  pattern: "none",
  font: "inter",
  radius: "rounded",
  style: "cards",
  image: "",
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

export const STYLES: { id: ThemeStyle; label: string; note: string }[] = [
  { id: "cards", label: "Photo cards", note: "Big appetising photos in a 2-up grid — the crowd-pleaser." },
  { id: "editorial", label: "Menu paper", note: "Serif names, dotted price leaders, no photos — classic printed menu." },
  { id: "list", label: "Cafe board", note: "Dense thumbnail rows — fits long menus without endless scrolling." },
  { id: "poster", label: "Poster grid", note: "Full-bleed image tiles with the name and price laid over." },
  { id: "tickets", label: "Ticket stubs", note: "Dashed receipt-style rows — playful, street-food energy." },
];

const T = (t: Partial<Theme>): Theme => ({ ...DEFAULT_THEME, ...t });

export const THEME_PRESETS: { name: string; vibe: string; theme: Theme }[] = [
  { name: "Tandoor", vibe: "Ember & smoke", theme: T({ primary: "#ea580c", accent: "#fbbf24", bg: "#170806", bgMode: "gradient", pattern: "waves", font: "dmserif", radius: "soft", style: "poster" }) },
  { name: "Marigold", vibe: "Festive light", theme: T({ primary: "#b45309", accent: "#dc2626", bg: "#fff7e6", pattern: "dots", font: "dmserif", radius: "soft", style: "tickets" }) },
  { name: "Monsoon", vibe: "Teal ink rain", theme: T({ primary: "#14b8a6", accent: "#a5f3fc", bg: "#062a2e", pattern: "waves", font: "space", radius: "sharp", style: "list" }) },
  { name: "Gilt", vibe: "Gold on charcoal", theme: T({ primary: "#d4af37", accent: "#f5f5f4", bg: "#101010", pattern: "none", font: "playfair", radius: "sharp", style: "editorial" }) },
  { name: "Broadsheet", vibe: "Newspaper light", theme: T({ primary: "#1c1917", accent: "#c2410c", bg: "#faf8f2", pattern: "grid", font: "lora", radius: "sharp", style: "editorial" }) },
  { name: "Palm Court", vibe: "Tropical green", theme: T({ primary: "#16a34a", accent: "#fde047", bg: "#04160c", pattern: "dots", font: "nunito", radius: "rounded", style: "cards" }) },
  { name: "Neon Diner", vibe: "Retro after-dark", theme: T({ primary: "#ff2d78", accent: "#22d3ee", bg: "#0a0a12", bgMode: "gradient", pattern: "grid", font: "space", radius: "sharp", style: "poster" }) },
  { name: "Blueprint", vibe: "Drafting-table blue", theme: T({ primary: "#1d4ed8", accent: "#f97316", bg: "#eef2fd", pattern: "grid", font: "space", radius: "sharp", style: "list" }) },
  { name: "Rose Gold", vibe: "Blush premium", theme: T({ primary: "#9d174d", accent: "#f9a8d4", bg: "#fdf2f4", pattern: "none", font: "playfair", radius: "soft", style: "editorial" }) },
  { name: "Masala Night", vibe: "Chili & ghee", theme: T({ primary: "#dc2626", accent: "#fbbf24", bg: "#0d0204", bgMode: "gradient", pattern: "dots", font: "poppins", radius: "rounded", style: "tickets" }) },
  { name: "Lagoon Pearl", vibe: "Deep sea calm", theme: T({ primary: "#0ea5e9", accent: "#99f6e0", bg: "#031824", pattern: "none", font: "quicksand", radius: "soft", style: "cards" }) },
  { name: "Matcha House", vibe: "Stone-ground calm", theme: T({ primary: "#4d7c0f", accent: "#d9f99d", bg: "#0c1a0e", pattern: "grid", font: "lora", radius: "rounded", style: "list" }) },
  { name: "Sage & Stone", vibe: "Muted garden calm", theme: T({ primary: "#4d6a4f", accent: "#b7791f", bg: "#edf0e8", pattern: "none", font: "inter", radius: "soft", style: "editorial" }) },
  { name: "Jaipur Blush", vibe: "Pink-city neon", theme: T({ primary: "#ec4899", accent: "#fde68a", bg: "#25060f", pattern: "dots", font: "poppins", radius: "rounded", style: "poster" }) },
  // ---- Second wave: deliberately different silhouettes, not recolours ----
  { name: "Kerala Postcard", vibe: "Backwater postcard", theme: T({ primary: "#0f766e", accent: "#f59e0b", bg: "#fdf6e3", pattern: "waves", font: "lora", radius: "soft", style: "editorial" }) },
  { name: "Terracotta Sun", vibe: "Clay & daylight", theme: T({ primary: "#9a3412", accent: "#f59e0b", bg: "#f6ede1", pattern: "dots", font: "dmserif", radius: "soft", style: "cards" }) },
  { name: "Midnight Brass", vibe: "Brass bar at 1am", theme: T({ primary: "#b45309", accent: "#fcd34d", bg: "#09090b", pattern: "none", font: "playfair", radius: "sharp", style: "editorial" }) },
  { name: "Sea Salt", vibe: "Coastal daylight", theme: T({ primary: "#0369a1", accent: "#38bdf8", bg: "#f0f9ff", pattern: "waves", font: "quicksand", radius: "rounded", style: "cards" }) },
  { name: "Chai Stall", vibe: "Roadside warmth", theme: T({ primary: "#d97706", accent: "#fef3c7", bg: "#1a0f0a", pattern: "dots", font: "poppins", radius: "rounded", style: "tickets" }) },
  { name: "Botanical", vibe: "Greenhouse calm", theme: T({ primary: "#84cc16", accent: "#ecfccb", bg: "#0b1f17", pattern: "none", font: "lora", radius: "soft", style: "list" }) },
  { name: "Retro Cola", vibe: "Diner red & cream", theme: T({ primary: "#ef4444", accent: "#fbbf24", bg: "#2a0a0a", pattern: "grid", font: "space", radius: "sharp", style: "poster" }) },
  { name: "Porcelain", vibe: "Quiet minimal", theme: T({ primary: "#1f2937", accent: "#6366f1", bg: "#fafaf9", pattern: "none", font: "inter", radius: "sharp", style: "list" }) },
  { name: "Saffron Sky", vibe: "Sunlit courtyard", theme: T({ primary: "#c2410c", accent: "#0ea5e9", bg: "#fff7ed", pattern: "waves", font: "nunito", radius: "rounded", style: "cards" }) },
  { name: "Vinyl Bar", vibe: "Late-night listening", theme: T({ primary: "#a78bfa", accent: "#f472b6", bg: "#0f0d13", pattern: "grid", font: "space", radius: "sharp", style: "tickets" }) },
];

const STYLE_IDS: ThemeStyle[] = ["cards", "editorial", "list", "poster", "tickets"];

export function themeFromCafe(cafe: Record<string, string | undefined> | null | undefined): Theme {
  if (!cafe) return DEFAULT_THEME;
  const hex = (v: string | undefined, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(v || "") ? v! : fb);
  const pick = (...keys: string[]) => { for (const k of keys) if (cafe[k]) return cafe[k]; return undefined; };
  const bgMode = pick("bgMode", "themeBgMode");
  const pattern = pick("pattern", "themePattern");
  const font = pick("font", "themeFont");
  const radius = pick("radius", "themeRadius");
  const style = pick("style", "themeStyle");
  const image = pick("image", "themeImage") || "";
  return {
    primary: hex(pick("primary", "themePrimary"), DEFAULT_THEME.primary),
    accent: hex(pick("accent", "themeAccent"), DEFAULT_THEME.accent),
    bg: hex(pick("bg", "themeBg"), DEFAULT_THEME.bg),
    bgMode: bgMode === "gradient" ? "gradient" : "solid",
    pattern: (["dots", "grid", "waves"] as const).includes(pattern as never) ? (pattern as Theme["pattern"]) : "none",
    font: font && FONTS[font] ? font : "inter",
    radius: (["soft", "sharp"] as const).includes(radius as never) ? (radius as Theme["radius"]) : "rounded",
    style: STYLE_IDS.includes(style as ThemeStyle) ? (style as ThemeStyle) : "cards",
    image: /^https:\/\//.test(image) ? image : "",
  };
}

// Is the bg light? Used to flip text colours for light themes like Cream.
export function isLight(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
