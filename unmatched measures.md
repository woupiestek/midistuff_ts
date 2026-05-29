When measures in different parts don’t match in a MusicXML score, the situation
is explicitly supported by the MusicXML format. There are two mechanisms that
MusicXML provides to represent and disambiguate mismatched measure boundaries:

1. non-controlling="yes" for multimetric or misaligned measures If a measure in
   one part does not align with the same-numbered measure in another part (for
   example, in multimetric music such as Don Giovanni minuets), set the
   measure’s: non-controlling="yes" This tells MusicXML readers that this
   measure's left barline should not be aligned with the barlines of other
   parts. From the official W3C MusicXML 4.0 reference:

The non-controlling attribute “is intended for use in multimetric music… If set
to 'yes', the left barline in this measure does not coincide with the left
barline of measures in other parts” 1.

This prevents rendering engines from forcing the measures to line up across
parts.

2. implicit="yes" for hidden / conceptual measures If a part contains a measure
   that is used for logical grouping but should not appear visually, e.g.:

pickup measure mid‑measure repeat structures unnumbered partial measures

Use: implicit="yes" This marks the measure as not to display a measure number,
and helps conversions between partwise and timewise formats 1 2.

Quick Examples Example A: Measures intentionally misaligned Part 1 has a normal
measure 12 Part 2 divides that same time span into two smaller measures 12a and
12b: Xml<measure number="12"> ...
</measure>

<measure number="12a" non-controlling="yes">
    ...
</measure>

<measure number="12b" non-controlling="yes">
    ...
</measure>

Example B: Pickup measure that should NOT sync across parts
Xml<measure number="0" implicit="yes"> ...
</measure>

Why mismatched measures are allowed MusicXML purposely allows each part to
define its own measure segmentation. This is validated in both:

MusicXML 4.0 spec for <measure> attributes 1 Independent documentation of
partwise measure behavior 2 3

Rendering engines (Finale, Sibelius, MuseScore, Dorico, etc.) use the number,
implicit, and non‑controlling attributes to decide how to align or desynchronize
measures between parts.

Choosing how to encode mismatched measures Use the following rule of thumb:

The measures should match → give them the same number across all parts The
measures should NOT match visually → set non-controlling="yes" The measures
should NOT appear at all (pickup, hidden, etc.) → set implicit="yes"

If you're working in timewise vs partwise format, these attributes help preserve
the logical relationships during conversion 4.

If you want, I can also provide:

A complete validated MusicXML example with mismatched measure structures A guide
for how different notation programs interpret these attributes How to convert
between partwise and timewise when measure numbers don’t align

1-W3.org 2-Musicxml.com 3-Deepwiki.com 4-Deepwiki.com
