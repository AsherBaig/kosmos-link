import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark'

const SPLAT_TYPES = ['ply', 'sog', 'splat', 'spz', 'ksplat']

export default function Compose() {
  const { user } = useAuth()
  const mountRef = useRef(null)

  const [myScans, setMyScans] = useState([])
  const [items, setItems] = useState([])          // { instanceId, asset }
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('translate')
  const [compositions, setCompositions] = useState([])

  // THREE refs (created once)
  const sceneRef = useRef(null)
  const transformRef = useRef(null)
  const objectMapRef = useRef(new Map())          // instanceId -> THREE.Group
  const loaderRef = useRef(null)

  useEffect(() => {
    supabase
      .from('assets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyScans(data || []))
    fetchCompositions()
  }, [user])

  const fetchCompositions = async () => {
    const { data } = await supabase
      .from('compositions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setCompositions(data || [])
  }

  // --- One-time scene setup ---
  useEffect(() => {
    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(0, 2, 6)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)

    // Splats need a SparkRenderer in the scene
    scene.add(new SparkRenderer({ renderer }))

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true

    scene.add(new THREE.AmbientLight(0xffffff, 1))
    const dir = new THREE.DirectionalLight(0xffffff, 2)
    dir.position.set(5, 5, 5)
    scene.add(dir)
    scene.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b))

    // Move/rotate/scale gizmo
    const transform = new TransformControls(camera, renderer.domElement)
    transform.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value })
    const helper = transform.getHelper ? transform.getHelper() : transform
    scene.add(helper)
    transformRef.current = transform

    loaderRef.current = new GLTFLoader()

    renderer.setAnimationLoop(() => {
      orbit.update()
      renderer.render(scene, camera)
    })

    const handleResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', handleResize)
      transform.dispose()
      orbit.dispose()
      renderer.dispose()
      objectMapRef.current.clear()
      sceneRef.current = null
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  // Keep gizmo mode in sync
  useEffect(() => {
    transformRef.current?.setMode(mode)
  }, [mode])

  // Attach gizmo to the selected object
  useEffect(() => {
    const transform = transformRef.current
    if (!transform) return
    const obj = selectedId ? objectMapRef.current.get(selectedId) : null
    if (obj) transform.attach(obj)
    else transform.detach()
  }, [selectedId, items])

  // Load one asset into the scene at an optional transform; returns the item
  const spawnAsset = (asset, transform) => {
    const scene = sceneRef.current
    if (!scene) return null

    const instanceId = `${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const group = new THREE.Group()
    if (transform) {
      group.position.fromArray(transform.position)
      group.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2])
      group.scale.fromArray(transform.scale)
    }
    scene.add(group)
    objectMapRef.current.set(instanceId, group)

    const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(asset.file_path)

    if (asset.file_type === 'glb') {
      loaderRef.current.load(publicUrl, (gltf) => {
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        model.position.sub(box.getCenter(new THREE.Vector3()))
        group.add(model)
      })
    } else if (SPLAT_TYPES.includes(asset.file_type)) {
      const splat = new SplatMesh({ url: publicUrl })
      splat.quaternion.set(1, 0, 0, 0)
      group.add(splat)
    }

    return { instanceId, asset }
  }

  const addScan = (asset) => {
    const item = spawnAsset(asset, {
      position: [items.length * 2.5, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    })
    if (!item) return
    setItems((prev) => [...prev, item])
    setSelectedId(item.instanceId)
  }

  const clearScene = () => {
    const scene = sceneRef.current
    transformRef.current?.detach()
    objectMapRef.current.forEach((group) => scene?.remove(group))
    objectMapRef.current.clear()
    setItems([])
    setSelectedId(null)
  }

  const saveComposition = async () => {
    if (items.length === 0) return
    const name = window.prompt('Name this scene:')
    if (!name) return
    const data = items.map(({ asset, instanceId }) => {
      const g = objectMapRef.current.get(instanceId)
      return {
        asset_id: asset.id,
        position: g.position.toArray(),
        rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
        scale: g.scale.toArray(),
      }
    })
    const { error } = await supabase.from('compositions').insert({ user_id: user.id, name, data })
    if (error) { alert('Save failed: ' + error.message); return }
    fetchCompositions()
  }

  const loadComposition = (comp) => {
    clearScene()
    const newItems = []
    comp.data.forEach((entry) => {
      const asset = myScans.find((a) => a.id === entry.asset_id)
      if (!asset) return
      const item = spawnAsset(asset, {
        position: entry.position,
        rotation: entry.rotation,
        scale: entry.scale,
      })
      if (item) newItems.push(item)
    })
    setItems(newItems)
  }

  const deleteComposition = async (id) => {
    await supabase.from('compositions').delete().eq('id', id)
    setCompositions((prev) => prev.filter((c) => c.id !== id))
  }

  const removeItem = (instanceId) => {
    const scene = sceneRef.current
    const group = objectMapRef.current.get(instanceId)
    if (group && scene) {
      transformRef.current?.detach()
      scene.remove(group)
    }
    objectMapRef.current.delete(instanceId)
    setItems((prev) => prev.filter((i) => i.instanceId !== instanceId))
    if (selectedId === instanceId) setSelectedId(null)
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-1">Compose Scene</h1>
        <p className="text-gray-400 text-sm">Combine multiple scans in one scene and arrange them.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Pick scans */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <h3 className="text-white text-sm font-medium mb-2">Your scans</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {myScans.map((a) => (
                <button
                  key={a.id}
                  onClick={() => addScan(a)}
                  className="w-full flex items-center justify-between text-left text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded"
                >
                  <span className="truncate">{a.name}</span>
                  <span className="text-blue-400 text-xs ml-2">+ add</span>
                </button>
              ))}
              {myScans.length === 0 && <p className="text-gray-500 text-xs">No scans yet.</p>}
            </div>
          </div>

          {/* In scene */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <h3 className="text-white text-sm font-medium mb-2">In scene ({items.length})</h3>
            <div className="space-y-1">
              {items.map(({ instanceId, asset }) => (
                <div
                  key={instanceId}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded cursor-pointer ${
                    selectedId === instanceId ? 'bg-blue-900 text-blue-200' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                  }`}
                  onClick={() => setSelectedId(instanceId)}
                >
                  <span className="truncate">{asset.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeItem(instanceId) }}
                    className="text-red-400 hover:text-red-300 text-xs ml-2"
                  >
                    remove
                  </button>
                </div>
              ))}
              {items.length === 0 && <p className="text-gray-500 text-xs">Add scans to begin.</p>}
            </div>
          </div>

          {/* Gizmo mode */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <h3 className="text-white text-sm font-medium mb-2">Transform</h3>
            <div className="flex gap-2">
              {['translate', 'rotate', 'scale'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 text-xs py-2 rounded capitalize ${
                    mode === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-2">Select an item, then drag the gizmo.</p>
          </div>

          {/* Save / load scenes */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white text-sm font-medium">Saved scenes</h3>
              <button
                onClick={saveComposition}
                disabled={items.length === 0}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1 rounded"
              >
                Save
              </button>
            </div>
            <div className="space-y-1">
              {compositions.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm bg-gray-800 px-3 py-2 rounded">
                  <button onClick={() => loadComposition(c)} className="truncate text-gray-200 hover:text-blue-400 text-left flex-1">
                    {c.name}
                  </button>
                  <button onClick={() => deleteComposition(c.id)} className="text-red-400 hover:text-red-300 text-xs ml-2">
                    del
                  </button>
                </div>
              ))}
              {compositions.length === 0 && <p className="text-gray-500 text-xs">No saved scenes yet.</p>}
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div className="lg:col-span-3">
          <div ref={mountRef} className="w-full rounded-xl overflow-hidden" style={{ height: '75vh' }} />
        </div>
      </div>
    </div>
  )
}
