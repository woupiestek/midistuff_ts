# Midistuff logs

## 2023-11-13

- generate music xml
- pretty printer
- review metadata (only at the end) & labels ()
- generate from nwctxt

### music xml

There is a required subdivision of data into parts with ids. Data is then
organised in two ways: either a collection of measures, where eich measure is
devided into parts, or a collection of parts where each part is subdivided into
measures.

Obviously, lacking any specification, everything is going into one part, and
subdivided in measures assuming 4/4 time.

### pretty printer

- none to long lines
- show the unity of collections.

With `{}` and `[]` in that context, hugging if the content is small enough,
otherwise newlines and indents? Often too much vericality to my taste. it is
more like: when a newline is necessary, because of reaching a column limit,
indent appropriately.

Aim for something like this, perhaps:

```
{"bpm" = 140} key 1 "allegro" "f" _/8 [
  $A = [
    4 1 5 6 1 5 4 [0+, 3] [0, 5] _/4 3 _5/8 3 5 1 6 7 2 6 5 
      [2-, 4] [1, 6] _/4 4 _5/8 4 4 1 5 6 1 5 4 2 4 _/4 2 
      _5/8 2, _ [-3, -1] -2 -6 -1 0 -6 -1 -2 [-3, -6] _ [-4, 0] 
      -3 -6 -2 -1 -6 -2 -3 [-4, -6] _ [-3, -1] -2 -7 -1 0 -7 -1 
      -2 [-7+, -3]
  ]
  [
    3 1 4 5 0+ 4 3 [0+, 2] _/2 [0, 1] _/2 [0, 3], -2 -6 -1 0
      -5 -1 -2 -5+ _/2 [-4, -2] _/2 [-6, -2+]
  ] 
  $A
  [
    3 1 4 5 1 4 3 1 _ [1, 4], -2 -6 -1 0 -5 -1 -2 -4 _
      [-3, -1]
  ]
]
```

Rules are:

- Up to 64 column of consecutive elements on one line. Keep it horizontal. (key
  values pairs switch to vertical much faster.)
- broken up is ok, but that increases the indent by two spaces
- collections that are small enough to fit stay on only line.
- Of course, options stick to their nodes. `_3/4 [\n...]` over `_3/4 \n[...]`

Note 3 renderings of sets:

1. horizontal for small sets `[1, 4]`
2. vertical-horizontal for large sets of horizontal elements.
3. horizontal-horizontal, for any set of vertical elements. O/C there is the
   tension between a set being small enough to fit the presumed 64 character
   limit, but too large to also fit the indent. In some of these cases, an
   inline rendering could be more fair.

Kiss: keep track of the indent level, but put newlines where you run out of
space.

```
{"bpm" = 140} key 1 "allegro" "f" _/8 [$A = [4 1 5 6 1 5 4 [0+,
      3] [0, 5] _/4 3 _5/8 3 5 1 6 7 2 6 5 [2-, 4] [1, 6] _/4 4 
    _5/8 4 4 1 5 6 1 5 4 2 4 _/4 2 _5/8 2, _ [-3, -1] -2 -6 -1 0
    -6 -1 -2 [-3, -6] _ [-4, 0] -3 -6 -2 -1 -6 -2 -3 [-4, -6] _ 
    [-3, -1] -2 -7 -1 0 -7 -1 -2 [-7+, -3]] [3 1 4 5 0+ 4 3 [0+,
      2] _/2 [0, 1] _/2 [0, 3], -2 -6 -1 0 -5 -1 -2 -5+ _/2 [-4,
      -2] _/2 [-6, -2+]] $A [3 1 4 5 1 4 3 1 _ [1, 4], -2 -6 -1 
    0 -5 -1 -2 -4 _ [-3, -1]]]
```

Not especially readable, I am afraid. I guess I could look at the algorithms in
use for this, but keep the non prittey printer for now.

Always newline indent, for each collection make thins too vertical. Rather than
following a will-it-fit rule, have a max size for individual elements e.g. 32 or
even 16 chars.

### Outside sources

