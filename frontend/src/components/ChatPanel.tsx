import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Send, Loader2, User, Bot, Circle, Sparkles, X, ChevronLeft, ChevronRight, MessageCircle, Copy, Check, Download, Share2 } from 'lucide-react'
import { generateId } from '@/lib/utils'

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export default function ChatPanel() {
  const {
    activeDeviceId,
    setActiveDevice,
    openDeviceIds,
    removeOpenDevice,
    currentProjectId,
    activeDocumentId,
    currentDevices,
    deviceDetails,
    deviceConnections,
    chatSessions,
    setChatSession,
    addChatMessage,
    setDeviceLoading,
    setDeviceAnalyzing,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Get per-device states
  const currentSession = activeDeviceId ? chatSessions[activeDeviceId] : null
  const messages = currentSession?.messages || []
  const isLoading = currentSession?.isLoading || false
  const isAnalyzing = currentSession?.isAnalyzing || false
  const chatHistoryFetched = currentSession?.chatHistoryFetched || false

  const currentDevice = currentDevices.find(d => d.id === activeDeviceId)
  const currentConnection = deviceConnections.find(c => c.device_id === activeDeviceId)

  // Check scrollability
  const checkScroll = () => {
    if (chatContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = chatContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
    }
  }

  const scrollTabs = (direction: 'left' | 'right') => {
    if (chatContainerRef.current) {
      const scrollAmount = 200
      chatContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [openDeviceIds])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load chat history when active device changes
  useEffect(() => {
    if (!activeDeviceId || !currentProjectId || !activeDocumentId) {
      return
    }

    // Initialize session if not exists
    if (!chatSessions[activeDeviceId]) {
      setChatSession(activeDeviceId, {
        sessionId: null,
        messages: [],
        isLoading: false,
        isAnalyzing: false,
        chatHistoryFetched: false
      })
    }

    const fetchChatHistory = async () => {
      try {
        const connsRes = await fetch('/api/devices')
        const conns = await connsRes.json()

        const docId = activeDocumentId

        const matchedConn = conns.find((c: any) =>
          c.device_id === activeDeviceId &&
          c.project_id === currentProjectId &&
          c.document_id === docId
        )

        if (matchedConn) {
          const historyRes = await fetch(`/api/devices/${matchedConn.id}/chat-history`)
          const historyData = await historyRes.json()

          if (historyData.messages && historyData.messages.length > 0) {
            const loadedMessages: Message[] = historyData.messages.map((m: any) => ({
              id: generateId(),
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: m.timestamp
            }))
            setChatSession(activeDeviceId, {
              ...chatSessions[activeDeviceId] || {},
              sessionId: null,
              messages: loadedMessages,
              isLoading: false,
              isAnalyzing: false,
              chatHistoryFetched: true
            })
          } else {
            setChatSession(activeDeviceId, {
              ...chatSessions[activeDeviceId] || {},
              chatHistoryFetched: true
            })
          }
        } else {
          setChatSession(activeDeviceId, {
            ...chatSessions[activeDeviceId] || {},
            chatHistoryFetched: true
          })
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
        setChatSession(activeDeviceId, {
          ...chatSessions[activeDeviceId] || {},
          chatHistoryFetched: true
        })
      }
    }

    // Only fetch if not already fetched
    if (!chatSessions[activeDeviceId]?.chatHistoryFetched) {
      fetchChatHistory()
    }
  }, [activeDeviceId, currentProjectId, activeDocumentId])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    if (!activeDeviceId || !activeDocumentId) return

    const content = input.trim()

    setError(null)

    // Add user message
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: content,
      timestamp: new Date().toISOString()
    }
    addChatMessage(activeDeviceId, userMsg)
    setInput('')
    setDeviceLoading(activeDeviceId, true)

    try {
      const filename = activeDocumentId.split('_').slice(1).join('_')
      const res = await fetch('/api/chat/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: activeDeviceId,
          project_id: currentProjectId,
          filename: filename,
          message: content
        })
      })
      const data = await res.json()

      // Add assistant response
      addChatMessage(activeDeviceId, {
        id: generateId(),
        role: 'assistant',
        content: data.response || '响应为空',
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      console.error('Chat error:', err)
      addChatMessage(activeDeviceId, {
        id: generateId(),
        role: 'assistant',
        content: '发送消息失败: ' + String(err),
        timestamp: new Date().toISOString()
      })
    } finally {
      setDeviceLoading(activeDeviceId, false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAIAnalyze = async () => {
    if (!activeDeviceId || !currentProjectId || !activeDocumentId || isAnalyzing) return

    const detail = deviceDetails[activeDeviceId]
    if (!detail) {
      setError('Device details not found')
      return
    }

    setError(null)
    setDeviceAnalyzing(activeDeviceId, true)

    // Add user message
    addChatMessage(activeDeviceId, {
      id: generateId(),
      role: 'user',
      content: 'AI分析请求',
      timestamp: new Date().toISOString()
    })

    try {
      // Fetch prompt file
      const promptRes = await fetch(`/api/projects/${currentProjectId}/prompt`)
      const promptData = await promptRes.json()
      const promptTemplate = promptData.prompt || '请分析以下设备：\n{device_info}'

      // Send AI analyze request
      const analyzeRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptTemplate,
          device: detail,
          project_id: currentProjectId,
          filename: activeDocumentId.split('_').slice(1).join('_')
        })
      })

      const analyzeData = await analyzeRes.json()

      // Add AI response
      addChatMessage(activeDeviceId, {
        id: generateId(),
        role: 'assistant',
        content: analyzeData.response || 'AI分析完成',
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      console.error('AI analyze error:', err)
      setError('AI分析失败')
    } finally {
      setDeviceAnalyzing(activeDeviceId, false)
    }
  }

  const handleCloseTab = (e: React.MouseEvent, deviceId: string) => {
    e.stopPropagation()
    removeOpenDevice(deviceId)
    // If closing the active tab, switch to another
    if (activeDeviceId === deviceId) {
      const remaining = openDeviceIds.filter(id => id !== deviceId)
      if (remaining.length > 0) {
        setActiveDevice(remaining[remaining.length - 1])
      } else {
        setActiveDevice(null)
      }
    }
  }

  const handleTabClick = (deviceId: string) => {
    setActiveDevice(deviceId)
  }

  const handleCopyMessage = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopiedId(msg.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleExportChat = (format: 'md' | 'html') => {
    if (!currentDevice || messages.length === 0) return

    const deviceName = currentDevice.name || currentDevice.id
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `${deviceName}_${dateStr}`

    let content = ''
    let mimeType = ''
    let extension = ''

    if (format === 'md') {
      // Markdown format
      content = `# 对话记录: ${deviceName}\n\n`
      content += `**日期:** ${new Date().toLocaleDateString('zh-CN')}\n`
      content += `**设备:** ${deviceName}\n`
      if (currentDevice.risk_level) {
        content += `**风险等级:** ${currentDevice.risk_level}\n`
      }
      content += `\n---\n\n`
      messages.forEach((msg) => {
        const role = msg.role === 'user' ? '**用户**' : '**OpenCode**'
        const time = new Date(msg.timestamp).toLocaleString('zh-CN')
        content += `### ${role} - ${time}\n\n${msg.content}\n\n---\n\n`
      })
      mimeType = 'text/markdown'
      extension = 'md'
    } else {
      // HTML format with chat-like layout
      content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>对话记录 - ${deviceName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .chat-container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      overflow: hidden;
    }
    .chat-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px 32px;
    }
    .chat-header h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .chat-header .meta {
      font-size: 14px;
      opacity: 0.9;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    .risk-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255,255,255,0.2);
    }
    .messages {
      padding: 24px 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: 400px;
    }
    .message {
      display: flex;
      gap: 16px;
      max-width: 80%;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .message.assistant {
      align-self: flex-start;
    }
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .message.user .avatar {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    .message.assistant .avatar {
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    }
    .bubble {
      padding: 16px 20px;
      border-radius: 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      line-height: 1.6;
      font-size: 15px;
    }
    .message.user .bubble {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-bottom-right-radius: 6px;
    }
    .message.assistant .bubble {
      background: white;
      border: 1px solid #e5e7eb;
      color: #374151;
      border-bottom-left-radius: 6px;
    }
    .message .time {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 8px;
      padding: 0 4px;
    }
    .message.user .time {
      text-align: right;
    }
    .footer {
      text-align: center;
      padding: 16px;
      color: #9ca3af;
      font-size: 13px;
      border-top: 1px solid #f3f4f6;
    }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <h1>💬 对话记录: ${deviceName}</h1>
      <div class="meta">
        <span>📅 ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span>📱 ${deviceName}</span>
        ${currentDevice.risk_level ? `<span class="risk-badge">${currentDevice.risk_level === 'very-high' ? '🔴 极高风险' : currentDevice.risk_level === 'high' ? '🟠 高风险' : currentDevice.risk_level === 'medium' ? '🟡 中等风险' : '🟢 低风险'}</span>` : ''}
      </div>
    </div>
    <div class="messages">
`
      messages.forEach((msg) => {
        const role = msg.role === 'user' ? 'user' : 'assistant'
        const avatar = msg.role === 'user' ? '👤' : '🤖'
        const time = new Date(msg.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        content += `      <div class="message ${role}">
        <div class="avatar">${avatar}</div>
        <div>
          <div class="bubble">${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
          <div class="time">${time}</div>
        </div>
      </div>\n`
      })
      content += `    </div>
    <div class="footer">
      由 OpenCode Client 生成 | ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
</body>
</html>`
      mimeType = 'text/html'
      extension = 'html'
    }

    // Download file
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  // No tabs open
  if (openDeviceIds.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="text-center space-y-4">
          <div className="relative">
            {/* 3D depth layers */}
            <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl" />
            <div className="absolute -inset-2 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl blur-lg" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-white to-slate-100 flex items-center justify-center shadow-2xl border border-slate-200/50">
              <MessageCircle className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-700">选择一个设备开始对话</p>
          <p className="text-sm text-slate-500">从左侧项目列表选择设备</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar with 3D effect */}
      <div className="flex-shrink-0 bg-gradient-to-b from-slate-100 to-slate-50 border-b border-slate-200/80 relative">
        {/* Scroll buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scrollTabs('left')}
            className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-100 to-transparent z-10 flex items-center justify-center hover:from-slate-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollTabs('right')}
            className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-100 to-transparent z-10 flex items-center justify-center hover:from-slate-200 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        )}

        {/* Tabs */}
        <div
          ref={chatContainerRef}
          className="flex items-end gap-1 px-6 py-3 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={checkScroll}
        >
          {openDeviceIds.map((deviceId, index) => {
            const device = currentDevices.find(d => d.id === deviceId)
            const isActive = deviceId === activeDeviceId
            const session = chatSessions[deviceId]
            const hasMessages = session?.messages && session.messages.length > 0

            // Calculate 3D offset for stacked effect
            const stackOffset = isActive ? 0 : Math.min(index * 2, 10)

            return (
              <div
                key={deviceId}
                onClick={() => handleTabClick(deviceId)}
                className={`
                  group relative flex items-center gap-2.5 px-4 py-2.5 rounded-t-xl cursor-pointer
                  transition-all duration-200 ease-out
                  ${isActive ? 'z-10' : 'z-' + (10 - index)}
                `}
                style={{
                  transform: isActive ? 'translateY(0)' : `translateY(${stackOffset}px)`,
                  marginLeft: isActive ? '0' : `-${stackOffset}px`
                }}
              >
                {/* 3D shadow layers */}
                {!isActive && (
                  <>
                    <div className="absolute inset-0 bg-slate-300/50 rounded-xl blur-sm -z-10" />
                    <div className="absolute inset-0.5 bg-slate-200/80 rounded-xl -z-10" />
                  </>
                )}

                {/* Main tab surface */}
                <div className={`
                  absolute inset-0 rounded-xl transition-all duration-200
                  ${isActive
                    ? 'bg-white shadow-lg shadow-slate-200/80 border-t border-l border-r border-slate-200'
                    : 'bg-slate-50/90 border border-slate-200/50 hover:bg-slate-100/90'
                  }
                `} />

                {/* Risk indicator dot */}
                <div className={`
                  w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm relative z-10
                  ${device?.risk_level === 'very-high' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                    device?.risk_level === 'high' ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
                    device?.risk_level === 'medium' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                    'bg-gradient-to-br from-green-500 to-green-600'}
                  ${hasMessages ? 'animate-pulse' : ''}
                `} />

                {/* Device name */}
                <span className={`
                  text-sm font-semibold truncate max-w-[120px] relative z-10
                  ${isActive ? 'text-slate-800' : 'text-slate-500'}
                `}>
                  {device?.name || deviceId}
                </span>

                {/* Message count badge */}
                {hasMessages && (
                  <span className={`
                    px-1.5 py-0.5 text-xs rounded-full relative z-10
                    ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}
                  `}>
                    {session.messages.length}
                  </span>
                )}

                {/* Close button */}
                <button
                  onClick={(e) => handleCloseTab(e, deviceId)}
                  className={`
                    p-1 rounded-md transition-all relative z-10
                    ${isActive ? 'hover:bg-slate-200 text-slate-400' : 'opacity-0 group-hover:opacity-100 hover:bg-slate-300 text-slate-500'}
                  `}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100/80 bg-gradient-to-r from-white via-slate-50/50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />
              <span className="text-sm font-semibold text-green-600">
                {currentConnection ? '已连接' : '直连'}
              </span>
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <span className="text-sm font-bold text-slate-700">
              {currentDevice?.name || '未知设备'}
            </span>
            {currentDevice?.risk_level && (
              <span className={`
                px-2.5 py-1 text-xs rounded-full font-bold
                ${currentDevice.risk_level === 'very-high' ? 'bg-red-100 text-red-600 border border-red-200' :
                  currentDevice.risk_level === 'high' ? 'bg-orange-100 text-orange-600 border border-orange-200' :
                  currentDevice.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-600 border border-yellow-200' :
                  'bg-green-100 text-green-600 border border-green-200'}
              `}>
                {currentDevice.risk_level === 'very-high' ? '极高' :
                 currentDevice.risk_level === 'high' ? '高' :
                 currentDevice.risk_level === 'medium' ? '中' : '低'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 font-medium">
              {new Date().toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={messages.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:from-slate-200 hover:to-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm border border-slate-200"
              >
                <Share2 className="w-4 h-4" />
                <span>分享</span>
              </button>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 py-2 bg-white rounded-xl shadow-xl border border-slate-200 z-20 min-w-[140px]">
                    <button
                      onClick={() => handleExportChat('md')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      导出 Markdown
                    </button>
                    <button
                      onClick={() => handleExportChat('html')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      导出 HTML
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleAIAnalyze}
              disabled={isAnalyzing || !activeDocumentId}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-lg hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 active:scale-95"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>AI分析</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Messages area with 3D stacked cards */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-100/50 to-slate-50/30 scroll-smooth">
        {error && (
          <div className="mb-6 p-4 bg-red-50/80 backdrop-blur border border-red-200 rounded-2xl shadow-lg shadow-red-500/10">
            <p className="text-sm text-red-600 font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {error}
            </p>
          </div>
        )}

        {!chatHistoryFetched ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center border border-blue-500/20">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
              </div>
            </div>
            <p className="text-sm text-slate-500 font-medium">加载历史记录...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-5">
            {/* 3D empty state */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl blur-xl opacity-50" />
              <div className="absolute -inset-2 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl blur-lg" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-white to-slate-100 flex items-center justify-center shadow-xl border border-slate-200/50">
                <Bot className="w-10 h-10 text-blue-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700">开始对话</p>
              <p className="text-sm text-slate-500 mt-1">发送消息与 {currentDevice?.name || '设备'} 交流</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user'
              // For 3D stacked effect, calculate offset based on position
              const stackDepth = Math.min(index + 1, 5)
              const translateY = isUser ? 0 : Math.min(stackDepth * 2, 8)

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
                    {/* 3D Avatar */}
                    <div className={`
                      flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg
                      ${isUser
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/40'
                        : 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-500/40'
                      }
                    `}>
                      {isUser ? (
                        <User className="w-5 h-5 text-white" />
                      ) : (
                        <Bot className="w-5 h-5 text-white" />
                      )}
                    </div>

                    {/* 3D Message bubble */}
                    <div className="relative" style={{ transform: `translateY(${translateY}px)` }}>
                      {/* Shadow layers for 3D effect */}
                      {!isUser && (
                        <>
                          <div className="absolute -inset-1 bg-slate-300/30 rounded-2xl blur-sm -z-10" />
                          <div className="absolute -inset-0.5 bg-slate-200/50 rounded-2xl -z-10" />
                        </>
                      )}

                      {/* Main bubble */}
                      <div
                        className={`
                          px-5 py-4 rounded-2xl shadow-xl relative group
                          ${isUser
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/30'
                            : 'bg-white/95 backdrop-blur border border-slate-200/80 text-slate-700 shadow-slate-200/60'
                          }
                        `}
                      >
                        {/* Copy button */}
                        <button
                          onClick={() => handleCopyMessage(msg)}
                          className={`
                            absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all
                            ${isUser ? 'hover:bg-blue-400/50 text-white/80' : 'hover:bg-slate-100 text-slate-400'}
                          `}
                          title="复制内容"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        <p className="whitespace-pre-wrap text-sm leading-relaxed pr-8">{msg.content}</p>
                      </div>

                      {/* Time and copy indicator */}
                      <div className={`
                        flex items-center gap-2 mt-2 px-1
                        ${isUser ? 'justify-end' : 'justify-start'}
                      `}>
                        <span className="text-xs text-slate-400">
                          {formatTime(msg.timestamp)}
                        </span>
                        {copiedId === msg.id && (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            已复制
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Loading indicator with 3D effect */}
        {isLoading && (
          <div className="flex justify-start max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2">
            <div className="flex gap-3">
              {/* 3D Avatar */}
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-500/40">
                <Bot className="w-5 h-5 text-white" />
              </div>

              {/* 3D Loading bubble */}
              <div className="relative">
                <div className="absolute -inset-0.5 bg-slate-200/50 rounded-2xl blur-sm -z-10" />
                <div className="px-5 py-4 bg-white/95 backdrop-blur border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/60 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-sm text-slate-600 font-medium">思考中...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area with 3D inset effect */}
      <div className="flex-shrink-0 p-5 bg-gradient-to-t from-slate-100/80 to-white border-t border-slate-200/50">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <div className="relative flex-1">
            {/* 3D inset shadow */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-300/20 to-transparent rounded-xl pointer-events-none" />

            {/* Input field */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all shadow-inner"
              rows={1}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/40 hover:shadow-blue-500/50 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
