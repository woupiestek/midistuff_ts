// path from command line location!
const cert = await Deno.readTextFile(".\\cert\\localhost.crt");
const key = await Deno.readTextFile(".\\cert\\localhost.key");

Deno.serve(
  {
    port: 443,
    cert,
    key,
  },
  async (_req: Request) => {
    let path: string;
    let contentType: string;
    if (_req.url === "https://localhost/try_midi.js") {
      path = ".\\web\\try_midi.js";
      contentType = "text/javascript";
    } else {
      path = ".\\web\\index.html";
      contentType = "text/html";
    }
    return new Response(await Deno.readFile(path), {
      headers: {
        "content-type": contentType,
      },
    });
  },
);
