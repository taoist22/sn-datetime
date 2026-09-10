export type StampType = 'date' | 'time' | 'datetime';
export type DateFormat = 'us' | 'eu' | 'medium' | 'long' | 'iso' | 'ymd' | 'custom';

export const DEFAULT_CUSTOM_PATTERN = 'dd.MM.yy';
export const MAX_CUSTOM_PATTERN_LENGTH = 60;
const CUSTOM_TOKENS = ['MMMM', 'dddd', 'MMM', 'ddd', 'yyyy', 'MM', 'dd', 'yy', 'M', 'd'];

function pad(value: number): string { return String(value).padStart(2, '0'); }

export function validateCustomPattern(pattern: string): string | null {
  if (!pattern.trim()) { return 'Enter a custom stamp pattern.'; }
  if (pattern.length > MAX_CUSTOM_PATTERN_LENGTH) {
    return `Custom pattern must be ${MAX_CUSTOM_PATTERN_LENGTH} characters or fewer.`;
  }
  let quoted = false;
  let foundToken = false;
  for (let i = 0; i < pattern.length;) {
    if (pattern[i] === "'") {
      if (pattern[i + 1] === "'") { i += 2; continue; }
      quoted = !quoted; i++; continue;
    }
    if (!quoted && /[A-Za-z]/.test(pattern[i])) {
      const token = CUSTOM_TOKENS.find(candidate => pattern.startsWith(candidate, i));
      if (!token) { return `Unsupported token: ${pattern[i]}`; }
      foundToken = true;
      i += token.length; continue;
    }
    i++;
  }
  if (quoted) { return 'Close the quoted text in the custom pattern.'; }
  return foundToken ? null : 'Include at least one supported token.';
}

export function formatCustomStamp(date: Date, pattern: string): string {
  const error = validateCustomPattern(pattern);
  if (error) { throw new Error(error); }
  const monthShort = new Intl.DateTimeFormat(undefined, {month: 'short'}).format(date);
  const monthLong = new Intl.DateTimeFormat(undefined, {month: 'long'}).format(date);
  const dayShort = new Intl.DateTimeFormat(undefined, {weekday: 'short'}).format(date);
  const dayLong = new Intl.DateTimeFormat(undefined, {weekday: 'long'}).format(date);
  const values: Record<string, string> = {
    M: String(date.getMonth() + 1), MM: pad(date.getMonth() + 1), MMM: monthShort, MMMM: monthLong,
    d: String(date.getDate()), dd: pad(date.getDate()), ddd: dayShort, dddd: dayLong,
    yy: pad(date.getFullYear() % 100), yyyy: String(date.getFullYear()),
  };
  let result = '';
  let quoted = false;
  for (let i = 0; i < pattern.length;) {
    if (pattern[i] === "'") {
      if (pattern[i + 1] === "'") { result += "'"; i += 2; continue; }
      quoted = !quoted; i++; continue;
    }
    if (!quoted && /[A-Za-z]/.test(pattern[i])) {
      const token = CUSTOM_TOKENS.find(candidate => pattern.startsWith(candidate, i))!;
      result += values[token]; i += token.length; continue;
    }
    result += pattern[i++];
  }
  return result;
}

function customPatternHasWeekday(pattern: string): boolean {
  let quoted = false;
  for (let i = 0; i < pattern.length;) {
    if (pattern[i] === "'") {
      if (pattern[i + 1] === "'") { i += 2; continue; }
      quoted = !quoted; i++; continue;
    }
    if (!quoted && /[A-Za-z]/.test(pattern[i])) {
      const token = CUSTOM_TOKENS.find(candidate => pattern.startsWith(candidate, i));
      if (!token) { i++; continue; }
      if (token === 'ddd' || token === 'dddd') { return true; }
      i += token.length; continue;
    }
    i++;
  }
  return false;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatYmdDate(date: Date): string {
  return formatIsoDate(date).replace(/-/g, '');
}

function formatDate(
  date: Date,
  format: DateFormat,
  includeDayName: boolean,
): string {
  const weekday: Intl.DateTimeFormatOptions['weekday'] = includeDayName
    ? 'long'
    : undefined;

  if (format === 'iso' || format === 'ymd') {
    const iso = formatIsoDate(date);
    const compact = format === 'ymd' ? formatYmdDate(date) : iso;
    if (includeDayName) {
      const dayName = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
      }).format(date);
      return `${dayName}, ${compact}`;
    }
    return compact;
  }

  // Keep the chosen numeric order independent of locale, but obtain an
  // optional weekday name from the device locale.
  if (format === 'us' || format === 'eu') {
    const numeric = format === 'us'
      ? `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
      : `${date.getDate()}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    if (!includeDayName) { return numeric; }
    const dayName = new Intl.DateTimeFormat(undefined, {weekday: 'long'}).format(date);
    return `${dayName}, ${numeric}`;
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

export function formatDateKeyword(date: Date): string {
  return formatYmdDate(date);
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
  customPattern: string = DEFAULT_CUSTOM_PATTERN,
): string {
  const timePart = formatTime(date, use24Hour, includeSeconds);
  if (dateFormat === 'custom' && type !== 'time') {
    let custom = formatCustomStamp(date, customPattern);
    if (includeDayName && !customPatternHasWeekday(customPattern)) {
      const dayName = new Intl.DateTimeFormat(undefined, {weekday: 'long'}).format(date);
      custom = `${dayName}, ${custom}`;
    }
    return type === 'datetime' ? `${custom}  ${timePart}` : custom;
  }
  const datePart = formatDate(date, dateFormat, includeDayName);

  switch (type) {
    case 'date':
      return datePart;
    case 'time':
      return timePart;
    case 'datetime':
      return `${datePart}  ${timePart}`;
  }
}
