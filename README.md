# DateTimeStamp for Supernote

A [Supernote](https://supernote.com) plugin that inserts formatted date, time, or date+time stamps into your notes.

## Features

- **Three stamp types:** Date, Time, or Date + Time
- **Six date formats:** US (4/26/2026), EU (26/04/2026), Medium (Apr 26, 2026), Long (April 26, 2026), ISO (2026-04-26), YMD (20260426)
- **Optional day name:** e.g. Sunday, April 26, 2026
- **12 or 24-hour time**
- **Optional seconds** in time stamps
- **Font size:** S / M / L / XL
- **Bold and italic styles**
- **Alignment:** left, center, or right (applies when Position is Bottom)
- **Insertion position:** Bottom, Top Left, or Top Right
- **Add as keyword:** also registers the stamp in the Supernote keyword index (not available for YMD format)
- Stamp is inserted as an editable text element

## Installation

1. Download `DateTimeStamp.snplg` from the [latest release](https://github.com/taoist22/sn-datetime/releases).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `DateTimeStamp.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `DateTimeStamp`.

## Usage

1. Open a note and tap the **clock icon** in the toolbar.
2. **Select a stamp type** — tap **Date**, **Time**, or **Date + Time** at the top of the panel. The selected type highlights.
3. Configure your options:
   - **Include day name** — prepends the full weekday name to the date
   - **24-hour time** — switches time display to 24h format
   - **Include seconds** — adds seconds to time stamps
   - **Date format:**
     - *US* — M/D/YYYY (4/26/2026)
     - *EU* — D/MM/YYYY (26/04/2026)
     - *Med* — abbreviated month (Apr 26, 2026)
     - *Long* — full month name (April 26, 2026)
     - *ISO* — year-first with dashes (2026-04-26)
     - *YMD* — compact no-separator (20260426)
   - **Position:** Bottom / Top Left / Top Right
   - **Align:** ← / ↔ / → (applies when Position is Bottom)
   - **Size:** S / M / L / XL
   - **Style:** Bold (B), Italic (I)
   - **Add as keyword** — registers the stamp in the Supernote keyword index for that page, making it searchable via the Keywords view. Disabled when YMD format is selected (all-digit strings are not supported by keyword search)
4. Tap **Insert** to place the stamp and close the panel.

The stamp lands at the chosen position as an editable text element. You can lasso and move it from there.

## Building from Source

Requirements: Node.js ≥ 18, npm.

```bash
npm install
./buildPlugin.sh
```

The built plugin will be at `build/outputs/DateTimeStamp.snplg`.

## Compatibility

Requires Supernote firmware with plugin support. Tested on Supernote Nomad (A6X2) and Manta (A5X2).

## License

MIT
