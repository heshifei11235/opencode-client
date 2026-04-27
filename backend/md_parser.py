"""
Markdown document parser - extracts device information from JSON code blocks
Supports external field mapping configuration for API response transformations
"""
import json
import re
import os
import yaml
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime


# ============================================================
# Field Mapping Configuration
# ============================================================

# 获取字段映射配置路径
FIELD_MAPPING_PATH = Path(__file__).parent / "field_mapping.yaml"

_field_mapping_config: Dict[str, Dict[str, str]] = {}


def load_field_mapping() -> Dict[str, Dict[str, str]]:
    """加载字段映射配置"""
    global _field_mapping_config

    if _field_mapping_config:
        return _field_mapping_config

    if FIELD_MAPPING_PATH.exists():
        try:
            with open(FIELD_MAPPING_PATH, 'r', encoding='utf-8') as f:
                _field_mapping_config = yaml.safe_load(f) or {}
                return _field_mapping_config
        except Exception as e:
            print(f"Warning: Failed to load field mapping from {FIELD_MAPPING_PATH}: {e}")

    # 默认映射 (当配置文件不存在时使用)
    _field_mapping_config = {
        "device_info": {
            "id": "id",
            "uuid_sha256": "id",
            "udid_sha256": "id",
            "name": "name",
            "host": "host",
            "ip": "host",
            "port": "port",
            "protocol": "protocol",
            "username": "username",
            "group": "group"
        },
        "device_detail": {
            "id": "id",
            "uuid_sha256": "id",
            "udid_sha256": "id",
            "device_name": "device_name",
            "name": "name",
            "device_type": "device_type",
            "device_status": "device_status",
            "device_location": "device_location",
            "device_ip": "device_ip",
            "ip": "device_ip",
            "host": "device_ip",
            "device_port": "device_port",
            "port": "device_port",
            "device_username": "device_username",
            "device_password": "device_password",
            "device_ssh_port": "device_ssh_port",
            "device_ssh_username": "device_ssh_username",
            "day30_active_flg": "day30_active_flg",
            "sample_type_cn": "sample_type_cn",
            "device_extnal_modname": "device_extnal_modname",
            "device_prod_sprdname": "device_prod_sprdname",
            "frame_type": "frame_type",
            "country": "country",
            "province": "province",
            "city": "city",
            "version_category": "version_category",
            "bl_version": "bl_version",
            "security_id": "security_id",
            "oobe_status": "oobe_status",
            "oobe_times": "oobe_times",
            "developer_mode_status": "developer_mode_status",
            "pt_d": "pt_d",
            "city_change_list": "city_change_list",
            "wifi_detection_list": "wifi_detection_list",
            "app_hdc_install_list": "app_hdc_install_list",
            "restart_times": "restart_times",
            "daysof30_active_flglist": "daysof30_active_flglist",
            "cpp_crash_times": "cpp_crash_times",
            "panic_times": "panic_times",
            "top_app_usage": "top_app_usage"
        },
        "wifi_info": {
            "ssid": "ssid",
            "password": "password",
            "bssid": "bssid",
            "apexit_ip": "apexit_ip",
            "happentime": "happentime"
        },
        "risk_analysis": {
            "generation_time": "generation_time",
            "生成时间": "generation_time",
            "analysis_type": "analysis_type",
            "分析类型": "analysis_type",
            "time_range": "time_range",
            "分析时间范围": "time_range",
            "very_high_risk": "very_high_risk",
            "极高风险": "very_high_risk",
            "high_risk": "high_risk",
            "高风险": "high_risk",
            "medium_risk": "medium_risk",
            "中风险": "medium_risk",
            "low_risk": "low_risk",
            "低风险": "low_risk"
        }
    }
    return _field_mapping_config


def get_field_mapping(category: str) -> Dict[str, str]:
    """获取指定类别的字段映射"""
    config = load_field_mapping()
    return config.get(category, {})


def map_field(category: str, api_key: str, default: Any = None) -> Any:
    """
    将 API 字段映射到内部字段

    Args:
        category: 映射类别 (device_info, device_detail, wifi_info, risk_analysis)
        api_key: API 返回的原始字段名
        default: 当映射不存在时使用的默认值

    Returns:
        映射后的值
    """
    mapping = get_field_mapping(category)
    return mapping.get(api_key, api_key if default is None else default)


def apply_field_mapping(category: str, data: dict) -> dict:
    """
    将 API 返回的数据批量映射到内部字段名

    Args:
        category: 映射类别
        data: API 返回的原始数据

    Returns:
        映射后的数据
    """
    mapping = get_field_mapping(category)
    result = {}
    for api_key, value in data.items():
        # 查找映射后的字段名
        internal_key = mapping.get(api_key, api_key)
        result[internal_key] = value
    return result


# ============================================================
# Data Classes
# ============================================================

@dataclass
class DeviceInfo:
    id: str
    name: str
    host: str
    port: int
    username: Optional[str] = None
    protocol: str = "ssh"
    group: Optional[str] = None


@dataclass
class WifiInfo:
    ssid: str
    password: str


