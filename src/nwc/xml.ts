import { Element, ElementBuilder } from "../musicxml/xml.ts";
import { Parser, Row } from "./parser.ts";

export class Converter {
  #current: Row;
  constructor(private parser: Parser) {
    this.#current = parser.next();
  }

  score(): Element {
    const element = new ElementBuilder("score-partwise");
    this.#header();
    while (this.#part(element));
    return element.build();
  }

  #advance() {
    if (!this.parser.done()) {
      this.#current = this.parser.next();
    }
  }

  #header() {
    // todo
    while (
      ["Editor", "Font", "PgMargins", "PgSetup", "SongInfo"].includes(
        this.#current.class,
      )
    ) {
      this.#advance();
    }
  }

  #part(score: ElementBuilder): boolean {
    if (this.#current.class !== "AddStaff") return false;

    for (;;) {
      this.#current = this.parser.next();
      if (
        !["StaffInstrument", "StaffProperties"].includes(this.#current.class)
      ) {
        break;
      }
      // todo: store those properties
    }

    const builder = new ElementBuilder("part");
    // measures

    // fuck those barlines

    score.add(builder.build());
    return true;
  }

  #offset = 0;

  #clef() {
    const clef = new ElementBuilder("clef");
    let sign = "";
    let line = "";
    switch (this.#current.fields.Type[0]) {
      case "Bass":
        sign = "F";
        this.#offset = -6;
        break;
      case "Treble":
        sign = "G";
        this.#offset = 6;
        break;
      case "Alto":
        sign = "C";
        this.#offset = 0;
        break;
      case "Tenor":
        sign = "C";
        line = "4";
        this.#offset = -2;
        break;
      default:
        break;
    }
    clef.add(new ElementBuilder("sign").add(sign).build());
    if (line !== "") clef.add(new ElementBuilder("line").add(line).build());
    let octaveChange = 0;
    if (this.#current.fields.OctaveShift) {
      switch (this.#current.fields.OctaveShift[0]) {
        case "Octave Up":
          this.#offset += 7;
          octaveChange = 1;
          break;
        case "Octave Down":
          this.#offset -= 7;
          octaveChange = -1;
          break;
        default:
          break;
      }
    }
    if (octaveChange !== 0) {
      clef.add(
        new ElementBuilder("clef-octave-change").add(octaveChange.toString())
          .build(),
      );
    }
    this.#advance();
    return clef.build();
  }

  #signature = Object.fromEntries([..."ABCDEFG"].map((k) => [k, 0]));

  #accidentals = { ...this.#signature };

  #key() {
    // there is a choice between traditional and nontraditional signatures!
    for (const s of this.#current.fields.Signature) {
      this.#signature[s[0]] = { "#": 1, b: -1 }[s[1]] || 0;
    }
    this.#advance();
    //recognize traditional signatures
    const key = [
      "0000000",
      "0000001",
      "0000011",
      "0000111",
      "0001111",
      "0011111",
      "0111111",
      "1111111",
      "1111112",
      "1111122",
      "1111222",
      "1112222",
      "1122222",
      "1222222",
      "2222222",
    ].indexOf([..."BEADGCF"].map((c) => this.#signature[c] + 1).join("")) - 7;

    const builder = new ElementBuilder("key");
    if (key >= -7) {
      builder.add(
        new ElementBuilder("fifths").add(key.toString()).build(),
      );
    } else {
      Object.entries(this.#signature).forEach(([step, alter]) =>
        builder.add(new ElementBuilder("key-step").add(step).build())
          .add(new ElementBuilder("key-alter").add(alter.toString()).build())
      );
    }
    return builder.build();
  }

  #measure(measure: ElementBuilder) {
    // have an attributes block,
    // put in divisions, like 24 per whole note
    // const divisionsPerQuarter = 24;
    switch (this.#current.class) {
      case "Bar":
        this.#accidentals = { ...this.#signature };
        return;
      case "Clef":
        measure.add(
          new ElementBuilder("attributes").add(
            this.#clef(),
          ).build(),
        );
        break;
      case "Dynamic": {
        const dynamic = this.#current.fields.Style[0];
        this.#advance();
        if (typeof dynamic !== "string") {
          console.warn(
            "unprocessed dynamic",
            this.#current.fields.Style,
          );
          break;
        }
        measure.add(
          new ElementBuilder("direction").add(
            new ElementBuilder("direction-type").add(
              new ElementBuilder("dynamics").add(
                new ElementBuilder(dynamic).build(),
              ).build(),
            ).build(),
          ).build(),
        );
        break;
      }
      case "Key":
        measure.add(
          new ElementBuilder("attributes").add(
            this.#key(),
          ).build(),
        );
        break;
      case "Note": {
        break;
      }
      case "SustainPedal": {
        const type = this.#current.fields.Status?.[0] !== "Released"
          ? "start"
          : "stop";
        this.#advance();
        measure.add(
          new ElementBuilder("direction").add(
            new ElementBuilder("direction-type").add(
              new ElementBuilder("pedal").attribute(
                "type",
                type,
              ).build(),
            ).build(),
          ).build(),
        );
        break;
      }
      case "Tempo": {
        const metronome = new ElementBuilder("metronome");
        let base = "quarter";
        let dotted = false;
        switch (this.#current.fields.Base?.[0]) {
          case "Eighth Dotted":
            dotted = true; // fall through
          case "Eighth":
            base = "eighth";
            break;
          case "Quarter Dotted":
            dotted = true; // fall through
          case "Quarter":
            base = "quarter";
            break;
          case "Half Dotted":
            dotted = true; // fall through
          case "Half":
            base = "half";
            break;
          default:
            break;
        }
        metronome.add(new ElementBuilder("beat-unit").add(base).build());
        if (dotted) metronome.add(new ElementBuilder("beat-unit-dot").build());
        const bpm = this.#current.fields.Tempo[0];
        if (typeof bpm !== "string") {
          console.warn("unprocessed tempo", this.#current.fields.Tempo);
          break;
        }
        metronome.add(new ElementBuilder("per-minute").add(bpm).build());
        this.#advance();
        measure.add(
          new ElementBuilder("direction").add(
            new ElementBuilder("direction-type").add(
              metronome.build(),
            ).build(),
          ).build(),
        );
        break;
      }
      case "TimeSig": {
        const s0 = this.#current.fields.Signature[0];
        this.#advance();
        if (typeof s0 !== "string") {
          console.error(`weird error ${s0}`);
          break;
        }
        const s1 = s0.indexOf("/");
        measure.add(
          new ElementBuilder("time").add(
            new ElementBuilder("beats").add(s0.slice(0, s1)).build(),
          ).add(
            new ElementBuilder("beat-type").add(s0.slice(s1 + 1)).build(),
          ).build(),
        );
        break;
      }
    }
  }

  //   #pitch(Pos: Value): { pitch: Element; tied: boolean } | undefined {
  //     if (Pos instanceof Array) {
  //       console.warn(`Problems with position ${Pos}`);
  //       return undefined;
  //     }
  //     let i = 0;
  //     let alter = {
  //       x: 2,
  //       "#": 1,
  //       n: 0,
  //       b: -1,
  //       v: -2,
  //     }[Pos[i]];
  //     if (alter !== undefined) i++;
  //     let sign = 1;
  //     if (Pos[i] === "-") {
  //       sign = -1;
  //       i++;
  //     }
  //     let value = 0;
  //     while ("0" <= Pos[i] && Pos[i] <= "9") {
  //       value = value * 10 + Pos.charCodeAt(i) - 48;
  //       i++;
  //     }
  //     const degree = sign * value + this.#offset;
  //     const index = mod(degree, 7);
  //     if (alter === undefined) {
  //       alter = this.#accidentals[index];
  //     } else {
  //       this.#accidentals[index] = alter;
  //     }
  //     const tied = Pos[i] === "^";
  //     if (tied) i++;
  //     if (i !== Pos.length) {
  //       console.warn(`Problems with position ${Pos}`);
  //     }
  //     const pitch = new ElementBuilder("pitch")
  //       .add(
  //         new ElementBuilder("octave").add(
  //           (Math.floor(degree / 7) + 4).toString(),
  //         ).build(),
  //       )
  //       .add(new ElementBuilder("step").add("CDEFGAB"[index]).build());
  //     if (alter !== 0) {
  //       pitch.add(new ElementBuilder("alter").add(alter.toString()).build());
  //     }
  //     return { pitch: pitch.build(), tied };
  //   }
}

// function duration(Dur: Value[], divisionsPerQuarter: number): number {
//   let duration = 0;
//   switch (Dur[0]) {
//     case "4th":
//       duration = divisionsPerQuarter;
//       break;
//     case "8th":
//       duration = divisionsPerQuarter / 2;
//       break;
//     case "Half":
//       duration = divisionsPerQuarter * 2;
//       break;
//     case "Whole":
//       duration = divisionsPerQuarter * 4;
//       break;
//   }
//   for (let i = 1; i < Dur.length; i++) {
//     if (typeof Dur[i] === "string") {
//       switch (Dur[i]) {
//         case "Dotted":
//           duration *= 3 / 2;
//           break;
//         case "DblDotted":
//           duration *= 7 / 4;
//           break;
//         case "Triplet":
//           duration *= 2 / 3;
//           break;
//         default:
//           console.warn("not processed", Dur[i]);
//       }
//     } else if (Dur[i] instanceof Array && Dur[i][0] === "Triplet") {
//       duration *= 2 / 3;
//     } else {
//       console.warn("not processed", Dur[i]);
//     }
//   }
//   return duration;
