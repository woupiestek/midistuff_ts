# Midistuff logs

## 2025-04-22

### ideas

Four things at the measure level:

- notes
- attributes
- directions
- barlines

None to challenging. The big issue now is combining staves into parts.

This could be an indication: |StaffProperties|WithNextStaff:Brace,ConnectBars
However, NWC allows staffs to be hidden and layered as well, So how do we then
determine combinations?

The strategy is two voices per staff, to support Noteworthy's system.

### explicit accidentals

Where they are needed, that is!

## 2025-04-21

### ideas

- further breakup into responsibilities
- note/measure numbers with attached attributes

### combining parts

NWC doesn't have parts, just staves. How to tell when a two staff piano part is
supposed to be a single part?

Proper ending barline is still missing BTW.

## 2025-04-20

### multistave parts

It looks like the way to do this, is to use a full measure `<backup>`,
`<staves>` attributes and `<staff>` properties on notes.

### attributes and directions

Maybe them more like notes? They don't have a duration, so they fit between
elements that have. Yet there can be any number (typically 0) in any order...

### ties

What is going on with ties into triplets? They don't seem to come out either.
ties not showing in the bass part as expected

### leftovers

dynamics, metronome, ...

### dynamics

!NoteWorthyComposerClip(2.751,Single) |Dynamic|Style:ppp|Pos:-8
|Dynamic|Style:pp|Pos:-8 |Dynamic|Style:p|Pos:-8 |Dynamic|Style:mp|Pos:-8
|Dynamic|Style:mp|Pos:-8 |Dynamic|Style:mf|Pos:-8 |Dynamic|Style:f|Pos:-8
|Dynamic|Style:ff|Pos:-8 |Dynamic|Style:fff|Pos:-8 !NoteWorthyComposerClip-End

!NoteWorthyComposerClip(2.751,Single) |Tempo|Tempo:115|Pos:12
!NoteWorthyComposerClip-End

!NoteWorthyComposerClip(2.751,Single) |Tempo|Base:Eighth Dotted|Tempo:153|Pos:12
!NoteWorthyComposerClip-End

!NoteWorthyComposerClip(2.751,Single) |Tempo|Tempo:114|Pos:12
|Tempo|Base:Half|Tempo:57|Pos:12 |Tempo|Base:Quarter Dotted|Tempo:76|Pos:12
!NoteWorthyComposerClip-End

## 2025-04-19

!NoteWorthyComposerClip(2.751,Single) |Bar |Bar|Style:Double
|Bar|Style:SectionOpen |Bar|Style:SectionClose |Bar|Style:MasterRepeatOpen
|Bar|Style:MasterRepeatClose |Bar|Style:LocalRepeatOpen
|Bar|Style:LocalRepeatClose|Repeat:2 |Bar|Style:BrokenSingle
|Bar|Style:BrokenDouble !NoteWorthyComposerClip-End

https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/bar-style/

## 2025-04-18

### time signatures

!NoteWorthyComposerClip(2.751,Single) |TimeSig|Signature:4/4
|TimeSig|Signature:2/2 |TimeSig|Signature:3/4 |TimeSig|Signature:2/4
|TimeSig|Signature:Common |TimeSig|Signature:AllaBreve |TimeSig|Signature:3/2
|TimeSig|Signature:3/8 |TimeSig|Signature:6/8 |TimeSig|Signature:9/8
|TimeSig|Signature:12/8 !NoteWorthyComposerClip-End

### bar line issues

This:

|Bar|Style:MasterRepeatClose |Bar|Style:MasterRepeatOpen

Must not produce an empty measure

- a bar line element must be emitted
- when paired, the measure must not be emited. this suggests that every bar
  listener must watch the style.

## 2025-04-15

### line numbers

Instead of counting particular lines, identify objects by their (adjusted) line
number in the nwc file!

### noteworthy cuts

