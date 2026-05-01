import { expect, test } from "bun:test"
import {
  createDrillGuide,
  createDrillGuide3MfBlob,
  createSingleBodyMeshData,
  extractDrillHoles,
  getDrillGuideOptions,
} from "lib/index"
import JSZip from "jszip"

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
  expect(options.pillarDiameterMm).toBe(2.2)
  expect(options.pillarHeightMm).toBe(1)
  expect(options.pillarCenterInsetMm).toBe(6)
  expect(guide.stats.holes).toHaveLength(1)
  expect(guide.stats.triangleCount).toBeGreaterThan(0)
})

test("exports a single manifold body mesh for 3mf", async () => {
  const circuitJson = [
    {
      type: "pcb_via",
      x: 0,
      y: 0,
      hole_diameter: 1,
    },
  ]
  const meshData = await createSingleBodyMeshData(circuitJson)

  expect(meshData.vertices.length).toBeGreaterThan(0)
  expect(meshData.triangles.length).toBeGreaterThan(0)

  const blob = await createDrillGuide3MfBlob(circuitJson)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const modelXml = await zip.file("3D/3dmodel.model")?.async("string")

  expect(modelXml).toContain('<object id="1" type="model">')
  expect(modelXml?.match(/<object /g)).toHaveLength(1)
  expect(modelXml?.match(/<item /g)).toHaveLength(1)
})
