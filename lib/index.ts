import JSZip from "jszip"
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  type Object3D,
} from "three"

export interface DrillGuideOptions {
  baseWidthMm?: number
  baseHeightMm?: number
  baseThicknessMm?: number
  pillarDiameterMm?: number
  pillarHeightMm?: number
  pillarCenterInsetMm?: number
  holeSegments?: number
}

export interface DrillHole {
  id: string
  type: "pcb_hole" | "pcb_plated_hole" | "pcb_via"
  x: number
  y: number
  diameterMm: number
}

export interface DrillGuideStats {
  holes: DrillHole[]
  baseWidthMm: number
  baseHeightMm: number
  baseThicknessMm: number
  pillarCount: number
  triangleCount: number
}

export interface DrillGuideBuild {
  group: Group
  stats: DrillGuideStats
}

type CircuitElement = Record<string, unknown>

const defaultOptions = {
  baseWidthMm: 100,
  baseHeightMm: 70,
  baseThicknessMm: 3,
  pillarDiameterMm: 1,
  pillarHeightMm: 3,
  pillarCenterInsetMm: 6,
  holeSegments: 48,
} satisfies Required<DrillGuideOptions>

const guideMaterial = new MeshStandardMaterial({
  color: 0xb9c8cf,
  roughness: 0.62,
  metalness: 0.05,
  side: DoubleSide,
})

const pillarMaterial = new MeshStandardMaterial({
  color: 0x63899d,
  roughness: 0.56,
  metalness: 0.08,
  side: DoubleSide,
})

export const getDrillGuideOptions = (
  options: DrillGuideOptions = {},
): Required<DrillGuideOptions> => ({
  ...defaultOptions,
  ...options,
})

export const extractDrillHoles = (circuitJson: unknown[]): DrillHole[] => {
  const holes: DrillHole[] = []

  for (const element of circuitJson as CircuitElement[]) {
    if (
      element.type !== "pcb_hole" &&
      element.type !== "pcb_plated_hole" &&
      element.type !== "pcb_via"
    ) {
      continue
    }

    const x = readNumber(element.x) ?? readNestedNumber(element, "center", "x")
    const y = readNumber(element.y) ?? readNestedNumber(element, "center", "y")
    const radius = readNumber(element.radius)
    const diameterMm =
      readNumber(element.hole_diameter) ??
      readNumber(element.diameter) ??
      readNumber(element.drill_diameter) ??
      (radius === undefined ? undefined : radius * 2)

    if (x === undefined || y === undefined || diameterMm === undefined) continue
    if (!Number.isFinite(x) || !Number.isFinite(y) || diameterMm <= 0) continue

    holes.push({
      id:
        readString(element.pcb_hole_id) ??
        readString(element.pcb_plated_hole_id) ??
        readString(element.pcb_via_id) ??
        `${element.type}_${holes.length}`,
      type: element.type,
      x,
      y,
      diameterMm,
    })
  }

  return holes
}

export const createDrillGuide = (
  circuitJson: unknown[],
  options: DrillGuideOptions = {},
): DrillGuideBuild => {
  const resolvedOptions = getDrillGuideOptions(options)
  const holes = extractDrillHoles(circuitJson).filter((hole) =>
    isHoleInsideBase(hole, resolvedOptions),
  )
  const group = new Group()
  group.name = "via-drill-guide"

  const base = new Mesh(
    createBaseGeometry(holes, resolvedOptions),
    guideMaterial,
  )
  base.name = "drill-guide-base"
  group.add(base)

  for (const position of getPillarPositions(resolvedOptions)) {
    const pillar = new Mesh(
      createPillarGeometry(resolvedOptions),
      pillarMaterial,
    )
    pillar.name = "bottom-locating-pillar"
    pillar.position.set(
      position.x,
      position.y,
      -resolvedOptions.pillarHeightMm / 2,
    )
    group.add(pillar)
  }

  return {
    group,
    stats: {
      holes,
      baseWidthMm: resolvedOptions.baseWidthMm,
      baseHeightMm: resolvedOptions.baseHeightMm,
      baseThicknessMm: resolvedOptions.baseThicknessMm,
      pillarCount: 4,
      triangleCount: countGroupTriangles(group),
    },
  }
}

export const createDrillGuide3MfBlob = async (
  circuitJson: unknown[],
  options: DrillGuideOptions = {},
): Promise<Blob> => {
  const { group } = createDrillGuide(circuitJson, options)
  group.rotation.set(0, 0, 0)
  group.updateMatrixWorld(true)

  const meshData = collectMeshData(group)
  const modelXml = createModelXml(meshData)
  const zip = new JSZip()
  zip.file("[Content_Types].xml", createContentTypesXml())
  zip.folder("_rels")?.file(".rels", createRelationshipsXml())
  zip.folder("3D")?.file("3dmodel.model", modelXml)

  return await zip.generateAsync({
    type: "blob",
    mimeType: "model/3mf",
    compression: "DEFLATE",
  })
}

export const generateViaDrillGuide = extractDrillHoles

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

