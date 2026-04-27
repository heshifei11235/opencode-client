import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Plus, Search, Trash2, Terminal, Key, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Connection } from '@/types'

export default function Sidebar() {
  const {
    activeView, setActiveView,
    connections, addConnection, removeConnection,
    activeConnectionId, setActiveConnection
  } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // New connection form
  const [newConnName, setNewConnName] = useState('')
  const [newConnUrl, setNewConnUrl] = useState('')
  const [newConnUsername, setNewConnUsername] = useState('')
  const [newConnPassword, setNewConnPassword] = useState('')
  const [newConnWorkDir, setNewConnWorkDir] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const filteredConnections = connections.filter(conn =>
    conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conn.url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleTestConnection = async () => {
    if (!newConnUrl.trim()) return

    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newConnUrl,
          username: newConnUsername || null,
          password: newConnPassword || null
        })
      })
      const data = await res.json()

      if (data.success) {
        setTestResult({ success: true, message: 'Connection successful!' })
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' })
      }
    } catch (err) {
      setTestResult({ success: false, message: 'Failed to test connection' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleAddConnection = async () => {
    if (!newConnName.trim() || !newConnUrl.trim()) return

    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newConnName,
          url: newConnUrl,
          username: newConnUsername || null,
          password: newConnPassword || null,
          working_directory: newConnWorkDir || null
        })
      })
      const data = await res.json()
      addConnection(data)
      resetForm()
      setShowAddDialog(false)
    } catch (err) {
      console.error('Failed to add connection:', err)
    }
  }

  const resetForm = () => {
    setNewConnName('')
    setNewConnUrl('')
    setNewConnUsername('')
    setNewConnPassword('')
    setNewConnWorkDir('')
    setTestResult(null)
  }

  const handleDeleteConnection = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Delete this connection?')) return

    try {
      await fetch(`/api/connections/${id}`, { method: 'DELETE' })
      removeConnection(id)
    } catch (err) {
      console.error('Failed to delete connection:', err)
    }
  }

  return (
    <aside className={cn(
      'h-full flex flex-col bg-gradient-to-b from-slate-800 to-slate-900 transition-all duration-300 relative',
      isCollapsed ? 'w-14' : 'w-64'
    )}>
      {/* 3D shuttle edge */}
      <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-500" />
      <div className="absolute top-0 right-0 h-full w-0.5 bg-gradient-to-b from-slate-400 via-transparent to-slate-400 opacity-50" />

      {/* Header */}
      <div className={cn('p-3 border-b border-slate-700/50 flex items-center gap-2 bg-gradient-to-r from-slate-800 to-transparent', isCollapsed && 'justify-center')}>
        {!isCollapsed && (
          <>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Terminal className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold truncate bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">OpenCode</h1>
          </>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md hover:bg-slate-700/50 transition-colors ml-auto text-slate-400 hover:text-white"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* View tabs */}
      <div className="flex border-b border-slate-700/50 bg-slate-800/50">
        <button
          onClick={() => setActiveView('chat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all relative',
            activeView === 'chat'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          )}
          title={isCollapsed ? 'Sessions' : undefined}
        >
          {activeView === 'chat' && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b-2 border-blue-400" />
          )}
          <Terminal className={cn('w-4 h-4 relative z-10', activeView === 'chat' && 'text-blue-400')} />
          {!isCollapsed && <span className="relative z-10">Sessions</span>}
        </button>
        <button
          onClick={() => setActiveView('password')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all relative',
            activeView === 'password'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          )}
          title={isCollapsed ? 'Passwords' : undefined}
        >
          {activeView === 'password' && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b-2 border-purple-400" />
          )}
          <Key className={cn('w-4 h-4 relative z-10', activeView === 'password' && 'text-purple-400')} />
          {!isCollapsed && <span className="relative z-10">Passwords</span>}
        </button>
      </div>

      {/* Search and add */}
      {activeView === 'chat' && !isCollapsed && (
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
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
            Add Connection
          </button>
        </div>
      )}
      {activeView === 'chat' && isCollapsed && (
        <div className="p-2 flex justify-center">
          <button
            onClick={() => setShowAddDialog(true)}
            className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg shadow-blue-500/20"
            title="Add Connection"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connection list */}
      {activeView === 'chat' && (
        <div className="flex-1 overflow-y-auto bg-slate-900/50">
          {filteredConnections.length === 0 ? (
            <div className={cn('p-4 text-center text-sm text-slate-500', isCollapsed && 'hidden')}>
              {searchQuery ? 'No connections found' : 'No connections yet'}
            </div>
          ) : (
            <div className={cn('p-2 space-y-1', isCollapsed && 'p-1')}>
              {filteredConnections.map((conn) => (
                <ConnectionItem
                  key={conn.id}
                  connection={conn}
                  isActive={conn.id === activeConnectionId}
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    setActiveConnection(conn.id)
                    setActiveView('chat')
                  }}
                  onDelete={(e) => handleDeleteConnection(e, conn.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Password view placeholder */}
      {activeView === 'password' && (
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-500 p-4 text-center">
          <Key className="w-8 h-8 mb-2 text-slate-600" />
          <p>Password management</p>
          <p className="text-xs text-slate-600 mt-1">Securely store credentials</p>
        </div>
      )}

      {/* Add connection dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto space-y-4 border border-slate-700 shadow-2xl shadow-black/50">
            <h2 className="text-lg font-semibold text-white">New OpenCode Connection</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-300">Connection Name</label>
                <input
                  type="text"
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  placeholder="My Remote Server"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">OpenCode Server URL</label>
                <input
                  type="text"
                  value={newConnUrl}
                  onChange={(e) => setNewConnUrl(e.target.value)}
                  placeholder="http://192.168.1.100:4096"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  URL of the remote OpenCode server
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Username (optional)</label>
                <input
                  type="text"
                  value={newConnUsername}
                  onChange={(e) => setNewConnUsername(e.target.value)}
                  placeholder="opencode"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Password (optional)</label>
                <input
                  type="password"
                  value={newConnPassword}
                  onChange={(e) => setNewConnPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Working Directory (optional)</label>
                <input
                  type="text"
                  value={newConnWorkDir}
                  onChange={(e) => setNewConnWorkDir(e.target.value)}
                  placeholder="/path/to/project"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Default working directory for sessions
                </p>
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={cn(
                'p-3 rounded-lg text-sm',
                testResult.success ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              )}>
                {testResult.message}
              </div>
            )}

            <div className="flex gap-2 justify-between">
              <button
                onClick={handleTestConnection}
                disabled={!newConnUrl.trim() || isTesting}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/50 disabled:opacity-50 transition-colors"
              >
                {isTesting && <Loader2 className="w-4 h-4 animate-spin" />}
                Test Connection
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddDialog(false); resetForm() }}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddConnection}
                  disabled={!newConnName.trim() || !newConnUrl.trim()}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function ConnectionItem({
  connection,
  isActive,
  isCollapsed,
  onClick,
  onDelete
}: {
  connection: Connection & { url: string }
  isActive: boolean
  isCollapsed: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onClick={onClick}
      title={isCollapsed ? connection.name : undefined}
      className={cn(
        'w-full text-left rounded-lg transition-all group relative cursor-pointer',
        isCollapsed ? 'p-2 flex justify-center' : 'p-3',
        isActive
          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 shadow-lg shadow-blue-500/10'
          : 'hover:bg-slate-700/50 border border-transparent'
      )}
    >
      {isCollapsed ? (
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          isActive ? 'bg-blue-500/30' : 'bg-slate-700/50'
        )}>
          <Terminal className={cn('w-4 h-4', isActive ? 'text-blue-400' : 'text-slate-400')} />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className={cn(
                'font-medium truncate',
                isActive ? 'text-white' : 'text-slate-200'
              )}>
                {connection.name}
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {connection.url}
              </p>
            </div>
            <span
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {formatDate(connection.updated_at)}
          </p>
        </>
      )}
    </div>
  )
}
