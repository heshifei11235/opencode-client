from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


# ==================== Project Models ====================

class ProjectCreate(BaseModel):
    name: str
    path: str  # Local project directory path


class ProjectResponse(BaseModel):
    id: int
    name: str
    path: str
    created_at: datetime
    updated_at: datetime


# ==================== Document Models ====================

class DocumentInfo(BaseModel):
    id: str  # projectId_filename
    project_id: int
    filename: str  # md filename without extension
    full_path: str  # complete file path


class DocumentParseRequest(BaseModel):
    project_id: int
    filename: str  # md filename


class DeviceInfo(BaseModel):
    id: str
    name: str
    host: str
    port: int
    username: Optional[str] = None
    protocol: str = "ssh"  # ssh, telnet, http
    group: Optional[str] = None


class RiskAnalysisData(BaseModel):
    generation_time: str = ""
    analysis_type: str = ""
    time_range: dict = {}
    very_high_risk: List[str] = []
    high_risk: List[str] = []
    medium_risk: List[str] = []
    low_risk: List[str] = []


# ==================== Device Models ====================

class WifiInfo(BaseModel):
    ssid: str
    password: str


class DeviceDetail(BaseModel):
    id: str
    device_name: str
    device_type: str = "Server"
    device_status: str = "Online"
    device_location: str = ""
    device_ip: str = ""
    device_port: int = 4096
    device_username: str = ""
    device_password: str = ""
    device_ssh_port: int = 22
    device_ssh_username: str = ""
    wifi_list: List[WifiInfo] = []


class DocumentParseResponse(BaseModel):
    devices: List[DeviceInfo]
    risk_analysis: RiskAnalysisData = RiskAnalysisData()
    device_details: Dict[str, DeviceDetail] = {}


class DeviceConnectionCreate(BaseModel):
    project_id: int
    document_id: str
    device_id: str
    name: str
    url: str  # OpenCode server URL
    username: Optional[str] = None
    password: Optional[str] = None


class DeviceConnectionResponse(BaseModel):
    id: int
    project_id: int
    document_id: str
    device_id: str
    name: str
    url: str
    username: Optional[str] = None
    created_at: datetime


class DeviceDetailResponse(BaseModel):
    id: str
    device_name: str
    device_type: str
    device_status: str
    device_location: str
    device_ip: str
    device_port: int
    device_username: str
    device_password: str
    device_ssh_port: int
    device_ssh_username: str
    wifi_list: List[WifiInfo]


# ==================== Connection models (legacy, to be phased out) ====================

class ConnectionCreate(BaseModel):
    name: str
    url: str
    username: Optional[str] = None
    password: Optional[str] = None
    working_directory: Optional[str] = None


class ConnectionResponse(BaseModel):
    id: int
    name: str
    url: str
    username: Optional[str] = None
    working_directory: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ConnectionTest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None


# Session models
class SessionCreate(BaseModel):
    connection_id: int


class SessionResponse(BaseModel):
    id: str
    connection_id: int
    remote_session_id: Optional[str] = None
    created_at: datetime


# Chat models
class MessageSend(BaseModel):
    session_id: str
    content: str


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    timestamp: datetime


# Password models
class PasswordEntryCreate(BaseModel):
    category: str  # website, app, email
    name: str
    username: str
    password: str
    url: Optional[str] = None
    notes: Optional[str] = None


class PasswordEntryResponse(BaseModel):
    id: int
    category: str
    name: str
    username: str
    url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# Auth models
class MasterPasswordVerify(BaseModel):
    password: str


class MasterPasswordSet(BaseModel):
    password: str