Consider a pretty printer as something that operates maninly on white space. o/c
it still needs to parse the document, in order to ignore spaces in strings and
comments (which must be preserved this time), add spaces between tokens, and to
understand nestings depths...

Advantage: seen this way, we could just keep the line breaks already present in
the provided document: just don't make choices for the writer here. Just glue
together, adjust indents and break up long lines, for the benefit of the end
user.

- Doc = string | Doc[], where '[', ']','{', '}' are just

O/c want I want is to inspect the result of converting nwctxt files, and other
sources, not necessarily to format existing documents. These things should be
kept apart perhaps.

### more thoughts

So maybe I went overboard with adding meta data. If possible, bring it down to:
key-values pairs of two levels, uppoer layer for label definitions, lower layer
for configs. Document settings would be added to a tag and then the tag would
appear in front of the node.

Now we could go back to inline metadata: that is keyvalues pairs of one level,
vs the two level structure that can only appear at the end of the file.

And maybe let labels always be strings.

### complex formatting

Graph search: the idea is that all methods of adding whitespace are permitted,
but weighted by cost, this is the number of rule violations needed, weighted by
importance. Then do a breadth first search.

### to music xml

- sorting by part & measure...
- split notes over barlines and add ties (more generally, don't let odd
  durations cross over)
- notes as step, alteration and octave: alterations always needed!
- remaining issue: polyfony within a part

Set: have the interpreter, and a run setup that can test the interpreter against
a string

Split up by parts,

## 2023-11-12

- ~~arrays~~
- generate music xml
- generate from nwctxt

### arrays

Arrays of data may be useful for specifying e.g. multiple midi configs, like
different channels and programs.

## 2023-11-11

### todo list

- ~~add tuplet code~~
- ~~fix parallel tempo support in midi~~
- ~~unicode?~~
- ~~(pretty) printer~~
- ~~add attributes, file structure~~
- generate music xml
- generate from nwctxt

### tuplets

For the tuplets: treat it as modified duration? i.e. `_.4 / _1.8`. Why not use
fractions all the time then, though? `_/4` `_3/4` `_/256` `_ 1 / 4`. Three token
types: UNDERSCORE, SLASH, INTEGER, Rule: `UNDERSCORE INTEGER? (SLASH INTEGER)?`.
Default to 1 if either integer is missing, so `_ [...]` is a tone set of whole
note duration. Forbid `0` as a value on either side.

### midi tempo

Midi has its own interpretation of tempo, which may be unexpected. I.e. I could
write `[allegro [0 1 2], vivace [3 4 6]]` for some experiment in modernism. This
indicates two melodies played in parallel with different tempos. Use the tempo
midi meta message, however, and both will be play with only on of these tempos.

Maybe that is the problem: we should not use the midi meta messages for the
tempo.

1. All meta messages are optional
2. There are alternative timing options, and all that matters is ticks.

I.e. we could try a timecode, and tie each event to a frame.

Here the option of attaching attributes a file, a tone set or a 'class' becomes
useful again.

### midi timing

Midi has a global notion of tempo which determine the length of a tick... IDK
how much influence the time signature meta data has, but ordinarily, one tick
has a length of `tempo / PPQN`, where `tempo = 6e7 microseconds / BPM`. With a
metadata event the tempo number can be changing in the course of the file. The
issue now, is that parallel tracks with different tempo's are interpreted
incorrectly now: the tempo indication influence each other.

Possible solutions:

- use a header/footer with metadata to specify the midi tempo instead, tempo
  indications in the score are for other interpreters
- change the interpreter to ignore midi tempo, and compute independent values.

The former has more uses.

### lilypond/latex example:

I turned `\keyword {}` into `keyword []`, and that can continue. The identifiers
are labels now, freely added to the score for the benefit of the interpreter. I
should add strings for the same purpose. To indicate sections of the file that
contain different data...

```
\let [ velocity [ 100 ] ] _/2 [0, 2, 4]

\define [
  f [ velocity [ 85 ] ]
  p [ velocity [ 43 ] ]
]
```

Perhaps the score should have a marker A header is needed to indicate file type
and version

Attach attributes to a node, possible at any place, so why not on top?

The list is:

