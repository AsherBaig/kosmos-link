import { useParams } from 'react-router-dom'

export default function Viewer() {
  const { id } = useParams()
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">3D Viewer</h1>
      <p className="text-gray-400">Viewing scan: {id}</p>
      <div className="bg-gray-900 rounded-xl h-96 flex items-center justify-center mt-4">
        <p className="text-gray-600">3D Viewer will load here</p>
      </div>
    </div>
  )
}
