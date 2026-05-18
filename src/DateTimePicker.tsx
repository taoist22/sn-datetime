import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI} from 'sn-plugin-lib';
import {DateFormat, formatStamp, StampType} from './dateFormat';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_PAGE_WIDTH = 1404;
const DEFAULT_PAGE_HEIGHT = 1872;
const PANEL_WIDTH = 480;
const PANEL_PADDING = 20;
const BUTTON_MIN_HEIGHT = 88;
const ERROR_DISPLAY_MS = 2500;

// ─── Font size presets ────────────────────────────────────────────────────────
//
// boxHeight is the textRect height passed to the API. Supernote sizes the text
// to fill the box, so boxHeight is the primary lever for visual size. fontSize
// is also passed; on firmware builds that honour it explicitly, both agree.

const FONT_SIZES = [
  {label: 'S', fontSize: 28, boxHeight: 44},
  {label: 'M', fontSize: 40, boxHeight: 60},
  {label: 'L', fontSize: 56, boxHeight: 80},
  {label: 'XL', fontSize: 72, boxHeight: 100},
] as const;

type FontSizeLabel = (typeof FONT_SIZES)[number]['label'];

// textAlign values (Supernote convention, same as Android gravity):
// 0 = left, 1 = center, 2 = right
const ALIGNS = [
  {label: '←', value: 0},
  {label: '↔', value: 1},
  {label: '→', value: 2},
] as const;

const DATE_FORMATS: Array<{label: string; value: DateFormat; example: string}> =
  [
    {label: 'Num', value: 'numeric', example: '4/26/2026'},
    {label: 'Med', value: 'medium', example: 'Apr 26'},
    {label: 'Long', value: 'long', example: 'April 26'},
    {label: 'ISO', value: 'iso', example: '2026-04-26'},
  ];

type Position = 'bottom' | 'top';

// ─── Types ───────────────────────────────────────────────────────────────────

type ApiRes<T> =
  | {success: boolean; result?: T; error?: {message?: string}}
  | null
  | undefined;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolvePageSize(): Promise<{width: number; height: number}> {
  try {
    const pathRes = (await PluginCommAPI.getCurrentFilePath()) as ApiRes<string>;
    const pageRes = (await PluginCommAPI.getCurrentPageNum()) as ApiRes<number>;
    if (
      pathRes?.success &&
      pageRes?.success &&
      typeof pathRes.result === 'string' &&
      typeof pageRes.result === 'number'
    ) {
      const sizeRes = (await PluginFileAPI.getPageSize(
        pathRes.result,
        pageRes.result,
      )) as ApiRes<{width: number; height: number}>;
      if (sizeRes?.success && sizeRes.result) {
        return sizeRes.result;
      }
    }
  } catch {
    // Fall through to defaults
  }
  return {width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT};
}

/**
 * Estimate the pixel width needed for `text` at `fontSize`.
 */
function estimateBoxWidth(
  text: string,
  fontSize: number,
  pageWidth: number,
): number {
  const estimated = Math.ceil(text.length * fontSize * 0.55 * 1.15);
  const min = fontSize * 4;
  const max = pageWidth - 200;
  return Math.max(min, Math.min(max, estimated));
}

async function insertStamp(
  text: string,
  fontSize: number,
  boxHeight: number,
  bold: boolean,
  italic: boolean,
  align: number,
  position: Position,
  pageWidth: number,
  pageHeight: number,
): Promise<void> {
  const edgeMargin = 20;
  const width = estimateBoxWidth(text, fontSize, pageWidth);

  let left: number;
  let right: number;
  let top: number;
  let bottom: number;

  if (position === 'top') {
    top = 80;
    bottom = top + boxHeight;
    right = pageWidth - edgeMargin;
    left = right - width;
  } else {
    bottom = Math.round(pageHeight - 80);
    top = bottom - boxHeight;
    if (align === 2) {
      right = pageWidth - edgeMargin;
      left = right - width;
    } else if (align === 1) {
      left = Math.round((pageWidth - width) / 2);
      right = left + width;
    } else {
      left = 100;
      right = left + width;
    }
  }

  const textRect = {
    left: Math.round(left),
    top: Math.round(top),
    right: Math.round(right),
    bottom: Math.round(bottom),
  };

  const res = await PluginNoteAPI.insertText({
    textContentFull: text,
    textRect,
    fontSize,
    textBold: bold ? 1 : 0,
    textItalics: italic ? 1 : 0,
    textAlign: position === 'top' ? 2 : align,
    textEditable: 1,
    showLassoAfterInsert: false,
  });
  if (!(res as ApiRes<boolean>)?.success) {
    throw new Error(
      (res as ApiRes<boolean>)?.error?.message ?? 'insertText failed',
    );
  }
}

