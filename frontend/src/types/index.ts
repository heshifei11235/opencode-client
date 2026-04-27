// ==================== Project Types ====================

export interface Project {
  id: number;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

// ==================== Document Types ====================

export interface MdDocument {
  id: string;  // projectId_filename
  project_id: number;
  filename: string;  // md filename without extension
  full_path: string;
}

// ==================== Device Types ====================

export type RiskLevel = 'very-high' | 'high' | 'medium' | 'low'

export interface Device {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  protocol: 'ssh' | 'telnet' | 'http';
  group?: string;
  risk_level?: RiskLevel;
}

export interface DeviceDetail {
  id: string;
  device_name: string;
  device_type: string;
  device_status: string;
  device_location: string;
  device_ip: string;
  device_port: number;
  device_username: string;
  device_password: string;
  device_ssh_port: number;
  device_ssh_username: string;
  wifi_list: Array<{
    ssid: string;
    password: string;
  }>;
  // 扩展字段 (通过 field_mapping.yaml 映射的字段)
  [key: string]: unknown;
}

export interface RiskAnalysis {
  generation_time: string;
  analysis_type: string;
  time_range: {
    start: string;
    end: string;
  };
  very_high_risk: string[];
  high_risk: string[];
  medium_risk: string[];
  low_risk: string[];
}

export interface DeviceConnection {
  id: number;
  project_id: number;
  document_id: string;
  device_id: string;
  name: string;
  url: string;
  username?: string;
  created_at: string;
}

// ==================== Legacy Connection (to be phased out) ====================

export interface Connection {
  id: number;
  name: string;
  url: string;
  username?: string;
  working_directory?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  connection_id: number;
  remote_session_id?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PasswordEntry {
  id: number;
  category: 'website' | 'app' | 'email';
  name: string;
  username: string;
  url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PasswordEntryFull extends PasswordEntry {
  password: string;
}

export interface AuthStatus {
  has_master_password: boolean;
  is_unlocked: boolean;
}