@dataclass
class DeviceDetail:
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
    wifi_list: List[WifiInfo] = field(default_factory=list)
    # 扩展字段 (通过字段映射支持)
    extra_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskAnalysis:
    generation_time: str = ""
    analysis_type: str = ""
    time_range: Dict[str, str] = field(default_factory=dict)
    very_high_risk: List[str] = field(default_factory=list)
    high_risk: List[str] = field(default_factory=list)
    medium_risk: List[str] = field(default_factory=list)
    low_risk: List[str] = field(default_factory=list)


@dataclass
class ParseResult:
    devices: List[DeviceInfo]
    risk_analysis: RiskAnalysis
    device_details: Dict[str, DeviceDetail] = field(default_factory=dict)


# ============================================================
# Parsing Functions
# ============================================================

def get_device_id(device_data: dict) -> str | None:
    """Get device ID from device data, supporting multiple ID field names"""
    return device_data.get("id") or device_data.get("uuid_sha256") or device_data.get("udid_sha256")


def find_json_code_blocks(content: str) -> List[dict]:
    """Find all JSON code blocks in markdown content and merge devices from them"""
    devices = []
    device_ids = set()

    # Pattern to match ```json ... ``` blocks
    pattern = r'```json\s*(.*?)\s*```'
    matches = re.findall(pattern, content, re.DOTALL)

    for match in matches:
        try:
            data = json.loads(match)
            # Handle different JSON structures
            if isinstance(data, dict):
                # Case 1: {"devices": [...], "risk_analysis": {...}}
                if "devices" in data:
                    for device in data["devices"]:
                        device_id = get_device_id(device)
                        if device_id and device_id not in device_ids:
                            devices.append(device)
                            device_ids.add(device_id)
                # Case 2: Direct device object
                elif get_device_id(data) and (data.get("host") or data.get("ip")):
                    device_id = get_device_id(data)
                    if device_id and device_id not in device_ids:
                        devices.append(data)
                        device_ids.add(device_id)
            elif isinstance(data, list):
                # Case 3: Array of devices
                for device in data:
                    if isinstance(device, dict):
                        device_id = get_device_id(device)
                        if device_id and device_id not in device_ids:
                            devices.append(device)
                            device_ids.add(device_id)
        except json.JSONDecodeError:
            continue

    return devices


def parse_device(device_data: dict, default_port: int = 4096) -> Optional[DeviceInfo]:
    """Parse a device dictionary into a DeviceInfo object using field mapping"""
    try:
        # 使用字段映射
        mapped_data = apply_field_mapping("device_info", device_data)

        # 获取 ID (优先使用 uuid_sha256 映射后的 id)
        device_id = mapped_data.get("id")
        if not device_id:
            return None

        # 获取 host
        host = mapped_data.get("host")
        if not host:
            return None

        return DeviceInfo(
            id=str(device_id),
            name=mapped_data.get("name", device_id),
            host=str(host),
            port=mapped_data.get("port", default_port),
            username=mapped_data.get("username"),
            protocol=mapped_data.get("protocol", "ssh"),
            group=mapped_data.get("group")
        )
    except Exception:
        return None


def parse_device_detail(device_data: dict) -> Optional[DeviceDetail]:
    """Parse extended device details from device data using field mapping"""
    try:
        # 使用字段映射
        mapped_data = apply_field_mapping("device_detail", device_data)

        # 获取 ID
        device_id = mapped_data.get("id")
        if not device_id:
            return None

        # 解析 WiFi 列表
        wifi_list = []
        wifi_api_data = device_data.get("wifi_detection_list") or mapped_data.get("wifi_detection_list") or []
        wifi_mapping = get_field_mapping("wifi_info")

        for wifi in wifi_api_data:
            if isinstance(wifi, dict):
                # 应用 WiFi 字段映射
                mapped_wifi = {
                    wifi_mapping.get(k, k): v for k, v in wifi.items()
                }
                wifi_list.append(WifiInfo(
                    ssid=mapped_wifi.get("ssid", ""),
                    password=mapped_wifi.get("password", "")
                ))

        # 收集扩展字段 (在 device_detail 映射中未定义的字段)
        known_fields = {
            "id", "device_name", "name", "device_type", "device_status",
            "device_location", "device_ip", "device_port", "device_username",
            "device_password", "device_ssh_port", "device_ssh_username", "wifi_list"
        }
        extra_fields = {k: v for k, v in mapped_data.items() if k not in known_fields}

        return DeviceDetail(
            id=str(device_id),
            device_name=mapped_data.get("device_name", mapped_data.get("name", device_id)),
            device_type=mapped_data.get("device_type", "Server"),
            device_status=mapped_data.get("device_status", "Online"),
            device_location=mapped_data.get("device_location", ""),
            device_ip=mapped_data.get("device_ip", ""),
            device_port=mapped_data.get("device_port", 4096),
            device_username=mapped_data.get("device_username", ""),
            device_password=mapped_data.get("device_password", ""),
            device_ssh_port=mapped_data.get("device_ssh_port", 22),
            device_ssh_username=mapped_data.get("device_ssh_username", ""),
            wifi_list=wifi_list,
            extra_fields=extra_fields
        )
    except Exception:
        return None