- adding key value pairs to any node
- adding key value pairs to a file
- adding key value pairs to a label

The first one is dubious: what are we really trying to do there?

o/c we don't need two syntaxes for key value pairs, but... I guess I still don't
know what I really need.

### keep it simple

- add utf8 strings and hashes
- allow an optional header add the start of a file
- don't pick a universal way to associate key value pairs to labels in the file.

Assume drastically simplified json, as in: key-value pairs, integers, labels and
strings, that is it.

## 2023-11-10

Directions to head into:

- generate notation
- generate midi files
- more midi controls

Idea: this is a data format to help compose music within certain traditional
limits, but it should allow much data to be attached to the scores, both for
producing notation and for midi.

The score is a series of numbers (with modifiers) indicating tones and a symbol
for a rest, which can be grouped and set to run in parallel. Some key attributes
that can be attached to both individual tones and to goruping of them are:

- duration: this is the floating point hexadecimal thing, which indicates how
  low a tone is supposed to last relative to the temp
- tempo: currently milliseconds for a whole note. BPM has a legacy, but requires
  explicitly mentioning the duration like so: `bpm _.4 135`. This is
  `60000/(duration * bpm)` ms per whole note.
- key: since the scale is diatonic, this is requires to understand the scale
  degrees
- dynamic: pretty relevant to music as well.

The midi interpreter I have now keeps track of time, programs and channels, and
uses a set of parameters to take care of the rest. `Program` feels like
something only relevant to midi interpreters, however.

Operationally, duration, key and dynamic set pattern that can be applied to
generic attributes: key values pairs. `{ channel: x program: x pedal }[]`
`{ pedal }[...]`

There is no truly objective way to seperate text from interpretation, of course.
So my system should as expressive as sheet music and midi files combined, while
being convenient for composing the kind of music I want.

Pedal is a good example: is it really up to the interpreter, or it it part of
the composition? Arguably, it is somewhere in the middle. Same for tempo.

I like only having one kind of collection, so no xml, and no s-expression, where
everything needs a tag.

Layers:

1. tones, rests
2. duration, key, dynamic
3. tempo
4. program

- define new keywords with parameters
- let those definition carry meta data

Hypothetically it could say: def f { velocity = 85 } Somewhere, so dynamics are
not given, though this invites questions about specifying imports...

Back to this: `let \piano { channel: 0, program: 1 }`

Attach tags to nodes, and add parameters to tags.

`\pedal = {} [... \pedal [...] ...]` That seems like a clean solution, doesn't
it?

This is verbose, then: `\music_box = { program: 10 } \music_box [...]`

- a fairly free system to attach attributes to a node. What values can an
  attribute take?
- a way to group those attributes together

Could be more like this:

- Attribute attachment `=program 10 []`
- This starts looking like a macro system: `\music_box [=program 10 ...]`
  `\music_box [...]`

The ontology has five parts now:

- sets of tones and rests, the core data of music.
- durations, dynamics, key and tempo: the core attributes.
- general attributes: key value pairs for the benefit of interpreters.
- tags: sets of attributes to apply to sets of tones.
- marks: tone sets can be marked to be repeated later.

Utimately, we could do something like: `\# = [transpose 1]`,
`\b = [transpose -1]` and so on.

### ongoing thoughts

The keys, tones and durations need to stay. Dynamic and tempo have me wondering:
to what extend are they part of the composition, and to what extend are they up
to the interpreter? Only the bpm number is exact, there rest is much less clear.
Then the program number: this is strictly for midi of course.

Some things that I don't support yet: pedal, crescendo, ralentando, accents on
notes... There are endless numbers of these some of which are less ambiguous
than others.

So what to do here?

I like the idea of tagging tone sets and then defining the interpretation of the
tags elsewhere. As long as they are numbers that don't change to often, that
should just work out, right?

Questions:

- Should the styles be in the same file? Look at style html...
- Is special syntax needed for the tags, or can we just use keywords?
- How about the key?

Actions:

- I can at least test the identifier and limited keyword approach for dynamics,
  and add the option to use that generally, but don't do anything about program
  and tempo.

## goal

