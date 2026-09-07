export const MYSTYLE_DIR = '/storage/emulated/0/MyStyle';
export const FONTS_DIR = `${MYSTYLE_DIR}/Fonts`;

// Building our own font list was tried and removed: FileUtils.listFiles and
// getFileList are both declared in sn-plugin-lib but neither enumerates a
// directory on Chauvet 3.29.44, and RattaFileSelector already presents a
// scrollable list. Reach for a native module only if an inline list is ever
// worth more than the picker.
export function fontName(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.(ttf|otf)$/i, '');
}
