import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Download, FileJson, RefreshCw, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  createDrillGuide,
  createDrillGuide3MfBlob,
  extractDrillHoles,
  type DrillGuideStats,
} from "lib/index"
import { GuideViewer } from "./guide-viewer"

const sampleCircuitJsonUrl = "/sample-circuit.json"

export const App = () => {
  const [circuitJson, setCircuitJson] = useState<unknown[]>([])
  const [fileName, setFileName] = useState("sample circuit")
  const [status, setStatus] = useState("Loading sample...")
  const [isBusy, setIsBusy] = useState(false)

  const guide = useMemo(() => {
    if (circuitJson.length === 0) return null
    return createDrillGuide(circuitJson)
  }, [circuitJson])

  const pcbSvg = useMemo(() => {
    if (circuitJson.length === 0) return ""
    return convertCircuitJsonToPcbSvg(circuitJson as never[], {
      width: 900,
      height: 620,
      showSolderMask: true,
      shouldDrawErrors: false,
      backgroundColor: "#f8fafc",
    })
  }, [circuitJson])

  useEffect(() => {
    void loadSample()
  }, [])

  const loadSample = async () => {
    setIsBusy(true)
    setStatus("Loading sample...")

    try {
      const response = await fetch(sampleCircuitJsonUrl)
      if (!response.ok) {
        throw new Error(`Sample request failed with ${response.status}`)
      }
      const nextCircuitJson = await response.json()
      if (!Array.isArray(nextCircuitJson)) {
        throw new Error("Circuit JSON must be an array")
      }
      setCircuitJson(nextCircuitJson)
      setFileName("motor-controller-sheild-v1-0-2")
      setStatus("Ready")
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to load sample",
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    setIsBusy(true)
    setStatus("Reading upload...")

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        throw new Error("Circuit JSON must be an array")
      }
      setCircuitJson(parsed)
      setFileName(file.name.replace(/\.json$/i, ""))
      setStatus("Ready")
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to read upload",
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleDownload = async () => {
    if (circuitJson.length === 0) return
    setIsBusy(true)
    setStatus("Building 3MF...")

    try {
      const blob = await createDrillGuide3MfBlob(circuitJson)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${fileName || "via-drill-guide"}.3mf`
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus("Ready")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to build 3MF")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Via Drill Guide Generator</h1>
          <p>{fileName}</p>
        </div>
        <div className="toolbar" aria-label="Circuit JSON actions">
          <button type="button" onClick={loadSample} disabled={isBusy}>
            <RefreshCw size={17} aria-hidden="true" />
            <span>Sample</span>
          </button>
          <label className="button-like">
            <Upload size={17} aria-hidden="true" />
            <span>Upload</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleUpload(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isBusy || circuitJson.length === 0}
          >
            <Download size={17} aria-hidden="true" />
            <span>3MF</span>
          </button>
        </div>
      </header>

      <section className="metrics" aria-label="Guide measurements">
        <Metric label="Status" value={status} />
        <Metric label="Base" value={formatBase(guide?.stats)} />
        <Metric label="Pillars" value="4 x 1 mm" />
        <Metric
          label="Drill Holes"
          value={String(guide?.stats.holes.length ?? 0)}
        />
        <Metric
          label="Triangles"
          value={String(guide?.stats.triangleCount ?? 0)}
        />
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <FileJson size={18} aria-hidden="true" />
            <h2>Circuit</h2>
            <span>{extractDrillHoles(circuitJson).length} projected</span>
          </div>
          <div
            className="svg-preview"
            dangerouslySetInnerHTML={{ __html: pcbSvg }}
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <Download size={18} aria-hidden="true" />
            <h2>Guide</h2>
            <span>100 x 70 x 3 mm</span>
          </div>
          <GuideViewer circuitJson={circuitJson} />
        </div>
      </section>
    </main>
  )
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const formatBase = (stats: DrillGuideStats | undefined): string => {
  if (!stats) return "100 x 70 x 3 mm"
  return `${stats.baseWidthMm} x ${stats.baseHeightMm} x ${stats.baseThicknessMm} mm`
}
