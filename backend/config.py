"""
配置文件加载模块
"""
import os
import yaml
import logging
from pathlib import Path

# 获取配置文件路径
CONFIG_PATH = Path(__file__).parent / "config.yaml"

# 默认配置
DEFAULT_CONFIG = {
    "server": {
        "port": 8000,
        "debug": False,
        "cors_origins": ["*"]
    },
    "database": {
        "path": "opencode_client.db"
    },
    "opencode": {
        "default_url": "http://localhost:4096",
        "timeout": 60,
        "username": "",
        "password": ""
    },
    "auth": {
        "enabled": True,
        "pbkdf2_iterations": 100000
    },
    "logging": {
        "level": "INFO",
        "console": True,
        "file": None
    },
    "debug": {
        "print_api_requests": True,
        "print_database_operations": False,
        "print_cache_operations": True,
        "print_opencode_communication": True
    },
    "upload": {
        "max_size": 10,
        "allowed_extensions": [".md", ".json", ".txt"]
    }
}

_config = None
_logger = None


def load_config() -> dict:
    """加载配置文件"""
    global _config

    if _config is not None:
        return _config

    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                user_config = yaml.safe_load(f) or {}
                # 合并默认配置和用户配置
                _config = merge_config(DEFAULT_CONFIG, user_config)
        except Exception as e:
            print(f"Warning: Failed to load config from {CONFIG_PATH}: {e}")
            _config = DEFAULT_CONFIG
    else:
        print(
            f"Warning: Config file not found at {CONFIG_PATH}, using defaults")
        _config = DEFAULT_CONFIG

    # 初始化日志
    _init_logging()

    return _config


def merge_config(default: dict, user: dict) -> dict:
    """递归合并配置"""
    result = default.copy()
    for key, value in user.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_config(result[key], value)
        else:
            result[key] = value
    return result


def get_config() -> dict:
    """获取配置（单例）"""
    if _config is None:
        return load_config()
    return _config


def _init_logging():
    """初始化日志配置"""
    global _logger
    logging_config = get_config().get("logging", {})

    level = getattr(logging, logging_config.get(
        "level", "INFO").upper(), logging.INFO)
    log_format = "%(asctime)s [%(levelname)s] %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # 配置根日志
    logging.basicConfig(
        level=level,
        format=log_format,
        datefmt=date_format
    )

    _logger = logging.getLogger("opencode")

    # 文件输出（如果配置了）
    log_file = logging_config.get("file")
    if log_file:
        log_path = Path(__file__).parent / log_file
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setLevel(level)
        file_handler.setFormatter(logging.Formatter(log_format, date_format))
        _logger.addHandler(file_handler)

    # 打印启动信息
    _logger.info("=" * 50)
    _logger.info("OpenCode Client 后端服务配置")
    _logger.info("=" * 50)
    _logger.info(f"日志级别: {logging_config.get('level')}")
    _logger.info(f"日志文件: {log_file or '无'}")
    _logger.info(
        f"调试模式: {'开启' if get_config().get('server', {}).get('debug') else '关闭'}")
    _logger.info("=" * 50)


def get_logger():
    """获取日志器"""
    global _logger
    if _logger is None:
        _init_logging()
    return _logger or logging.getLogger("opencode")


def get_debug_config() -> dict:
    """获取调试配置"""
    return get_config().get("debug", {})


# 便捷访问函数
def get_server_config() -> dict:
    """获取服务器配置"""
    return get_config().get("server", {})


def get_database_config() -> dict:
    """获取数据库配置"""
    return get_config().get("database", {})


def get_opencode_config() -> dict:
    """获取 OpenCode 服务配置"""
    return get_config().get("opencode", {})


def get_auth_config() -> dict:
    """获取认证配置"""
    return get_config().get("auth", {})


def get_logging_config() -> dict:
    """获取日志配置"""
    return get_config().get("logging", {})


# 导出配置
CONFIG = load_config()