Translate composition form NWC to this format, compose some more in this format,
export to musescore. The system cannot handle that yet.

### tempos

Relevant: 240000/bpm

- Grave – (32 bpm) - 7500ms
- Largo – (53 bpm) - 4528ms
- Adagio – (56 bpm) - 4286ms
- Lento – (80 bpm) - 3000ms
- Andante – (82 bpm) - 2927ms
- Moderato – (114 bpm) - 2105ms
- Allegro – (138 bpm) - 1739ms
- Vivace – (166 bpm) - 1447ms
- Presto – (184 bpm) - 1304ms

### drums

Can we accomodate? A slight different notation might be better, and looking
around what exists already is somthing I still need to do.

### status

I think I have it: the core syntax and semantics of my notation. The only thing
remaining is the way styles and scores can be combined. HTML uses ccs in 3 ways:

- inline, with the styles attributes
- in the header with css between style tags
- in a files linked from the header.

I could mimick this system:

- a `style`-like keyword or structure, that accepts key values pairs.
- a file format that consists of two parts, where one part has the
  selector/style combinations as in css
- an option to link the two.

Key values pairs: it will have to be the literal strings, with limitations, so
`{tempo:1700;program:10}` could work specifically for my interpreter. Then maybe
`piano = { channel: 0; program: 1; }`, to attach styles to classes. In this
case, though, not every class needs an associated style. Keep the tokenizer in
mind! only keys and values that are acceptable s tokens can be used in the
key-value pairs, and the interpreters have to work with these too...

Modal tokenizer can remember in what mode it was tokenzing, So it can generate
different tokens in diferrent part of the file. Fine, i think, if it remains a
finite state machine.

Why do I want that? Because this system controls the values that interpreters
get out of it. Now everything is numbers, but I imagine some data I want to
transfer is not.

Maybe is it enough to allow for a number of predefined tokens anyway, Like
identifiers and integers

`'{' (IDENTIFIER ':' (IDENTIFIER|INTEGER))* '}'`

I don't like the inline definition. inline attributes are better.

Start the file with a specific line. Then an optional header, or you know what:
put that after the end instead.

Add metadata there too.

### generating midi files

Yeah, let's put that together.

### tuplets

Could be an exception to the free interpretation rule: fit more notes into less
time.

Technically, this would work: `_.2 tuplet [_.4 [0 1 2]]` Compress the set into
the duration before the tuplet.

idea: `tuplet` INTEGER implies scaling by `n / (n + 1)`, all integers except
`-3, -2, -1, 0, 1` though.

Something like, 'shorthen node by this duration' could be good.

Technically, only odd denominators matter, so letting the numerator
automatically be the 'greatest power of two less than' works.

### todo list

- add tuplet code
- add attributes
- generate music xml
- generate from nwctxt

Attributes can be attached to both classes and sets, But the attachment to
classes needs to happen somewhere else.

Maybe there won't be an inline solution at all.

File structure:

- header: likely the file type and version followed by a description
- tone set: a tone set
- classes: stuff like midi settings and notation parameters
- properties: stuff that applies to all of the file, like title, author, etc.

Maybe come up with better names... e.g. 'modes' for classes.

## 2023-11-9

Further changes to the system:

- ~~simplify mark & repeat notation~~
- ~~improve interpretation: go for literal repeat~~
- ~~change how parameters are attached to sets.~~
- ~~different symbols~~
- ~~dynamic enum, translated by interpreter.~~
- ~~break up parsing and validating? downside: no info on error location~~
- ~~params as params~~
- ~~pitch sets: [0 2 4];.4~~
- ~~; -> d? r -> .?~~
- ~~remove operations~~
- ~~move durations~~
- ~~use `_` as duration symbol~~

### pitch sets

The pitch group fulfils some need, but again in a novel way. How far does this
go? It could work similar to all the parameters, actually! So, 0 is a complete
note, ;.4 modifies its value, but only as far as its goes, so in:
`;.4[;.2 0 1 2 0 ;.2r]` everthing is a quarter note, except for the note that
are explicitly marked a eigths.

Let's keep it a post fix operator for now.

