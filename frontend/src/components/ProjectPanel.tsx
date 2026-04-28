import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Plus, Search, Trash2, FolderOpen, FileText, Server, Loader2, ChevronRight, ChevronDown, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project, MdDocument, Device } from '@/types'

export default function ProjectPanel() {
  const {
    projects, addProject, removeProject,
    currentProjectId, setCurrentProjectId,
    projectDocuments, setProjectDocuments,
    currentDevices, setCurrentDevices,
    activeDeviceId, setActiveDevice,
    openDeviceIds: _openDeviceIds, addOpenDevice, removeOpenDevice: _removeOpenDevice,
    setActiveDocumentId,
    setRiskAnalysis
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())
  // Track expanded docs per project (keyed by projectId_docId)
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

  // New project form
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Add/Edit device dialog
  const [showDeviceDialog, setShowDeviceDialog] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deviceFormData, setDeviceFormData] = useState({
    id: '',
    name: '',
    host: '',
    port: '4096',
    username: '',
    protocol: 'ssh',
    group: ''
  })

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.path.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddProject = async () => {
    if (!newProjectName.trim() || !newProjectPath.trim()) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          path: newProjectPath
        })
      })
      const data = await res.json()
      addProject(data)
      setNewProjectName('')
      setNewProjectPath('')
      setShowAddDialog(false)
    } catch (err) {
      console.error('Failed to add project:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Delete this project and all its connections?')) return

    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      removeProject(id)
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  const handleToggleExpandProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    const newExpanded = new Set(expandedProjects)

    if (expandedProjects.has(project.id)) {
      newExpanded.delete(project.id)
    } else {
      try {
        const res = await fetch(`/api/projects/${project.id}/documents`)
        const docs = await res.json()
        // Store documents under this project's ID
        setProjectDocuments(project.id, docs)
        newExpanded.add(project.id)
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      }
    }

    setExpandedProjects(newExpanded)
  }

  const handleSelectProject = (project: Project) => {
    setCurrentProjectId(project.id)
    setActiveDevice(null)
    setCurrentDevices([])
  }

  const handleSelectDocument = async (projectId: number, doc: MdDocument) => {
    setCurrentProjectId(projectId)
    setActiveDocumentId(doc.id)  // Set active document ID
    try {
      const res = await fetch('/api/documents/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          filename: doc.filename
        })
      })
      const data = await res.json()

      // Parse risk analysis
      const riskAnalysis = data.risk_analysis
      setRiskAnalysis(riskAnalysis)

      // Build device list with risk levels from data.devices
      const devices: Device[] = []
      const riskMap: Record<string, import('@/types').RiskLevel> = {}

      // Map risk levels
      for (const id of riskAnalysis.very_high_risk || []) riskMap[id] = 'very-high'
      for (const id of riskAnalysis.high_risk || []) riskMap[id] = 'high'
      for (const id of riskAnalysis.medium_risk || []) riskMap[id] = 'medium'
      for (const id of riskAnalysis.low_risk || []) riskMap[id] = 'low'

      // Use devices from API response
      for (const d of data.devices || []) {
        devices.push({
          id: d.id,
          name: d.name || d.id,
          host: d.host || '',
          port: d.port || 4096,
          username: d.username,
          protocol: d.protocol || 'ssh',
          group: d.group,
          risk_level: riskMap[d.id] || 'low'
        })
      }

      setCurrentDevices(devices)

      // Toggle doc expansion - use doc.id as key
      const newExpanded = new Set(expandedDocs)
      if (expandedDocs.has(doc.id)) {
        newExpanded.delete(doc.id)
      } else {
        newExpanded.add(doc.id)
      }
      setExpandedDocs(newExpanded)
    } catch (err) {
      console.error('Failed to parse document:', err)
      setCurrentDevices([])
      setRiskAnalysis(null)
    }
  }

  const handleSelectDevice = async (device: Device, documentId: string) => {
    setActiveDevice(device.id)
    setActiveDocumentId(documentId)
    addOpenDevice(device.id)

    // Ensure device connection exists in database
    try {
      const projectId = currentProjectId
      if (!projectId) return

      // Check if device connection already exists
      const connsRes = await fetch('/api/devices')
      const conns = await connsRes.json()
      const existingConn = conns.find((c: any) =>
        c.device_id === device.id &&
        c.project_id === projectId &&
        c.document_id === documentId
      )

      // If not found, the connection will be created automatically when parsing document
      // or we can create it here if needed
      if (!existingConn) {
        console.log('Device connection not found in DB, will be created on document parse')
      }
    } catch (err) {
      console.error('Failed to check device connection:', err)
    }
  }

  const openAddDeviceDialog = () => {
    setEditingDevice(null)
    setDeviceFormData({
      id: `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      host: '',
      port: '4096',
      username: '',
      protocol: 'ssh',
      group: ''
    })
    setShowDeviceDialog(true)
  }

  const openEditDeviceDialog = (device: Device) => {
    setEditingDevice(device)
    setDeviceFormData({
      id: device.id,
      name: device.name,
      host: device.host,
      port: String(device.port),
      username: device.username || '',
      protocol: device.protocol,
      group: device.group || ''
    })
    setShowDeviceDialog(true)
  }

  const handleSaveDevice = () => {
    if (!deviceFormData.id || !deviceFormData.name || !deviceFormData.host) return

    const newDevice: Device = {
      id: deviceFormData.id,
      name: deviceFormData.name,
      host: deviceFormData.host,
      port: parseInt(deviceFormData.port) || 4096,
      username: deviceFormData.username || undefined,
      protocol: deviceFormData.protocol as 'ssh' | 'telnet' | 'http',
      group: deviceFormData.group || undefined
    }

    if (editingDevice) {
      setCurrentDevices(currentDevices.map(d => d.id === editingDevice.id ? newDevice : d))
    } else {
      setCurrentDevices([...currentDevices, newDevice])
    }

    setShowDeviceDialog(false)
  }

  const handleDeleteDevice = async (deviceId: string, docId: string) => {
    if (!confirm('Delete this device?')) return

    try {
      // Find and delete the device connection from database
      const connsRes = await fetch('/api/devices')
      const conns = await connsRes.json()

      const connToDelete = conns.find((c: any) =>
        c.device_id === deviceId &&
        c.project_id === currentProjectId &&
        c.document_id === docId
      )

      if (connToDelete) {
        await fetch(`/api/devices/${connToDelete.id}`, { method: 'DELETE' })
      }
    } catch (err) {
      console.error('Failed to delete device from database:', err)
    }

    // Remove from frontend state
    setCurrentDevices(currentDevices.filter(d => d.id !== deviceId))
    if (activeDeviceId === deviceId) {
      setActiveDevice(null)
    }
  }

  return (
    <aside className="h-full flex flex-col bg-gradient-to-b from-slate-800 to-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <FolderOpen className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold truncate bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Projects</h1>
        </div>
      </div>

      {/* Search and add */}
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto bg-slate-900/50">
        {filteredProjects.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </div>
        ) : (
          <div className="p-2">
            {filteredProjects.map((project) => (
              <div key={project.id} className="mb-1">
                {/* Project item (level 1) */}
                <div
                  onClick={() => handleSelectProject(project)}
                  className={cn(
                    'w-full text-left rounded-lg transition-all group relative cursor-pointer p-2',
                    currentProjectId === project.id && !activeDeviceId
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30'
                      : 'hover:bg-slate-700/50 border border-transparent'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        onClick={(e) => handleToggleExpandProject(e, project)}
                        className="p-0.5 hover:bg-slate-600/50 rounded flex-shrink-0"
                      >
                        {expandedProjects.has(project.id) ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      <FolderOpen className={cn('w-4 h-4 flex-shrink-0', currentProjectId === project.id ? 'text-blue-400' : 'text-slate-400')} />
                      <span className={cn('font-medium truncate text-sm', currentProjectId === project.id ? 'text-white' : 'text-slate-200')}>
                        {project.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all cursor-pointer flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

{/* Document list (level 2) */}
                {expandedProjects.has(project.id) && projectDocuments[project.id]?.length > 0 && (
                  <div className="ml-3 mt-1">
                    {projectDocuments[project.id].map((doc) => (
                      <div key={doc.id} className="mb-1">
                        <div
                          onClick={() => handleSelectDocument(project.id, doc)}
                          className={cn(
                            'w-full text-left rounded-lg transition-all cursor-pointer p-2 flex items-center gap-2',
                            expandedDocs.has(doc.id)
                              ? 'bg-slate-700/50 text-white'
                              : 'hover:bg-slate-700/30 text-slate-300'
                          )}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectDocument(project.id, doc)
                            }}
                            className="p-0.5 hover:bg-slate-600/50 rounded flex-shrink-0"
                          >
                            {expandedDocs.has(doc.id) ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-sm truncate">{doc.filename}</span>
                        </div>

                        {/* Device list (level 3) */}
                        {expandedDocs.has(doc.id) && (
                          <div className="ml-5 mt-1 space-y-1">
                            {currentDevices.length > 0 ? (
                              currentDevices.map((device) => (
                                <div
                                  key={device.id}
                                  onClick={() => handleSelectDevice(device, doc.id)}
                                  className={cn(
                                    'w-full text-left rounded-lg transition-all cursor-pointer p-2 group flex items-center justify-between border',
                                    activeDeviceId === device.id
                                      ? 'bg-blue-500/30 border-blue-500/50'
                                      : 'hover:bg-slate-700/50 text-slate-300 border-transparent',
                                    device.risk_level === 'very-high' && 'border-l-4 border-l-red-500',
                                    device.risk_level === 'high' && 'border-l-4 border-l-orange-500',
                                    device.risk_level === 'medium' && 'border-l-4 border-l-yellow-500',
                                    device.risk_level === 'low' && 'border-l-4 border-l-green-500'
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Server className={cn('w-4 h-4 flex-shrink-0', activeDeviceId === device.id ? 'text-blue-400' : 'text-slate-500')} />
                                    <span className="text-sm truncate">{device.name}</span>
                                    {device.risk_level && (
                                      <span className={cn(
                                        'px-1.5 py-0.5 text-xs rounded font-medium',
                                        device.risk_level === 'very-high' && 'bg-red-500/20 text-red-400',
                                        device.risk_level === 'high' && 'bg-orange-500/20 text-orange-400',
                                        device.risk_level === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                                        device.risk_level === 'low' && 'bg-green-500/20 text-green-400'
                                      )}>
                                        {device.risk_level === 'very-high' ? '极高' :
                                         device.risk_level === 'high' ? '高' :
                                         device.risk_level === 'medium' ? '中' : '低'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openEditDeviceDialog(device)
                                      }}
                                      className="p-1 hover:bg-slate-600 rounded"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteDevice(device.id, doc.id)
                                      }}
                                      className="p-1 hover:bg-red-500/20 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : null}
                            {/* Add device button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openAddDeviceDialog()
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-blue-400 transition-all flex items-center gap-2 text-sm"
                            >
                              <Plus className="w-4 h-4" />
                              Add Device
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add project dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto space-y-4 border border-slate-700 shadow-2xl shadow-black/50">
            <h2 className="text-lg font-semibold text-white">Add New Project</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-300">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Project"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Project Path</label>
                <input
                  type="text"
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Local directory containing device configuration md files
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddDialog(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProject}
                disabled={!newProjectName.trim() || !newProjectPath.trim() || isCreating}
                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit device dialog */}
      {showDeviceDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto space-y-4 border border-slate-700 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingDevice ? 'Edit Device' : 'Add Device'}
              </h2>
              <button
                onClick={() => setShowDeviceDialog(false)}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-300">Device ID *</label>
                <input
                  type="text"
                  value={deviceFormData.id}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, id: e.target.value })}
                  placeholder="device-001"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  readOnly={!!editingDevice}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Name *</label>
                <input
                  type="text"
                  value={deviceFormData.name}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, name: e.target.value })}
                  placeholder="Server A"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300">Host *</label>
                  <input
                    type="text"
                    value={deviceFormData.host}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, host: e.target.value })}
                    placeholder="192.168.1.100"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">Port</label>
                  <input
                    type="text"
                    value={deviceFormData.port}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, port: e.target.value })}
                    placeholder="4096"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300">Username</label>
                  <input
                    type="text"
                    value={deviceFormData.username}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, username: e.target.value })}
                    placeholder="root"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">Protocol</label>
                  <select
                    value={deviceFormData.protocol}
                    onChange={(e) => setDeviceFormData({ ...deviceFormData, protocol: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  >
                    <option value="ssh">SSH</option>
                    <option value="telnet">Telnet</option>
                    <option value="http">HTTP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Group</label>
                <input
                  type="text"
                  value={deviceFormData.group}
                  onChange={(e) => setDeviceFormData({ ...deviceFormData, group: e.target.value })}
                  placeholder="Production"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowDeviceDialog(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDevice}
                disabled={!deviceFormData.id || !deviceFormData.name || !deviceFormData.host}
                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
              >
                {editingDevice ? 'Save Changes' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}