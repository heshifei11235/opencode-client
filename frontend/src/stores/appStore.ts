import { create } from 'zustand'
import type { Project, MdDocument, Device, DeviceConnection, ChatMessage, Connection, PasswordEntry, AuthStatus } from '@/types'

// Risk level types
export type RiskLevel = 'very-high' | 'high' | 'medium' | 'low'

export interface RiskAnalysis {
  generation_time: string
  analysis_type: string
  time_range: {
    start: string
    end: string
  }
  very_high_risk: string[]
  high_risk: string[]
  medium_risk: string[]
  low_risk: string[]
}

// Device info from API
export interface DeviceDetail {
  id: string
  device_name: string
  device_type: string
  device_status: string
  device_location: string
  device_ip: string
  device_port: number
  device_username: string
  device_password: string
  device_ssh_port: number
  device_ssh_username: string
  // 扩展字段
  ip?: string
  country?: string
  province?: string
  city?: string
  pt_d?: string
  day30_active_flg?: string
  sample_type_cn?: string
  device_extnal_modname?: string
  device_prod_sprdname?: string
  frame_type?: string
  version_category?: string
  bl_version?: string
  security_id?: string
  oobe_times?: string
  developer_mode_status?: string
  wifi_detection_list?: Array<{
    ssid: string
    bssid: string
    apexit_ip: string
    happentime: string
  }>
  city_change_list?: string
}

interface ChatSession {
  sessionId: string | null
  messages: ChatMessage[]
  isLoading: boolean
  isAnalyzing: boolean
  chatHistoryFetched: boolean
}

// Default empty session
const DEFAULT_SESSION: ChatSession = {
  sessionId: null,
  messages: [],
  isLoading: false,
  isAnalyzing: false,
  chatHistoryFetched: false
}

interface AppState {
  // View state
  activeView: 'chat' | 'password';
  setActiveView: (view: 'chat' | 'password') => void;

