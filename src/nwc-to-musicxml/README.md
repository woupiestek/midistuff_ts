# NWC to MusicXML converter

NWC is the file format of Noteworthy composer. Version 2 ships with a converter
tool that provides a plain text format--nwctxt--that this converter turn into
MusicXML, which is more widely supported.

## design philosophy

Data oriented design: perhaps typescript is not ideals for taking advantage of
fewer cache misses and branch mispredictions, but the maintainer may be... each
loop devoted to one task, and if statements at the top level of control flow: it
sound like maintainable code to me, even if unfamiliar.

### testing

No unit test here, just a regression test script, to use as follows.

`deno run --allow-all src\nwc-to-musicxml\regression_test.ts`

Reason:

- unit tests get in the way of big refactors that are part of exploring a new
  codeing style.
- it is not a big project.