const readNestedNumber = (
  element: CircuitElement,
  objectKey: string,
  numberKey: string,
): number | undefined => {
  const child = element[objectKey]
  if (!child || typeof child !== "object") return undefined
  return readNumber((child as CircuitElement)[numberKey])
}

const isHoleInsideBase = (
  hole: DrillHole,
  options: Required<DrillGuideOptions>,
): boolean => {
  const radius = hole.diameterMm / 2
  return (
    hole.x - radius >= -options.baseWidthMm / 2 &&
    hole.x + radius <= options.baseWidthMm / 2 &&
    hole.y - radius >= -options.baseHeightMm / 2 &&
    hole.y + radius <= options.baseHeightMm / 2
  )
}

const createBaseGeometry = (
  holes: DrillHole[],
  options: Required<DrillGuideOptions>,
): BufferGeometry => {
  const width = options.baseWidthMm
  const height = options.baseHeightMm
  const shape = new Shape()

  shape.moveTo(-width / 2, -height / 2)
  shape.lineTo(width / 2, -height / 2)
  shape.lineTo(width / 2, height / 2)
  shape.lineTo(-width / 2, height / 2)
  shape.lineTo(-width / 2, -height / 2)

  for (const hole of holes) {
    const path = new Path()
    path.absellipse(
      hole.x,
      hole.y,
      hole.diameterMm / 2,
      hole.diameterMm / 2,
      0,
      Math.PI * 2,
      true,
    )
    shape.holes.push(path)
  }

  return toNonIndexedGeometry(
    new ExtrudeGeometry(shape, {
      depth: options.baseThicknessMm,
      bevelEnabled: false,
      steps: 1,
      curveSegments: options.holeSegments,
    }),
  )
}

const createPillarGeometry = (
  options: Required<DrillGuideOptions>,
): BufferGeometry => {
  const geometry = new CylinderGeometry(
    options.pillarDiameterMm / 2,
    options.pillarDiameterMm / 2,
    options.pillarHeightMm,
    48,
  )
  geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2))
  return toNonIndexedGeometry(geometry)
}

const getPillarPositions = (options: Required<DrillGuideOptions>) => {
  const x = options.baseWidthMm / 2 - options.pillarCenterInsetMm
  const y = options.baseHeightMm / 2 - options.pillarCenterInsetMm

  return [
    { x: -x, y: -y },
    { x, y: -y },
    { x, y },
    { x: -x, y },
  ]
}

const countGroupTriangles = (group: Group): number => {
  let triangleCount = 0

  group.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const geometry = toNonIndexedGeometry(mesh.geometry)
    const position = geometry.attributes.position
    if (!position) return
    triangleCount += position.count / 3
  })

  return triangleCount
}

interface MeshData {
  vertices: Array<[number, number, number]>
  triangles: Array<[number, number, number]>
}

const collectMeshData = (root: Object3D): MeshData => {
  const vertices: Array<[number, number, number]> = []
  const triangles: Array<[number, number, number]> = []

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    const geometry = toNonIndexedGeometry(mesh.geometry)
    const position = geometry.attributes.position
    if (!position) return
    const startIndex = vertices.length

    for (let index = 0; index < position.count; index += 1) {
      const vertex = [
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      ]
      const transformed = vertex as [number, number, number]
      const x =
        mesh.matrixWorld.elements[0] * transformed[0] +
        mesh.matrixWorld.elements[4] * transformed[1] +
        mesh.matrixWorld.elements[8] * transformed[2] +
        mesh.matrixWorld.elements[12]
      const y =
        mesh.matrixWorld.elements[1] * transformed[0] +
        mesh.matrixWorld.elements[5] * transformed[1] +
        mesh.matrixWorld.elements[9] * transformed[2] +
        mesh.matrixWorld.elements[13]
      const z =
        mesh.matrixWorld.elements[2] * transformed[0] +
        mesh.matrixWorld.elements[6] * transformed[1] +
        mesh.matrixWorld.elements[10] * transformed[2] +
        mesh.matrixWorld.elements[14]
      vertices.push([round(x), round(y), round(z)])
    }

    for (let index = 0; index < position.count; index += 3) {
      triangles.push([
        startIndex + index,
        startIndex + index + 1,
        startIndex + index + 2,
      ])
    }
  })

  return { vertices, triangles }
}

const round = (value: number): number => Number(value.toFixed(5))

const toNonIndexedGeometry = (geometry: BufferGeometry): BufferGeometry =>
  geometry.index ? geometry.toNonIndexed() : geometry

const createModelXml = ({ vertices, triangles }: MeshData): string => {
  const vertexXml = vertices
    .map(
      ([x, y, z]) =>
        `<vertex x="${escapeXml(String(x))}" y="${escapeXml(String(y))}" z="${escapeXml(String(z))}"/>`,
    )
    .join("")
  const triangleXml = triangles
    .map(([v1, v2, v3]) => `<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`)
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Via Drill Guide</metadata>
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${vertexXml}</vertices>
        <triangles>${triangleXml}</triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`
}

const createContentTypesXml =
  (): string => `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const createRelationshipsXml =
  (): string => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
