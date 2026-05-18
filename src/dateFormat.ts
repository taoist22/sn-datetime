/**
 * Date/time formatting for the DateTime Stamper plugin.
 *
 * All Intl.DateTimeFormat calls use locale = undefined, which tells the JS
 * engine to use the device's default locale. This means date ordering
 * (MM/DD vs DD/MM) and 12/24h time follow the device's region setting
 * automatically for the 'numeric' format.
 *
 * 'medium', 'long', and 'iso' formats are unambiguous regardless of locale:
 *   medium → Apr 26, 2026
 *   long   → April 26, 2026
 *   iso    → 2026-04-26
 *
 * Note: Android's standalone "Use 24-hour format" clock setting is not
 * accessible from JS without a native module. use24Hour overrides this
 * explicitly when the user enables it in the popup.
 */

export type StampType = 'date' | 'time' | 'datetime';
export type DateFormat = 'numeric' | 'medium' | 'long' | 'iso';

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(
  date: Date,
  format: DateFormat,
  includeDayName: boolean,
): string {
  const weekday: Intl.DateTimeFormatOptions['weekday'] = includeDayName
    ? 'long'
    : undefined;

  if (format === 'iso') {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    if (includeDayName) {
      const dayName = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
      }).format(date);
      return `${dayName}, ${iso}`;
    }
    return iso;
  }

  const monthStyle: Intl.DateTimeFormatOptions['month'] =
    format === 'numeric' ? 'numeric' : format === 'medium' ? 'short' : 'long';

  return new Intl.DateTimeFormat(undefined, {
    weekday,
    year: 'numeric',
    month: monthStyle,
    day: 'numeric',
  }).format(date);
}

// ─── Time formatting ──────────────────────────────────────────────────────────

/**
 * @param use24Hour  When true, forces 24-hour output (e.g. "14:30") regardless
 *                   of locale. When false, defers to the locale convention.
 */
function formatTime(date: Date, use24Hour: boolean, includeSeconds: boolean = false): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: use24Hour ? false : undefined,
  }).format(date);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Format a date/time stamp ready for insertion into a note.
 *
 * @param date           The Date to format (typically `new Date()` at tap time)
 * @param type           Which components to include
 * @param includeDayName When true, prefixes the date with the full weekday name
 * @param use24Hour      When true, forces 24-hour time format
 * @param dateFormat     Controls how the date portion is rendered
 */
export function formatStamp(
  date: Date,
  type: StampType,
  includeDayName: boolean,
  use24Hour: boolean = false,
  dateFormat: DateFormat = 'numeric',
  includeSeconds: boolean = false,
): string {
  const datePart = formatDate(date, dateFormat, includeDayName);
  const timePart = formatTime(date, use24Hour, includeSeconds);

  switch (type) {
    case 'date':
      return datePart;
    case 'time':
      return timePart;
    case 'datetime':
      return `${datePart}  ${timePart}`;
  }
}
