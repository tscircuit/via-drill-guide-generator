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

test("extracts pill, oval, and rect drills that only have hole_width/height", () => {
  const holes = extractDrillHoles([
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "usb_slot",
      shape: "pill",
      x: 5,
      y: -4,
      hole_width: 3.2,
      hole_height: 1.1,
      outer_width: 4,
      outer_height: 1.8,
      ccw_rotation: 90,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "oval_slot",
      hole_shape: "oval",
      x: -6,
      y: 2,
      hole_width: 2.4,
      hole_height: 1.2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "rect_cutout",
      hole_shape: "rect",
      x: 8,
      y: 8,
      hole_width: 2,
      hole_height: 1.5,
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "offset_circle",
      shape: "circular_hole_with_rect_pad",
      x: 1,
      y: 1,
      hole_diameter: 0.8,
      hole_offset_x: 0.2,
      hole_offset_y: -0.1,
    },
  ])

  expect(holes).toEqual([
    {
      id: "usb_slot",
      type: "pcb_plated_hole",
      x: 5,
      y: -4,
      diameterMm: 1.1,
      widthMm: 3.2,
      heightMm: 1.1,
      holeShape: "pill",
      rotationDeg: 90,
    },
    {
      id: "oval_slot",
      type: "pcb_hole",
      x: -6,
      y: 2,
      diameterMm: 1.2,
      widthMm: 2.4,
      heightMm: 1.2,
      holeShape: "oval",
    },
    {
      id: "rect_cutout",
      type: "pcb_hole",
      x: 8,
      y: 8,
      diameterMm: 1.5,
      widthMm: 2,
      heightMm: 1.5,
      holeShape: "rect",
    },
    {
      id: "offset_circle",
      type: "pcb_plated_hole",
      x: 1.2,
      y: 0.9,
      diameterMm: 0.8,
    },
  ])
})

test("cuts a pill plated hole as a single manifold body", async () => {
  const circuitJson = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "usb_slot",
      shape: "pill",
      x: 0,
      y: 0,
      hole_width: 3.2,
      hole_height: 1.1,
    },
  ]
  const meshData = await createSingleBodyMeshData(circuitJson)

  expect(meshData.vertices.length).toBeGreaterThan(0)
  expect(meshData.triangles.length).toBeGreaterThan(0)
  expect(Math.min(...meshData.vertices.map((vertex) => vertex[2]))).toBe(-1.6)
  expect(Math.max(...meshData.vertices.map((vertex) => vertex[2]))).toBe(3)
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
  expect(options.pillarHeightMm).toBe(1.6)
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
  expect(Math.min(...meshData.vertices.map((vertex) => vertex[2]))).toBe(-1.6)
  expect(Math.max(...meshData.vertices.map((vertex) => vertex[2]))).toBe(3)

  const blob = await createDrillGuide3MfBlob(circuitJson)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const modelXml = await zip.file("3D/3dmodel.model")?.async("string")

  expect(modelXml).toContain('<object id="1" type="model">')
  expect(modelXml?.match(/<object /g)).toHaveLength(1)
  expect(modelXml?.match(/<item /g)).toHaveLength(1)
})