### parsing & validation

Keep the combination to attach locations to errors

### program issue

No program does weird things, as well as program 0, which is technically out of
range

### remaining issues

- Should we not now put the durations in front?
- Will we stick with this notation for dynamics?

Options: `_.4` `!ppp` `|ppp`.

- At the moment, there is no ambiguity to forces dynamics to use the \dyn
  keyword. Of course, the following big step is translations back and forth
  between formats.

Might as well use special token for each of them, now.

How about this: durations are mostly fractional, and other numbers are not, So
we may replace the `;.` with a single indicator for fractional hexadecimals.

Accidental problem: `0- 3` and `0 -3` cannot be told apart now.

## 2023-11-8

### yet another notation

Diatonic distances from central c. So 0 -> c 1-> d, -1 -> d etc. Interpretation
requires a key, which is alos why numbers are favored over letters: 0 ban be a c
sharp or flat, depening on the key.

Let's look for a formula for midi number from pitch `p` and key `k`, which is
the number of sharps.

Midi note number from diatonic pitch `p` and key `k`: `(12 p + k + 425) % 7`,
where `%` is integer division. The pitch can range from about -35 (0) to 39
(127). On the keyboard of a typical piano: from -23 (21) to 28 (108). With these
ranges, why not just use numbers? Using hexadecimals introduces letters that can
confuse. Heptasimal numbers might make it easier to tell octaves apart.

Sharps and flats are replaced by relative changes: add or remove a semitone.

`-?[0-9]+[+-]{0,2}`

Make live harder for the tokenizer, after all: how to tell numbers and notes
apart? Idea: let the parser fix some of the ambiguity. i.e. there are numbers
and degrees. An accidental clarifies that some number is a degree. Don't forget
the key keyword: it is now necessary to interpret the degrees.

### dynamics

With crescendos, the target dynamic usually comes with a target note. My
application of it to a collections of notes doesn't have such a clear start and
endpoint.

### needs:

Token types: INT DEGREE node type: KEY The only floats needed are for durations
hexadecimals are use here.

Exception may be tempo, _but_ millisecond per whole note is pretty fine grained.
and why not use bpm integers? This is not midi!

### interpreter

Basic setup done. Immediate ideas on optimisations, Mainly: doing something
about setting parameters.

It could be more convenient to just have a 'settings region.' for: dyn, key,
program and tempo

Remaining: mark and repeat.

### idea

The operands are functions retruning collections and most of the operators
affect one of the parameters fed to the functions.

### result

This now works! `.\play.ps1 .\samples\jacob.txt`

### conflict resolution

This `\dyn p { 0;.4 1;.4 \dyn f 3;.4 4;.4 }` would be my argument for the inner
settings overriding the outer one. How else do you say: piano overall, but one
note forte? Perhaps the other way around is actually better, but I dont see it.

Dynamics and durations as post fix operators?

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

### next goals

Panic mode would be good as well, but what are the boundaries if everything is
an expression? `,` and `}` maybe?

### variable resolution

The marks etc. are now the interesting parts. Is the scope of a mark limited?

Maybe add something to the parser?

The keyword is repeat. Some perhaps doubling a part with another instrument is
an unusual way to 'repeat' a section, but this is an ok use.

We can do something more powerful:

- put marked sections in a list.
- replace mark & repeat nodes with nodes the refer to the list.
- refer back to the position in the list.

This changes the return type (a node with a list of subsections) And creates
resolution errors.

The sections are in place. They can of course refer to each other, but this only
goes backward: resolutions fails unless there was something to refer to, but
when section n was stored, only sections < n could be found.

Main is the last one in a sense, but has no mark, so it does not simply fit in.

### positional system

Something like: `-?[0-4][0-7][-+]{0,2}`

1. Idea: replace `abcdefg` with their distance above c as notated
2. Use key signatures to change the meaning of the numbers
3. Use + and -
4. Relative accidentals: there is no natural because + is always a semitone
   higher and - one lower.

Use key signatures: `\key -?[0-7]` Sharps or when negative flats, modifying the
meaning of the numbers.

Key idea means no direct translation to note numbers...

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