// ─── Stamp button config ──────────────────────────────────────────────────────

const STAMP_BUTTONS: Array<{type: StampType; label: string}> = [
  {type: 'date', label: 'Date'},
  {type: 'time', label: 'Time'},
  {type: 'datetime', label: 'Date + Time'},
];

// ─── Component ───────────────────────────────────────────────────────────────

export const TEST_IDS = {
  overlay: 'datetime-overlay',
  stampBtn: (type: StampType) => `datetime-btn-${type}`,
  toggle: 'datetime-toggle-dayname',
  toggle24h: 'datetime-toggle-24h',
  sizeBtn: (label: string) => `datetime-size-${label}`,
  boldBtn: 'datetime-bold',
  italicBtn: 'datetime-italic',
  alignBtn: (value: number) => `datetime-align-${value}`,
  error: 'datetime-error',
} as const;

export default function DateTimePicker() {
  const [includeDayName, setIncludeDayName] = useState(false);
  const [use24Hour, setUse24Hour] = useState(false);
  const [includeSeconds, setIncludeSeconds] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormat>('numeric');
  const [position, setPosition] = useState<Position>('bottom');
  const [sizeLabel, setSizeLabel] = useState<FontSizeLabel>('M');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const insertingRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pageSize, setPageSize] = useState({
    width: DEFAULT_PAGE_WIDTH,
    height: DEFAULT_PAGE_HEIGHT,
  });

  useEffect(() => {
    resolvePageSize().then(setPageSize);
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const sizePreset = useMemo(
    () => FONT_SIZES.find(s => s.label === sizeLabel) ?? FONT_SIZES[1],
    [sizeLabel],
  );

  const previewDate = useMemo(() => new Date(), []);

  const handleStampTap = useCallback(
    async (type: StampType) => {
      if (insertingRef.current) {
        return;
      }
      insertingRef.current = true;
      setError(null);
      try {
        const text = formatStamp(
          new Date(),
          type,
          includeDayName,
          use24Hour,
          dateFormat,
          includeSeconds,
        );
        await insertStamp(
          text,
          sizePreset.fontSize,
          sizePreset.boxHeight,
          bold,
          italic,
          align,
          position,
          pageSize.width,
          pageSize.height,
        );
        PluginManager.closePluginView();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Insert failed';
        console.error('[DateTimePicker] insertStamp failed:', msg, e);
        setError(msg);
        if (errorTimerRef.current) {
          clearTimeout(errorTimerRef.current);
        }
        errorTimerRef.current = setTimeout(
          () => setError(null),
          ERROR_DISPLAY_MS,
        );
      } finally {
        insertingRef.current = false;
      }
    },
    [
      includeDayName,
      use24Hour,
      includeSeconds,
      dateFormat,
      position,
      sizePreset,
      bold,
      italic,
      align,
      pageSize,
    ],
  );

  const handleClose = useCallback(() => {
    if (!insertingRef.current) {
      PluginManager.closePluginView();
    }
  }, []);

  return (
    <Pressable
      testID={TEST_IDS.overlay}
      style={styles.overlay}
      onPress={handleClose}>
      <Pressable style={styles.panel} onPress={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Insert Stamp</Text>
          <Pressable
            onPress={handleClose}
            style={({pressed}) => [
              styles.closeBtn,
              pressed && styles.closeBtnPressed,
            ]}>
            <Text style={styles.closeText}>{'✕'}</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />

        {/* ── Error banner ── */}
        {error != null && (
          <View testID={TEST_IDS.error} style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Stamp buttons ── */}
        <View style={styles.body}>
          {STAMP_BUTTONS.map(({type, label}, idx) => (
            <React.Fragment key={type}>
              {idx > 0 && <View style={styles.buttonDivider} />}
              <Pressable
                testID={TEST_IDS.stampBtn(type)}
                style={({pressed}) => [
                  styles.stampBtn,
                  pressed && styles.stampBtnPressed,
                ]}
                onPress={() => handleStampTap(type)}>
                <Text style={styles.stampBtnLabel}>{label}</Text>
                <Text
                  style={[
                    styles.stampBtnPreview,
                    bold && styles.previewBold,
                    italic && styles.previewItalic,
                  ]}>
                  {formatStamp(
                    previewDate,
                    type,
                    includeDayName,
                    use24Hour,
                    dateFormat,
                    includeSeconds,
                  )}
                </Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
        <View style={styles.divider} />

        {/* ── Options ── */}
        <View style={styles.options}>

          {/* Day name toggle */}
          <Pressable
            testID={TEST_IDS.toggle}
            style={styles.toggleRow}
            onPress={() => setIncludeDayName(v => !v)}>
            <View
              style={[
                styles.checkbox,
                includeDayName && styles.checkboxChecked,
              ]}>
              {includeDayName && (
                <Text style={styles.checkmark}>{'✓'}</Text>
              )}
            </View>
            <Text style={styles.toggleLabel}>Include day name</Text>
          </Pressable>

          {/* 24-hour time toggle */}
          <Pressable
            testID={TEST_IDS.toggle24h}
            style={styles.toggleRow}
            onPress={() => setUse24Hour(v => !v)}>
            <View
              style={[styles.checkbox, use24Hour && styles.checkboxChecked]}>
              {use24Hour && <Text style={styles.checkmark}>{'✓'}</Text>}
            </View>
            <Text style={styles.toggleLabel}>24-hour time</Text>
          </Pressable>

          {/* Seconds toggle */}
          <Pressable
            style={styles.toggleRow}
            onPress={() => setIncludeSeconds(v => !v)}>
            <View
              style={[styles.checkbox, includeSeconds && styles.checkboxChecked]}>
              {includeSeconds && <Text style={styles.checkmark}>{'✓'}</Text>}
            </View>
            <Text style={styles.toggleLabel}>Include seconds</Text>
          </Pressable>

          {/* Date format chips */}
          <View style={styles.formatRow}>
            <Text style={styles.controlGroupLabel}>Date</Text>
            <View style={styles.controlBtnRow}>
              {DATE_FORMATS.map(f => (
                <Pressable
                  key={f.value}
                  onPress={() => setDateFormat(f.value)}
                  style={({pressed}) => [
                    styles.chipBtn,
                    styles.chipBtnWide,
                    dateFormat === f.value && styles.chipBtnSelected,
                    pressed && styles.chipBtnPressed,
                  ]}>
                  <Text
                    style={[
                      styles.chipBtnText,
                      dateFormat === f.value && styles.chipBtnTextSelected,
                    ]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Position chips */}
          <View style={styles.formatRow}>
            <Text style={styles.controlGroupLabel}>Position</Text>
            <View style={styles.controlBtnRow}>
              {([
                {label: 'Bottom', value: 'bottom'},
                {label: 'Top Right', value: 'top'},
              ] as const).map(p => (
                <Pressable
                  key={p.value}
                  onPress={() => setPosition(p.value)}
                  style={({pressed}) => [
                    styles.chipBtn,
                    styles.chipBtnXWide,
                    position === p.value && styles.chipBtnSelected,
                    pressed && styles.chipBtnPressed,
                  ]}>
                  <Text
                    style={[
                      styles.chipBtnText,
                      position === p.value && styles.chipBtnTextSelected,
                    ]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.optionDivider} />

          {/* Size + style + alignment row */}
          <View style={styles.controlRow}>

            {/* Size */}
            <View style={styles.controlGroup}>
              <Text style={styles.controlGroupLabel}>Size</Text>
              <View style={styles.controlBtnRow}>
                {FONT_SIZES.map(s => (
                  <Pressable
                    key={s.label}
                    testID={TEST_IDS.sizeBtn(s.label)}
                    onPress={() => setSizeLabel(s.label)}
                    style={({pressed}) => [
                      styles.chipBtn,
                      sizeLabel === s.label && styles.chipBtnSelected,
                      pressed && styles.chipBtnPressed,
                    ]}>
                    <Text
                      style={[
                        styles.chipBtnText,
                        sizeLabel === s.label && styles.chipBtnTextSelected,
                      ]}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.controlGroupDivider} />

            {/* Style (bold / italic) */}
            <View style={styles.controlGroup}>
              <Text style={styles.controlGroupLabel}>Style</Text>
              <View style={styles.controlBtnRow}>
                <Pressable
                  testID={TEST_IDS.boldBtn}
                  onPress={() => setBold(v => !v)}
                  style={({pressed}) => [
                    styles.chipBtn,
                    bold && styles.chipBtnSelected,
                    pressed && styles.chipBtnPressed,
                  ]}>
                  <Text
                    style={[
                      styles.chipBtnText,
                      styles.chipBtnBoldText,
                      bold && styles.chipBtnTextSelected,
                    ]}>
                    {'B'}
                  </Text>
                </Pressable>
                <Pressable
                  testID={TEST_IDS.italicBtn}
                  onPress={() => setItalic(v => !v)}
                  style={({pressed}) => [
                    styles.chipBtn,
                    italic && styles.chipBtnSelected,
                    pressed && styles.chipBtnPressed,
                  ]}>
                  <Text
                    style={[
                      styles.chipBtnText,
                      styles.chipBtnItalicText,
                      italic && styles.chipBtnTextSelected,
                    ]}>
                    {'I'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.controlGroupDivider} />

            {/* Alignment */}
            <View style={styles.controlGroup}>
              <Text style={styles.controlGroupLabel}>Align</Text>
              <View style={styles.controlBtnRow}>
                {ALIGNS.map(a => (
                  <Pressable
                    key={a.value}
                    testID={TEST_IDS.alignBtn(a.value)}
                    onPress={() => setAlign(a.value)}
                    style={({pressed}) => [
                      styles.chipBtn,
                      align === a.value && styles.chipBtnSelected,
                      pressed && styles.chipBtnPressed,
                    ]}>
                    <Text
                      style={[
                        styles.chipBtnText,
                        align === a.value && styles.chipBtnTextSelected,
                      ]}>
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

          </View>
        </View>

      </Pressable>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: PANEL_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
  },

  // Header
  header: {
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeBtn: {
    position: 'absolute',
    right: PANEL_PADDING,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: '#E8E8E8',
  },
  closeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },

  // Dividers
  divider: {
    height: 1,
    backgroundColor: '#000000',
  },
  buttonDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: PANEL_PADDING,
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  controlGroupDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
    alignSelf: 'stretch',
  },

  // Error
  errorBanner: {
    marginHorizontal: PANEL_PADDING,
    marginTop: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },

  // Stamp buttons
  body: {
    paddingVertical: 8,
  },
  stampBtn: {
    paddingVertical: 14,
    paddingHorizontal: PANEL_PADDING,
    minHeight: BUTTON_MIN_HEIGHT,
    justifyContent: 'center',
  },
  stampBtnPressed: {
    backgroundColor: '#F0F0F0',
  },
  stampBtnLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  stampBtnPreview: {
    fontSize: 15,
    color: '#555555',
  },
  previewBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  previewItalic: {
    fontStyle: 'italic',
  },

  // Options section
  options: {
    paddingBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 16,
    gap: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#000000',
  },
  checkmark: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: 'bold',
    lineHeight: 21,
  },
  toggleLabel: {
    fontSize: 19,
    color: '#000000',
  },

  // Date format row
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 12,
    gap: 12,
  },

  // Size / Style / Align controls
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 14,
    gap: 0,
  },
  controlGroup: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  controlGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  controlBtnRow: {
    flexDirection: 'row',
    gap: 4,
  },
  chipBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipBtnWide: {
    width: 52,
  },
  chipBtnXWide: {
    width: 80,
  },
  chipBtnSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipBtnPressed: {
    backgroundColor: '#F0F0F0',
  },
  chipBtnText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  chipBtnTextSelected: {
    color: '#FFFFFF',
  },
  chipBtnBoldText: {
    fontWeight: '900',
  },
  chipBtnItalicText: {
    fontStyle: 'italic',
  },
});
