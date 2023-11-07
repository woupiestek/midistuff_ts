# Midistuff logs

## 2023-11-7

### left out

- pedals
- accents
- ...

Accents is interesting: something that can only be attached to a note. Not that
a crescendo over an empty sequence or a chord with rests is meaningful, but is
seem we have a case for splitting up two types of note.

Note: perhaps the ultimate solution is to build a trie of operands, each with
separate token types. Main exception is duration: every note and rest has one,
and a lot is allowed. There are non hex numbers too, for tempo and program, etc.

This could be split up: the normal pattern becomes (rest/note duration)*,
seperated with spaces if needed. duration follows, because the note or rest
applies to it i.e. they are not themselves the events.

Abiguity is a bitch. Maybe durations should just always be preceded by a `;`
That way, other tokens are free to start with `abcdef`. This could be a general
rule: use a marker to set all numbers apart from other operands. Have different
markers for different numbers.

Mark and repeat introduce variable names, so, `$` for them right? Maybe backtick
or `'`, or something.

### notation of pitch

Pitches actually are the default kind of number, ironically. Currently
octave-tone-accidental: big to small, like numbers. The note names are absolute,
sothe accidentals are no issue. If we introduced keys signatures, there is a
choice: add naturals, of keep the relative accidentals. Advantage of key
signatures: less accidentals to note down, Downside: misleading note names.

This is the part that can change the most.

### inventorize

Pitches, dynamics, durations, programs, tempos: different numbers with different
ways to write them down.

- Pitches and dynamics have their own little systems, for which i'd like the
  trees.
- Duration: floating hexadecimals...
- Programs: limited range like pitches and dynamics, but I am not feeling like
  working them out. Up for change down the line. `=` for decimal numbers?
- Tempos: sticking to this milliseconds per whole note idea...

Aside from that, markers, which should just be identifier strings. `$`?

### next step: generate messages!

The marks etc. are now the interesting parts. Is the scope of a mark limited?

Maybe add something to the parser?

Panic mode would be good as well, but what are the boundaries if everything is
an expression? `,` and `}` maybe?

## 2023-11-6

Where to take the notation from here?

- Parallellism for chords.
- Tempo.
- Pedals.
- More dynamic options.
- Comments.
- Repeats.
- Instruments. (well... midi programs)

### the imperative route

Have labels and goto's to navigate the score A, but how can a jump be
conditional?

### crossing off ideas

- Parallellism is about having two way to acculutae events: given two
  collections, the can be put end to end, or combined from the same starting
  point. The interpreter for the second state just resets the realTime. `{...}`
  to collect, `,` for parallel combination. Spaces for sequencing.
- Tempo. combined with parallelism, this could be confusing: does the change in
  tempo carry over to other collections? A more declarative method groups a
  collection of events and sets the tempo for all of the. Measured in ms for a
  whole note... `\tempo 1500` e.g. ordinary numbers here.
- Pedals. Postpone (and maybe deduplicate) note off events. Once again, not as a
  background parameter, I imagine. `\pedal {...}`.
- More dynamic options. Like dynamic accent, crescendo & decrescendo. We have
  dynamic events now. A stateful interpretation may be confusing. `\dyn ff {}`,
  `\cresc p f {}` special values.
- Comments: that is nowhere. `%` to got to end, some blokc comment option.
- Repeats: simple literal repeats help, but aren't enough. Label parts of the
  score to repeat later, _so_ `\set bla {...}` is an expression, that links bla
  with the collection behind it. `\get bla` put the same notes in elsewhere.
  This is an exception to the anti-stateful rule. labels could be numbers, but
  why not general identifiers.
- Instruments: once again, the stateful interpretation can be confusing.
  `\program number`. Yes, numbers.

### status byte issues

Back in REGGAE? at 22?

## 2023-11-5

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