!NoteWorthyComposerClip(2.751,Single) |Clef|Type:Treble|OctaveShift:Octave Up
!NoteWorthyComposerClip-End !NoteWorthyComposerClip(2.751,Single)
|Clef|Type:Treble|OctaveShift:Octave Down !NoteWorthyComposerClip-End

### strategy

Want notes grouped by measure, measures by staff

### new test case

And we see: chording the noteworthy way does not work!

- produce backup...

It works, but Musescore complains. Adding voices helps.

### staccato

note/notations/articulations/staccato

### slur

are only start & stop needed? this is different from NWC..., but still

### more dynamics

!NoteWorthyComposerClip(2.751,Single) |DynamicVariance|Style:Crescendo|Pos:0
|Rest|Dur:4th |DynamicVariance|Style:Decrescendo|Pos:0 |Rest|Dur:4th
|DynamicVariance|Style:Diminuendo|Pos:0 |Rest|Dur:4th
|DynamicVariance|Style:Rinforzando|Pos:0 |Rest|Dur:4th
|DynamicVariance|Style:Sforzando|Pos:0 |Rest|Dur:4th !NoteWorthyComposerClip-End

### third test case

1 endings 2 last pedal !NoteWorthyComposerClip(2.751,Single)
|Ending|Endings:1,2,3,4,5,6,7,D !NoteWorthyComposerClip-End

## 2025-04-13

### positions versus durations

!NoteWorthyComposerClip(2.751,Single)
|Note|Dur:4th,DblDotted,Tenuto,Slur,Accent|Pos:1^ |Note|Dur:4th|Pos:1
!NoteWorthyComposerClip-End

### grace, slur, beam

!NoteWorthyComposerClip(2.751,Single) |Note|Dur:8th,Grace,Slur|Pos:2
|Note|Dur:8th|Pos:1|Opts:Stem=Down,Beam=First
|Note|Dur:8th|Pos:2|Opts:Stem=Down,Beam |Note|Dur:8th|Pos:3|Opts:Stem=Down,Beam
|Note|Dur:8th|Pos:1|Opts:Stem=Down,Beam=End !NoteWorthyComposerClip-End

NWC seems to only support beams on the shortest durations if multiple are
defined.

### beams

!NoteWorthyComposerClip(2.751,Single)
|Note|Dur:8th,DblDotted|Pos:1|Opts:Stem=Down,Beam=First
|Note|Dur:32nd|Pos:1|Opts:Stem=Down,Beam=End !NoteWorthyComposerClip-End

### Design

Pretty much go linearly though the NWC file, but allow each component to react
it is own way.

So we can either think of producing results in response to the 'commands', or of
representing details in the input efficiently.

Start over?

## 2025-04-12

How to continue now? I've been wanting to combine data orientation with a break
up by optic: each property gets its own class that maintains a collection
(preferrably an array) of elements.

There are two models of sheet music to be handled here.

Idea: ways to organize notes... like a group of pitched by duration. rests,
notes and chords, but here is the issue: NWC allows chords to contain two groups
of notes of different pitch MusicXML doesn't impose this limit. NWC has rest
type element MusicXML treat rest as a special pitch.

List of notes, with durations added to groups of them. Some things belong to
pitches, like ties and dots.

### accidentals in noteworthy:

!NoteWorthyComposerClip(2.751,Single) |Note|Dur:4th|Pos:b0 |Note|Dur:4th|Pos:0
|Note|Dur:4th|Pos:0 |Note|Dur:4th|Pos:0 !NoteWorthyComposerClip-End

'b' is not a position, but an acccidental symbol, that applies to the remaining
notes.

### polyphonic chords:

!NoteWorthyComposerClip(2.751,Single)
|Chord|Dur:8th|Pos:-2,1|Opts:Stem=Up|Dur2:Half|Pos2:-5,-4
|Chord|Dur:8th|Pos:-2,2|Opts:Stem=Up |Chord|Dur:8th|Pos:-1,1|Opts:Stem=Up
|Chord|Dur:8th|Pos:-2,0|Opts:Stem=Up !NoteWorthyComposerClip-End

