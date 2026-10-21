import { readFile } from "node:fs/promises";

const cert = await readFile("./cert/localhost.crt");
const key = await readFile("./cert/localhost.key");

Bun.serve({
  port: 443,
  tls: { cert, key },
  async fetch(_req: Request) {
    let path: string;
    let contentType: string;
    if (new URL(_req.url).pathname === "/try_midi.js") {
      path = "./web/try_midi.js";
      contentType = "text/javascript";
    } else {
      path = "./web/index.html";
      contentType = "text/html";
    }
    return new Response(await readFile(path), {
      headers: {
        "content-type": contentType,
      },
    });
  },
});
