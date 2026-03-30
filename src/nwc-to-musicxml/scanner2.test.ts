import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { scan } from "./scanner2.ts";
import { sample } from "./scanner2.testdata.ts";

Deno.test("just try something", () => {
  const result = scan(sample);
  console.log(result);
  assertEquals(result.values.Dur["4th"].size, 130);
});
