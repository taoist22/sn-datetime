# DateTimeStamp for Supernote

A [Supernote](https://supernote.com) plugin that inserts formatted date, time, or date+time stamps into your notes. Set the format once, then tap the page wherever you want the stamp.

## Features

- **Three stamp types:** Date, Time, or Date + Time
- **Six date formats:** US (4/26/2026), EU (26/04/2026), Medium (Apr 26, 2026), Long (April 26, 2026), ISO (2026-04-26), YMD (20260426)
- **Optional day name:** e.g. Sunday, April 26, 2026
- **12 or 24-hour time**, with optional seconds
- **Tap placement:** the stamp lands on the line you tap
- **Custom fonts:** any `.ttf` or `.otf` from `MyStyle/Fonts`
- **Size:** S / M / L / XL presets, or fine adjustment from 16 to 96
- **Bold and italic styles**
- **Date search indexing:** adds a searchable `YYYYMMDD` keyword without changing the visible stamp
- **Saved settings** that survive a restart, plus **quick placement** for one-tap stamping
- Stamp is inserted as an editable text element you can lasso and move

## Installation

1. Download `DateTimeStamp.snplg` from the [latest release](https://github.com/taoist22/sn-datetime/releases).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `DateTimeStamp.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `DateTimeStamp`.

## Usage

1. Open a note and tap the **clock icon** in the toolbar.
2. Set up how the stamp should look — see [Options](#options).
3. Tap **Date**, **Time**, or **Date + Time**. Each button previews exactly what it will insert. The panel closes and a **Tap to place · 30 seconds** banner appears.
4. **Tap the page** where you want the stamp. It is inserted at that point as an editable text element.

There is no separate insert step: the stamp button you tap is the one that gets placed. Configure first, then tap the stamp you want.

Placement takes a single tap. Drags and long presses are ignored, so you will not stamp the page by resting your hand on it. Your selected pen is unchanged, and no handwriting is erased.

### Leaving the placement banner

- **Cancel** or the hardware **Back** button closes the plugin without inserting anything.
- **Settings** returns to the settings panel with nothing inserted.
- After 30 seconds with no tap, placement gives up and closes the plugin, the same as Cancel.

### Options

- **Include day name** — prepends the full weekday name to the date
- **24-hour time** — switches time display to 24h format
- **Include seconds** — adds seconds to time stamps
- **Date format:**
  - *US* — M/D/YYYY (4/26/2026)
  - *EU* — D/MM/YYYY (26/04/2026)
  - *Med* — abbreviated month (Apr 26, 2026)
  - *Long* — full month name (April 26, 2026)
  - *ISO* — year-first with dashes (2026-04-26)
  - *YMD* — compact, no separators (20260426)
- **Font** — Default, or a `.ttf` / `.otf` file of your own; see [Fonts](#fonts)
- **Size** — S / M / L / XL, or the **− / +** controls for any size from 16 to 96. Choosing a preset clears the fine adjustment.
- **Style** — Bold (B), Italic (I)
- **Index date for search** — adds a searchable `YYYYMMDD` keyword to the page for date and date+time stamps, without changing what the stamp looks like. Native search and date-range tools find it even when the stamp uses another format. Unavailable for time-only stamps, which have no date to index.

Settings are saved when you place a stamp or press **Save settings**, and are reused next time. Closing the panel without either discards your changes.

## Quick placement

Set up your stamp, tick **Quick placement on toolbar tap**, then press **Save settings**. From then on, tapping the clock icon skips the settings panel entirely and goes straight to the placement banner — tap the page and you are done.

To change settings afterwards, use **Settings** on the placement banner, or open DateTimeStamp's configuration entry in Supernote's plugin manager.

## Fonts

Create a **Fonts** subfolder inside **MyStyle** on your Supernote and copy `.ttf` or `.otf` files into it. Extract any ZIP downloads first — the plugin needs the font file itself.

In Settings, tap **Choose font** to pick a file. The picker opens in `MyStyle/Fonts` when that folder exists, otherwise in `MyStyle`. **Default** returns to the normal Supernote font.

The font file must stay where you selected it. If it has moved or been deleted, the plugin opens Settings with an error rather than silently stamping in a different font — reselect the font to fix it. The preview in the settings panel uses the panel's own UI font, not your selected font; place a stamp to see the real result.

## Permissions

On first use the device asks for file access. DateTimeStamp requests two permissions:

- **Write** — required. This is how the stamp and the optional date keyword get into your note. Denying it means no stamp.
- **Read** — optional. Used to pick a font file, and to check whether a page already carries the date keyword being added. Denying it still lets you stamp; you just cannot choose a custom font, and a page may end up with a duplicate date keyword.

## Building from Source

Requirements: Node.js ≥ 18, npm, JDK 21, and the Android SDK.

```bash
npm install
ANDROID_HOME=~/Library/Android/sdk ./buildPlugin.sh
```

The built plugin will be at `build/outputs/DateTimeStamp.snplg`.

Note that `buildPlugin.sh` exits 0 even when the APK step fails — check its output for `APK build succeeded` rather than trusting the exit code.

## Compatibility

Requires Plugin Preview Build **Chauvet 3.29.44 Beta** on Manta / Nomad, or **Chauvet 2.26.41 Beta** on A5 X / A6 X. These builds introduced plugin permission management; earlier builds are not supported.

> Do not use Chauvet 3.29.43 / 2.26.40 — Ratta withdrew those builds because sticker data could be lost after upgrading.

## License

MIT

## Changelog

### 1.5.0-beta

- **Tap placement everywhere.** The Bottom / Top Left / Top Right presets and the Align control are gone; a stamp is placed by tapping the page. Saved presets migrate to tap placement automatically.
- **No Insert button.** Tapping Date, Time, or Date + Time goes straight to placement.
- **Placement lands on the line you tap.** The stamp is anchored on the text baseline, offset by `2.05 × font size`, calibrated on device against 8mm ruled lines.
- **Cancel closes the plugin.** Cancel, Back, and the 30-second timeout previously reopened the settings panel with an error. Only genuine insert failures return you to Settings now.
- **Custom fonts and fine size control**, with Font, Size and Style grouped together in one section.
- **Saved settings and quick placement** persist across restarts via AsyncStorage, and the plugin registers a configuration entry in the plugin manager.
- **Permission-aware.** Works with the permission management introduced in Chauvet 3.29.44. A denied read permission no longer blocks stamping.

### 1.2.x-beta

Regional date formats, Top Left / Top Right positions, keyword indexing, and box-width fixes for bold and digit-heavy stamps.
