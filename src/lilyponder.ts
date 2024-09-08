import { Value } from "./parser3.ts";
import { Event, Note } from "./transformer.ts";
import { mod, Ratio } from "./util.ts";
export class FourFourSplitter {
  #chunks: string[] = [];

  set(from: Ratio, to: Ratio) {
    this.#chunks.length = 0;
    const f = Math.floor(from.value);
    const t = Math.ceil(to.value);
    for (let i = f; i < t; i++) {
      this.#segment(from, to, i, i + 1);
    }
  }

  get() {
    return Array.from(this.#chunks);
  }

  #segment(from: Ratio, to: Ratio, f: number, t: number) {
    if (!from.moreThan(f)) {
      if (!to.lessThan(t)) {
        this.#chunks.push(`${1 / (t - f)}`);
        return;
      }
      this.#end(f, to);
      return;
    }
    if (!to.lessThan(t)) {
      this.#start(from, t);
      return;
    }

    // undotted syncopation (special case)
    if (
      from.value === 0.75 * f + 0.25 * t &&
      to.value === 0.25 * f + 0.75 * t
    ) {
      this.#start(from, 0.75 * f + 0.25 * t);
      this.#chunks.push((2 / (t - f)).toString());
      this.#end(0.25 * f + 0.75 * t, to);
      return;
    }

    const m = (t + f) / 2;
    if (from.lessThan(m)) {
      this.#segment(from, to, f, m);
    }
    if (to.moreThan(m)) {
      this.#segment(from, to, m, t);
    }
  }

  #start(from: Ratio, t: number) {
    this.#chunks.push(
      ...FourFourSplitter.#duration(
        (t * from.denominator - from.numerator) | 0,
        from.denominator,
      ),
    );
  }

  #end(f: number, to: Ratio) {
    this.#chunks.push(
      ...FourFourSplitter.#duration(
        (to.numerator - f * to.denominator) | 0,
        to.denominator,
      ).reverse(),
    );
  }

  static #duration(n: number, d: number): string[] {
    const result = [];
    let dots = "";
    while (n > 0) {
      switch (n & 3) {
        case 1:
          result.push(`${d}${dots}`);
          dots = "";
          break;
        case 3:
          dots += ".";
          break;
        default:
          break;
      }
      n >>= 1;
      d >>= 1;
    }
    return result;
  }
}

export type Placeholder = {
  pitch: string;
  duration: string[];
  voice?: Value;
  from: Ratio;
  to: Ratio;
};
export class Lilyponder {
  #fourFourSplitter = new FourFourSplitter();
  #pitch(note: Note) {
    const { degree, alter } = note.pyth.toPitch();
    let pitch = "cdefgab"[mod(degree, 7)];
    if (alter < 0) {
      for (let i = alter; i < 0; i++) {
        pitch += "es";
      }
    }
    if (alter > 0) {
      for (let i = 0; i < alter; i++) {
        pitch += "is";
      }
    }
    const octave = 1 + Math.floor(degree / 7);
    if (octave > 0) { for (let i = 0; i < octave; i++) pitch += "'"; }
    if (octave < 0) { for (let i = octave; i < 0; i++) pitch += ","; }
    return pitch;
  }

  // put both together...
  process(notes: (Event | Note)[]) {
    this.#addAll(notes);
    return this.#stringify();
  }

  #stringify() {
    const voices: string[] = [];
    for (const voice of this.#chords) {
      const chords: string[] = [];
      for (const bar of voice) {
        for (let i = 1; i < bar.length; i++) {
          this.#fourFourSplitter.set(bar[i - 1].start, bar[i].start);
          switch (bar[i - 1].parts.length) {
            case 0:
              for (const d of this.#fourFourSplitter.get()) {
                chords.push("r" + d);
              }
              continue;
            case 1: {
              const duration = this.#fourFourSplitter.get();
              const pitch = bar[i - 1].parts[0].pitch;
              const tie = bar[i - 1].parts[0].tied ? "~" : "";
              duration.map((d, j) => {
                chords.push(pitch + d + (j < duration.length - 1 ? "~" : tie));
              });
              continue;
            }
            default: {
              const duration = this.#fourFourSplitter.get();
              duration.map((d, j) => {
                const tones = j < duration.length - 1
                  ? bar[i - 1].parts.map(({ pitch }) => pitch + "~")
                  : bar[i - 1].parts
                    .map(({ pitch, tied }) => pitch + (tied ? "~" : ""))
                    .join(" ");
                chords.push(`<${tones}>${d}`);
              });
            }
          }
        }
      }
      voices.push(`{${chords.join(" ")}}`);
    }
    return `<<${voices.join(" ")}>>`;
  }

  #voices: Value[] = [];
  #vi(value: Value) {
    const i = this.#voices.indexOf(value);
    if (i === -1) {
      this.#voices.push(value);
      return this.#voices.length - 1;
    }
    return i;
  }

  // some invariant to preserve: none of the existing chords may overlap.
  #chords: Chord[][][] = [];
  #addAll(items: (Event | Note)[]) {
    this.#chords.length = 0;
    let voice = -1;
    for (const item of items) {
      if (item.type === "event") {
        // todo: handle others
        voice = ["treble", "bass"].indexOf(item.value);
        continue;
      }
      // silently ignore?
      if (voice < 0) {
        console.warn("Dropping note not assigned to voice");
        continue;
      }

      const vi = this.#vi(voice);
      const bar = item.start.value | 0;
      this.#add(vi, bar, item);
    }
  }

  #addTo(
    start: Ratio,
    stop: Ratio,
    pitch: string,
    tied: boolean,
    chords: Chord[],
  ) {
    let i = 0;
    while (chords[i].start.less(start)) {
      i++;
    }
    if (start.less(chords[i].start)) {
      chords.splice(i - 1, 0, {
        start: chords[i - 1].start,
        parts: chords[i - 1].parts.map(({ pitch }) => ({
          pitch,
          tied: true,
        })),
      });
      chords[i].start = start;
      i++;
    }
    const first = i;
    while (chords[i].start.less(stop)) {
      i++;
    }
    const last = i - 1;
    if (stop.less(chords[i].start)) {
      chords.splice(i - 1, 0, {
        start: chords[i - 1].start,
        parts: chords[i - 1].parts.map(({ pitch }) => ({
          pitch,
          tied: true,
        })),
      });
      chords[i].start = stop;
      i++;
    }
    for (let j = first; j < last; j++) {
      chords[j].parts.push({ pitch, tied: true });
    }
    chords[last].parts.push({ pitch, tied });
  }

  #add(vi: number, bar: number, note: Note) {
    const tied = note.stop.moreThan(bar + 1);
    if (tied) {
      const m = Ratio.int(bar + 1);
      this.#add(vi, bar + 1, { ...note, start: m });
      note.stop = m;
    }
    if (this.#chords[vi] === undefined) {
      this.#chords[vi] = [];
    }
    // not changing
    if (this.#chords[vi][bar] === undefined) {
      // 'empty' start, required for the #addTo method
      this.#chords[vi][bar] = [
        { start: Ratio.int(bar), parts: [] },
        { start: Ratio.int(bar + 1), parts: [] },
      ];
    }
    this.#addTo(
      note.start,
      note.stop,
      this.#pitch(note),
      tied,
      this.#chords[vi][bar],
    );
  }
}
type Chord = {
  start: Ratio;
  parts: { pitch: string; tied: boolean }[];
};
