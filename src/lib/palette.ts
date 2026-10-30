"use client";
// Photo → design matcher. Runs entirely in the browser: no AI API, no upload
// needed to get a palette. We shrink the photo into a canvas, group its pixels
// into colour buckets, then build looks that are guaranteed readable
// (buttons keep white text, backgrounds keep enough contrast).

import type { Theme, ThemeStyle } from "./theme";

type Bucket = { hex: string; weight: number; h: number; s: number; l: number };

export type PhotoAnalysis = {
  colors: string[];        // dominant colours, most common first
  primary: string;         // best brand colour
  accent: string;          // contrasting highlight
  avgLightness: number;    // 0 (black) → 1 (white)
  saturation: number;      // 0 → 1
  busy: boolean;           // lots of distinct colours (photos, textures)
  light: boolean;          // overall bright image
};

export type PhotoLook = { label: string; note: string; theme: Theme };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hsl(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hueGap(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image — try JPG, PNG or WebP."));
    img.src = src;
  });
}

// Shrinks a photo into a small self-contained data URL (~35–60 KB). Stored in
// the cafe row itself, so photo backdrops need no file-storage service at all.
export async function fileToCompactDataUrl(file: File, maxChars = 60_000): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    for (const maxSide of [760, 620, 500, 400, 320]) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser can't prepare images — try another browser.");
      ctx.drawImage(img, 0, 0, w, h);

      for (const q of [0.74, 0.64, 0.54, 0.44, 0.34, 0.26]) {
        let out = canvas.toDataURL("image/webp", q);
        // Older Safari silently returns PNG for WebP — use JPEG instead.
        if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", q);
        if (out.length <= maxChars) return out;
      }
    }
    throw new Error("That image is very detailed — try a simpler photo or a smaller crop.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function analyzeImage(src: string): Promise<PhotoAnalysis> {
  const img = await loadImage(src);
  const size = 72;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can't read images — try another browser.");
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  let totalLight = 0, totalSat = 0, counted = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
    const { s, l } = rgbToHsl(r, g, b);
    totalLight += l; totalSat += s; counted += 1;
  }
  if (!counted) throw new Error("That image looks empty — try another one.");

  const list: Bucket[] = [...buckets.values()].map((b) => {
    const r = b.r / b.n, g = b.g / b.n, bl = b.b / b.n;
    const { h, s, l } = rgbToHsl(r, g, bl);
    return {
      hex: `#${[r, g, bl].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`,
      weight: b.n / counted, h, s, l,
    };
  }).sort((a, b) => b.weight - a.weight);

  const avgLightness = totalLight / counted;
  const saturation = totalSat / counted;
  const meaningful = list.filter((b) => b.weight > 0.012);
  const busy = meaningful.length >= 12;

  // Brand colour: the most present colour that is vivid enough to carry buttons.
  const vivid = meaningful
    .filter((b) => b.s > 0.2 && b.l > 0.08 && b.l < 0.85)
    .sort((a, b) => b.s * b.weight - a.s * a.weight);
  const mid = meaningful.filter((b) => b.l > 0.1 && b.l < 0.9);
  const base = vivid[0] || mid[0] || list[0];

  const primary = hsl(base.h, clamp(base.s, 0.55, 0.86), clamp(base.l, 0.36, 0.53));
  const other = vivid.find((b) => hueGap(b.h, base.h) > 35) || vivid[1];
  const accent = other
    ? hsl(other.h, clamp(other.s, 0.6, 0.95), clamp(other.l, 0.58, 0.78))
    : hsl(base.h + 150, 0.7, 0.62);

  return {
    colors: meaningful.slice(0, 6).map((b) => b.hex),
    primary,
    accent,
    avgLightness,
    saturation,
    busy,
    light: avgLightness > 0.62,
  };
}

// Three complete designs from one photo. Each is visually distinct — same
// photo can read as "my brand", "printed menu" or "night bar".
export function looksFromPhoto(a: PhotoAnalysis): PhotoLook[] {
  const warm = /^#(f|e|d|c)/i.test(a.primary) || a.saturation > 0.45;
  const serif = a.busy || a.saturation > 0.5 ? "dmserif" : "playfair";
  const style1: ThemeStyle = a.busy ? "poster" : "cards";
  const style3: ThemeStyle = a.saturation > 0.5 ? "tickets" : "list";

  return [
    {
      label: "True to photo",
      note: a.light ? "Light, airy palette lifted from your image." : "Dark, moody palette lifted from your image.",
      theme: {
        primary: a.primary,
        accent: a.accent,
        bg: a.light ? hsl(0, 0.1, 0.965) : hsl(0, 0.2, 0.055),
        bgMode: a.light ? "solid" : "gradient",
        pattern: a.busy ? "none" : "dots",
        font: warm ? "poppins" : "inter",
        radius: a.busy ? "sharp" : "rounded",
        style: style1,
        image: "",
      },
    },
    {
      label: "Menu paper",
      note: "Cream stock, ink type, your photo's colour as the highlight.",
      theme: {
        primary: hsl(0, 0.55, 0.22),
        accent: a.primary,
        bg: "#faf6ec",
        bgMode: "solid",
        pattern: "none",
        font: serif,
        radius: "soft",
        style: "editorial",
        image: "",
      },
    },
    {
      label: "After dark",
      note: "Deep tinted night, neon edge, playful ticket rows.",
      theme: {
        primary: a.accent,
        accent: a.primary,
        bg: hsl(0, 0.3, 0.06),
        bgMode: "gradient",
        pattern: a.busy ? "grid" : "none",
        font: "space",
        radius: "sharp",
        style: style3,
        image: "",
      },
    },
  ];
}
