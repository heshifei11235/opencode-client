import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import ProjectPanel from '@/components/ProjectPanel'
import DeviceInfoPanel from '@/components/DeviceInfoPanel'
import ChatPanel from '@/components/ChatPanel'
import { PanelLeftClose, PanelLeft, GripVertical } from 'lucide-react'

function App() {
  const { setProjects, setDeviceConnections, setAuthStatus } = useAppStore()

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(224)
  const [rightPanelWidth, setRightPanelWidth] = useState(420)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()

    if (isDraggingLeft) {
      const newWidth = e.clientX - rect.left
      if (newWidth >= 180 && newWidth <= 400) {
        setLeftPanelWidth(newWidth)
      }
    }

    if (isDraggingRight) {
      const newWidth = rect.right - e.clientX
      if (newWidth >= 320 && newWidth <= 600) {
        setRightPanelWidth(newWidth)
      }
    }
  }, [isDraggingLeft, isDraggingRight])

  const handleMouseUp = useCallback(() => {
    setIsDraggingLeft(false)
    setIsDraggingRight(false)
  }, [])

  useEffect(() => {
    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDraggingLeft, isDraggingRight, handleMouseMove, handleMouseUp])

  return (
    <div ref={containerRef} className="flex h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      {/* Left: Project Panel */}
      {leftPanelCollapsed ? (
        <div className="w-12 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-3">
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            title="展开左侧面板"
          >
            <PanelLeft className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      ) : (
        <>
          <div style={{ width: leftPanelWidth }} className="flex-shrink-0">
            <ProjectPanel />
          </div>

          {/* Left drag handle */}
          <div
            className="w-1 cursor-col-resize flex-shrink-0 group hover:bg-blue-400 transition-colors"
            onMouseDown={() => setIsDraggingLeft(true)}
          >
            <div className="h-full flex items-center justify-center">
              <GripVertical className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            </div>
          </div>
        </>
      )}

      {/* Center: Chat Panel */}
      <main className="flex-1 flex flex-col p-3 min-w-0">
        <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <ChatPanel />
        </div>
      </main>

      {/* Right drag handle */}
      <div
        className="w-1 cursor-col-resize flex-shrink-0 group hover:bg-blue-400 transition-colors"
        onMouseDown={() => setIsDraggingRight(true)}
      >
        <div className="h-full flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
        </div>
      </div>

      {/* Right: Device Info Panel */}
      <div style={{ width: rightPanelWidth }} className="flex-shrink-0">
        <DeviceInfoPanel />
      </div>

      {/* Collapse left panel button (when collapsed) */}
      {leftPanelCollapsed && (
        <div className="absolute left-12 top-4 z-10">
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="p-2 bg-white hover:bg-slate-100 rounded-lg shadow-md transition-colors"
            title="展开左侧面板"
          >
            <PanelLeft className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      )}

      {/* Collapse left panel button (when expanded) */}
      {!leftPanelCollapsed && (
        <div className="absolute left-0 top-4 z-10" style={{ left: leftPanelWidth - 36 }}>
          <button
            onClick={() => setLeftPanelCollapsed(true)}
            className="p-1.5 bg-white hover:bg-slate-100 rounded-lg shadow-md transition-colors"
            title="折叠左侧面板"
          >
            <PanelLeftClose className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      )}
    </div>
  )
}

export default App