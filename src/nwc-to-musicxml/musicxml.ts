import { create, Element } from "./xml.ts";

const HEADER =
  '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">';

export type Elements = {
  positions: {
    accidentals: Map<number, Element>;
    backup: Set<number>;
    groups: number[];
    pitches: Element[];
    startTieds: Map<number, Element>;
    stopTieds: Map<number, Element>;
  };
  lyrics: Element[][];
};

export class MusicXML {
  static readonly chord: Element = create("chord");
  static readonly rest: Element = create("rest");
  static readonly timeMod: Element = create(
    "time-modification",
    undefined,
    create("actual-notes", undefined, "3"),
    create("normal-notes", undefined, "2"),
  );
  static readonly tie: { start: Element; stop: Element } = {
    start: create("tie", { type: "start" }),
    stop: create("tie", { type: "stop" }),
  };
  static readonly dot: Element = create("dot");

  static readonly stem = {
    up: create("stem", undefined, "up"),
    down: create("stem", undefined, "down"),
  };

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

  time(n: string, d: string): Element {
    return this.#cache["T" + n + "/" + d] ||= create(
      "time",
      undefined,
      create("beats", undefined, n),
      create("beat-type", undefined, d),
    );
  }

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
