import { useEffect, useRef } from "react"
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { createDrillGuide } from "lib/index"

export const GuideViewer = ({ circuitJson }: { circuitJson: unknown[] }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new Scene()
    scene.background = new Color("#f8fafc")

    const camera = new PerspectiveCamera(38, 1, 0.1, 1000)
    camera.position.set(92, -96, 78)

    const renderer = new WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.append(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const guide =
      circuitJson.length > 0 ? createDrillGuide(circuitJson).group : null
    if (guide) scene.add(guide)

    const ambient = new AmbientLight("#ffffff", 1.9)
    const keyLight = new DirectionalLight("#ffffff", 2.1)
    keyLight.position.set(20, -40, 65)
    const fillLight = new DirectionalLight("#b9e5ff", 0.8)
    fillLight.position.set(-60, 35, 35)
    scene.add(ambient, keyLight, fillLight)

    if (guide) {
      const bounds = new Box3().setFromObject(guide)
      const center = new Vector3()
      bounds.getCenter(center)
      controls.target.copy(center)
    }

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    let animationFrame = 0
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [circuitJson])

  return <div ref={containerRef} className="guide-viewer" />
}