### tied example.

!NoteWorthyComposerClip(2.751,Single) |Chord|Dur:8th|Pos:-4,-2^
|Chord|Dur:8th|Pos:-5,-2 !NoteWorthyComposerClip-End

### so...

Core data structure to record lists of pitches and belong decorations, However,
record both the position on the bar and the actual pitch

Then group this by duration. Rests can be indicated by empty durations, While
chords by durations with extra notes. The polyphonic option needs some special
care here, cause otherwise the assumption is that each duration comes after the
other.

Durations are grouped by measures, and those by parts.

## 2025-04-10

### detat representation

This is how Noteworthy handles multiple voices:

!NoteWorthyComposerClip(2.751,Single)
|Chord|Dur:8th|Pos:1|Opts:Stem=Up|Dur2:Half|Pos2:-3
|Note|Dur:8th|Pos:0|Opts:Stem=Up |Note|Dur:8th|Pos:-1|Opts:Stem=Up
|Note|Dur:8th|Pos:0|Opts:Stem=Up !NoteWorthyComposerClip-End

Choice is limited to two durations, with the shorter one leading.

Musicxml allows more durations, but the durations must be shorter than the first
note: the longest during is leading.

## 2025-03-11

What about breaking up by lens: for each source path, select a target path and
converter, as a way to make converters modular.

## 2024-12-13

So many moving parts... what next?

## 2024-10-13

### data orientation

Consider the advantages of being able to add a property to all objects of a type
dynamically, like adding a column to a table... Maybe that is what databases
already tend to do.

During development it is the same as adding a method to a class, but possibly
cleaner.

This is beyond the scope of this project, but nearly each field on a class could
be an 'extension field', with its own logic for initialisation. It is
acknowledged that handles are just object ids, and that each field of an object
is stored in an array for all objects of a class.

## 2024-09-25

Let's make a todo list. These are the tags in the sample file:

- ~~Editor~~
- SongInfo
- ~~PgSetup~~
- ~~Font~~
- ~~PgMargins~~
- ~~AddStaff~~
- StaffProperties
- StaffInstrument
- ~~Clef~~
- ~~Key~~
- TimeSig
- Tempo
- Dynamic
- ~~Rest~~
- ~~Chord~~
- ~~Bar~~
- ~~Note~~
- SustainPedal

The target list is harder, musicxml is not nice! What if we went the other way
around somehow? Writers block.

## 2024-09-20

simplistic xml spec: element ()

## 2024-09-12

Rethinking this project as a way to get nwc into musescore or lilypond. In
combination with data oriented ideas. Maybe there are nicer ways to represent
musicxml data, like a list of nodes with a tag, an for each tag, data
containers. Yeah. A format intermediate between nwc and musicxml...

## 2024-09-09

See test coverage with deno:

- `deno test --coverage`
- `deno coverage --html`

## 2024-09-08

### data orientation

Maybe finish this project with some new ideas on how to organize data.

## 2023-12-27

- generate from nwctxt
  - accents
  - special bar lines
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### alternatives

Focus on musicxml, and even bypass the new notation for a while.

## 2023-12-21

- ~~event vs classes~~
- generate from nwctxt
  - accents
  - special bar lines
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### event vs classes

Using the strings to denote events that happen between notes or rests fits other
music notation and midi better than the lables I have now, so, time for a major
refactor.

## 2023-12-20

- generate from nwctxt
  - accents
  - special bar lines
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### silence

The factory reset removed dll linking, which was reinstalled with the help of a
reinstallation of rust!

### actually running blue

Missing some stuff, mainly pedals and repeats.

I guess up to now I assumed that labels distibute: `'happy' [ x, y, z]` is
equivalent to `[ 'happy' x, 'happy' y, 'happy' z]` But this does not work for:

- delayed dynamics, which where a way of delaing both with notations as with an
  effect seen in mozart, where the choir was to switch from 'f' to 'p' halfway
  down a whole note.
