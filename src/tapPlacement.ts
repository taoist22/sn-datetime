export type TapPoint = {x: number; y: number};

// Distance from the requested box top down to the glyph baseline, as a multiple
// of the font size. The stamp is anchored so this baseline lands on the tap, so
// it sits on a ruled line the way handwriting does.
//
// Calibrated on device against 8mm ruled lines (~94px at 300dpi). At font 40 an
// offset of 82px puts the text on the tapped line, and at font 72 that same 82px
// left it ~62px low — two points that fit a straight proportion through 82/40.
//
// Note the box height is NOT the lever here: insertText ignores the height we
// pass and builds an element of a fixed height, measured identical at font 40
// and font 72. It is the position of the text *inside* that fixed element that
// scales with the font, which is why this is a ratio and not a constant.
//
// Placement tracks the tap continuously — it does not snap to the ruled grid —
// so any leftover error is a straight adjustment to this one number.
export const BASELINE_OFFSET_RATIO = 2.05;

export function tapRect(
  point: TapPoint,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
  fontSize: number,
) {
  const left = Math.max(0, Math.min(point.x, pageWidth - width));
  const top = Math.max(
    0,
    Math.min(point.y - fontSize * BASELINE_OFFSET_RATIO, pageHeight - height),
  );
  return {left: Math.round(left), top: Math.round(top), right: Math.round(left + width), bottom: Math.round(top + height)};
}
