import {isFontPath, MIN_FONT_SIZE, MAX_FONT_SIZE} from './fontOptions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {type DateFormat, type StampType} from './dateFormat';
export type StampSettings = {
  selectedType: StampType | null; includeDayName: boolean; use24Hour: boolean;
  includeSeconds: boolean; dateFormat: DateFormat;
  position: 'bottom' | 'top-left' | 'top-right' | 'tap';
  sizeLabel: 'S' | 'M' | 'L' | 'XL'; bold: boolean; italic: boolean;
  fontPath: string | null; customFontSize: number | null;
  align: number; addAsKeyword: boolean; quickPlacement: boolean;
};
// Tap placement replaced the fixed Bottom / Top Left / Top Right presets. The
// preset code stays in place behind this flag: set it to true to bring the
// Position and Align controls back if tap-only draws user pushback.
export const SHOW_POSITION_PRESETS = false;

export const defaults: StampSettings = {selectedType: null, includeDayName: false, use24Hour: false,
  includeSeconds: false, dateFormat: 'us', position: 'tap', sizeLabel: 'M', bold: false,
  italic: false, align: 1, addAsKeyword: true, quickPlacement: false, fontPath: null, customFontSize: null};
const KEY = 'datetimestamp.settings.v1';
export function normalizeSettings(value: unknown): StampSettings {
  const result = {...defaults};
  if (!value || typeof value !== 'object') { return result; }
  const input = value as Record<string, unknown>;
  for (const key of ['includeDayName', 'use24Hour', 'includeSeconds', 'bold', 'italic', 'addAsKeyword', 'quickPlacement'] as const) {
    if (typeof input[key] === 'boolean') { result[key] = input[key] as boolean; }
  }
  const choices = {selectedType: ['date','time','datetime'], dateFormat: ['us','eu','medium','long','iso','ymd'], position: ['bottom','top-left','top-right','tap'], sizeLabel: ['S','M','L','XL'], align: [0,1,2]};
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    if ((choices[key] as unknown[]).includes(input[key])) { Object.assign(result, {[key]: input[key]}); }
  }
  if (isFontPath(input.fontPath)) {result.fontPath = input.fontPath;}
  if (typeof input.customFontSize === 'number' && Number.isInteger(input.customFontSize) &&
      input.customFontSize >= MIN_FONT_SIZE && input.customFontSize <= MAX_FONT_SIZE) {
    result.customFontSize = input.customFontSize;
  }
  if (!result.selectedType) { result.quickPlacement = false; }
  // Without the Position control there is no way to leave a stored preset, so
  // upgrading users are moved onto tap rather than stranded on an old choice.
  if (!SHOW_POSITION_PRESETS) { result.position = 'tap'; }
  return result;
}
export async function loadSettings(): Promise<StampSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) { return {...defaults}; }
  try { return normalizeSettings(JSON.parse(raw)); } catch { return {...defaults}; }
}
export async function saveSettings(settings: StampSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(normalizeSettings(settings)));
}
