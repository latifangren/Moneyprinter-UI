export const DEFAULT_VIDEO_LANGUAGE = "en";
export const DEFAULT_PARAGRAPH_NUMBER = 1;
export const DEFAULT_TERMS_AMOUNT = 5;

export function formatTerms(videoTerms: string[] | string): string {
  return Array.isArray(videoTerms) ? videoTerms.join(", ") : videoTerms;
}

export function parseTerms(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function clampNumber(value: string, min: number, max: number): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(parsedValue)));
}
