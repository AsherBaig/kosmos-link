import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export default function Viewer() {
  const { id } = useParams()
  const mountRef = useRef(null)
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    // Load GLB
    if (asset.file_type === 'glb') {
      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(asset.file_path)

      const loader = new GLTFLoader()
      loader.load(
        publicUrl,
        (gltf) => {
          const model = gltf.scene
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          model.position.sub(center)
          scene.add(model)
        },
        undefined,
        (err) => console.error('GLTFLoader error:', err)
      )
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
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
      window.removeEventListener('resize', handleResize)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
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

      <div
        ref={mountRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: '70vh' }}
      />

      <p className="text-gray-600 text-xs text-center mt-2">
        Left click to rotate • Scroll to zoom • Right click to pan
      </p>
    </div>
  )
}
