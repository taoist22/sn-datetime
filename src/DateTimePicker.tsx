import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  ToastAndroid,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI, FileUtils, RattaFileSelector} from 'sn-plugin-lib';
import {DateFormat, formatDateKeyword, formatStamp, StampType} from './dateFormat';
import {
  requestFileReadPermission,
  requireFileReadPermission,
  requireFileWritePermission,
} from './pluginPermissions';

import {tapRect, type TapPoint} from './tapPlacement';
import {isFontPath, adjustedSize, heightForSize, MIN_FONT_SIZE, MAX_FONT_SIZE} from './fontOptions';
import {fontName, FONTS_DIR, MYSTYLE_DIR} from './fontLibrary';
import {defaults, saveSettings, SHOW_POSITION_PRESETS, type StampSettings} from './settings';
import PlacementOverlay, {type PlacementRequest, type PlacementResult} from './PlacementOverlay';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_PAGE_WIDTH = 1404;
const DEFAULT_PAGE_HEIGHT = 1872;
const PANEL_WIDTH = 480;
const PANEL_PADDING = 20;
const BUTTON_MIN_HEIGHT = 76;
const ERROR_DISPLAY_MS = 2500;

// ─── Font size presets ────────────────────────────────────────────────────────
//
// fontSize is what actually drives the rendered size. boxHeight is passed as
// the textRect height but insertText does not honour it: the element it creates
// is a fixed height regardless (measured identical at font 40 and font 72), so
// these values only affect our own edge clamping, not how the stamp looks.

const FONT_SIZES = [
  {label: 'S', fontSize: 28, boxHeight: 44},
  {label: 'M', fontSize: 40, boxHeight: 60},
  {label: 'L', fontSize: 56, boxHeight: 80},
  {label: 'XL', fontSize: 72, boxHeight: 100},
] as const;

type FontSizeLabel = (typeof FONT_SIZES)[number]['label'];

// textAlign values (Supernote / Android gravity): 0=left, 1=center, 2=right
const ALIGNS = [
  {label: '←', value: 0},
  {label: '↔', value: 1},
  {label: '→', value: 2},
] as const;

const DATE_FORMATS: Array<{label: string; value: DateFormat}> = [
  {label: 'US', value: 'us'},
  {label: 'EU', value: 'eu'},
  {label: 'Med', value: 'medium'},
  {label: 'Long', value: 'long'},
  {label: 'ISO', value: 'iso'},
  {label: 'YMD', value: 'ymd'},
];

type Position = 'bottom' | 'top-left' | 'top-right' | 'tap';

const POSITIONS: Array<{label: string; value: Position}> = [
  {label: 'Bottom', value: 'bottom'},
  {label: 'Top Left', value: 'top-left'},
  {label: 'Top Right', value: 'top-right'},
  {label: 'Tap', value: 'tap'},
];

// ─── Types ───────────────────────────────────────────────────────────────────

type ApiRes<T> =
  | {success: boolean; result?: T; error?: {message?: string}}
  | null
  | undefined;

type PageContext = {
  width: number;
  height: number;
  filePath: string | null;
  pageNum: number | null;
};

