import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Pyth } from "../pythagorean.ts";
import { pitchFromPyth } from "./elements.ts";

Deno.test(function testPythToPitch() {
  assertEquals(
    pitchFromPyth(new Pyth(0, 0)).toString(),
    "<pitch><octave>4</octave><step>C</step></pitch>",
  );
  assertEquals(
    pitchFromPyth(new Pyth(2, 1)).toString(),
    "<pitch><octave>4</octave><step>F</step></pitch>",
  );
  assertEquals(
    pitchFromPyth(new Pyth(3, 0)).toString(),
    "<pitch><octave>4</octave><step>F</step><alter>1</alter></pitch>",
  );
  assertEquals(
    pitchFromPyth(new Pyth(4, 2)).toString(),
    "<pitch><octave>4</octave><step>B</step><alter>-1</alter></pitch>",
  );
  assertEquals(
    pitchFromPyth(new Pyth(5, 2)).toString(),
    "<pitch><octave>5</octave><step>C</step></pitch>",
  );
});
