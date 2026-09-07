import {fontName, FONTS_DIR} from '../src/fontLibrary';

it('derives a display name from a font path', () => {
  expect(fontName(`${FONTS_DIR}/Caslon-Regular.ttf`)).toBe('Caslon-Regular');
  expect(fontName('/x/Noto.OTF')).toBe('Noto');
  expect(fontName('Bare.ttf')).toBe('Bare');
});
