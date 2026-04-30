import { expect, test } from "bun:test"
import {
  createDrillGuide,
  extractDrillHoles,
  getDrillGuideOptions,
} from "lib/index"

test("extracts drill holes from vias, pcb holes, and plated holes", () => {
  const holes = extractDrillHoles([
    {
      type: "pcb_via",
      pcb_via_id: "via_1",
      x: 4,
      y: -2,
      hole_diameter: 1.5,
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_hole_1",
      x: -3,
      y: 1,
      hole_diameter: 1.016,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_1",
      x: 0,
      y: 3,
      diameter: 2,
    },
    {
      type: "pcb_smtpad",
      x: 0,
      y: 0,
      width: 1,
    },
  ])

  expect(holes).toEqual([
    {
      id: "via_1",
      type: "pcb_via",
      x: 4,
      y: -2,
      diameterMm: 1.5,
    },
    {
      id: "plated_hole_1",
      type: "pcb_plated_hole",
      x: -3,
      y: 1,
      diameterMm: 1.016,
    },
    {
      id: "hole_1",
      type: "pcb_hole",
      x: 0,
      y: 3,
      diameterMm: 2,
    },
  ])
})

test("builds the requested base with four bottom pillars", () => {
  const guide = createDrillGuide([
    {
      type: "pcb_via",
      x: 0,
      y: 0,
      hole_diameter: 1,
    },
  ])
  const options = getDrillGuideOptions()

  expect(guide.stats.baseWidthMm).toBe(100)
  expect(guide.stats.baseHeightMm).toBe(70)
  expect(guide.stats.baseThicknessMm).toBe(3)
  expect(guide.stats.pillarCount).toBe(4)
  expect(options.pillarDiameterMm).toBe(1)
  expect(options.pillarCenterInsetMm).toBe(6)
  expect(guide.stats.holes).toHaveLength(1)
  expect(guide.stats.triangleCount).toBeGreaterThan(0)
})
