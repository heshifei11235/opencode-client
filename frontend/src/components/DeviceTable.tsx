import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Server, User, Globe, Network, Loader2, Plus, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Device } from '@/types'

interface DeviceTableProps {
  onDeviceConnect: (device: Device) => void
}

export default function DeviceTable({ onDeviceConnect }: DeviceTableProps) {
  const { currentDevices, setCurrentDevices, currentProjectId } = useAppStore()
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null)

  // Add/Edit dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    host: '',
    port: '4096',
    username: '',
    protocol: 'ssh',
    group: ''
  })

  const openAddDialog = () => {
    setEditingDevice(null)
    setFormData({
      id: generateId(),
      name: '',
      host: '',
      port: '4096',
      username: '',
      protocol: 'ssh',
      group: ''
    })
    setShowDialog(true)
  }

  const generateId = () => `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  if (currentDevices.length === 0 && !showDialog) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No devices found</p>
          <p className="text-sm mt-1">Select a project and md document to view devices</p>
        </div>
        <button
          onClick={openAddDialog}
          className="mt-4 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Device Manually
        </button>
      </div>
    )
  }

  const openEditDialog = (device: Device) => {
    setEditingDevice(device)
    setFormData({
      id: device.id,
      name: device.name,
      host: device.host,
      port: String(device.port),
      username: device.username || '',
      protocol: device.protocol,
      group: device.group || ''
    })
    setShowDialog(true)
  }

  const handleSave = () => {
    if (!formData.id || !formData.name || !formData.host) return

    const newDevice: Device = {
      id: formData.id,
      name: formData.name,
      host: formData.host,
      port: parseInt(formData.port) || 4096,
      username: formData.username || undefined,
      protocol: formData.protocol as 'ssh' | 'telnet' | 'http',
      group: formData.group || undefined
    }

    if (editingDevice) {
      // Update existing device
      setCurrentDevices(currentDevices.map(d => d.id === editingDevice.id ? newDevice : d))
    } else {
      // Add new device
      setCurrentDevices([...currentDevices, newDevice])
    }

    setShowDialog(false)
  }

  const handleDelete = (deviceId: string) => {
    if (!confirm('Delete this device?')) return
    setCurrentDevices(currentDevices.filter(d => d.id !== deviceId))
  }

  const handleConnect = async (device: Device) => {
    setConnectingDeviceId(device.id)
    try {
      await onDeviceConnect(device)
    } finally {
      setConnectingDeviceId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-500" />
          Device List
          <span className="text-xs font-normal text-slate-400 ml-2">
            ({currentDevices.length} devices)
          </span>
        </h3>
        <button
          onClick={openAddDialog}
          className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Device
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Host</th>
              <th className="px-4 py-3 text-left font-medium">Port</th>
              <th className="px-4 py-3 text-left font-medium">Username</th>
              <th className="px-4 py-3 text-left font-medium">Protocol</th>
              <th className="px-4 py-3 text-left font-medium">Group</th>
              <th className="px-4 py-3 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentDevices.map((device) => (
              <tr
                key={device.id}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                      <Server className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="font-medium text-slate-700">{device.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 font-mono text-sm">{device.host}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-600 font-mono text-sm">{device.port}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 text-sm">{device.username || '-'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    device.protocol === 'ssh' && 'bg-blue-100 text-blue-600',
                    device.protocol === 'http' && 'bg-green-100 text-green-600',
                    device.protocol === 'telnet' && 'bg-yellow-100 text-yellow-600'
                  )}>
                    {device.protocol.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 text-sm">{device.group || '-'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => openEditDialog(device)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-blue-600"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(device.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-500 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleConnect(device)}
                      disabled={connectingDeviceId === device.id || !currentProjectId}
                      className="ml-2 px-3 py-1.5 text-sm bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      {connectingDeviceId === device.id ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                        </span>
                      ) : (
                        'Connect'
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto space-y-4 border border-slate-700 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingDevice ? 'Edit Device' : 'Add Device'}
              </h2>
              <button
                onClick={() => setShowDialog(false)}
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
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="device-001"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  readOnly={!!editingDevice}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Server A"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300">Host *</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="192.168.1.100"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">Port</label>
                  <input
                    type="text"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
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
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="root"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">Protocol</label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
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
                  value={formData.group}
                  onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  placeholder="Production"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.id || !formData.name || !formData.host}
                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
              >
                {editingDevice ? 'Save Changes' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
