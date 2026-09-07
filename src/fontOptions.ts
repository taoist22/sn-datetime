export const MIN_FONT_SIZE = 16;
export const MAX_FONT_SIZE = 96;
export function isFontPath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && /\.(ttf|otf)$/i.test(path) && !path.includes('\0');
}
export function adjustedSize(size: number, delta: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(size + delta)));
}
// Interpolate the existing, device-tested presets to retain their appearance.
export function heightForSize(size: number): number {
  const stops = [[16,28], [28,44], [40,60], [56,80], [72,100], [96,132]];
  for (let i = 1; i < stops.length; i++) {
    if (size <= stops[i][0]) {
      const [x0,y0] = stops[i-1]; const [x1,y1] = stops[i];
      return Math.round(y0 + (size-x0)*(y1-y0)/(x1-x0));
    }
  }
  return 132;
}
