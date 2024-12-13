import { Scanner } from "./scanner.ts";
import { Element, Elements } from "./xml.ts";

// expected smallest subdivison in NWC
const FRACTION = 768;

function gcd(a: number, b: number): number {
  for (;;) {
    if (!b) return a;
    a = a % b;
    if (!a) return b;
    b = b % a;
  }
}

export class Transformed {
  partOffset: number[] = [];
  partNames: string[] = [];
  measures: number[] = [];
  types: string[] = [];
  durations: number[] = [];
  attributes: object[] = [];
  data: object[] = [];

  #offset = 34;
  #signature = [0, 0, 0, 0, 0, 0, 0];
  #alterations = [0, 0, 0, 0, 0, 0, 0];

  static #clefStep: { [_: string]: number } = {
    Bass: 22,
    Treble: 34,
    Alto: 28,
    Tenor: 26,
  };

  static #alters: { [_: string]: number } = {
    x: 2,
    "#": 1,
    n: 0,
    b: -1,
    v: -2,
  };

  #pitches: {
    [_: string]: Element;
  } = {};

  #pitch(pos: string) {
    const tied = pos[pos.length - 1] === "^";
    if (tied) {
      pos = pos.substring(0, pos.length - 1);
    }
    let alter = Transformed.#alters[pos[0]];
    const offset = this.#offset +
      +(alter === undefined ? pos : pos.substring(1));
    if (alter === undefined) {
      alter = this.#alterations[offset % 7];
    } else {
      this.#alterations[offset % 7] = alter;
    }
    const key = ["bb", "b", "n", "#", "x"][alter + 2] + offset;
    const octave = (offset / 7) | 0;
    const step = "CDEFGAB"[offset % 7];
    // ouch! boolean field tied
    this.#pitches[key] ||= this.#xml.create(
      "pitch",
      undefined,
      this.#xml.create("alter", undefined, alter.toString()),
      this.#xml.create("octave", undefined, octave.toString()),
      this.#xml.create("step", undefined, step),
    );
    return { pitch: key, tied };
  }

  #gcd = Number.MAX_VALUE;

  #fractions(dur: string[]): number {
    let d = FRACTION;
    for (const s of dur) {
      switch (s) {
        case "16th":
          d /= 16;
          break;
        case "32nd":
          d /= 32;
          break;
        case "64th":
          d /= 64;
          break;
        case "8th":
          d /= 8;
          break;
        case "4th":
          d /= 4;
          break;
        case "Dotted":
          d *= 3 / 2;
          break;
        case "DblDotted":
          d *= 7 / 4;
          break;
        case "Triplet":
          d *= 2 / 3;
          break;
        case "First":
          break;
        case "End":
          break;
        case "Staccato":
          break;
        case "Tenuto":
          break;
        case "Accent":
          break;
        case "Whole":
          break;
        case "Half":
          d /= 2;
          break;
        default:
          break;
      }
    }
    if (this.#gcd > d) {
      this.#gcd = gcd(this.#gcd, d);
    }
    return d;
  }

  constructor(source: string) {
    const scanner = new Scanner(source);
    for (const line of scanner.lines()) {
      const typ = scanner.getName(scanner.getLineTag(line) + 1);
      switch (typ) {
        // case "SongInfo":
        case "AddStaff": {
          this.#signature = [0, 0, 0, 0, 0, 0, 0];
          this.#alterations = [0, 0, 0, 0, 0, 0, 0];
          let name = "";
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Name":
                name = scanner.getString(scanner.getValues(column)[0] + 2);
            }
          }
          this.partNames.push(name);
          this.partOffset.push(this.measures.length);
          continue;
        }
        // case "StaffProperties":
        // case "StaffInstrument":
        case "Clef": {
          const cols = [...scanner.getColumns(line)];
          const sign = scanner.getName(
            scanner.getValues(cols[0])[0] + 1,
          );
          const shift = cols[1] &&
            scanner.getName(
              scanner.getValues(cols[1])[0] + 1,
            );
          this.attributes.push({
            type: typ,
            measure: this.measures.length,
            sign,
            shift,
          });
          this.#offset = Transformed.#clefStep[sign] ?? 34;
          continue;
        }
        case "Key": {
          const cols = [...scanner.getColumns(line)];
          const signature = scanner.getValues(cols[0]).map((
            from,
          ) => scanner.getKeyPart(from + 1));

          this.#signature = [0, 0, 0, 0, 0, 0, 0];
          for (const x of signature) {
            this.#signature["CDEFGAB".indexOf(x[0])] =
              { "#": 1, "b": -1 }[x[1]] ?? 0;
          }
          this.#alterations = [...this.#signature];
          const tonic = cols[1] &&
            scanner.getKeyPart(
              scanner.getValues(cols[1])[0] + 1,
            );
          this.attributes.push({
            type: typ,
            measure: this.measures.length,
            signature,
            tonic,
          });
          continue;
        }
        case "TimeSig": {
          const col = scanner.getColumns(line).next().value ?? -1;
          const time = scanner.getSignature(scanner.getValues(col)[0] + 1);
          this.attributes.push({
            type: typ,
            measure: this.measures.length,
            time,
          });
          continue;
        }
        // case "Tempo":
        // case "Dynamic":
        case "Rest": {
          let dur: string[] = [];
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Dur":
                dur = scanner.getValues(column).map((from) =>
                  scanner.getName(from + 1)
                );
            }
          }
          this.types.push(typ);
          this.durations.push(this.#fractions(dur));
          this.data.push({ dur });
          break;
        }
        case "Chord": {
          let dur: string[] = [];
          let pos: string[] = [];
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Dur":
                dur = scanner.getValues(column).map((from) =>
                  scanner.getName(from + 1)
                );
                break;
              case "Pos":
                pos = scanner.getValues(column).map((from) =>
                  scanner.getPos(from + 1)
                );
                break;
            }
          }
          this.types.push(typ);
          this.durations.push(this.#fractions(dur));
          this.data.push({
            dur,
            pos,
            pitch: pos.map((p) => this.#pitch(p)),
          });
          break;
        }
        case "Bar": {
          this.measures.push(this.data.length);
          this.#alterations = [...this.#signature];
          continue;
        }
        case "Note": {
          let dur: string[] = [];
          let pos = "";
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Dur":
                dur = scanner.getValues(column).map((from) =>
                  scanner.getName(from + 1)
                );
                break;
              case "Pos":
                pos = scanner.getPos(scanner.getValues(column)[0] + 1);
                break;
            }
          }
          this.types.push(typ);
          this.durations.push(this.#fractions(dur));
          this.data.push({
            dur,
            pos,
            pitch: this.#pitch(pos),
          });
          break;
        }
        // case "SustainPedal":
        default:
          continue;
      }
    }
    console.log(this.#gcd);
  }

  #xml = new Elements();
  toXML() {
    return this.#xml.stringify(this.#xml.create(
      "score-partwise",
      { version: "4.0" },
      this.#xml.create(
        "part-list",
        undefined,
        ...this.partNames.map((name, i) =>
          this.#xml.create(
            "score-part",
            { id: `P${i + 1}` },
            this.#xml.create("part-name", undefined, name),
          )
        ),
      ),
      ...this.partNames.map((_, i) =>
        this.#xml.create(
          "part",
          { id: `P${i + 1}` },
          ...this.measures.slice(this.partOffset[i], this.partOffset[i + 1])
            .map((_, j) =>
              this.#xml.create("measure", { number: (j + 1).toString() })
            ),
        )
      ),
    ));
  }

  // todo
  #notes(measure: number) {
    const from = this.measures[measure];
    const to = this.measures[measure + 1] ?? this.types.length;
    const notes = [];
    for (let i = from; i < to; i++) {
      switch (this.types[i]) {
        case "Rest":
          notes.push(
            this.#xml.create(
              "note",
              undefined,
              this.#xml.create("rest"),
              this.#xml.create(
                "duration",
                undefined,
                (this.durations[i] / this.#gcd).toString(),
              ),
              // collect the right data and map it...
              // this.#xml.create("type", )
            ),
          );
      }
    }
  }
}
