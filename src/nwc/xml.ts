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
    switch (this.#current.class) {
      case "Bar":
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
}
