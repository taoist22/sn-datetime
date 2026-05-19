import {formatStamp} from '../src/dateFormat';

// Sunday April 26 2026, 14:30 UTC.
const FIXED_DATE = new Date('2026-04-26T14:30:00Z');

// Pass explicit locales through; default undefined to en-US for consistency.
const enUS = 'en-US';
const origDateTimeFormat = Intl.DateTimeFormat;

beforeAll(() => {
  global.Intl = {
    ...global.Intl,
    DateTimeFormat: (
      locale?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) => new origDateTimeFormat(locale ?? enUS, options),
  } as typeof Intl;
});

afterAll(() => {
  global.Intl = {...global.Intl, DateTimeFormat: origDateTimeFormat};
});

describe('formatStamp — date formats', () => {
  it('us: M/D/YYYY', () => {
    expect(formatStamp(FIXED_DATE, 'date', false, false, 'us')).toBe('4/26/2026');
  });

  it('eu: D/MM/YYYY', () => {
    expect(formatStamp(FIXED_DATE, 'date', false, false, 'eu')).toBe('26/04/2026');
  });

  it('medium: abbreviated month', () => {
    expect(formatStamp(FIXED_DATE, 'date', false, false, 'medium')).toBe('Apr 26, 2026');
  });

  it('long: full month name', () => {
    expect(formatStamp(FIXED_DATE, 'date', false, false, 'long')).toBe('April 26, 2026');
  });

  it('iso: YYYY-MM-DD', () => {
    expect(formatStamp(FIXED_DATE, 'date', false, false, 'iso')).toBe('2026-04-26');
  });

  it('ymd: YYYYMMDD compact', () => {
    expect(formatStamp(FIXED_DATE, 'date', false, false, 'ymd')).toBe('20260426');
  });

  it('iso with day name: prepends weekday', () => {
    expect(formatStamp(FIXED_DATE, 'date', true, false, 'iso')).toBe('Sunday, 2026-04-26');
  });

  it('long with day name', () => {
    expect(formatStamp(FIXED_DATE, 'date', true, false, 'long')).toBe('Sunday, April 26, 2026');
  });

  it('us with day name', () => {
    expect(formatStamp(FIXED_DATE, 'date', true, false, 'us')).toContain('Sunday');
  });
});

describe('formatStamp — time', () => {
  it('returns locale time (12h) by default', () => {
    const result = formatStamp(FIXED_DATE, 'time', false);
    expect(result).toMatch(/\d{1,2}:30\s*(AM|PM)/i);
  });

  it('returns 24-hour time when use24Hour is true', () => {
    const result = formatStamp(FIXED_DATE, 'time', false, true);
    expect(result).toMatch(/\d{2}:30/);
  });

  it('includeDayName has no effect on time-only stamp', () => {
    expect(formatStamp(FIXED_DATE, 'time', false)).toBe(
      formatStamp(FIXED_DATE, 'time', true),
    );
  });
});

describe('formatStamp — datetime', () => {
  it('contains both date and time parts separated by two spaces', () => {
    const result = formatStamp(FIXED_DATE, 'datetime', false);
    expect(result).toContain('4/26/2026');
    expect(result).toContain('  ');
    expect(result).toMatch(/\d{1,2}:30/);
  });

  it('includes day name in the date portion when toggled on', () => {
    const result = formatStamp(FIXED_DATE, 'datetime', true, false, 'long');
    expect(result).toContain('Sunday, April 26, 2026');
    expect(result).toMatch(/\d{1,2}:30/);
  });
});
