import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark'

const SPLAT_TYPES = ['ply', 'sog', 'splat', 'spz', 'ksplat']

export default function Viewer() {
  const { id } = useParams()
  const mountRef = useRef(null)
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sceneLoading, setSceneLoading] = useState(true)

  useEffect(() => {
    fetchAsset()
  }, [id])

  const fetchAsset = async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      setError('Scan not found')
      setLoading(false)
      return
    }

    setAsset(data)
    setLoading(false)
  }

  useEffect(() => {
    if (!asset || !mountRef.current) return

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 1, 3)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Lighting (for GLB models)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    // Resolve the file's public URL
    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(asset.file_path)

    let splatMesh = null

    if (asset.file_type === 'glb') {
      // ---- 3D model (GLB) ----
      const loader = new GLTFLoader()
      loader.load(
        publicUrl,
        (gltf) => {
          const model = gltf.scene
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          model.position.sub(center)
          scene.add(model)
          setSceneLoading(false)
        },
        undefined,
        (err) => {
          console.error('GLTFLoader error:', err)
          setError('Failed to load 3D model')
          setSceneLoading(false)
        }
      )
    } else if (SPLAT_TYPES.includes(asset.file_type)) {
      // ---- Gaussian Splat (.ply / .sog / .splat) via SparkJS ----
      // SparkRenderer is required to draw splats; add it to the scene.
      const spark = new SparkRenderer({ renderer })
      scene.add(spark)

      splatMesh = new SplatMesh({ url: publicUrl })
      // Splats are usually Y-down; rotate 180° around X to view upright
      splatMesh.quaternion.set(1, 0, 0, 0)
      splatMesh.position.set(0, 0, 0)
      scene.add(splatMesh)

      splatMesh.initialized
        .then(() => setSceneLoading(false))
        .catch((err) => {
          console.error('SplatMesh error:', err)
          setError('Failed to load Gaussian Splat')
          setSceneLoading(false)
        })
    } else {
      setError('Unsupported file type: ' + asset.file_type)
      setSceneLoading(false)
    }

    // Animation loop
    let frameId
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      if (splatMesh) splatMesh.dispose?.()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [asset])

  if (loading) return <div className="text-gray-400 text-center py-20">Loading...</div>
  if (error) return <div className="text-red-400 text-center py-20">{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">{asset?.name}</h1>
        <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded uppercase font-medium">
          {asset?.file_type}
        </span>
      </div>

      <div className="relative w-full rounded-xl overflow-hidden" style={{ height: '70vh' }}>
        <div ref={mountRef} className="w-full h-full" />
        {sceneLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/60 pointer-events-none">
            <p className="text-gray-300 text-sm animate-pulse">Loading 3D scene…</p>
          </div>
        )}
      </div>

      <p className="text-gray-600 text-xs text-center mt-2">
        Left click to rotate • Scroll to zoom • Right click to pan
      </p>
    </div>
  )
}
