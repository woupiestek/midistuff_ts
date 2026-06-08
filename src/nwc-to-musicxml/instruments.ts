export interface GMInstruments {
  gm: number[];
  name: string[];
  instrumentSound: string[];
}

export const GM_INSTRUMENTS: GMInstruments = {
  gm: Array.from({ length: 128 }, (_, i) => i + 1),
  name: [
    // 1-8: Pianos
    "Acoustic Grand Piano",
    "Bright Acoustic Piano",
    "Electric Grand Piano",
    "Honky-tonk Piano",
    "Electric Piano 1",
    "Electric Piano 2",
    "Harpsichord",
    "Clavinet",

    // 9-16: Chromatic Percussion
    "Celesta",
    "Glockenspiel",
    "Music Box",
    "Vibraphone",
    "Marimba",
    "Xylophone",
    "Tubular Bells",
    "Dulcimer",

    // 17-24: Organs
    "Drawbar Organ",
    "Percussive Organ",
    "Rock Organ",
    "Church Organ",
    "Reed Organ",
    "Accordion",
    "Harmonica",
    "Tango Accordion",

    // 25-32: Guitars
    "Acoustic Guitar (nylon)",
    "Acoustic Guitar (steel)",
    "Electric Guitar (jazz)",
    "Electric Guitar (clean)",
    "Electric Guitar (muted)",
    "Overdriven Guitar",
    "Distortion Guitar",
    "Guitar Harmonics",

    // 33-40: Basses
    "Acoustic Bass",
    "Electric Bass (finger)",
    "Electric Bass (pick)",
    "Fretless Bass",
    "Slap Bass 1",
    "Slap Bass 2",
    "Synth Bass 1",
    "Synth Bass 2",

    // 41-48: Strings
    "Violin",
    "Viola",
    "Cello",
    "Contrabass",
    "Tremolo Strings",
    "Pizzicato Strings",
    "Orchestral Harp",
    "Timpani",

    // 49-56: Ensemble
    "String Ensemble 1",
    "String Ensemble 2",
    "Synth Strings 1",
    "Synth Strings 2",
    "Choir Aahs",
    "Voice Oohs",
    "Synth Voice",
    "Orchestra Hit",

    // 57-64: Brass
    "Trumpet",
    "Trombone",
    "Tuba",
    "Muted Trumpet",
    "French Horn",
    "Brass Section",
    "Synth Brass 1",
    "Synth Brass 2",

    // 65-72: Reeds
    "Soprano Sax",
    "Alto Sax",
    "Tenor Sax",
    "Baritone Sax",
    "Oboe",
    "English Horn",
    "Bassoon",
    "Clarinet",

    // 73-80: Pipes
    "Piccolo",
    "Flute",
    "Recorder",
    "Pan Flute",
    "Blown Bottle",
    "Shakuhachi",
    "Whistle",
    "Ocarina",

    // 81-88: Synth Leads
    ...Array.from({ length: 8 }, (_, i) => `Lead ${i + 1}`),

    // 89-96: Synth Pads
    ...Array.from({ length: 8 }, (_, i) => `Pad ${i + 1}`),

    // 97-104: Synth Effects
    ...Array.from({ length: 8 }, (_, i) => `FX ${i + 1}`),

    // 105-112: Ethnic
    "Sitar",
    "Banjo",
    "Shamisen",
    "Koto",
    "Kalimba",
    "Bagpipe",
    "Fiddle",
    "Shanai",

    // 113-120: Percussive
    "Tinkle Bell",
    "Agogo",
    "Steel Drums",
    "Woodblock",
    "Taiko Drum",
    "Melodic Tom",
    "Synth Drum",
    "Reverse Cymbal",

    // 121-128: Sound Effects
    "guitar-fret-noise",
    "breath-noise",
    "seashore",
    "bird",
    "telephone",
    "helicopter",
    "applause",
    "gunshot",
  ],
  instrumentSound: [
    // 1-8: Pianos
    "keyboard.piano.grand",
    "keyboard.piano.grand",
    "keyboard.piano.electric",
    "keyboard.piano.honky-tonk",
    "keyboard.piano.electric",
    "keyboard.piano.electric",
    "keyboard.harpsichord",
    "keyboard.clavinet",

    // 9-16: Chromatic Percussion
    "keyboard.celesta",
    "pitched-percussion.glockenspiel",
    "pitched-percussion.music-box",
    "pitched-percussion.vibraphone",
    "pitched-percussion.marimba",
    "pitched-percussion.xylophone",
    "pitched-percussion.tubular-bells",
    "strings.dulcimer",

    // 17-24: Organs
    "keyboard.organ.hammond",
    "keyboard.organ",
    "keyboard.organ",
    "keyboard.organ.pipe",
    "keyboard.organ.reed",
    "free-reed.accordion",
    "free-reed.harmonica",
    "free-reed.accordion",

    // 25-32: Guitars
    "strings.guitar.acoustic",
    "strings.guitar.acoustic",
    "strings.guitar.electric",
    "strings.guitar.electric",
    "strings.guitar.electric",
    "strings.guitar.electric",
    "strings.guitar.electric",
    "strings.guitar.electric",

    // 33-40: Basses
    "strings.bass.acoustic",
    "strings.bass.electric",
    "strings.bass.electric",
    "strings.bass.electric",
    "strings.bass.electric",
    "strings.bass.electric",
    "synth.bass",
    "synth.bass",

    // 41-48: Strings
    "strings.violin",
    "strings.viola",
    "strings.cello",
    "strings.bass",
    "strings.ensemble",
    "strings.ensemble",
    "strings.harp",
    "pitched-percussion.timpani",

    // 49-56: Ensemble
    "strings.ensemble",
    "strings.ensemble",
    "strings.ensemble",
    "strings.ensemble",
    "voice.choir",
    "voice.choir",
    "synth.voice",
    "effects.orchestra-hit",

    // 57-64: Brass
    "wind.brass.trumpet",
    "wind.brass.trombone",
    "wind.brass.tuba",
    "wind.brass.trumpet",
    "wind.brass.french-horn",
    "wind.brass.section",
    "synth.brass",
    "synth.brass",

    // 65-72: Reeds
    "wind.reed.saxophone.soprano",
    "wind.reed.saxophone.alto",
    "wind.reed.saxophone.tenor",
    "wind.reed.saxophone.baritone",
    "wind.reed.oboe",
    "wind.reed.english-horn",
    "wind.reed.bassoon",
    "wind.reed.clarinet",

    // 73-80: Pipes
    "wind.flutes.piccolo",
    "wind.flutes.flute",
    "wind.flutes.recorder",
    "wind.flutes.pan-flute",
    "wind.flutes",
    "wind.flutes.shakuhachi",
    "wind.whistle",
    "wind.flutes.ocarina",

    // 81-88: Synth Leads
    ...Array.from({ length: 8 }, () => "synth.lead"),

    // 89-96: Synth Pads
    ...Array.from({ length: 8 }, () => "synth.pad"),

    // 97-104: Synth Effects
    ...Array.from({ length: 8 }, () => "synth.effects"),

    // 105-112: Ethnic
    "strings.sitar",
    "strings.banjo",
    "strings.shamisen",
    "strings.koto",
    "pitched-percussion.kalimba",
    "wind.reed.bagpipe",
    "strings.violin",
    "wind.reed.shenai",

    // 113-120: Percussive
    "pitched-percussion.bell",
    "unpitched-percussion.agogo",
    "pitched-percussion.steel-drums",
    "unpitched-percussion.woodblock",
    "unpitched-percussion.taiko",
    "unpitched-percussion.tom",
    "synth.drum",
    "effects.reverse-cymbal",

    // 121-128: Sound Effects
    ...[
      "guitar-fret-noise",
      "breath-noise",
      "seashore",
      "bird",
      "telephone",
      "helicopter",
      "applause",
      "gunshot",
    ].map((name) => `effects.${name}`),
  ],
};
