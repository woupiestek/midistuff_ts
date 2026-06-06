import { Elements } from "./musicxml.ts";
import { countLessThan, NWCLines } from "./scanner.ts";
import { create, Element } from "./xml.ts";

const ALTSTR = "vbn#x";

const N7 = "nnnnnnn";

const CLEF_TONE = new Map([
  ["Bass", 22],
  ["Treble", 34],
  ["Alto", 28],
  ["Tenor", 26],
]);

export class Positions {
  #alters: string[] = [];
  #tones: number[] = [];
  #firstNoteByDuration: number[] = [];
  #startTie = new Set<number>();
  #stopTie = new Set<number>();
  #accidentals = new Map<number, Element>();

  visit(
    { values, lineNumbersByTag }: NWCLines,
    visited: Set<number>,
  ): void {
    const lines = [
      lineNumbersByTag.Chord,
      lineNumbersByTag.Note,
      lineNumbersByTag.Rest,
      lineNumbersByTag.RestChord,
    ].filter((it) => it).flat().sort((a, b) => a - b);

    for (const line of lines) {
      visited.add(line);
      if (values[line].Dur2) {
        this.#firstNoteByDuration.push(values[line].Pos2?.length ?? 0);
      }
      if (values[line].Dur) {
        this.#firstNoteByDuration.push(values[line].Pos?.length ?? 0);
      }
    }
    for (let i = 1; i < this.#firstNoteByDuration.length; i++) {
      this.#firstNoteByDuration[i] += this.#firstNoteByDuration[i - 1];
    }

    // this still seems crazy complicated.
    // let's document
    // take lines with notes or rests on them and translate to chords.
    const chords = lines.map((line) =>
      [values[line].Pos2, values[line].Pos].filter((it) => it).flat()
    );
    // all data will be flattened into a single array, which is why we need these offsets here now.
    const offsets = [0];
    for (let i = 1; i <= chords.length; i++) {
      offsets[i] = offsets[i - 1] + chords[i - 1].length;
    }

    // tone for the central line of the staff
    const baseTones: { [_: number]: number } = {};
    // then evey bar it resets to the last key signature.
    const Bar = lineNumbersByTag.Bar ?? [];
    // the signature by the index of the first bar where it is valid
    const signatureByBar: { [_: number]: string } = {};
    const signatureByLine: { [_: number]: string } = {};
    // reset at the start of each staff
    if (lineNumbersByTag.AddStaff) {
      lineNumbersByTag.AddStaff.forEach((line) => {
        visited.add(line);
        const index = countLessThan(line, lines);
        baseTones[index] = 34;
        signatureByLine[index] =
          signatureByBar[countLessThan(line, Bar)] =
            N7;
      });
    }
    // set to key signatures where they appear
    // issue: Key is optional... so what do the Bars below do?
    if (lineNumbersByTag.Key) {
      lineNumbersByTag.Key.forEach((line) => {
        visited.add(line);
        const signature = [...N7];
        for (const x of values[line].Signature) {
          const index = "CDEFGAB".indexOf(x[0]);
          signature[index] = x[1];
        }
        signatureByLine[countLessThan(line, lines)] =
          signatureByBar[countLessThan(line, Bar)] =
            signature.join("");
      });
    }

    // reset to key signature every bar, don't override!
    {
      let signature = N7;
      Bar.forEach((line, index) => {
        visited.add(line);
        if (signatureByBar[index]) signature = signatureByBar[index];
        signatureByLine[countLessThan(line, lines)] ??= signature;
      });
    }

    // adjust center tones to clef
    if (lineNumbersByTag.Clef) {
      lineNumbersByTag.Clef.forEach((line) => {
        visited.add(line);
        let tone = CLEF_TONE.get(values[line].Type[0]) ?? 34;
        if (values[line].OctaveShift?.[0] === "Octave Up") {
          tone += 7;
        }
        if (values[line].OctaveShift?.[0] === "Octave Down") {
          tone -= 7;
        }
        baseTones[countLessThan(line, lines)] = tone;
      });
    }

    const accidentalElements = Object.fromEntries(
      ["flat-flat", "flat", "natural", "sharp", "double-sharp"].map((
        type,
        i,
      ) => [ALTSTR[i], create("accidental", undefined, type)]),
    );

    const addStaff = new Set(
      (lineNumbersByTag.AddStaff ?? []).map((line) =>
        countLessThan(line, lines)
      ),
    );

    // fall back to imperative solution
    // I just wanna make it work.
    const open: (number)[] = Array.from({ length: 68 }, () => -1);
    let signature = [...N7];
    let baseTone = 34;
    chords.forEach((chord, i) => {
      if (addStaff.has(i)) {
        signature = [...N7];
        baseTone = 34;
      }
      // adjust these if AddStaff, Clef or Key,
      if (signatureByLine[i]) signature = [...signatureByLine[i]];
      if (baseTones[i]) baseTone = baseTones[i];
      chord.forEach((pos, j) => {
        // parse the NWC position
        const altered = ALTSTR.includes(pos[0]);
        const tie = pos[pos.length - 1] === "^";
        const tone = baseTone + +pos.substring(+altered, pos.length - +tie);
        // put the result in their proper place
        const index = offsets[i] + j;
        this.#tones[index] = tone;
        // more stop ties needed!

        if (altered) {
          this.#accidentals.set(
            index,
            accidentalElements[
              signature[tone % 7] =
                this.#alters[index] =
                  pos[0]
            ],
          );
        }

        if (open[tone] >= 0) {
          console.assert(
            !altered || pos[0] === this.#alters[open[tone]],
            `invalid alteration of tied note on line ${lines[i] + 2}`,
          );
          this.#stopTie.add(index);
          this.#alters[index] = this.#alters[open[tone]];
        }
        if (altered) {
          this.#accidentals.set(
            index,
            accidentalElements[
              signature[tone % 7] =
                this.#alters[index] =
                  pos[0]
            ],
          );
        } else {
          this.#alters[index] = signature[tone % 7];
        }
        if (tie) {
          this.#startTie.add(index);
          open[tone] = index;
        } else {
          open[tone] = -1;
        }
      });
    });
  }

  build(): Elements["positions"] {
    return {
      accidentals: this.#accidentals,
      groups: this.#firstNoteByDuration,
      pitches: this.#pitches(),
      ...this.#ties(),
    };
  }

  #pitches(): Element[] {
    // this method is only called once
    // so it actually saves memory to allocate these structures on the stack
    // I know that doesn't happen, because typescript does not work that way
    // But it could work that way in rust, or zig or c++ for example

    const steps = [..."CDEFGAB"].map((step) => create("step", undefined, step));

    // technically _ is n, the neutral alteration, but that result in no (null) xml elements
    const alters = new Map([..."vb_#x"].map((
      alter,
      i,
    ) => [alter, create("alter", undefined, (i - 2).toString())]));

    const octaves = Array(10).keys().map((octave) =>
      create("octave", undefined, octave.toString())
    ).toArray();

    const xmls: { [_: string]: Element }[] = [];
    return this.#tones.map((tone, i) => {
      const alter = this.#alters[i];
      xmls[tone] ??= {};
      return xmls[tone][i] ??= create(
        "pitch",
        undefined,
        steps[tone % 7],
        alters.get(alter) ?? null,
        octaves[(tone / 7) | 0],
      );
    });
  }

  #ties(): {
    stopTieds: Map<number, Element>;
    startTieds: Map<number, Element>;
  } {
    const startTieds: Map<number, Element> = new Map();
    const stopTieds: Map<number, Element> = new Map();
    const startXmls: { [_: string]: Element } = {};
    const stopXmls: { [_: string]: Element } = {};
    for (const note of this.#startTie) {
      const number = (this.#tones[note] % 16 + 1).toString();
      startTieds.set(
        note,
        startXmls[number] ??= create("tied", {
          type: "start",
          number,
        }),
      );
    }
    for (const note of this.#stopTie) {
      const number = (this.#tones[note] % 16 + 1).toString();
      stopTieds.set(
        note,
        stopXmls[number] ??= create("tied", {
          type: "stop",
          number,
        }),
      );
    }
    return { startTieds, stopTieds };
  }
}
