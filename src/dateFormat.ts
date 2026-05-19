export type StampType = 'date' | 'time' | 'datetime';
export type DateFormat = 'us' | 'eu' | 'medium' | 'long' | 'iso' | 'ymd';

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(
  date: Date,
  format: DateFormat,
  includeDayName: boolean,
): string {
  const weekday: Intl.DateTimeFormatOptions['weekday'] = includeDayName
    ? 'long'
    : undefined;

  if (format === 'iso' || format === 'ymd') {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const compact = format === 'ymd' ? `${y}${m}${d}` : `${y}-${m}-${d}`;
    if (includeDayName) {
      const dayName = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
      }).format(date);
      return `${dayName}, ${compact}`;
    }
    return compact;
  }

  // Explicit regional formats — locale passed directly so output is
  // independent of the device's server-region setting.
  if (format === 'us' || format === 'eu') {
    const locale = format === 'us' ? 'en-US' : 'en-GB';
    return new Intl.DateTimeFormat(locale, {
      weekday,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(date);
  }

  const monthStyle: Intl.DateTimeFormatOptions['month'] =
    format === 'medium' ? 'short' : 'long';

  return new Intl.DateTimeFormat(undefined, {
    weekday,
    year: 'numeric',
    month: monthStyle,
    day: 'numeric',
  }).format(date);
}

// ─── Time formatting ──────────────────────────────────────────────────────────

function formatTime(
  date: Date,
  use24Hour: boolean,
  includeSeconds: boolean = false,
): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: use24Hour ? false : undefined,
  }).format(date);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function formatStamp(
  date: Date,
  type: StampType,
  includeDayName: boolean,
  use24Hour: boolean = false,
  dateFormat: DateFormat = 'us',
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
