import { scan } from "./scanner.ts";
import { Transformer } from "./transformer.ts";

const samplesDir = "samples";
const targetDir = "target";
const nwcConv =
  "C:\\Program Files (x86)\\Noteworthy Software\\NoteWorthy Composer 2\\nwc-conv.exe";

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e;
  }
}

function decodeNwcText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  return new TextDecoder().decode(bytes);
}

async function convertNwcToNwcTxt(): Promise<void> {
  for await (const entry of Deno.readDir(samplesDir)) {
    if (!entry.isFile || !entry.name.endsWith(".nwc")) {
      continue;
    }

    const fileName = entry.name.substring(0, entry.name.length - 4);
    const nwctxtPath = `${samplesDir}\\${fileName}.nwctxt`;
    if (await exists(nwctxtPath)) {
      continue;
    }

    const command = new Deno.Command(nwcConv, {
      args: [`${samplesDir}\\${entry.name}`, "NWCTXT"],
    });
    const output = await command.output();
    if (!output.success) {
      const stderr = new TextDecoder().decode(output.stderr);
      throw new Error(`nwc-conv failed for ${entry.name}: ${stderr}`);
    }

    await Deno.writeTextFile(nwctxtPath, decodeNwcText(output.stdout));
  }
}

await Deno.mkdir(targetDir, { recursive: true });
await convertNwcToNwcTxt();

const list = [];
for await (const entry of Deno.readDir(samplesDir)) {
  if (entry.name.endsWith(".nwctxt")) {
    list.push(entry.name.substring(0, entry.name.length - 7));
  }
}

for (const fileName of list) {
  console.log("Processing", fileName);
  const source = await Deno.readTextFile(`${samplesDir}\\${fileName}.nwctxt`);
  try {
    await Deno.writeTextFile(
      `.\\${targetDir}\\${fileName}.json`,
      JSON.stringify(scan(source), null, 2),
    );
    await Deno.writeTextFile(
      `.\\${targetDir}\\${fileName}.xml`,
      new Transformer().transform(source),
    );
  } catch (e) {
    console.error("Something went wrong", fileName, e);
  }
}