  // Project state
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: number) => void;

  // Current project documents
  currentProjectDocuments: MdDocument[];
  setCurrentProjectDocuments: (docs: MdDocument[]) => void;

  // Current project
  currentProjectId: number | null;
  setCurrentProjectId: (id: number | null) => void;

  // Current document devices (with risk levels)
  currentDevices: Device[];
  setCurrentDevices: (devices: Device[]) => void;

  // Risk analysis data
  riskAnalysis: RiskAnalysis | null;
  setRiskAnalysis: (analysis: RiskAnalysis | null) => void;

  // Device details (fetched from API)
  deviceDetails: Record<string, DeviceDetail>;
  setDeviceDetail: (id: string, detail: DeviceDetail) => void;

  // Device details loading state
  deviceDetailLoading: Record<string, boolean>;
  setDeviceDetailLoading: (id: string, loading: boolean) => void;

  // Active device
  activeDeviceId: string | null;
  setActiveDevice: (id: string | null) => void;

  // Open device tabs (multiple devices can have open chats)
  openDeviceIds: string[];
  addOpenDevice: (id: string) => void;
  removeOpenDevice: (id: string) => void;

  // Active document (the document whose devices are currently displayed)
  activeDocumentId: string | null;
  setActiveDocumentId: (id: string | null) => void;

  // Device connections
  deviceConnections: DeviceConnection[];
  setDeviceConnections: (connections: DeviceConnection[]) => void;
  addDeviceConnection: (conn: DeviceConnection) => void;
  removeDeviceConnection: (id: number) => void;

  // Chat state - per device connection id
  chatSessions: Record<string, ChatSession>;
  setChatSession: (deviceId: string, session: ChatSession) => void;
  addChatMessage: (deviceId: string, message: ChatMessage) => void;
  setDeviceLoading: (deviceId: string, loading: boolean) => void;
  setDeviceAnalyzing: (deviceId: string, analyzing: boolean) => void;
  clearChatMessages: (deviceId: string) => void;

  // Legacy connection state (to be phased out)
  connections: Connection[];
  setConnections: (connections: Connection[]) => void;
  addConnection: (connection: Connection) => void;
  removeConnection: (id: number) => void;
  activeConnectionId: number | null;
  setActiveConnection: (id: number | null) => void;

  // Password state
  passwords: PasswordEntry[];
  setPasswords: (passwords: PasswordEntry[]) => void;
  addPassword: (password: PasswordEntry) => void;
  removePassword: (id: number) => void;

  // Auth state
  authStatus: AuthStatus;
  setAuthStatus: (status: AuthStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // View state
  activeView: 'chat',
  setActiveView: (view) => set({ activeView: view }),

  // Project state
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => ({
    projects: [project, ...state.projects]
  })),
  removeProject: (id) => set((state) => ({
    projects: state.projects.filter(p => p.id !== id)
  })),

  // Current project documents
  currentProjectDocuments: [],
  setCurrentProjectDocuments: (docs) => set({ currentProjectDocuments: docs }),

  // Current project
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  // Current document devices
  currentDevices: [],
  setCurrentDevices: (devices) => set({ currentDevices: devices }),

  // Risk analysis
  riskAnalysis: null,
  setRiskAnalysis: (analysis) => set({ riskAnalysis: analysis }),

  // Device details
  deviceDetails: {},
  setDeviceDetail: (id, detail) => set((state) => ({
    deviceDetails: { ...state.deviceDetails, [id]: detail }
  })),

  // Device details loading state
  deviceDetailLoading: {},
  setDeviceDetailLoading: (id, loading) => set((state) => ({
    deviceDetailLoading: { ...state.deviceDetailLoading, [id]: loading }
  })),

  // Active device
  activeDeviceId: null,
  setActiveDevice: (id) => set({ activeDeviceId: id }),

  // Open device tabs
  openDeviceIds: [],
  addOpenDevice: (id) => set((state) => {
    if (state.openDeviceIds.includes(id)) return state
    return { openDeviceIds: [...state.openDeviceIds, id] }
  }),
  removeOpenDevice: (id) => set((state) => ({
    openDeviceIds: state.openDeviceIds.filter(d => d !== id)
  })),

  // Active document
  activeDocumentId: null,
  setActiveDocumentId: (id) => set({ activeDocumentId: id }),

  // Device connections
  deviceConnections: [],
  setDeviceConnections: (connections) => set({ deviceConnections: connections }),
  addDeviceConnection: (conn) => set((state) => ({
    deviceConnections: [conn, ...state.deviceConnections]
  })),
  removeDeviceConnection: (id) => set((state) => ({
    deviceConnections: state.deviceConnections.filter(c => c.id !== id)
  })),

  // Chat state
  chatSessions: {},
  setChatSession: (deviceId, session) => set((state) => ({
    chatSessions: {
      ...state.chatSessions,
      [deviceId]: session
    }
  })),
  addChatMessage: (deviceId, message) => set((state) => {
    const current = state.chatSessions[deviceId] || { sessionId: null, messages: [], isLoading: false, isAnalyzing: false, chatHistoryFetched: false }
    return {
      chatSessions: {
        ...state.chatSessions,
        [deviceId]: {
          ...current,
          messages: [...(current.messages || []), message]
        }
      }
    }
  }),
  clearChatMessages: (deviceId) => set((state) => ({
    chatSessions: {
      ...state.chatSessions,
      [deviceId]: DEFAULT_SESSION
    }
  })),
  setDeviceLoading: (deviceId, loading) => set((state) => {
    const current = state.chatSessions[deviceId] || DEFAULT_SESSION
    return {
      chatSessions: {
        ...state.chatSessions,
        [deviceId]: { ...current, isLoading: loading }
      }
    }
  }),
  setDeviceAnalyzing: (deviceId, analyzing) => set((state) => {
    const current = state.chatSessions[deviceId] || DEFAULT_SESSION
    return {
      chatSessions: {
        ...state.chatSessions,
        [deviceId]: { ...current, isAnalyzing: analyzing }
      }
    }
  }),

  // Legacy connection state
  connections: [],
  setConnections: (connections) => set({ connections }),
  addConnection: (connection) => set((state) => ({
    connections: [connection, ...state.connections]
  })),
  removeConnection: (id) => set((state) => ({
    connections: state.connections.filter(c => c.id !== id)
  })),
  activeConnectionId: null,
  setActiveConnection: (id) => set({ activeConnectionId: id }),

  // Password state
  passwords: [],
  setPasswords: (passwords) => set({ passwords }),
  addPassword: (password) => set((state) => ({
    passwords: [password, ...state.passwords]
  })),
  removePassword: (id) => set((state) => ({
    passwords: state.passwords.filter(p => p.id !== id)
  })),

  // Auth state
  authStatus: { has_master_password: false, is_unlocked: false },
  setAuthStatus: (status) => set({ authStatus: status }),
}))
