# MICR glyph reference

`micr-glyphs.json` contains synthetic E-13B glyph silhouettes from GnuMICR
000.300, copyright (C) 2000-2003 Eric Sandeen. These font-derived silhouettes
are distributed under the GNU General Public License, version 2 or later;
see the original [COPYING](../../../client/public/fonts/gnumicr/COPYING)
and [README](../../../client/public/fonts/gnumicr/README) supplied with the font.

The reference was generated independently of the application outline parser:
PDF.js 5.4.296 rendered an embedded, original Type 1 GnuMICR font with the
synthetic text `0123456789AC` at 12pt, with 9pt advances, onto a white page.
Each 9pt-wide cell was rasterized at four pixels per point over the vertical
range from 12pt above the baseline to 1.5pt below it. Pixels with all RGB
channels below 128 are set to one. Each 36-pixel row is stored as nine hex
digits, with the leftmost pixel in the least significant bit; the 54 rows
are concatenated for each glyph. `A` is transit and `C` is on-us.

Tests render the application's actual PDF and compare these silhouettes at
the required check positions. The fixture contains no banking or personal
information and deliberately does not use application layout/parser helpers.
