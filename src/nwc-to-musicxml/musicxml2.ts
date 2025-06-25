import { Node, XML } from "./xml2.ts";
export class MusicXML2 {
  constructor(readonly xml: XML) {
  }
  #keyValue(k: string, v: string | Node): Node {
    return this.xml.builder(k).children(v).build();
  }
  timeMod32() {
    return this.xml.builder("time-modification").children(
      this.#keyValue("actual-notes", "3"),
      this.#keyValue("normal-notes", "2"),
    ).build();
  }
  startTie() {
    return this.xml.builder("tie").attributes({ type: "start" }).build();
  }
  stopTie() {
    return this.xml.builder("tie").attributes({ type: "stop" }).build();
  }
  dynamic(d: string) {
    return this.#keyValue("dynamics", this.xml.element(d));
  }
  articulation(a: string) {
    switch (a) {
      case "Accent":
        this.xml.element("accent");
        break;
      case "Breath Mark":
        this.#keyValue("breath-mark", "comma");
        break;
      case "Caesura":
        this.xml.element("caesura");
        break;
      case "Staccato":
        this.xml.element("staccato");
        break;
      case "Tenuto":
        this.xml.element("tenuto");
        break;
    }
  }
  stem(sv: string) {
    return this.#keyValue("stem", sv);
  }
  tied(attributes: { type: string; number: string }) {
    return this.xml.builder("tied").attributes(attributes).build();
  }
  slur(type: string, number: number): Node {
    return this.xml.builder(
      "slur",
    ).attributes(
      { type, number: number.toString() },
    ).build();
  }
  direction(type: Node, staff: number) {
    return this.xml.builder(
      "direction",
    ).children(
      this.#keyValue("direction-type", type),
      this.staff(staff),
    )
      .build();
  }
  startSustain(staff: number) {
    return this.direction(
      this.xml.builder("pedal").attributes({ type: "start" }).build(),
      staff,
    );
  }
  stopSustain(staff: number) {
    return this.direction(
      this.xml.builder("pedal").attributes({ type: "stop" }).build(),
      staff,
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
  leftBarline(type: string = "Single", ending: string[] = []) {
    if (!this.#leftBarStyles.has(type) && !ending.length) return null;
    return this.xml.builder(
      "barline",
    ).attributes(
      { location: "left" },
    ).children(
      type === "Single"
        ? null
        : this.#keyValue("bar-style", this.#barStyles[type]),
      ending.length
        ? this.xml.builder("ending").attributes({
          number: ending.join(","),
          type: "start",
        }).build()
        : null,
      this.#repeatBars.has(type)
        ? this.xml.builder("repeat").attributes({ direction: "forward" })
          .build()
        : null,
    );
  }
  rightBarline(type: string = "Single", ending: string[] = []) {
    if (!this.#rightBarStyles.has(type) && !ending.length) return null;
    const single = type === "Single";
    return this.xml.builder(
      "barline",
    ).attributes(
      { location: "right" },
    ).children(
      single ? null : this.#keyValue("bar-style", this.#barStyles[type]),
      ending.length
        ? this.xml.builder("ending").attributes({
          number: ending.join(","),
          type: single ? "discontinue" : "stop",
        }).build()
        : null,
      this.#repeatBars.has(type)
        ? this.xml.builder("repeat").attributes({ direction: "backward" })
          .build()
        : null,
    );
  }
  wedge(wegde: { type: string; number: string }, staff: number): Node {
    return this.direction(
      this.xml.builder("wedge").attributes(wegde).build(),
      staff,
    );
  }
  clef(type: string, octaveChange: number, number: number): Node {
    const elements = [];
    switch (type) {
      case "Bass":
        elements.push(this.#keyValue("sign", "F"));
        break;
      case "Alto":
        elements.push(this.#keyValue("sign", "C"));
        break;
      case "Tenor":
        elements.push(
          this.#keyValue("sign", "C"),
          this.#keyValue("line", "4"),
        );
        break;
      case "Treble":
        elements.push(this.#keyValue("sign", "G"));
        break;
      default:
        throw new Error("Unknown Clef Type");
    }
    if (octaveChange) {
      elements.push(
        this.#keyValue("clef-octave-change", octaveChange.toString()),
      );
    }
    return this.xml.builder(
      "clef",
    ).attributes(
      { number: number.toString() },
    ).children(
      ...elements,
    ).build();
  }
  staff(number: number): Node {
    return this.#keyValue("staff", number.toString());
  }
  voice(name: string): Node {
    return this.#keyValue("voice", name);
  }
  key(fifths: number): Node {
    return this.#keyValue("key", this.#keyValue("fifths", fifths.toString()));
  }
  pitch(tone: number, alter: string): Node {
    return this.xml.builder(
      "pitch",
    ).children(
      this.#keyValue("step", "CDEFGAB"[tone % 7]),
      alter === "n"
        ? null
        : this.#keyValue("alter", ("vbn#x".indexOf(alter) - 2).toString()),
      this.#keyValue("octave", ((tone / 7) | 0).toString()),
    ).build();
  }

  metronome(
    tempo: number,
    base: string = "Quarter",
    staff: number,
  ): Node {
    const [type, dotted] = base.split(" ");
    return this.direction(
      this.xml.builder(
        "metronome",
      ).children(
        this.#keyValue("beat-unit", type.toLowerCase()),
        dotted ? this.xml.element("beat-unit-dot") : null,
        this.#keyValue("per-minute", tempo.toString()),
      ).build(),
      this.staff(staff),
    );
  }

  time(n: string, d: string): Node {
    return this.xml.builder(
      "time",
    ).children(
      this.#keyValue("beats", n),
      this.#keyValue("beat-type", d),
    ).build();
  }

  backup(duration: number): Node {
    return this.#keyValue(
      "backup",
      this.#keyValue("duration", duration.toString()),
    );
  }
}
