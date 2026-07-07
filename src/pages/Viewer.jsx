import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Comments from '../components/Comments'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark'

const SPLAT_TYPES = ['ply', 'sog', 'splat', 'spz', 'ksplat']

// Copy the WebGL canvas into a downscaled 2D canvas and return a JPEG blob.
// MUST be called synchronously right after renderer.render() so the drawing
// buffer still holds the rendered frame (works reliably for splats too).
function grabThumbnailBlob(renderer) {
  const source = renderer.domElement
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 225
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
}

// Upload the captured blob and store its URL as this asset's thumbnail.
async function uploadThumbnail(blob, asset) {
  try {
    if (!blob) return
    const path = `${asset.user_id}/thumb_${asset.id}_${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('assets')
      .upload(path, blob, { contentType: 'image/jpeg' })
    if (upErr) {
      console.error('Thumbnail upload failed:', upErr)
      return
    }
    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(path)
    await supabase.from('assets').update({ thumbnail_url: publicUrl }).eq('id', asset.id)
  } catch (err) {
    console.error('uploadThumbnail error:', err)
  }
}

export default function Viewer() {
  const { id } = useParams()
  const { user } = useAuth()
  const mountRef = useRef(null)

  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sceneLoading, setSceneLoading] = useState(true)

  // Spatial annotations
  const [annotations, setAnnotations] = useState([])
  const [annotateMode, setAnnotateMode] = useState(false)
  const [pendingPoint, setPendingPoint] = useState(null) // {x,y,z} awaiting text
  const [pendingText, setPendingText] = useState('')
  const [selected, setSelected] = useState(null) // annotation clicked to view

  // THREE refs shared between the render effect and click handling
  const modelRef = useRef(null)          // raycast target (GLB model)
  const splatRef = useRef(null)          // raycast target (Gaussian splat)
  const markerGroupRef = useRef(null)    // THREE.Group holding annotation pins
  const markerRadiusRef = useRef(0.05)   // pin size, scaled to the model
  const annotateModeRef = useRef(false)
  const annotationsRef = useRef([])

  // Keep refs in sync so the (long-lived) click handler reads current values
  useEffect(() => { annotateModeRef.current = annotateMode }, [annotateMode])
  useEffect(() => { annotationsRef.current = annotations }, [annotations])

  useEffect(() => {
    fetchAsset()
    fetchAnnotations()
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

  const fetchAnnotations = async () => {
    const { data, error } = await supabase
      .from('annotations')
      .select('*')
      .eq('asset_id', id)
      .order('created_at', { ascending: true })
    if (!error) setAnnotations(data)
  }

  const savePendingAnnotation = async () => {
    if (!pendingPoint || !pendingText.trim()) return
    const { data, error } = await supabase
      .from('annotations')
      .insert({
        asset_id: id,
        user_id: user.id,
        author_email: user.email,
        x: pendingPoint.x,
        y: pendingPoint.y,
        z: pendingPoint.z,
        body: pendingText.trim(),
      })
      .select()
      .single()

    if (!error && data) {
      setAnnotations((prev) => [...prev, data])
      setPendingPoint(null)
      setPendingText('')
    }
  }

  const deleteAnnotation = async (annId) => {
    await supabase.from('annotations').delete().eq('id', annId)
    setAnnotations((prev) => prev.filter((a) => a.id !== annId))
    setSelected(null)
  }

  // --- Scene setup (runs when the asset is loaded) ---
  useEffect(() => {
    if (!asset || !mountRef.current) return

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 1, 3)

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)

    // Group that holds all annotation pins
    const markerGroup = new THREE.Group()
    scene.add(markerGroup)
    markerGroupRef.current = markerGroup

    let captureAt = 0
    const maybeCaptureThumbnail = (delay = 800) => {
      if (user?.id === asset.user_id && !asset.thumbnail_url) {
        captureAt = performance.now() + delay
      }
    }

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const ambientLight = new THREE.AmbientLight(0xffffff, 1)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(asset.file_path)

    let splatMesh = null

    if (asset.file_type === 'glb') {
      const loader = new GLTFLoader()
      loader.load(
        publicUrl,
        (gltf) => {
          const model = gltf.scene
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          model.position.sub(center)
          scene.add(model)
          modelRef.current = model
          // Scale pin size to the model so pins are always visible
          const size = box.getSize(new THREE.Vector3()).length()
          markerRadiusRef.current = Math.max(size * 0.02, 0.01)
          refreshMarkers()
          setSceneLoading(false)
          maybeCaptureThumbnail()
        },
        undefined,
        (err) => {
          console.error('GLTFLoader error:', err)
          setError('Failed to load 3D model')
          setSceneLoading(false)
        }
      )
    } else if (SPLAT_TYPES.includes(asset.file_type)) {
      const spark = new SparkRenderer({ renderer })
      scene.add(spark)

      // raycastable enables click-to-annotate on the splat point cloud
      splatMesh = new SplatMesh({ url: publicUrl, raycastable: true })
      splatMesh.quaternion.set(1, 0, 0, 0)
      splatMesh.position.set(0, 0, 0)
      scene.add(splatMesh)

      splatMesh.initialized
        .then(() => {
          splatRef.current = splatMesh
          const box = splatMesh.getBoundingBox?.() || new THREE.Box3().setFromObject(splatMesh)
          const size = box.getSize(new THREE.Vector3()).length()
          markerRadiusRef.current = Math.max(size * 0.015, 0.02)
          refreshMarkers()
          setSceneLoading(false)
          maybeCaptureThumbnail(2500)
        })
        .catch((err) => {
          console.error('SplatMesh error:', err)
          setError('Failed to load Gaussian Splat')
          setSceneLoading(false)
        })
    } else {
      setError('Unsupported file type: ' + asset.file_type)
      setSceneLoading(false)
    }

    // --- Raycasting: add pins in annotate mode, view pins otherwise ---
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downX = 0, downY = 0

    const onPointerDown = (e) => { downX = e.clientX; downY = e.clientY }

    const onPointerUp = (e) => {
      // Ignore drags (camera orbit); only treat near-stationary clicks
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) return

      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)

      const target = modelRef.current || splatRef.current
      if (annotateModeRef.current && target) {
        // Place a new annotation at the clicked point on the model/splat
        const hits = raycaster.intersectObject(target, true)
        if (hits.length > 0) {
          const p = hits[0].point
          setPendingPoint({ x: p.x, y: p.y, z: p.z })
        }
      } else {
        // View an existing annotation by clicking its pin
        const hits = raycaster.intersectObjects(markerGroup.children, false)
        if (hits.length > 0) {
          const annId = hits[0].object.userData.annotationId
          const ann = annotationsRef.current.find((a) => a.id === annId)
          if (ann) setSelected(ann)
        }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    let frameId
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      if (captureAt && performance.now() >= captureAt) {
        captureAt = 0
        grabThumbnailBlob(renderer).then((blob) => uploadThumbnail(blob, asset))
      }
    }
    animate()

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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      if (splatMesh) splatMesh.dispose?.()
      controls.dispose()
      renderer.dispose()
      modelRef.current = null
      splatRef.current = null
      markerGroupRef.current = null
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [asset])

  // Rebuild the annotation pins whenever the annotation list changes
  useEffect(() => {
    refreshMarkers()
  }, [annotations])

  // Draw a sphere pin for each annotation into the marker group
  const refreshMarkers = () => {
    const group = markerGroupRef.current
    if (!group) return
    while (group.children.length) group.remove(group.children[0])

    const geo = new THREE.SphereGeometry(markerRadiusRef.current, 16, 16)
    const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    annotationsRef.current.forEach((a) => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(a.x, a.y, a.z)
      mesh.userData.annotationId = a.id
      group.add(mesh)
    })
  }

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

      {/* Annotate toolbar (GLB + Splat) */}
      {user && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => { setAnnotateMode(!annotateMode); setPendingPoint(null); setSelected(null) }}
            className={`text-sm px-4 py-2 rounded-lg transition font-medium ${
              annotateMode ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            {annotateMode ? '📍 Annotating — click on the model' : '📍 Add Annotation'}
          </button>
          {annotations.length > 0 && (
            <span className="text-gray-500 text-sm">{annotations.length} annotation(s)</span>
          )}
        </div>
      )}

      <div className="relative w-full rounded-xl overflow-hidden" style={{ height: '70vh' }}>
        <div ref={mountRef} className="w-full h-full" />
        {sceneLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/60 pointer-events-none">
            <p className="text-gray-300 text-sm animate-pulse">Loading 3D scene…</p>
          </div>
        )}

        {/* New annotation input */}
        {pendingPoint && (
          <div className="absolute top-4 left-4 bg-gray-900 border border-gray-700 rounded-lg p-4 w-72 shadow-xl">
            <p className="text-white text-sm font-medium mb-2">New annotation</p>
            <textarea
              autoFocus
              value={pendingText}
              onChange={(e) => setPendingText(e.target.value)}
              placeholder="Describe this point..."
              rows={3}
              className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-amber-500 resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={savePendingAnnotation}
                disabled={!pendingText.trim()}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm py-1.5 rounded"
              >
                Save
              </button>
              <button
                onClick={() => { setPendingPoint(null); setPendingText('') }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-1.5 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Selected annotation popup */}
        {selected && (
          <div className="absolute top-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 w-72 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-amber-400 text-sm font-medium">{selected.author_email || 'Anonymous'}</span>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
            </div>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{selected.body}</p>
            {user?.id === selected.user_id && (
              <button
                onClick={() => deleteAnnotation(selected.id)}
                className="text-red-400 hover:text-red-300 text-xs mt-2"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-gray-600 text-xs text-center mt-2">
        {annotateMode ? 'Click on the model to drop a pin' : 'Left click to rotate • Scroll to zoom • Right click to pan • Click a pin to read it'}
      </p>

      <Comments assetId={id} />
    </div>
  )
}