- dynamic dynamics (crescendo, decresendo)
- pedals, interpreted as and effect like those dynamics.

Pedals have on and off like midi notes, but they don't have tones or velocities,
and they modify sound, rather than making it on their own. Which is why I'd
rather keep them as modifications of sets of tones.

So there is a distinction here. It is the difference between transformations
that affect each note the same way, and transformations that affect notes as a
group, but that don't come down to doing the same thing to each individual note.

I could add somthing like function systax, but the semantics make me hesitate:
should labels commute with functions? Perhaps everything inside the function is
not affected.

Options:

- have functions
- have parallel tracks for pedals and perhaps for dynamics
- have events between the tones

The last one is probably the easiest, and fits with traditional notation.
Perhaps it makes labels mostly pointless, but at least it does raise difficult
questions.

## 2023-12-11

- generate from nwctxt
  - accents
  - special bar lines
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### some ideas about the translation

A perfect rendering is not necessary, though the more comes over automatically
the easier it gets.

### no midi sound

The script is not working anymore. Probabaly lost some dev tools in the factory
reset.

## 2023-12-11

- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### key and dynamic

Here is the deal: a key sugnature or dynamic may be placed under a tie, which
essentially means the change applies to untied notes from that point on. It
could be different for dynamics. In the system of this project notes are grouped
together and then a dynamic is applied to the whole group. Same for the key.

Ideas:

- Don't solve this edge case, just move the key or dynamic to the start or end
  of the tied note group. Give an error message, or even ignore the
  unfortunately placed marking.
- Come of with a way to group individual voices to best match the intetiona of
  the marking.
- Change the model to allow things like this: periods that affect the
  interpretation of notes, but that don't sync up with their starts and ends.
- Delayed dynamics: there is an indication that a change in dynamics should come
  after a delay. This won't be the way we deal with keys, which will simply move
  to the nearest convenient place. For the dynamic though, the indication could
  be like "f_in_7/4", and the processor could leave a legenda to explain what
  indicators like these mean.

Why delayed dynamics: it feels like combining parallel data, but it is a
transformation of the meansing of the notes in the group.

There is some trouble here: basically, a dynamic remains valid until it is
revoked. What happens before the delay of a delayed dynamic, however? The
implication of notation is nested dynamic, each one embedded in the former. This
is not what I want to come out. The delayed dynamics should be limited to
dynamics under ties, as a special effect.

Okay, sort the problem I foresee is this: a change from p to f happens halfway
through a possibly tied note. If we just register what the dynamic changes to,
then the whole group needs to be part of the previous dynamic grouping for p. So
either notes get be tied between groups, or three groups are created: the p
phrases, the f phrases and the dynamic change phrase.

### deriving keys

Every pyth has a diatonic measure. This can be averaged over a group of notes to
get the avaerge numder of shaprs or flats for that group. Commonly used
alteration like lead tones in minor scales could skew this assessment. Also,
this workd from grouping to key signatures. Finding proper groupings could be
challenging.

### alternatives

XSD.exe can create JS classes from the musicxml xsd. Maybe a better way to go.

## 2023-12-8

- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### groupings

Group stuff together, to attach propertties to notes. what to do with tied notes
then, though?

- Clef: important for notation, does not remain in notes
- Dynamics: can only affect notes later on.
- Key: this is needed, and has the same logic as dynamics.
- Sustain on and off: seperate events, could just get their own score. so...
- Tempo: this affects everthing, it does not belong anywhere
- Time signature: important for notation, not recording in thet notes.

So Clef and Time Signature are merely for notation, and key is somewhat like
that. Dynamic and Key have a delayd logic: they apply to lots of. Sustain is
like its parallel sequence of notes. Tempo: belongs in its own lane.

## 2023-12-4

