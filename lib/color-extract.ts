/* eslint-disable @typescript-eslint/no-require-imports */
/* ================================================================== */
/*  Color extraction utility                                            */
/*                                                                      */
/*  Wraps the `colorthief` package to derive the dominant color from   */
/*  an image. Returns a hex string. Always falls back to a sensible    */
/*  default on any failure — never throws.                             */
/* ================================================================== */

const FALLBACK = "#2563eb";

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract the dominant color from a remote image URL.
 *
 * NOTE: only works when the URL is publicly fetchable. SharePoint
 * "logical paths" (e.g. /Company/X/Branding/logo.png) are not URLs —
 * use {@link extractPrimaryColorFromBuffer} when you already have the
 * raw file bytes (preferred for upload flows).
 */
export async function extractPrimaryColor(imageUrl: string): Promise<string> {
  try {
    const res    = await fetch(imageUrl);
    if (!res.ok) return FALLBACK;
    const buffer = Buffer.from(await res.arrayBuffer());
    return await extractPrimaryColorFromBuffer(buffer);
  } catch {
    return FALLBACK;
  }
}

/**
 * Extract the dominant color from raw image bytes already in memory.
 * Always returns a valid hex string — falls back on any error.
 */
export async function extractPrimaryColorFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const ColorThief = require("colorthief");
    const rgb        = await ColorThief.getColor(buffer);
    if (!Array.isArray(rgb) || rgb.length < 3) return FALLBACK;
    const [r, g, b] = rgb as [number, number, number];
    return rgbToHex(r, g, b);
  } catch {
    return FALLBACK;
  }
}
