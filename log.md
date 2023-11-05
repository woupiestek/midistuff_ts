# Midistuff logs

## 2013-11-5

Midi sound achieved! Added:

- `deno_midi.ts` for the code that makes the sound
- `run_midi.ps1` to deal with the necessary permissions

Use `.\run_midi.ps1 -file .\deno_midi.ts` to hear.

And now I am playing midi files!

### thoughts on the interface

It should be possible to play short sequences in isolation and so on, so maybe a
structured text document of some sort: like you just see the text, clicking
opens up an editor, that produces sounds when new events are added or something.

### lingering

Let's test all the midi files.

- BALLADE, CANYON, Exhil, FANTASIE, ochtend, ases_dood, griegs..., JAZZ, MINUET,
  REGGAE, trouwdag..., zaal_van_de_bergkoning: scan failure
- others: unexpected abrupt endings...

'trollenmars' sounds odd, but mediaplayer does the same thing.

The mystery is solved: midi uses 'running status', to compress its files.

## 2023-11-2

Reorganize the file by program: the program determines how the notes sound.
Takes hashes for deduplication.

### trying to play midi

Frustration is increasing. Can Deno not do midi?

- not with web midi api directly
- not with web midi api in the browser
- not with web midi api served via https...

## 2023-11-1

There is a web midi api, maybe it works in deno as well. I could also run it in
chrome, by setting up a web app.

## 2023-10-29

All data is in events in tracks even if some of the data does not belong to a
particular track, time or either.

- Track only: sequence number, sequence name, device name, end of track, smpte
  offset
- Time only: marker, cue point, tempo, key signature,
- Neither: copyright

For next time: modify and write.
