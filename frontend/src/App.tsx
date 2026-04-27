import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import ProjectPanel from '@/components/ProjectPanel'
import DeviceInfoPanel from '@/components/DeviceInfoPanel'
import ChatPanel from '@/components/ChatPanel'

function App() {
  const { setProjects, setDeviceConnections, setAuthStatus } = useAppStore()

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(console.error)

    fetch('/api/devices')
      .then(res => res.json())
      .then(data => setDeviceConnections(Array.isArray(data) ? data : []))
      .catch(console.error)

    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => setAuthStatus(data))
      .catch(console.error)
  }, [setProjects, setDeviceConnections, setAuthStatus])

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      {/* Left: Project Panel */}
      <div className="w-56 flex-shrink-0">
        <ProjectPanel />
      </div>

      {/* Center: Chat Panel */}
      <main className="flex-1 flex flex-col p-3 min-w-0">
        <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <ChatPanel />
        </div>
      </main>

      {/* Right: Device Info Panel */}
      <div className="w-[420px] flex-shrink-0">
        <DeviceInfoPanel />
      </div>
    </div>
  )
}

export default App