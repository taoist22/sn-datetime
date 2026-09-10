import AsyncStorage from '@react-native-async-storage/async-storage';
import {defaults, loadSettings, saveSettings, normalizeSettings} from '../src/settings';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(async () => {await AsyncStorage.clear();});
it('persists the configuration and quick placement', async () => {
  const value = {...defaults, selectedType: 'datetime' as const, quickPlacement: true, bold: true, dateFormat: 'iso' as const};
  await saveSettings(value);
  expect(await loadSettings()).toEqual(value);
});
it('rejects invalid options and prevents quick placement without a stamp type', () => {
  expect(normalizeSettings({quickPlacement: true, selectedType: 'unknown', align: 99, bold: 'yes'})).toEqual(defaults);
});
it('surfaces storage failures instead of claiming settings were saved', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await expect(saveSettings(defaults)).rejects.toThrow('disk full');
});

it('keeps legacy presets and validates new font settings', async () => {
  expect(normalizeSettings({sizeLabel: 'L'})).toEqual({...defaults, sizeLabel: 'L'});
  expect(normalizeSettings({fontPath: '/font.exe', customFontSize: 999})).toEqual(defaults);
  const settings = {...defaults, fontPath: '/MyStyle/Fonts/MyFont.otf', customFontSize: 46};
  await saveSettings(settings);
  expect(await loadSettings()).toEqual(settings);
});

it('persists valid custom patterns and repairs invalid saved patterns', async () => {
  const settings = {...defaults, dateFormat: 'custom' as const, customPattern: 'dd/MM/yy'};
  await saveSettings(settings);
  expect(await loadSettings()).toEqual(settings);
  expect(normalizeSettings({dateFormat: 'custom', customPattern: 'dd.MM.yyyyy'})).toEqual({
    ...defaults,
    dateFormat: 'custom',
  });
});
