import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Send, Loader2, User, Bot, Circle } from 'lucide-react'
import { generateId } from '@/lib/utils'

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel() {
  const activeConnectionId = useAppStore(s => s.activeConnectionId)
  const connections = useAppStore(s => s.connections)
  const chatSessions = useAppStore(s => s.chatSessions)
  const setChatSession = useAppStore(s => s.setChatSession)
  const addChatMessage = useAppStore(s => s.addChatMessage)

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const activeConnectionIdRef = useRef<number | null>(null)

  const currentConnection = connections.find(c => c.id === activeConnectionId)
  const connectionName = currentConnection?.name || 'Unknown'

  useEffect(() => {
    activeConnectionIdRef.current = activeConnectionId
  }, [activeConnectionId])

  const currentSession = activeConnectionId
    ? chatSessions[activeConnectionId]
    : null
  const messages = currentSession?.messages || []
  const storedSessionId = currentSession?.sessionId || null

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!activeConnectionId) return

    if (!storedSessionId) {
      const createOrGetSession = async () => {
        try {
          const res = await fetch(`/api/connections/${activeConnectionId}/sessions/latest`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
          if (res.ok) {
            const sessionData = await res.json()
            setChatSession(activeConnectionId, {
              sessionId: sessionData.id,
              messages: []
            })
          }
        } catch (err) {
          console.error('Failed to get/create session:', err)
        }
      }
      createOrGetSession()
      return
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setWsConnected(false)

    const ws = new WebSocket(`/ws/chat/${storedSessionId}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected to existing session')
      setWsConnected(true)
      setIsLoading(false)
      ws.send(JSON.stringify({ type: 'history' }))
    }

    ws.onmessage = (event) => {
      try {
        const msgData = JSON.parse(event.data)
        console.log('WebSocket message:', msgData)

        if (activeConnectionIdRef.current !== activeConnectionId) {
          return
        }

        if (msgData.type === 'history') {
          const history = msgData.data || []
          if (history.length > 0 && activeConnectionIdRef.current) {
            const connId = activeConnectionIdRef.current
            setChatSession(connId, {
              sessionId: storedSessionId,
              messages: history
            })
          }
          setIsLoading(false)
        } else if (msgData.type === 'message') {
          const parts = msgData.data?.parts || []
          let textContent = ''

          for (const part of parts) {
            if (part.type === 'text' && part.text) {
              textContent += part.text
            }
          }

          if (textContent && activeConnectionIdRef.current === activeConnectionId) {
            addChatMessage(activeConnectionId, {
              id: generateId(),
              role: 'assistant',
              content: textContent,
              timestamp: new Date().toISOString()
            })
          }

          setIsLoading(false)
        } else if (msgData.type === 'error') {
          console.error('Error from server:', msgData.message)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to parse message:', err)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsLoading(false)
    }

    ws.onclose = () => {
      console.log('WebSocket closed')
      setWsConnected(false)
      wsRef.current = null
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [activeConnectionId, storedSessionId])

  const handleSend = () => {
    if (!input.trim() || !activeConnectionId || isLoading) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, state:', wsRef.current?.readyState)
      return
    }

    const content = input.trim()

    addChatMessage(activeConnectionId, {
      id: generateId(),
      role: 'user',
      content: content,
      timestamp: new Date().toISOString()
    })

    setInput('')
    setIsLoading(true)

    wsRef.current.send(JSON.stringify({
      type: 'prompt',
      content: content
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!activeConnectionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <p className="text-lg font-medium text-foreground">Select a connection</p>
          <p className="text-sm text-muted-foreground">Choose from the sidebar or add a new connection</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {wsConnected ? (
                <div className="relative">
                  <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />
                  <div className="absolute inset-0 animate-ping">
                    <Circle className="w-2.5 h-2.5 fill-green-500/30 text-green-500" />
                  </div>
                </div>
              ) : (
                <Circle className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500 animate-pulse" />
              )}
              <span className={`text-sm font-medium ${wsConnected ? 'text-green-600' : 'text-yellow-600'}`}>
                {wsConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-sm font-medium text-slate-700">{connectionName}</span>
            {storedSessionId && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-px bg-slate-200" />
                <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded" title={`Session ID: ${storedSessionId}`}>
                  {storedSessionId}
                </span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 bg-white scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/10">
              <Bot className="w-10 h-10 text-blue-500" />
            </div>
            <p className="text-lg font-semibold text-slate-700">Start a conversation</p>
            <p className="text-sm text-slate-500">Send a message to begin chatting with OpenCode</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-md ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      : 'bg-gradient-to-br from-slate-700 to-slate-800 text-white'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-lg ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-slate-200/50'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <span className={`text-xs text-slate-400 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {isLoading && (
          <div className="flex justify-start max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-2">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-md">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg shadow-slate-200/50 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm text-slate-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-slate-100 p-4 bg-slate-50/50">
        <div className="flex gap-3 max-w-xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={wsConnected ? "Type your message..." : "Connecting..."}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
            rows={1}
            disabled={!wsConnected}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !wsConnected}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-lg shadow-blue-500/30 hover:scale-105"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
