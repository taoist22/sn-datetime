# DateTimeStamp for Supernote

A [Supernote](https://supernote.com) plugin that inserts formatted date, time, or date+time stamps into your notes with a single tap.

## Features

- **Three stamp types:** Date, Time, or Date + Time
- **Four date formats:** Numeric (4/26/2026), Medium (Apr 26, 2026), Long (April 26, 2026), ISO (2026-04-26)
- **Optional day name:** e.g. Sunday, April 26, 2026
- **12 or 24-hour time**
- **Optional seconds** in time stamps
- **Font size:** S / M / L / XL
- **Bold and italic styles**
- **Alignment:** left, center, or right
- **Insertion position:** bottom of page (with alignment) or fixed top-right corner
- Stamp is inserted as an editable text element

## Installation

1. Download `DateTimeStamp.snplg` from the [latest release](https://github.com/taoist22/sn-datetime/releases).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `DateTimeStamp.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `DateTimeStamp`.

## Usage

1. Open a note and tap the **clock icon** in the toolbar.
2. Set your preferences in the panel:
   - **Toggles:** Include day name, 24-hour time, Include seconds
   - **Date format:** Num / Med / Long / ISO
   - **Position:** Bottom (respects alignment) or Top Right (always upper-right corner)
   - **Size:** S / M / L / XL
   - **Style:** Bold (B), Italic (I)
   - **Align:** ← / ↔ / → (applies when Position is Bottom)
3. Tap **Date**, **Time**, or **Date + Time** to insert the stamp.

The stamp lands at the chosen position as a text element. You can lasso and move it from there.

## Building from Source

Requirements: Node.js ≥ 18, npm.

```bash
npm install
./buildPlugin.sh
```

The built plugin will be at `build/outputs/DateTimeStamp.snplg`.

## Compatibility

Requires Supernote firmware with plugin support. Tested on the Supernote Nomad (A6X2).

## License

MIT