def parse_risk_analysis(data: dict) -> RiskAnalysis:
    """Parse risk analysis data from JSON (supports both English and Chinese keys)"""
    risk_mapping = get_field_mapping("risk_analysis")

    # 合并原始 key 和映射后的 key
    risk = data.get("risk_analysis", data)

    # 从映射中获取值 (支持中英文)
    generation_time = risk.get("generation_time") or risk.get("生成时间") or ""
    if not generation_time:
        generation_time = risk_mapping.get("generation_time", "")

    analysis_type = risk.get("analysis_type") or risk.get("分析类型", "network_scan")
    if not analysis_type:
        generation_time = risk_mapping.get("analysis_type", "network_scan")

    time_range = risk.get("time_range") or risk.get("分析时间范围", {"start": "", "end": ""})

    very_high_risk = risk.get("very_high_risk") or risk.get("极高风险", [])
    high_risk = risk.get("high_risk") or risk.get("高风险", [])
    medium_risk = risk.get("medium_risk") or risk.get("中风险", [])
    low_risk = risk.get("low_risk") or risk.get("低风险", [])

    return RiskAnalysis(
        generation_time=str(generation_time),
        analysis_type=str(analysis_type),
        time_range=time_range,
        very_high_risk=very_high_risk if isinstance(very_high_risk, list) else [],
        high_risk=high_risk if isinstance(high_risk, list) else [],
        medium_risk=medium_risk if isinstance(medium_risk, list) else [],
        low_risk=low_risk if isinstance(low_risk, list) else []
    )


def parse_md_document_full(file_path: str) -> ParseResult:
    """Parse a markdown or JSON file and extract all information including risk analysis

    If the file has a .json extension, parse it directly as JSON.
    If the file has a .md extension, extract JSON code blocks from it.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    devices = []
    device_ids = set()
    risk_analysis = RiskAnalysis()
    device_details: Dict[str, DeviceDetail] = {}

    # Check if this is a direct JSON file or a markdown file
    if file_path.endswith('.json'):
        # Direct JSON file - parse the entire content as JSON
        try:
            data = json.loads(content)
            risk_analysis = _process_json_data(data, devices, device_ids, risk_analysis, device_details)
        except json.JSONDecodeError:
            pass
    else:
        # Markdown file - find all JSON code blocks
        pattern = r'```json\s*(.*?)\s*```'
        matches = re.findall(pattern, content, re.DOTALL)

        for match in matches:
            try:
                data = json.loads(match)
                risk_analysis = _process_json_data(data, devices, device_ids, risk_analysis, device_details)
            except json.JSONDecodeError:
                continue

    # Convert to DeviceInfo objects
    device_infos = []
    for device_data in devices:
        device = parse_device(device_data)
        if device:
            device_infos.append(device)

    return ParseResult(
        devices=device_infos,
        risk_analysis=risk_analysis,
        device_details=device_details
    )


def _process_json_data(
    data: dict,
    devices: List[dict],
    device_ids: set,
    risk_analysis: RiskAnalysis,
    device_details: Dict[str, DeviceDetail]
) -> RiskAnalysis:
    """Process parsed JSON data and extract devices and risk analysis"""
    # Parse risk analysis if present (supports both English and Chinese keys)
    if isinstance(data, dict):
        has_risk_data = (
            "risk_analysis" in data or "very_high_risk" in data or
            "极高风险" in data or "高风险" in data or
            "中风险" in data or "低风险" in data
        )
        if has_risk_data:
            risk_analysis = parse_risk_analysis(data)

        # Extract devices and details
        if "devices" in data:
            for device_data in data["devices"]:
                # 支持 id, uuid_sha256 或 udid_sha256 作为设备标识
                device_id = get_device_id(device_data)
                if device_id and device_id not in device_ids:
                    devices.append(device_data)
                    device_ids.add(device_id)

                    # Parse and store device detail
                    detail = parse_device_detail(device_data)
                    if detail:
                        device_details[device_id] = detail
        elif get_device_id(data):
            device_id = get_device_id(data)
            if device_id and device_id not in device_ids:
                devices.append(data)
                device_ids.add(device_id)
                detail = parse_device_detail(data)
                if detail:
                    device_details[device_id] = detail

    elif isinstance(data, list):
        for device_data in data:
            if isinstance(device_data, dict):
                device_id = get_device_id(device_data)
                if device_id and device_id not in device_ids:
                    devices.append(device_data)
                    device_ids.add(device_id)
                    detail = parse_device_detail(device_data)
                    if detail:
                        device_details[device_id] = detail

    return risk_analysis


def parse_md_document(file_path: str) -> List[DeviceInfo]:
    """Parse a markdown file and extract device information (legacy)"""
    result = parse_md_document_full(file_path)
    return result.devices


def list_md_documents(directory: str) -> List[str]:
    """List all markdown files in a directory"""
    if not os.path.exists(directory):
        raise FileNotFoundError(f"Directory not found: {directory}")

    md_files = []
    for filename in os.listdir(directory):
        if filename.endswith(".md"):
            md_files.append(filename)

    return sorted(md_files)
