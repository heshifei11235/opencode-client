import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import Sidebar from '@/components/Sidebar'
import ChatPanel from '@/components/ChatPanel'
import PasswordPanel from '@/components/PasswordPanel'

function App() {
  const { activeView, setConnections, setAuthStatus } = useAppStore()

  useEffect(() => {
    // Fetch initial data
    fetch('/api/connections')
      .then(res => res.json())
      .then(data => setConnections(Array.isArray(data) ? data : []))
      .catch(console.error)

    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => setAuthStatus(data))
      .catch(console.error)
  }, [setConnections, setAuthStatus])

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="w-[720px] flex-shrink-0 flex flex-col py-4 pr-4 pl-4">
        <div className="flex-1 bg-white/95 backdrop-blur rounded-2xl shadow-2xl shadow-black/20 border border-white/20 overflow-hidden flex flex-col">
          {activeView === 'chat' ? <ChatPanel /> : <PasswordPanel />}
        </div>
      </main>

      {/* Right placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-700/50 flex items-center justify-center mb-3 border border-slate-600/30">
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-sm font-medium text-slate-400">Coming Soon</p>
          <p className="text-xs text-slate-600 mt-1">Additional features</p>
        </div>
      </div>
    </div>
  )
}

export default App
