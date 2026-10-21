import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { scan } from "./scanner.ts";
import { Transformer } from "./transformer.ts";

const execFileAsync = promisify(execFile);

const samplesDir = "samples";
const targetDir = "target";
const nwcConv =
  "C:\\Program Files (x86)\\Noteworthy Software\\NoteWorthy Composer 2\\nwc-conv.exe";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
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
  for (const name of await readdir(samplesDir)) {
    if (!name.endsWith(".nwc")) {
      continue;
    }

    const fileName = name.substring(0, name.length - 4);
    const nwctxtPath = join(samplesDir, `${fileName}.nwctxt`);
    if (await exists(nwctxtPath)) {
      continue;
    }

    const { stdout } = await execFileAsync(
      nwcConv,
      [join(samplesDir, name), "NWCTXT"],
      { encoding: "buffer" },
    );
    await writeFile(nwctxtPath, decodeNwcText(Buffer.from(stdout)));
  }
}

await mkdir(targetDir, { recursive: true });
await convertNwcToNwcTxt();

const list = [];
for (const name of await readdir(samplesDir)) {
  if (name.endsWith(".nwctxt")) {
    list.push(name.substring(0, name.length - 7));
  }
}

for (const fileName of list) {
  console.log("Processing", fileName);
  const source = await readFile(join(samplesDir, `${fileName}.nwctxt`), "utf8");
  try {
    await writeFile(
      join(targetDir, `${fileName}.json`),
      JSON.stringify(scan(source), null, 2),
    );
    await writeFile(
      join(targetDir, `${fileName}.xml`),
      new Transformer().transform(source),
    );
  } catch (e) {
    console.error("Something went wrong", fileName, e);
  }
}
