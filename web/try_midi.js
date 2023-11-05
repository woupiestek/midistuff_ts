// deno-lint-ignore-file
async function checkAudio() {
  try {
    const access = await navigator.requestMIDIAccess();
    console.log("access:", access);
    const context = new AudioContext();
    console.log(context);
  } catch (e) {
    console.error(e);
  }
}