type KeyWord = {
  keyword?: string;
  page?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolvePageContext(): Promise<PageContext> {
  try {
    const pathRes = (await PluginCommAPI.getCurrentFilePath()) as ApiRes<string>;
    const pageRes = (await PluginCommAPI.getCurrentPageNum()) as ApiRes<number>;
    if (
      pathRes?.success &&
      pageRes?.success &&
      typeof pathRes.result === 'string' &&
      typeof pageRes.result === 'number'
    ) {
      const filePath = pathRes.result;
      const pageNum = pageRes.result;
      // Placement uses on-screen coordinates, so the new display-size API is
      // more accurate than document storage dimensions. Retain getPageSize as
      // a fallback for older plugin-preview firmware.
      const displaySizeRes = (await PluginCommAPI.getPageDisplaySize()) as ApiRes<{
        width: number;
        height: number;
      }>;
      const sizeRes = displaySizeRes?.success
        ? displaySizeRes
        : ((await PluginFileAPI.getPageSize(
            filePath,
            pageNum,
          )) as ApiRes<{width: number; height: number}>);
      const size =
        sizeRes?.success && sizeRes.result
          ? sizeRes.result
          : {width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT};
      return {...size, filePath, pageNum};
    }
  } catch {
    // fall through to defaults
  }
  return {
    width: DEFAULT_PAGE_WIDTH,
    height: DEFAULT_PAGE_HEIGHT,
    filePath: null,
    pageNum: null,
  };
}

function estimateBoxWidth(
  text: string,
  fontSize: number,
  pageWidth: number,
  bold: boolean = false,
): number {
  // Bold glyphs render ~15% wider than regular; digit-heavy strings (YMD) also
  // need extra headroom. Use a higher coefficient for bold to prevent wrapping.
  const charFactor = bold ? 0.80 : 0.70;
  const estimated = Math.ceil(text.length * fontSize * charFactor * 1.15);
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
  point?: TapPoint,
  fontPath?: string | null,
): Promise<void> {
  const edgeMargin = 20;
  const width = estimateBoxWidth(text, fontSize, pageWidth, bold);

  let left: number;
  let right: number;
  let top: number;
  let bottom: number;

  if (position === 'top-right') {
    top = 80;
    bottom = top + boxHeight;
    right = pageWidth - edgeMargin;
    left = right - width;
  } else if (position === 'top-left') {
    top = 80;
    bottom = top + boxHeight;
    left = 100;
    right = left + width;
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

  const textAlign =
    position === 'top-right' ? 2 : position === 'top-left' || position === 'tap' ? 0 : align;

  const textRect = point ? tapRect(point, width, boxHeight, pageWidth, pageHeight, fontSize) : {
    left: Math.round(left),
    top: Math.round(top),
    right: Math.round(right),
    bottom: Math.round(bottom),
  };

  const res = await PluginNoteAPI.insertText({
    textContentFull: text,
    ...(fontPath ? {fontPath} : {}),
    textRect,
    fontSize,
    textBold: bold ? 1 : 0,
    textItalics: italic ? 1 : 0,
    textAlign,
    textEditable: 1,
    showLassoAfterInsert: false,
  });
  if (!(res as ApiRes<boolean>)?.success) {
    throw new Error(
      (res as ApiRes<boolean>)?.error?.message ?? 'insertText failed',
    );
  }
}

async function insertDateKeyword(
  filePath: string,
  pageNum: number,
  keyword: string,
): Promise<void> {
  try {
    // Reading existing keywords needs FILE:READ, which the stamp itself does
    // not. Skip the check rather than block indexing when read is refused.
    if (await requestFileReadPermission()) {
      const existingRes = (await PluginFileAPI.getKeyWords(filePath, [
        pageNum,
      ])) as ApiRes<KeyWord[]>;
      if (
        existingRes?.success &&
        existingRes.result?.some(
          item => item.keyword === keyword && item.page === pageNum,
        )
      ) {
        return;
      }
    }
  } catch {
    // Continue with insertion; duplicate detection is only a courtesy.
  }

  const res = (await PluginFileAPI.insertKeyWord(
    filePath,
    pageNum,
    keyword,
  )) as ApiRes<boolean>;
  if (!res?.success) {
    console.warn(
      '[DateTimePicker] keyword indexing failed:',
      res?.error?.message ?? 'insertKeyWord failed',
    );
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TEST_IDS = {
  overlay: 'datetime-overlay',
  stampBtn: (type: StampType) => `datetime-btn-${type}`,
  toggle: 'datetime-toggle-dayname',
  toggle24h: 'datetime-toggle-24h',
  toggleKeyword: 'datetime-toggle-keyword',
  sizeBtn: (label: string) => `datetime-size-${label}`,
  boldBtn: 'datetime-bold',
  italicBtn: 'datetime-italic',
  alignBtn: (value: number) => `datetime-align-${value}`,
  error: 'datetime-error',
} as const;

export default function DateTimePicker({initialSettings = defaults, autoPlace = false, initialError = null}: {initialSettings?: StampSettings; autoPlace?: boolean; initialError?: string | null}) {
  const [selectedType, setSelectedType] = useState<StampType | null>(initialSettings.selectedType);
  const [includeDayName, setIncludeDayName] = useState(initialSettings.includeDayName);
  const [use24Hour, setUse24Hour] = useState(initialSettings.use24Hour);
  const [includeSeconds, setIncludeSeconds] = useState(initialSettings.includeSeconds);
  const [dateFormat, setDateFormat] = useState<DateFormat>(initialSettings.dateFormat);
  const [position, setPosition] = useState<Position>(initialSettings.position);
  const [sizeLabel, setSizeLabel] = useState<FontSizeLabel>(initialSettings.sizeLabel);
  const [bold, setBold] = useState(initialSettings.bold);
  const [italic, setItalic] = useState(initialSettings.italic);
  const [align, setAlign] = useState(initialSettings.align);
  const [addAsKeyword, setAddAsKeyword] = useState(initialSettings.addAsKeyword);
  const [error, setError] = useState<string | null>(initialError);
  const [quickPlacement, setQuickPlacement] = useState(initialSettings.quickPlacement);
  const [fontPath, setFontPath] = useState(initialSettings.fontPath);
  const [customFontSize, setCustomFontSize] = useState(initialSettings.customFontSize);
  const [choosingFont, setChoosingFont] = useState(false);
  const chooseFont = async () => {
    if (insertingRef.current || choosingFont) {return;}
    setChoosingFont(true);
    try {
      await requireFileReadPermission();
      const startFolder = await FileUtils.exists(FONTS_DIR) ? FONTS_DIR : MYSTYLE_DIR;
      const files = await RattaFileSelector.selectFile({selectType: 0, maxNum: 1,
        needSelectFolder: startFolder, suffixList: ['ttf', 'otf'], title: 'Choose stamp font', rightButtonText: 'Choose'});
      const selected = files?.[0];
      if (selected) {
        if (!isFontPath(selected)) {throw new Error('Choose a .ttf or .otf font file.');}
        if (!await FileUtils.exists(selected)) {throw new Error('The selected font file is unavailable.');}
        setFontPath(selected); setError(null);
      }
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not choose font.');}
    finally {setChoosingFont(false);}
  };
  const autoStarted = useRef(false);
  const [settingsVisible, setSettingsVisible] = useState(!autoPlace);
  const snapshot = (): StampSettings => ({selectedType, includeDayName, use24Hour, includeSeconds,
    dateFormat, position, sizeLabel, bold, italic, align, addAsKeyword, quickPlacement, fontPath, customFontSize});
  const handleSave = async () => {
    if (insertingRef.current || choosingFont) {return;}
    if (quickPlacement && !selectedType) {setError('Choose a stamp type first.'); return;}
    insertingRef.current = true;
    try {await saveSettings(snapshot()); setSettingsVisible(false); PluginManager.closePluginView();}
    catch {setError('Could not save settings. Please try again.');}
    finally {insertingRef.current = false;}
  };
  const insertingRef = useRef(false);
  const [placement, setPlacement] = useState<PlacementRequest | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const sizePreset = useMemo(
    () => customFontSize !== null
      ? {fontSize: customFontSize, boxHeight: heightForSize(customFontSize)}
      : FONT_SIZES.find(s => s.label === sizeLabel) ?? FONT_SIZES[1],
    [sizeLabel, customFontSize],
  );

  const previewDate = useMemo(() => new Date(), []);
  const canIndexDate = selectedType !== 'time';

  const handleInsert = useCallback(async (quick = false, typeOverride?: StampType) => {
    const type = typeOverride ?? selectedType;
    if (!type || insertingRef.current || choosingFont) {
      return;
    }
    insertingRef.current = true;
    setError(null);
    try {
      if (!quick) {await saveSettings({...snapshot(), selectedType: type});}
      // The toolbar button is registered only for NOTE views. Do not use
      // canHandwrite here: while this popup is open, current preview firmware
      // reports the popup itself rather than the editable note beneath it.
      await requireFileWritePermission();
      if (fontPath) {
        await requireFileReadPermission();
        if (!await FileUtils.exists(fontPath)) {
          throw new Error('Saved font is unavailable. Choose another font or Default in Settings.');
        }
      }
      let contextForInsert = await resolvePageContext();
      let point: TapPoint | undefined;
      if (quick || position === 'tap') {
        if (!contextForInsert.filePath || contextForInsert.pageNum === null) {
          throw new Error('Cannot identify the current note page.');
        }
        const outcome = await new Promise<PlacementResult>(resolve => {
          setPlacement({resolve});
        });
        // Backing out is not a failure: close the plugin the way the user
        // expects instead of dropping them into the settings panel.
        if (outcome.kind === 'cancelled') {
          setSettingsVisible(false);
          PluginManager.closePluginView();
          return;
        }
        if (outcome.kind === 'settings') {
          setSettingsVisible(true);
          return;
        }
        point = outcome.point;
        // Keep PluginHost foreground through insertion. Closing first can
        // suspend JS/timers until the user opens the plugin again.
        const current = await resolvePageContext();
        if (current.filePath !== contextForInsert.filePath || current.pageNum !== contextForInsert.pageNum ||
            current.width !== contextForInsert.width || current.height !== contextForInsert.height) {
          throw new Error('Page or orientation changed. Please try again.');
        }
        if (point.x < 0 || point.y < 0 || point.x >= current.width || point.y >= current.height) {
          throw new Error('Tap was outside the page. Please try again.');
        }
        contextForInsert = current;
      }
      const stampDate = new Date();
      const text = formatStamp(
        stampDate,
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
        contextForInsert.width,
        contextForInsert.height,
        point,
        fontPath,
      );
      if (
        addAsKeyword &&
        type !== 'time' &&
        contextForInsert.filePath !== null &&
        contextForInsert.pageNum !== null
      ) {
        await insertDateKeyword(
          contextForInsert.filePath,
          contextForInsert.pageNum,
          formatDateKeyword(stampDate),
        );
      }
      setSettingsVisible(false);
      console.log('[DateTimeOverlay] insert complete; closing plugin');
      PluginManager.closePluginView();
    } catch (e) {
      setSettingsVisible(true);
      const msg = e instanceof Error ? e.message : 'Insert failed';
      console.error('[DateTimePicker] insert failed:', msg, e);
      setError(msg);
      if (position === 'tap') { ToastAndroid.show(msg, ToastAndroid.LONG); }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      errorTimerRef.current = setTimeout(() => setError(null), ERROR_DISPLAY_MS);
    } finally {
      setPlacement(null);
      insertingRef.current = false;
    }
  }, [
    selectedType,
    includeDayName,
    use24Hour,
    includeSeconds,
    dateFormat,
    position,
    sizePreset,
    bold,
    italic,
    align,
    addAsKeyword,
    quickPlacement,
    sizeLabel,
    fontPath,
    customFontSize,
    choosingFont,
  ]);

  useEffect(() => {
    if (autoPlace && !autoStarted.current) {
      autoStarted.current = true;
      void handleInsert(true);
    }
  }, [autoPlace, handleInsert]);

  const handleClose = useCallback(() => {
    if (!insertingRef.current) {
      setSettingsVisible(false);
      PluginManager.closePluginView();
    }
  }, []);

  if (placement) {
    return <PlacementOverlay request={placement} onSettings={() => placement.resolve({kind: 'settings'})} />;
  }

  if (!settingsVisible) {
    return <View testID="datetime-preparing" style={{flex: 1, backgroundColor: 'transparent'}}
      onStartShouldSetResponder={() => true} />;
  }

  return (
    <Pressable
      testID={TEST_IDS.overlay}
      style={styles.overlay}
      onPress={handleClose}>
      <Pressable style={[styles.panel, {maxHeight: '95%'}]} onPress={e => e.stopPropagation()}>
      <ScrollView>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>DateTime Settings</Text>
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

        {/* ── Selector hint ── */}
        <View style={styles.selectHintRow}>
          <Text style={styles.selectHint}>Tap a stamp, then tap the page</Text>
        </View>

        {/* ── Date | Time side by side ── */}
        <View style={styles.stampRow}>
          {(['date', 'time'] as StampType[]).map((type, idx) => (
            <React.Fragment key={type}>
              {idx > 0 && <View style={styles.stampRowDivider} />}
              <Pressable
                testID={TEST_IDS.stampBtn(type)}
                style={[
                  styles.stampBtn,
                  styles.stampBtnHalf,
                  selectedType === type && styles.stampBtnSelected,
                ]}
                onPress={() => {setSelectedType(type); void handleInsert(false, type);}}>
                <Text style={styles.stampBtnLabel}>
                  {type === 'date' ? 'Date' : 'Time'}
                </Text>
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
        <View style={styles.buttonDivider} />

        {/* ── Date + Time full width ── */}
        <Pressable
          testID={TEST_IDS.stampBtn('datetime')}
          style={[
            styles.stampBtn,
            selectedType === 'datetime' && styles.stampBtnSelected,
          ]}
          onPress={() => {setSelectedType('datetime'); void handleInsert(false, 'datetime');}}>
          <Text style={styles.stampBtnLabel}>{'Date + Time'}</Text>
          <Text
            style={[
              styles.stampBtnPreview,
              bold && styles.previewBold,
              italic && styles.previewItalic,
            ]}>
            {formatStamp(
              previewDate,
              'datetime',
              includeDayName,
              use24Hour,
              dateFormat,
              includeSeconds,
            )}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        {/* ── Options ── */}
        <View style={styles.options}>

          {/* Day name toggle */}
          <Pressable
            testID={TEST_IDS.toggle}
            style={styles.toggleRow}
            onPress={() => setIncludeDayName(v => !v)}>
            <View
              style={[styles.checkbox, includeDayName && styles.checkboxChecked]}>
              {includeDayName && (
                <Text style={styles.checkmark}>{'✓'}</Text>
              )}
            </View>
            <Text style={styles.toggleLabel}>Include day name</Text>
          </Pressable>

          {/* 24-hour toggle */}
          <Pressable
            testID={TEST_IDS.toggle24h}
            style={styles.toggleRow}
            onPress={() => setUse24Hour(v => !v)}>
            <View style={[styles.checkbox, use24Hour && styles.checkboxChecked]}>
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

          {/* Position chips — flex layout so "Top Left" / "Top Right" fit */}
          {SHOW_POSITION_PRESETS ? (
            <View style={styles.positionSection}>
              <Text style={styles.positionLabel}>{position === 'tap' ? 'Position — Insert, then tap the page' : 'Position'}</Text>
              <View style={styles.positionBtnRow}>
                {POSITIONS.map(p => (
                  <Pressable
                    key={p.value}
                    testID={`datetime-position-${p.value}`}
                    onPress={() => setPosition(p.value)}
                    style={({pressed}) => [
                      styles.positionChip,
                      position === p.value && styles.positionChipSelected,
                      pressed && styles.positionChipPressed,
                    ]}>
                    <Text
                      style={[
                        styles.positionChipText,
                        position === p.value && styles.positionChipTextSelected,
                      ]}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.optionDivider} />

          {/* Align | Size | Style — Align first so it sits visually under Position */}
          <View style={styles.controlRow}>

            {/* Align only ever applied to the Bottom preset, so it travels
                with the Position controls. */}
            {SHOW_POSITION_PRESETS && (
              <>
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

                <View style={styles.controlGroupDivider} />
              </>
            )}

          </View>

          <View style={styles.optionDivider} />

          {/* Font, size and style together — they all describe the same text,
              and size in particular used to appear twice in two places. */}
          <View style={styles.fontSection}>
          <Text style={styles.controlGroupLabel}>Font</Text>
          <Text style={styles.selectedFont} numberOfLines={2}>
            {fontPath ? fontName(fontPath) : 'Default Supernote font'}
          </Text>

          {/* The native file selector already presents a scrollable list of
              fonts, so it is opened directly rather than behind our own list. */}
          <View style={styles.controlBtnRow}>
            <Pressable testID="datetime-font-default" accessibilityState={{selected: !fontPath}} style={[styles.fontButton, !fontPath && styles.fontButtonSelected]} onPress={() => setFontPath(null)}>
              <Text style={[styles.closeText, !fontPath && styles.fontButtonSelectedText]}>{!fontPath ? '✓ Default' : 'Default'}</Text>
            </Pressable>
            <Pressable testID="datetime-font-choose" disabled={choosingFont} accessibilityState={{selected: !!fontPath}} style={[styles.fontButton, !!fontPath && styles.fontButtonSelected]} onPress={chooseFont}>
              <Text style={[styles.closeText, !!fontPath && styles.fontButtonSelectedText]}>{choosingFont ? 'Choosing…' : fontPath ? '✓ Change font' : 'Choose font'}</Text>
            </Pressable>
          </View>
          <Text style={styles.toggleNote}>Copy .ttf or .otf fonts into MyStyle/Fonts, then choose a file.</Text>

          {/* Presets and the fine dial are one control, so they share a line:
              the chips jump to a preset, − / + nudge from wherever you are. */}
          <Text style={[styles.controlGroupLabel, styles.fontSubLabel]}>Size</Text>
          <View style={[styles.controlBtnRow, styles.sizeRow]}>
            {FONT_SIZES.map(s => (
              <Pressable
                key={s.label}
                testID={TEST_IDS.sizeBtn(s.label)}
                onPress={() => {setSizeLabel(s.label); setCustomFontSize(null);}}
                style={({pressed}) => [
                  styles.chipBtn,
                  customFontSize === null && sizeLabel === s.label && styles.chipBtnSelected,
                  pressed && styles.chipBtnPressed,
                ]}>
                <Text
                  style={[
                    styles.chipBtnText,
                    customFontSize === null && sizeLabel === s.label && styles.chipBtnTextSelected,
                  ]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
            <View style={styles.sizeSpacer} />
            <Pressable testID="datetime-size-minus" disabled={sizePreset.fontSize <= MIN_FONT_SIZE} style={styles.dialButton}
              onPress={() => setCustomFontSize(adjustedSize(sizePreset.fontSize, -2))}>
              <Text style={styles.closeText}>−</Text>
            </Pressable>
            <Text style={styles.dialValue}>{sizePreset.fontSize}</Text>
            <Pressable testID="datetime-size-plus" disabled={sizePreset.fontSize >= MAX_FONT_SIZE} style={styles.dialButton}
              onPress={() => setCustomFontSize(adjustedSize(sizePreset.fontSize, 2))}>
              <Text style={styles.closeText}>+</Text>
            </Pressable>
          </View>

          <Text style={[styles.controlGroupLabel, styles.fontSubLabel]}>Style</Text>
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
          {/* Add as keyword toggle */}
          <Pressable
            testID={TEST_IDS.toggleKeyword}
            style={styles.toggleRow}
            onPress={canIndexDate ? () => setAddAsKeyword(v => !v) : undefined}>
            <View
              style={[
                styles.checkbox,
                addAsKeyword && canIndexDate && styles.checkboxChecked,
                !canIndexDate && styles.checkboxDisabled,
              ]}>
              {addAsKeyword && canIndexDate && (
                <Text style={styles.checkmark}>{'✓'}</Text>
              )}
            </View>
            <View>
              <Text style={[styles.toggleLabel, !canIndexDate && styles.toggleLabelDisabled]}>
                Index date for search
              </Text>
              <Text style={styles.toggleNote}>
                {canIndexDate
                  ? 'Adds a searchable date tag without changing the stamp'
                  : 'Time-only stamps do not include a date'}
              </Text>
            </View>
          </Pressable>

        </View>

        <View style={styles.divider} />

        <Pressable testID="datetime-quick" style={[styles.toggleRow, styles.quickRow]} onPress={() => setQuickPlacement(v => !v)}>
          <Text style={styles.toggleLabel}>{quickPlacement ? '☑' : '☐'} Quick placement on toolbar tap</Text>
        </Pressable>
        <Text style={[styles.toggleNote, styles.quickNote]}>Save once, then tap the toolbar icon and the page.</Text>
        <Pressable testID="datetime-save" style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.closeText}>Save settings</Text>
        </Pressable>
            </ScrollView>
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
  fontSection: {paddingHorizontal: PANEL_PADDING, paddingVertical: 12},
  fontSubLabel: {marginTop: 16, marginBottom: 8},
  sizeRow: {alignItems: 'center'},
  sizeSpacer: {flex: 1, minWidth: 12},
  dialButton: {minWidth: 44, minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderRadius: 6, justifyContent: 'center', alignItems: 'center'},
  dialValue: {fontSize: 18, fontWeight: 'bold', color: '#000000', minWidth: 34, textAlign: 'center'},
  selectedFont: {fontSize: 18, fontWeight: 'bold', color: '#000000', marginTop: 6, marginBottom: 12},
  fontButtonSelected: {backgroundColor: '#000000'},
  fontButtonSelectedText: {color: '#FFFFFF'},
  fontButton: {minHeight: 44, paddingHorizontal: 16, borderWidth: 1, borderRadius: 6, justifyContent: 'center', alignItems: 'center'},
  // Sized to its label and lifted clear of the panel border: with Insert gone
  // this is the last element in the scroll view, so it needs its own bottom gap.
  saveBtn: {alignSelf: 'center', marginTop: 16, marginBottom: 24, minHeight: 44, paddingHorizontal: 32, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center'},
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

  // Selector hint
  selectHintRow: {
    paddingHorizontal: PANEL_PADDING,
    paddingTop: 10,
    paddingBottom: 2,
  },
  selectHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Stamp buttons
  stampRow: {
    flexDirection: 'row',
  },
  stampRowDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  stampBtnHalf: {
    flex: 1,
  },
  stampBtn: {
    paddingVertical: 12,
    paddingHorizontal: PANEL_PADDING,
    minHeight: BUTTON_MIN_HEIGHT,
    justifyContent: 'center',
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  stampBtnSelected: {
    backgroundColor: '#DEDEDE',
    borderLeftColor: '#000000',
  },
  stampBtnLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 3,
  },
  stampBtnPreview: {
    fontSize: 14,
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
    paddingVertical: 14,
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
  toggleLabelDisabled: {
    color: '#AAAAAA',
  },
  toggleNote: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 2,
  },
  // The note sits between an inset toggle row and the inset Save button, so it
  // needs the same horizontal inset to line up with both.
  quickRow: {
    paddingBottom: 2,
  },
  quickNote: {
    paddingHorizontal: PANEL_PADDING,
    marginTop: 0,
  },
  checkboxDisabled: {
    borderColor: '#CCCCCC',
    backgroundColor: '#F5F5F5',
  },

  // Date format row
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 10,
    gap: 12,
  },

  // Position section — label stacked above flex chips
  positionSection: {
    paddingHorizontal: PANEL_PADDING,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  positionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  positionBtnRow: {
    flexDirection: 'row',
    gap: 4,
  },
  positionChip: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  positionChipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  positionChipPressed: {
    backgroundColor: '#F0F0F0',
  },
  positionChipText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '600',
  },
  positionChipTextSelected: {
    color: '#FFFFFF',
  },

  // Align / Size / Style controls
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

  // Insert button
});
