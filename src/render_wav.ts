import { MidiPlanner } from "./midi3.ts";
import { MessageType } from "./midiTypes.ts";
import { Parser } from "./parser3.ts";
import { Tokens } from "./tokens.ts";

const SAMPLE_RATE = 44_100;
const TAIL_SECONDS = 0.35;
const ATTACK_SECONDS = 0.006;
const RELEASE_SECONDS = 0.035;

if (Deno.args.length < 2) {
  console.error("Usage: render_wav [source] [target]\n");
  Deno.exit(64);
}

type Note = {
  note: number;
  velocity: number;
  start: number;
  stop: number;
};

const source = await Deno.readTextFile(Deno.args[0]);
const planner = new MidiPlanner(
  new Parser(new Tokens(source)).parse(),
);
const notes = collectNotes(planner);
const wav = renderWav(notes, planner.time * secondsPerUnit(planner.bpm));
await Deno.writeFile(Deno.args[1], wav);

function collectNotes(planner: MidiPlanner): Note[] {
  const active = new Map<string, Note[]>();
  const notes: Note[] = [];
  const unitSeconds = secondsPerUnit(planner.bpm);

  for (const { time, event } of planner.messages()) {
    if (
      event === null ||
      (event.type !== MessageType.noteOn && event.type !== MessageType.noteOff)
    ) {
      continue;
    }

    const key = `${event.channel}:${event.note}`;
    const when = time * unitSeconds;
    if (event.type === MessageType.noteOn && event.velocity > 0) {
      const note = {
        note: event.note,
        velocity: event.velocity,
        start: when,
        stop: when,
      };
      const stack = active.get(key);
      if (stack) stack.push(note);
      else active.set(key, [note]);
      notes.push(note);
      continue;
    }

    const stack = active.get(key);
    const note = stack?.shift();
    if (note) {
      note.stop = Math.max(when, note.start);
    }
    if (stack?.length === 0) {
      active.delete(key);
    }
  }

  const fallbackStop = planner.time * unitSeconds;
  for (const stack of active.values()) {
    for (const note of stack) {
      note.stop = Math.max(fallbackStop, note.start);
    }
  }

  return notes;
}

function secondsPerUnit(bpm: number) {
  return 240 / bpm;
}

function renderWav(notes: Note[], durationSeconds: number): Uint8Array {
  const length = Math.max(
    1,
    Math.ceil((durationSeconds + TAIL_SECONDS) * SAMPLE_RATE),
  );
  const samples = new Float32Array(length);

  for (const note of notes) {
    addNote(samples, note);
  }

  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  const gain = peak > 0 ? Math.min(0.95 / peak, 1) : 1;

  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] * gain));
    view.setInt16(44 + i * 2, Math.round(sample * 0x7fff), true);
  }

  return bytes;
}

function addNote(samples: Float32Array, note: Note) {
  const start = Math.floor(note.start * SAMPLE_RATE);
  const stop = Math.max(start + 1, Math.floor(note.stop * SAMPLE_RATE));
  const releaseStop = Math.min(
    samples.length,
    stop + Math.ceil(RELEASE_SECONDS * SAMPLE_RATE),
  );
  const frequency = 440 * 2 ** ((note.note - 69) / 12);
  const amplitude = 0.18 * (note.velocity / 127);

  for (let i = start; i < releaseStop; i++) {
    const t = i / SAMPLE_RATE;
    const age = t - note.start;
    const releaseAge = Math.max(0, t - note.stop);
    const attack = Math.min(1, age / ATTACK_SECONDS);
    const release = releaseAge === 0
      ? 1
      : Math.max(0, 1 - releaseAge / RELEASE_SECONDS);
    const envelope = attack * release;
    samples[i] += Math.sin(2 * Math.PI * frequency * t) * amplitude * envelope;
  }
}

function writeAscii(bytes: Uint8Array, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    bytes[offset + i] = text.charCodeAt(i);
  }
}