- ~~reconsider number of quotes on labels (' vs ")~~
- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

## 2023-12-4

- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### pythagorean coordinates

Count in whole and half tones. Note: a whole tone then in not two half tones,
they are independent units. Reason to encode tones like that. Firstly, correctly
and uniquely identify all notes and intervals. Secondly, simplify computation,
by allowing straightforward addition of intervals. Important! The distance
between c and c sharp must be considered as whole minus half.

c: 25W + 10H, c#: 26W + 9H, d: 26W + 10H, eb: 26W + 11H, e: 27W + 10H, f: 27W +
11H, f#: 28W + 10H, g: 28W + 11H, g#: 29W + 10H, a: 28W + 11H, bb: 28W + 12H, b:
29W + 11H,

### diatonic scoring

Could the multiplicity of the third overtone: W is 2 and H is -5. Result: c:0,
d:2, e:4, f:-1, g:1, a:3, b:5, pretty much the places in the circle of fifths.
Note however, that this gives a way to compute key signatures. For c, the
numbers for all the notes together add up to 14. Each sharp adds 7, each flat
subtracks 7. So divide by 7 and subtract 2. This also gives results for
noteworthy's 'custom' signatures.

Actually, this is the same as adding sharps and subtracting flats!

## 2023-11-29

- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### grouping

Dynamics and key signatures offer the challenge that they apply to groups of
notes, but only their start is marked.

Dynamics could be added to every note, but that makes less sense for the keys.
Worse still, everything could intersect...

The keys are tricky because notes can even tie over key signatures. What
grouping of notes to use in such cases?

Sort of hindsight best fit idea. To some extend needed since noteworthy allows
so much in key signatures.

Tied notes create possibilities in notation, that may not be too meaningful, and
rightfully left out of my system. This does raise questions on how to translate.

## 2023-11-26

- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### untieing

Work back to front, from the chord that does not have ties forward. No spliting
up of voices is needed if some notes end early. The starting late are the issue.

Breaking up into voices ok, how many levels do we want? Puting every tone in its
won voice always works, so it is interesting to reduce the number of voices at
much as possible. This means that voices must break up and combine all the time.
This seems to imply nesting to arbitrary depth.

There is another approach, which is to compute time and duration from start,
then fit the results togetehr again.

1. ordinarily all notes with the same start times can be joined togtehr in a
   chord.
2. The late start is the problem, so a split is needed between and here is a
   choice: the notes that end in time can fit before the late starters, or a
   rest can be put in their place. Which makes more sense?

The main thing is, it all ends at a chord without ties, so that is the point
when the number of voices goes down.

After break up into any number of voices, multiple of them can end at the same
time, creating an opportunity to join them together.

Very basic: first group notes together with the same start Then break these
groups based on which end before the next group of notes.

### alternatives

Assume the number of voices throughout is the max number of element per chord.
Of course, no need to groep untied chords together, so the number of voices
stays limited. I.e. at that point open voices can be closed.

## 2023-11-25

- ~~duration limitation~~
- ~~partial playback somehow~~
- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### problem

Underscore and slash now functions as operators, allowing white space inside
durations. It also means `_` on its own is a valid duration before anything but
a note. This was practical: a token can now contain an optional value of type
number, but I wanted durations to be `Ratio` instead. To turn durations into
tokens, more types of value will have to be supported.

For now, I will have the printer print `_1` instead of `_`.

## 2023-11-22

- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### nwctxt

There is a specific problem with turning chords with tied notes into polyfony
and back. Though I have a solution of sorts for the 'back' direction, that one
computes the position of notes in time, and then works from that. The way back
might be harder.

It seems like my version of the scores have more structure: groups of notes can
be nested without limit. Those nests would have to be deduced from the notation,
even when there is on objectively right way.

Soppose there is a sequence of chords each is tied to the next in at least one
note, but each also has a note that starts there, or that ends there. The
regrouping turns that into parallel voices with unbroken notes. The question is:
how?

Ideas:

- some kind of voice leading algorithm. Find melodies in the weave, by just
  picking notes left as available.
- minimize voices: begin by splitting in two sets of chords, in a way that lets
  tied notes be merged together. Extra splits feel better, though.
- perhaps a divide an conquer system, based on missing ties? I mean, break up
  the sequence of chord in halves, take the notes that prevent the merger out?
- assign values based on what note could belong to the same voice.
- just calculate start times and durations. Does that make anything easier?

What if the number of notes per chord varies? Is polyphony better than voices
with nested chords? I should first make an algorithm that can do it, and then
make it nice.

The first chord lead to a split: the tied notes versus the untied ones. The
second chord can subdivide the previously tied notes in two groups again: the
once that stop and the ones that go on, and splits its own notes in those two
groups as well. By the third one, the notes come in six groups. `2n` as number
of groups for `n` chords. Basically, any combination of starting an stopping
chord is a group here, though.

## 2023-11-22

- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### continue analysis

Every seem te represent one object, with a class name and a few attributes.

## 2023-11-20

- ~~pretty printer~~
- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### pretty printing

Two improvements were:

1. using duration to group notes in sequences together, leading to lines that
   are broken up sensibly.
2. introducing a special line document for delimiters, which is replaced by an
   empy string.

It took little time to get nice results.

### nwctxt

Copy and paste generates the same format:

!NoteWorthyComposerClip(2.751,Single) |Clef|Type:Treble
|Key|Signature:Bb|Tonic:F |TimeSig|Signature:3/4 |Dynamic|Style:mp|Pos:8
|Tempo|Tempo:115|Pos:12 |Rest|Dur:4th
|Note|Dur:8th,Slur|Pos:-5|Opts:Stem=Up,Beam=First
|Note|Dur:8th,Slur|Pos:-4|Opts:Stem=Up,Beam=End
|Note|Dur:8th,Slur|Pos:-3|Opts:Stem=Up,Beam=First
|Note|Dur:8th,Slur|Pos:-1|Opts:Stem=Up,Beam=End !NoteWorthyComposerClip-End

The goals is to writing a parser for an unknown language. Though it should not
be too hard, since this language was for machine manipulation...

Do we really get different types of token out of this file? The main issue is
that each symbol may have implications for what to do with the following ones,
And I don't know any of the rules.

!NoteWorthyComposerClip(2.751,Single) |Note|Dur:4th|Pos:0
!NoteWorthyComposerClip-End

I could just look at existing converters

The list of symbols is :
`!"(),-./0123456789:<=>ABCDEFGHIJKLMNOPRSTUVWYZ^abcdefghiklmnoprstuvwxyz|©`

- numbers and letters are obvious
- `!` first & last line, delmit the file
- `"` string encoding, straightforward
- `()` first line only--no structural use
- `,` for lists throughout the file
- `-` negative numbers
- `.` 5 uses: version and page margins
- `/` 2 uses: time signatures
- `:` key value association, it seems
- `<>` only used inside strings
- `=` key value associeitons withing lists
- `^` a tie! discovered by adding it to a clipping and pasting it back in
- `|` seem like a sigil for keywords
- `©` used once in a string.

Note that sometimes newlines are used, other times that are not.

## 2023-11-19

- pretty printer
- generate from nwctxt
- generate music xml / lilypond
- review metadata (are limited ranges of values okay?)

### the metadata question

The current transforms class adds a set of attributes to each note, based on a
dictionary of data related to labels that can be mixed into the scores.

### pretty printing

So this just works too. What I want is an optional line break in the sequences,
but I don't know how that would work yet.

Nodes in sequences can be grouped, and the rest then just works. I now have an
ad hoc rule that gives ok results, but ideally line breaks are added where the
bar lines go. This can be done by keeping track of time while generating the
document, like the other interpreters. Syncopes are added to the bar they
preceed.

## 2023-11-18

- generate music xml / lilypond
- pretty printer
- generate from nwctxt
- review metadata (are limited ranges of values okay?)

### chording

Making progress with the chording algorithm. It should give good results for
normal use cases, And reasonable workarounds otherwise.

The current version keep track of the start and end of each chord, but this
should not be needed. Keeping the durations or the start times should be enough.
Start times are better though, for computing durations.

### lilypond quirk

Watch out: `c~8` is interpreted as a two notes `<c~>8` as one!

### success

After this much puzzling the lilyponder is done. I can now produce notation form
the script. It was a lot more work than generating midi.

### looking forward

MusicXML has more applications, and many of the problems in generating that have
now been solved. We could try that again.

Using altenative bracketing for parallelism is interesting. It takes two symbols
instead of one, but the added visibility doesn't hurt.

I have the symbols. It is just matter of how to make the split between body and
metadata. Just add a metadata keyword?

Some things about midi and notation did really fit into the scores. Things that
affect all voices at the same time, or details about scores. Let's not give up
too easily.

## 2023-11-17

- generate music xml / lilypond
- pretty printer
- generate from nwctxt
- review metadata (are limited ranges of values okay?)

### what am I aiming for?

Am I close but jst too tired to see it?

1. group by voice
2. group and sort by time
3. create a sequence of chords out of each voice, suing _some_ strategy for
   mismatches.
4. break up the duration of each chord into conventional durations.

Mismatches: ideally simultaneous notes match up perfectrly in time, but what if
they dont? A rest between one note and the next is fine, so the main concenr is
overlap.

Perhaps the best strategy is to break up all the notes, and add ties. It seems
that tie through case cannot normally be ommitted in lilypond, so let's not.

Okay, are we ready then?

The new new created by splitting up may not be in the right order. so they may
have to be reconsidered on a second pass through.

## 2023-11-16

- generate music xml / lilypond
- pretty printer
- generate from nwctxt
- review metadata (are limited ranges of values okay?)

### rules for durations

So complicated...

Simple test for ditted durations: `i&(i+1)===0`

## 2023-11-15

- generate music xml / lilypond
- pretty printer
- generate from nwctxt
- review metadata (are limited ranges of values okay?)

### polyfony & duration

Basic deal: somehow bring things down to parallel voices, with sequences of
potential chords of pitches. But these are render options.

Chords of notes of different durations have to be broken up somehow.

### cascading properties

Think of the accidentals: they all control and override the same property:
volume. The properties attached to the inner lables override the properties of
the outer labels, but the labels don't have to each other completely.

The fact that there is a preferred interpretation means that there might be a
preferred interpreter.

### more complicated duration fractions

One might hope for a dterministic algorithm for splitting up notes. Also
consider the possibility that some

### basic duration algorithm

Just the correct break up of notes now. Missing:

- tuplets
- polymorphism
- breaking at the beat

### universal interpretation

Gravitating toward this: generate a universal interpretation, and let other
system work off that. That way shared code between interpreters becomes less.

### more practical systems?

For repeats, e.g. `|:`, `|n`, `:|` perhaps `:|n` to indicate playing `n` times
somehow.

## 2023-11-14

- generate music xml / lilypond
- pretty printer
- generate from nwctxt
- review metadata (are limited ranges of values okay?)

### duration algorithm

Plenty fraction can occur as durations now.

- Not binary fraction get special treatment: Enter a mode to output tuples,
  keeping track of the modification of the length. internal an adjusted duration
  is used (typically rounding down to the highest binary fraction)
- Note at the start of a measure can ignore beats, others cannot. There are two
  kind of cut--in other words: a dux at the bar line and a comes at the beat.
- Proper notes and dots are otherwise preferred over ties.

I hope this is easier than formatting text... Tuple & tie system.

### lilypond

This might be an easier target than musicxml, so maybe try this first?

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

Split up by parts (not meaningful yet), then by time. Measures, notes, ties.

### tactic

Forget about the verbose musicxml solution, and forcus on the needed structure:

Break up in measures, then break up notes.

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

This could be split up: the normal pattern becomes (rest/note duration)\*,
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
