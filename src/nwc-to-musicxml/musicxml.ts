import { Element, Elements } from "./xml.ts";

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>'; //<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "https://raw.githubusercontent.com/w3c/musicxml/refs/tags/v4.0/schema/partwise.dtd">';

export class MusicXML {
  readonly chord: Element;
  readonly rest: Element;
  readonly timeMod: Element;
  readonly tie: { start: Element; stop: Element };
  readonly dot: Element;
  readonly dynamics: Record<string, Element>;
  readonly staves: Element[] = [];
  readonly atriculations: Map<string, Element>;
  readonly fermata: Element;

  constructor(private xml = new Elements()) {
    this.staves = [
      xml.create("staff", undefined, "1"),
      xml.create("staff", undefined, "2"),
    ];
    this.chord = xml.create("chord");
    this.rest = xml.create("rest");
    this.timeMod = xml.create(
      "time-modification",
      undefined,
      xml.create("actual-notes", undefined, "3"),
      xml.create("normal-notes", undefined, "2"),
    );
    this.tie = {
      start: xml.create("tie", { type: "start" }),
      stop: xml.create("tie", { type: "stop" }),
    };

    this.dot = xml.create("dot");

    this.dynamics = Object.fromEntries(
      ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].map((
        d,
      ) => [
        d,
        xml.create("dynamics", undefined, xml.create(d)),
      ]),
    );
    this.atriculations = new Map([
      ["Accent", xml.create("accent")],
      ["Breath Mark", xml.create("breath-mark", undefined, "comma")],
      ["Caesura", xml.create("caesura")],
      ["Staccato", xml.create("staccato")],
      ["Tenuto", xml.create("tenuto")],
    ]);
    this.fermata = xml.create("fermata");
  }

  tied(attributes: { type: string; number: string }) {
    return this.#cache["tied" + attributes.type + attributes.number] ||= this
      .xml.create("tied", attributes);
  }

  slur(type: string, number: number): Element {
    return this.#cache["slur" + type + number] ||= this.xml.create(
      "slur",
      { type, number: number.toString() },
    );
  }

  #barStyles: Record<string, string> = {
    Double: "light-light",
    SectionOpen: "heavy-light",
    SectionClose: "light-heavy",
    MasterRepeatOpen: "heavy-light",
    MasterRepeatClose: "light-heavy",
    LocalRepeatOpen: "light-light",
    LocalRepeatClose: "light-light",
  };

  #rightBarStyles = new Set([
    "SectionClose",
    "MasterRepeatClose",
    "LocalRepeatClose",
  ]);

  #leftBarStyles = new Set([
    "Double",
    "SectionOpen",
    "MasterRepeatOpen",
    "LocalRepeatOpen",
  ]);

  #repeatBars = new Set([
    "MasterRepeatOpen",
    "LocalRepeatOpen",
    "MasterRepeatClose",
    "LocalRepeatClose",
  ]);

  startSustain(staff: number) {
    return this.#cache["startSustain" + staff] ||= this.direction(
      this.xml.create("pedal", { type: "start" }),
      staff,
    );
  }

  stopSustain(staff: number) {
    return this.#cache["stopSustain" + staff] ||= this.direction(
      this.xml.create("pedal", { type: "stop" }),
      staff,
    );
  }

  leftBarline(
    type: string = "Single",
    ending: string[] = [],
  ) {
    if (!this.#leftBarStyles.has(type) && !ending.length) return null;
    return this.#cache[type + ending] ||= this.create(
      "barline",
      { location: "left" },
      type === "Single" ? null : this.xml.create(
        "bar-style",
        undefined,
        this.#barStyles[type],
      ),
      ending.length
        ? this.create("ending", {
          number: ending.join(","),
          type: "start",
        })
        : null,
      this.#repeatBars.has(type)
        ? this.xml.create("repeat", {
          direction: "forward",
        })
        : null,
    );
  }

  rightBarline(
    type: string = "Single",
    ending: string[] = [],
  ) {
    if (!this.#rightBarStyles.has(type) && !ending.length) return null;
    const single = type === "Single";
    return this.#cache[type + ending] ||= this.create(
      "barline",
      { location: "right" },
      single ? null : this.xml.create(
        "bar-style",
        undefined,
        this.#barStyles[type],
      ),
      ending.length
        ? this.create("ending", {
          number: ending.join(","),
          type: single ? "discontinue" : "stop",
        })
        : null,
      this.#repeatBars.has(type)
        ? this.xml.create("repeat", {
          direction: "backward",
        })
        : null,
    );
  }

  wedge(wegde: { type: string; number: string }, staff: number): Element {
    return this.direction(this.xml.create("wedge", wegde), staff);
  }

  clef(type: string, octaveChange: number, number: number): Element {
    const key = type + octaveChange + "~" + number;
    if (this.#cache[key]) return this.#cache[key];
    const elements = [];
    switch (type) {
      case "Bass":
        elements.push(this.xml.create("sign", undefined, "F"));
        break;
      case "Alto":
        elements.push(this.xml.create("sign", undefined, "C"));
        break;
      case "Tenor":
        elements.push(
          this.xml.create("sign", undefined, "C"),
          this.xml.create("line", undefined, "4"),
        );
        break;
      case "Treble":
        elements.push(this.xml.create("sign", undefined, "G"));
        break;
      default:
        throw new Error("Unknown Clef Type");
    }
    if (octaveChange) {
      elements.push(
        this.xml.create(
          "clef-octave-change",
          undefined,
          octaveChange.toString(),
        ),
      );
    }
    return this.#cache[key] = this.create(
      "clef",
      { number: number.toString() },
      ...elements,
    );
  }

  staff(number: number): Element {
    return this.staves[number - 1];
  }

  voice(name: string): Element {
    return this.#cache["voice" + name] ||= this.xml.create(
      "voice",
      undefined,
      name,
    );
  }

  direction(type: Element, staff: number) {
    return this.create(
      "direction",
      undefined,
      this.xml.create("direction-type", undefined, type),
      this.staves[staff - 1],
    );
  }

  key(fifths: number): Element {
    return this.#cache["K" + fifths] ||= this.xml.create(
      "key",
      undefined,
      this.xml.create("fifths", undefined, fifths.toString()),
    );
  }

  #steps = [..."CDEFGAB"].map((step) =>
    this.xml.create("step", undefined, step)
  );
  #octaves = [..."0123456789"].map((octave) =>
    this.xml.create("octave", undefined, octave)
  );

  alter(number: number): Element {
    return this.#cache["A" + number] ||= this.xml.create(
      "alter",
      undefined,
      number.toString(),
    );
  }

  // todo: don't use nwc alter names, use the xml ones
  // v = flat-flat, b = flat, n = natural, # = sharp, x = double-sharp

  #alters = Object.fromEntries(
    [..."vbn#x"].map((
      alter,
      i,
    ) => [alter, this.xml.create("alter", undefined, (i - 2).toString())]),
  );

  static readonly accidentalType: Record<string, string> = {
    v: "flat-flat",
    b: "flat",
    n: "natural",
    "#": "sharp",
    x: "double-sharp",
  };

  accidental(alter: string): Element {
    return this.#cache["accidental" + alter] ||= this.xml.create(
      "accidental",
      undefined,
      MusicXML.accidentalType[alter],
    );
  }

  pitch(tone: number, alter: string): Element {
    return this.#cache[alter + tone] ||= this.create(
      "pitch",
      undefined,
      this.#steps[tone % 7],
      alter === "n" ? null : this.#alters[alter],
      this.#octaves[(tone / 7) | 0],
    );
  }

  type(dur: string): Element {
    return this.#cache["T" + dur] ||= this.xml.create(
      "type",
      undefined,
      dur,
    );
  }

  note(...elements: (Element | null)[]): Element {
    return this.create("note", undefined, ...elements);
  }

  measure(
    number: number,
    ...elements: Element[]
  ): Element {
    return this.xml.create(
      "measure",
      { number: number.toString() },
      ...elements,
    );
  }

  #cache: Record<string, Element> = {};

  duration(duration: number): Element {
    return this.#cache["duration" + duration] ||= this.xml.create(
      "duration",
      undefined,
      duration.toString(),
    );
  }

  metronome(
    tempo: number,
    base: string = "Quarter",
    staff: number,
  ): Element {
    const [type, dotted] = base.split(" ");
    return this.#cache["M" + tempo + base + staff] ||= this.direction(
      this.create(
        "metronome",
        undefined,
        this.xml.create("beat-unit", undefined, type.toLowerCase()),
        dotted ? this.xml.create("beat-unit-dot") : null,
        this.xml.create("per-minute", undefined, tempo.toString()),
      ),
      staff,
    );
  }

  time(n: string, d: string): Element {
    return this.#cache["T" + n + "/" + d] ||= this.xml.create(
      "time",
      undefined,
      this.xml.create("beats", undefined, n),
      this.xml.create("beat-type", undefined, d),
    );
  }

  create(
    name: string,
    attributes?: Record<string, string>,
    ...Elements: (Element | string | null)[]
  ): Element {
    return this.xml.create(
      name,
      attributes,
      ...Elements.filter((x) => x !== null),
    );
  }

  backup(duration: number): Element {
    return this.#cache["backup" + duration] ||= this.create(
      "backup",
      undefined,
      this.duration(duration),
    );
  }

  stringify(element: Element): string {
    return HEADER + this.xml.stringify(element);
  }
}
