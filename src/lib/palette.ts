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
  temperature: number;     // 0 cool → 1 warm
  contrast: number;        // 0 flat → 1 deep shadows/highlights
  edge: number;            // 0 smooth → 1 richly detailed
  neutralShare: number;    // 0 colourful → 1 mostly neutrals
  hueSpread: number;       // 0 monochrome → 1 many hues
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

function canvasToBlob(canvas: HTMLCanvasElement, q: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => {
      if (!b || b.type === "image/webp") return resolve(b);
      // Browser can't encode WebP (old Safari) → JPEG.
      canvas.toBlob((j) => resolve(j), "image/jpeg", q);
    }, "image/webp", q);
  });
}

// Resizes a dish photo before upload: ~1200px WebP, under 300 KB. Keeps menus
// fast and lets the built-in database store hold photos comfortably.
export async function fileToOptimizedBlob(file: File, maxBytes = 300_000): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    for (const maxSide of [1200, 1000, 820, 680]) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, w, h);

      for (const q of [0.82, 0.72, 0.62, 0.52, 0.42]) {
        const blob = await canvasToBlob(canvas, q);
        if (blob && blob.size <= maxBytes) {
          const ext = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp";
          const name = file.name.replace(/\.[^.]+$/, "") || "photo";
          return new File([blob], `${name}.${ext}`, { type: blob.type });
        }
      }
    }
    return file;
  } catch {
    // Any decode hiccup → let the server validate the original.
    return file;
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
  const lums = new Float32Array(size * size);
  let totalLight = 0, totalSat = 0, counted = 0, warmSum = 0, warmWeight = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
    const { h, s, l } = rgbToHsl(r, g, b);
    lums[i / 4] = l;
    totalLight += l; totalSat += s; counted += 1;
    if (s > 0.12) {
      // 1 = fully warm (orange/red), 0 = fully cool (blue/teal)
      warmSum += ((Math.cos(((h - 25) * Math.PI) / 180) + 1) / 2) * s;
      warmWeight += s;
    }
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

  // Contrast: spread of light and shadow in the frame.
  let variance = 0;
  for (let i = 0; i < lums.length; i++) variance += (lums[i] - avgLightness) ** 2;
  const contrast = Math.min(1, Math.sqrt(variance / Math.max(1, counted)) * 2.6);

  // Edge/detail: average difference between neighbouring pixels. Interiors and
  // textures score high; flat graphics and minimal logos score low.
  let edgeSum = 0, edgeCount = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (x < size - 1) { edgeSum += Math.abs(lums[i] - lums[i + 1]); edgeCount += 1; }
      if (y < size - 1) { edgeSum += Math.abs(lums[i] - lums[i + size]); edgeCount += 1; }
    }
  }
  const edge = Math.min(1, (edgeSum / Math.max(1, edgeCount)) * 9);

  const neutralShare = list.filter((b) => b.s < 0.12).reduce((acc, b) => acc + b.weight, 0);
  const temperature = warmWeight > 0 ? warmSum / warmWeight : 0.5;
  const busy = meaningful.length >= 10 || edge > 0.34;

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

  const topHues = vivid.slice(0, 4).map((b) => b.h);
  let spread = 0;
  for (let i = 0; i < topHues.length; i++) {
    for (let j = i + 1; j < topHues.length; j++) spread = Math.max(spread, hueGap(topHues[i], topHues[j]));
  }

  return {
    colors: meaningful.slice(0, 6).map((b) => b.hex),
    primary,
    accent,
    avgLightness,
    saturation,
    busy,
    light: avgLightness > 0.62,
    temperature,
    contrast,
    edge,
    neutralShare,
    hueSpread: spread / 180,
  };
}

function hueOf(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255).h;
}

// The main event: one complete design where palette, layout, font, texture,
// corners and background all come from the photo's actual character.
export function matchedTheme(a: PhotoAnalysis): Theme {
  const warm = a.temperature >= 0.56;
  const graphic = a.contrast > 0.42 && a.edge > 0.34;
  const calm = a.edge < 0.3;
  const neutral = a.neutralShare > 0.42;

  let style: ThemeStyle;
  if (a.busy && a.saturation > 0.42) style = "poster";
  else if (neutral && calm) style = "editorial";
  else if (graphic) style = "tickets";
  else if (a.edge > 0.32) style = "list";
  else style = "cards";

  let font: string;
  if (style === "editorial") font = warm ? "dmserif" : "playfair";
  else if (style === "tickets") font = warm ? "poppins" : "space";
  else if (style === "poster") font = warm ? "dmserif" : "space";
  else if (style === "list") font = neutral ? "inter" : "lora";
  else font = warm ? "poppins" : a.light ? "nunito" : "inter";

  const pattern: Theme["pattern"] = graphic ? "grid" : a.edge > 0.36 ? "dots" : calm && a.saturation > 0.28 ? "waves" : "none";
  const radius: Theme["radius"] = calm ? "soft" : graphic ? "sharp" : "rounded";
  const bg = a.light ? hsl(hueOf(a.accent), 0.3, 0.965) : hsl(hueOf(a.primary), 0.26, 0.055);

  return {
    primary: a.primary,
    accent: a.accent,
    bg,
    bgMode: a.light ? "solid" : a.contrast > 0.3 ? "gradient" : "solid",
    pattern,
    font,
    radius,
    style,
    image: "",
    wash: a.light ? 84 : 90,
  };
}

/** Human description of what we saw in the photo. */
export function describeAnalysis(a: PhotoAnalysis): string {
  const mood = a.temperature >= 0.56 ? "warm" : a.temperature <= 0.44 ? "cool" : "balanced";
  const light = a.light ? "bright" : "moody";
  const detail = a.edge > 0.45 ? "richly detailed" : a.edge < 0.24 ? "clean and minimal" : "softly textured";
  return `${mood}, ${light}, ${detail}`;
}

// Three complete designs from one photo. The first is the honest match; the
// other two are useful directions the same photo can take.
export function looksFromPhoto(a: PhotoAnalysis): PhotoLook[] {
  const warm = a.temperature >= 0.56;
  const matched = matchedTheme(a);
  return [
    {
      label: "Matched to your photo",
      note: `${describeAnalysis(a)} — colours, type, layout and texture all follow the image.`,
      theme: matched,
    },
    {
      label: "Light edit",
      note: "Your colours on cream stock — calmer, more printed-menu.",
      theme: {
        primary: hsl(hueOf(a.primary), 0.45, 0.22),
        accent: a.primary,
        bg: hsl(hueOf(a.accent), 0.4, 0.965),
        bgMode: "solid",
        pattern: "none",
        font: warm ? "dmserif" : "playfair",
        radius: "soft",
        style: a.busy ? "list" : "editorial",
        image: "",
        wash: 86,
      },
    },
    {
      label: "Night edit",
      note: "Deep tinted dark, with your photo's brightest colour as the neon edge.",
      theme: {
        primary: a.accent,
        accent: a.primary,
        bg: hsl(hueOf(a.primary), 0.32, 0.05),
        bgMode: "gradient",
        pattern: a.busy ? "grid" : "none",
        font: "space",
        radius: "sharp",
        style: a.busy ? "tickets" : "poster",
        image: "",
        wash: 92,
      },
    },
  ];
}
