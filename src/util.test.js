import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { gcd } from "./util.ts";

Deno.test(function gdcDoesNotHang() {
  const expected = [
    60,
    1,
    2,
    3,
    4,
    5,
    6,
    1,
    4,
    3,
    10,
    1,
    12,
    1,
    2,
    15,
    4,
    1,
    6,
    1,
    20,
    3,
    2,
    1,
    12,
    5,
    2,
    3,
    4,
    1,
    30,
  ];
  for (let i = 0; i <= 30; i++) {
    assertEquals(gcd(60, i), expected[i]);
    assertEquals(gcd(60, -i), expected[i]);
    assertEquals(gcd(i, 60), expected[i]);
    assertEquals(gcd(-i, 60), expected[i]);
  }
});
