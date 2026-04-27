# 设备接口文档

本文档描述 OpenCode Client 中与设备相关的接口、数据结构和使用方法。

## 目录

- [数据模型](#数据模型)
- [接口列表](#接口列表)
- [使用流程](#使用流程)
- [相关文件](#相关文件)

---

## 数据模型

### Project (项目)

```typescript
interface Project {
  id: number;           // 项目ID
  name: string;         // 项目名称
  path: string;         // 本地路径（设备配置文件所在目录）
  created_at: string;   // 创建时间
  updated_at: string;   // 更新时间
}
```

### MdDocument (文档)

```typescript
interface MdDocument {
  id: string;           // 格式: "{project_id}_{filename}"
  project_id: number;   // 所属项目ID
  filename: string;     // 文件名（不含扩展名）
  full_path: string;    // 完整文件路径
}
```

### Device (设备)

```typescript
interface Device {
  id: string;           // 设备唯一标识
  name: string;         // 设备名称
  host: string;         // 主机地址
  port: number;         // 端口
  username?: string;    // 用户名
  protocol: 'ssh' | 'telnet' | 'http';
  group?: string;       // 分组
  risk_level?: 'very-high' | 'high' | 'medium' | 'low';  // 风险等级
}
```

### DeviceDetail (设备详细信息)

```typescript
interface DeviceDetail {
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
}
```

### RiskAnalysis (风险分析)

```typescript
interface RiskAnalysis {
  generation_time: string;
  analysis_type: string;
  time_range: {
    start: string;
    end: string;
  };
  very_high_risk: string[];  // 极高风险设备ID列表
  high_risk: string[];        // 高风险设备ID列表
  medium_risk: string[];       // 中等风险设备ID列表
  low_risk: string[];          // 低风险设备ID列表
}
```

### DeviceConnection (设备连接)

```typescript
interface DeviceConnection {
  id: number;            // 连接ID
  project_id: number;    // 所属项目ID
  document_id: string;   // 文档ID (格式: "{project_id}_{filename}")
  device_id: string;    // 设备ID
  name: string;         // 连接名称
  url: string;         // OpenCode 服务地址
  username?: string;
  password?: string;
  created_at: string;
}
```

### ChatSession (聊天会话)

```typescript
interface ChatSession {
  sessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isAnalyzing: boolean;
  chatHistoryFetched: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

---

## 接口列表

### 1. 创建项目

```
POST /api/projects
```

请求体：
```json
{
  "name": "我的项目",
  "path": "/path/to/configs"
}
```

响应：
```json
{
  "id": 1,
  "name": "我的项目",
  "path": "/path/to/configs",
  "created_at": "2026-04-25 10:00:00",
  "updated_at": "2026-04-25 10:00:00"
}
```

---

### 2. 获取所有项目

```
GET /api/projects
```

响应：
```json
[
  {
    "id": 1,
    "name": "我的项目",
    "path": "/path/to/configs",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

---

### 3. 删除项目

```
DELETE /api/projects/{project_id}
```

---

### 4. 获取项目文档列表

```
GET /api/projects/{project_id}/documents
```

响应：
```json
[
  {
    "id": "1_test1",
    "project_id": 1,
    "filename": "test1",
    "full_path": "/path/to/configs/test1.md"
  }
]
```

---

### 5. 获取项目 Prompt 文件

```
GET /api/projects/{project_id}/prompt
```

响应：
```json
{
  "prompt": "你是一个专业的网络安全分析助手...\n{device_info}"
}
```

---

### 6. 解析文档 (核心接口)

```
POST /api/documents/parse
```

请求体：
```json
{
  "project_id": 1,
  "filename": "test1"
}
```

响应：
```json
{
  "devices": [
    {
      "id": "server-a",
      "name": "服务器A",
      "host": "192.168.1.100",
      "port": 4096,
      "username": "admin",
      "protocol": "ssh",
      "group": null
    }
  ],
  "risk_analysis": {
    "generation_time": "2026-04-25 10:00",
    "analysis_type": "network_scan",
    "time_range": { "start": "2026-04-25", "end": "2026-04-25" },
    "very_high_risk": ["server-a"],
    "high_risk": ["server-b"],
    "medium_risk": ["router-1"],
    "low_risk": []
  },
  "device_details": {
    "server-a": {
      "id": "server-a",
      "device_name": "服务器A",
      "device_type": "Server",
      "device_status": "Online",
      "device_location": "Data Center A",
      "device_ip": "192.168.1.100",
      "device_port": 4096,
      "device_username": "admin",
      "device_password": "password123",
      "device_ssh_port": 22,
      "device_ssh_username": "root",
      "wifi_list": [...]
    }
  }
}
```

**重要副作用：**
- 解析后的设备会自动创建到 `device_connections` 表
- 设备详情会缓存到内存 `device_details_cache`

---

### 7. 获取设备聊天历史

```
GET /api/devices/{device_id}/chat-history
```

响应：
```json
{
  "messages": [
    {
      "id": "1",
      "role": "user",
      "content": "你好",
      "timestamp": "2026-04-25 10:00:00"
    },
    {
      "id": "2",
      "role": "assistant",
      "content": "你好，有什么可以帮你的？",
      "timestamp": "2026-04-25 10:00:01"
    }
  ]
}
```

---

### 8. 发送消息到设备 (核心接口)

```
POST /api/chat/device
```

请求体：
```json
{
  "device_id": "server-a",
  "project_id": 1,
  "filename": "test1",
  "message": "你好"
}
```

响应：
```json
{
  "response": "你好，有什么可以帮你的？",
  "success": true
}
```

**处理流程：**
1. 从缓存获取设备信息
2. 查找数据库中的设备连接
3. 获取或创建设备会话
4. 通过 HTTP 与 OpenCode 服务通信
5. 保存消息到 `device_chat_messages` 表
6. 返回响应

---

### 9. AI 分析设备

```
POST /api/ai/analyze
```

请求体：
```json
{
  "prompt": "你是一个网络安全分析助手...\n{device_info}",
  "device": { /* DeviceDetail 对象 */ },
  "project_id": 1,
  "filename": "test1"
}
```

响应：
```json
{
  "response": "根据分析，该设备存在以下安全问题...",
  "prompt": "完整的提示词模板"
}
```

---

### 10. 获取设备详情 (从缓存)

```
GET /api/devices/detail?device_id=xxx&project_id=1&filename=test1
```

响应：
```json
{
  "id": "server-a",
  "device_name": "服务器A",
  ...
}
```

---

### 11. 获取所有设备连接

```
GET /api/devices
```

响应：
```json
[
  {
    "id": 1,
    "project_id": 1,
    "document_id": "1_test1",
    "device_id": "server-a",
    "name": "服务器A",
    "url": "http://localhost:4096",
    "username": "admin",
    "created_at": "2026-04-25 10:00:00"
  }
]
```

---

## 使用流程

### 流程一：完整对话流程

```
1. 创建项目
   POST /api/projects
   → 获取 project_id

2. 获取项目文档
   GET /api/projects/{project_id}/documents
   → 获取文档列表

3. 解析文档（同时创建设备连接）
   POST /api/documents/parse
   → 获取设备列表、风险等级、设备详情
   → 自动创建设备连接到数据库

4. 发送消息
   POST /api/chat/device
   → 自动创建会话
   → 保存消息
   → 返回响应

5. 获取聊天历史
   GET /api/devices/{device_id}/chat-history
   → 返回历史消息
```

### 流程二：AI 分析流程

```
1. 获取 prompt 模板
   GET /api/projects/{project_id}/prompt

2. 发起 AI 分析
   POST /api/ai/analyze
   → 结合设备和 prompt 生成分析结果
```

---

## 相关文件

### 后端文件

| 文件 | 说明 |
|------|------|
| `main.py` | API 端点实现 |
| `database.py` | 数据库操作（device_connections, device_sessions, device_chat_messages） |
| `models.py` | Pydantic 数据模型 |
| `md_parser.py` | Markdown/JSON 文档解析 |
| `remote_client.py` | OpenCode 服务通信客户端 |
| `config.py` | 配置加载 |
| `config.yaml` | 配置文件 |

### 前端文件

| 文件 | 说明 |
|------|------|
| `ChatPanel.tsx` | 聊天面板组件 |
| `ProjectPanel.tsx` | 项目面板组件 |
| `DeviceInfoPanel.tsx` | 设备信息面板 |
| `appStore.ts` | Zustand 状态管理 |

### 数据库表

| 表名 | 说明 |
|------|------|
| `projects` | 项目表 |
| `device_connections` | 设备连接表 |
| `device_sessions` | 设备会话表 |
| `device_chat_messages` | 设备聊天消息表 |

---

## 设备配置文件格式

### JSON 格式

```json
{
  "devices": [
    {
      "id": "server-a",
      "name": "服务器A",
      "host": "192.168.1.100",
      "port": 4096,
      "username": "admin",
      "protocol": "ssh",
      "device_type": "Server",
      "device_status": "Online",
      "device_location": "Data Center A",
      "device_password": "password123",
      "device_ssh_port": 22,
      "device_ssh_username": "root",
      "wifi_list": [
        { "ssid": "Office-WiFi", "password": "password123" }
      ]
    }
  ],
  "risk_analysis": {
    "generation_time": "2026-04-25 10:00",
    "analysis_type": "network_scan",
    "time_range": { "start": "2026-04-25", "end": "2026-04-25" },
    "very_high_risk": ["server-a"],
    "high_risk": [],
    "medium_risk": [],
    "low_risk": []
  }
}
```

### Markdown 格式

```markdown
# 设备配置

```json
{
  "devices": [...],
  "risk_analysis": {...}
}
```
```

---

## 风险等级说明

| 等级 | 中文 | 颜色 | 说明 |
|------|------|------|------|
| `very-high` | 极高风险 | 红色 | 高危设备，需立即处理 |
| `high` | 高风险 | 橙色 | 存在安全隐患 |
| `medium` | 中等风险 | 黄色 | 需要关注 |
| `low` | 低风险 | 绿色 | 正常设备 |

---

## 字段映射系统

### 概述

后端支持通过配置文件 `field_mapping.yaml` 对 API 返回的字段进行映射转换。当上游 API 字段名称变化时，只需修改映射文件，无需修改代码。

### 配置文件位置

```
backend/field_mapping.yaml
```

### 映射类别

| 类别 | 说明 |
|------|------|
| `device_info` | 设备基本信息映射 |
| `device_detail` | 设备详情映射 |
| `wifi_info` | WiFi 信息映射 |
| `risk_analysis` | 风险分析映射 (支持中英文 key) |

### 设备信息映射 (device_info)

```yaml
device_info:
  id: "id"              # 设备唯一标识
  uuid_sha256: "id"     # 使用 uuid_sha256 作为设备 ID
  name: "name"          # 设备名称
  host: "host"          # 主机地址
  ip: "host"            # 主机地址 (备用字段)
  port: "port"          # 端口
  protocol: "protocol"  # 协议
  username: "username"  # 用户名
  group: "group"        # 分组
```

### 设备详情映射 (device_detail)

```yaml
device_detail:
  # 标识字段
  id: "id"
  uuid_sha256: "id"     # 使用 uuid_sha256 作为设备 ID

  # 基本信息
  device_name: "device_name"
  name: "name"
  device_type: "device_type"
  device_status: "device_status"
  device_location: "device_location"

  # 网络信息
  ip: "device_ip"
  device_ip: "device_ip"
  port: "device_port"
  device_port: "device_port"

  # 认证信息
  device_username: "device_username"
  device_password: "device_password"
  device_ssh_port: "device_ssh_port"
  device_ssh_username: "device_ssh_username"

  # 扩展字段 (可根据 API 实际情况添加)
  day30_active_flg: "day30_active_flg"
  sample_type_cn: "sample_type_cn"
  oobe_times: "oobe_times"
  # ... 更多字段
```

### 风险分析映射 (risk_analysis)

```yaml
risk_analysis:
  # 支持中英文 key 映射
  generation_time: "generation_time"
  生成时间: "generation_time"

  analysis_type: "analysis_type"
  分析类型: "analysis_type"

  # 风险等级 (中英文)
  very_high_risk: "very_high_risk"
  极高风险: "very_high_risk"
  high_risk: "high_risk"
  高风险: "high_risk"
  medium_risk: "medium_risk"
  中风险: "medium_risk"
  low_risk: "low_risk"
  低风险: "low_risk"
```

### 修改字段映射的步骤

1. 打开 `backend/field_mapping.yaml`
2. 找到对应的映射类别
3. 修改 API 字段名到内部字段名的映射
4. 保存文件，重启后端服务

### 示例

**场景**: API 返回的字段从 `oobe_times` 变更为 `oobeTimes`

**修改前**:
```yaml
device_detail:
  oobe_times: "oobe_times"
```

**修改后**:
```yaml
device_detail:
  oobeTimes: "oobe_times"
```

---

## 注意事项

1. **设备 ID 唯一性**：设备 ID 在同一个项目中应保持唯一
2. **缓存失效**：重启后端服务后，设备详情缓存会清空，但数据库中的连接记录保留
3. **会话管理**：每个设备连接共享一个会话，切换设备不会丢失上下文
4. **消息持久化**：聊天消息保存到数据库，可跨会话恢复
5. **字段映射**：修改 `field_mapping.yaml` 后需重启后端服务
