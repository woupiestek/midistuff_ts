import { create, Element } from "./xml.ts";

const HEADER =
  '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">';

export class MusicXML {
  readonly chord: Element;
  readonly rest: Element;
  readonly timeMod: Element;
  readonly tie: { start: Element; stop: Element };
  readonly dot: Element;
  readonly dynamics: Record<string, Element>;
  readonly atriculations: Map<string, Element>;
  readonly fermata: Element;

  constructor() {
    this.chord = create("chord");
    this.rest = create("rest");
    this.timeMod = create(
      "time-modification",
      undefined,
      create("actual-notes", undefined, "3"),
      create("normal-notes", undefined, "2"),
    );
    this.tie = {
      start: create("tie", { type: "start" }),
      stop: create("tie", { type: "stop" }),
    };

    this.dot = create("dot");

    this.dynamics = Object.fromEntries(
      ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].map((
        d,
      ) => [
        d,
        create("dynamics", undefined, create(d)),
      ]),
    );
    this.atriculations = new Map([
      ["Accent", create("accent")],
      ["Breath Mark", create("breath-mark", undefined, "comma")],
      ["Caesura", create("caesura")],
      ["Staccato", create("staccato")],
      ["Tenuto", create("tenuto")],
    ]);
    this.fermata = create("fermata");
  }

  stem(sv: string) {
    return this.#cache["stem" + sv] ||= create("stem", undefined, sv);
  }

  tied(attributes: { type: string; number: string }) {
    return this.#cache["tied" + attributes.type + attributes.number] ||= create(
      "tied",
      attributes,
    );
  }

  slur(type: string, number: number): Element {
    return this.#cache["slur" + type + number] ||= create(
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

  startSustain(staff: Element) {
    return this.#cache["startSustain" + staff] ||= this.direction(
      create("pedal", { type: "start" }),
      staff,
    );
  }

  stopSustain(staff: Element) {
    return this.#cache["stopSustain" + staff] ||= this.direction(
      create("pedal", { type: "stop" }),
      staff,
    );
  }

  leftBarline(
    type: string = "Single",
    ending: string[] = [],
  ) {
    if (!this.#leftBarStyles.has(type) && !ending.length) return null;
    return this.#cache[type + ending] ||= create(
      "barline",
      { location: "left" },
      type === "Single" ? null : create(
        "bar-style",
        undefined,
        this.#barStyles[type],
      ),
      ending.length
        ? create("ending", {
          number: ending.join(","),
          type: "start",
        })
        : null,
      this.#repeatBars.has(type)
        ? create("repeat", {
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
    return this.#cache[type + ending] ||= create(
      "barline",
      { location: "right" },
      single ? null : create(
        "bar-style",
        undefined,
        this.#barStyles[type],
      ),
      ending.length
        ? create("ending", {
          number: ending.join(","),
          type: single ? "discontinue" : "stop",
        })
        : null,
      this.#repeatBars.has(type)
        ? create("repeat", {
          direction: "backward",
        })
        : null,
    );
  }

  wedge(wegde: { type: string; number: string }, staff: Element): Element {
    return this.direction(create("wedge", wegde), staff);
  }

  clef(type: string, octaveChange: number, number: number): Element {
    const key = type + octaveChange + "~" + number;
    if (this.#cache[key]) return this.#cache[key];
    const elements = [];
    switch (type) {
      case "Bass":
        elements.push(create("sign", undefined, "F"));
        break;
      case "Alto":
        elements.push(create("sign", undefined, "C"));
        break;
      case "Tenor":
        elements.push(
          create("sign", undefined, "C"),
          create("line", undefined, "4"),
        );
        break;
      case "Treble":
        elements.push(create("sign", undefined, "G"));
        break;
      default:
        throw new Error("Unknown Clef Type");
    }
    if (octaveChange) {
      elements.push(
        create(
          "clef-octave-change",
          undefined,
          octaveChange.toString(),
        ),
      );
    }
    return this.#cache[key] = create(
      "clef",
      { number: number.toString() },
      ...elements,
    );
  }

  staff(number: number): Element {
    return this.#cache["staff" + number] ||= create(
      "staff",
      undefined,
      number.toString(),
    );
  }

  voice(name: string): Element {
    return this.#cache["voice" + name] ||= create(
      "voice",
      undefined,
      name,
    );
  }

  direction(type: Element, staff: Element) {
    return create(
      "direction",
      undefined,
      create("direction-type", undefined, type),
      staff,
    );
  }

  key(fifths: number): Element {
    return this.#cache["K" + fifths] ||= create(
      "key",
      undefined,
      create("fifths", undefined, fifths.toString()),
    );
  }

  #steps = [..."CDEFGAB"].map((step) => create("step", undefined, step));
  #octaves = Array(10).keys().map((octave) =>
    create("octave", undefined, octave.toString())
  ).toArray();

  alter(number: number): Element {
    return this.#cache["A" + number] ||= create(
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
    ) => [alter, create("alter", undefined, (i - 2).toString())]),
  );

  static readonly accidentalType: Record<string, string> = {
    v: "flat-flat",
    b: "flat",
    n: "natural",
    "#": "sharp",
    x: "double-sharp",
  };

  accidental(alter: string): Element {
    return this.#cache["accidental" + alter] ||= create(
      "accidental",
      undefined,
      MusicXML.accidentalType[alter],
    );
  }

  pitch(tone: number, alter: string): Element {
    return this.#cache[alter + tone] ||= create(
      "pitch",
      undefined,
      this.#steps[tone % 7],
      alter === "n" ? null : this.#alters[alter],
      this.#octaves[(tone / 7) | 0],
    );
  }

  type(dur: string): Element {
    return this.#cache["T" + dur] ||= create(
      "type",
      undefined,
      dur,
    );
  }

  note(...elements: (Element | null)[]): Element {
    return create("note", undefined, ...elements);
  }

  measure(
    number: number,
    ...elements: Element[]
  ): Element {
    return create(
      "measure",
      { number: number.toString() },
      ...elements,
    );
  }

  #cache: Record<string, Element> = {};

  duration(duration: number): Element {
    return this.#cache["duration" + duration] ||= create(
      "duration",
      undefined,
      duration.toString(),
    );
  }

  metronome(
    tempo: number,
    base: string = "Quarter",
    staff: Element,
  ): Element {
    const [type, dotted] = base.split(" ");
    return this.#cache["M" + tempo + base + staff] ||= this.direction(
      create(
        "metronome",
        undefined,
        create("beat-unit", undefined, type.toLowerCase()),
        dotted ? create("beat-unit-dot") : null,
        create("per-minute", undefined, tempo.toString()),
      ),
      staff,
    );
  }

  time(n: string, d: string): Element {
    return this.#cache["T" + n + "/" + d] ||= create(
      "time",
      undefined,
      create("beats", undefined, n),
      create("beat-type", undefined, d),
    );
  }

  // create(
  //   name: string,
  //   attributes?: Record<string, string>,
  //   ...Elements: (Element | string | null)[]
  // ): Element {
  //   return create(
  //     name,
  //     attributes,
  //     ...Elements,
  //   );
  // }

  backup(duration: number): Element {
    return this.#cache["backup" + duration] ||= create(
      "backup",
      undefined,
      this.duration(duration),
    );
  }

  stringify(element: Element): string {
    return HEADER + element.stringify();
  }
}
