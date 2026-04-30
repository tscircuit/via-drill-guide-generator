import { expect, test } from "bun:test"
import { generateViaDrillGuide } from "lib/index"

test("generates an empty via drill guide by default", () => {
  expect(generateViaDrillGuide()).toEqual([])
})
