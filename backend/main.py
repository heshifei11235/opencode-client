import asyncio
import json
import os
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from dataclasses import dataclass

from models import (
    ConnectionCreate, ConnectionResponse, ConnectionTest,
    SessionCreate, SessionResponse, MessageSend,
    PasswordEntryCreate, PasswordEntryResponse,
    MasterPasswordVerify, MasterPasswordSet,
    ProjectCreate, ProjectResponse,
    DocumentInfo, DocumentParseRequest, DocumentParseResponse, DeviceInfo,
    DeviceConnectionCreate, DeviceConnectionResponse,
    WifiInfo, DeviceDetailResponse, RiskAnalysisData
)
from database import (
    init_database,
    create_connection as db_create_connection,
    get_connections, get_connection_by_id,
    delete_connection as db_delete_connection,
    update_connection_timestamp,
    create_session as db_create_session,
    get_session as db_get_session,
    delete_session as db_delete_session,
    get_sessions_by_connection,
    create_password_entry, get_password_entries, get_password_entry_by_id,
    delete_password_entry as db_delete_password_entry,
    get_master_password_hash, set_master_password_hash,
    save_chat_message, get_chat_messages,
    create_project, get_projects, get_project_by_id, delete_project,
    create_device_connection, get_device_connections, get_device_connection_by_id,
    delete_device_connection,
    create_device_session, get_device_session, get_device_session_by_device_connection,
    save_device_chat_message, get_device_chat_messages,
    get_device_connection_by_device_id
)
from password_store import password_store, generate_salt, hash_password
from remote_client import remote_client, RemoteConnection
from md_parser import list_md_documents, parse_md_document, parse_md_document_full
from config import get_server_config, get_database_config, get_opencode_config, get_debug_config, get_logger

# 加载配置
server_config = get_server_config()
opencode_config = get_opencode_config()

app = FastAPI()

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=server_config.get("cors_origins", ["*"]),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
init_database()

# In-memory cache for device details (keyed by document_id:device_id)
# This caches device details parsed from md documents
device_details_cache: dict[str, dict] = {}


# ==================== Connection Endpoints ====================

@app.post("/api/connections", response_model=ConnectionResponse)
async def api_create_connection(conn: ConnectionCreate):
    """Create a new connection to a remote OpenCode server"""
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] POST /api/connections - Creating connection: {conn.name}, url={conn.url}")
    conn_id = db_create_connection(
        name=conn.name,
        url=conn.url,
        username=conn.username,
        password=conn.password,
        working_directory=conn.working_directory
    )
    result = get_connection_by_id(conn_id)
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] Connection created: id={conn_id}")
    return result


@app.get("/api/connections")
async def api_get_connections():
    """Get all saved connections (without passwords)"""
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug("[API] GET /api/connections - Fetching all connections")
    result = get_connections()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] Returning {len(result)} connections")
    return result


@app.get("/api/connections/{conn_id}")
async def api_get_connection(conn_id: int):
    """Get a specific connection"""
    conn = get_connection_by_id(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    # Don't return password
    conn.pop("password", None)
    return conn


@app.post("/api/connections/test")
async def api_test_connection(test: ConnectionTest):
    """Test connection to a remote OpenCode server"""
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] POST /api/connections/test - Testing connection to {test.url}")
    result = await remote_client.test_connection(
        url=test.url,
        username=test.username,
        password=test.password
    )
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] Connection test result: {result}")
    return result


@app.delete("/api/connections/{conn_id}")
async def api_delete_connection(conn_id: int):
    """Delete a connection"""
    if not db_delete_connection(conn_id):
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"success": True}


# ==================== Session Endpoints ====================

@app.post("/api/sessions", response_model=SessionResponse)
async def api_create_session(session_data: SessionCreate):
    """Create a new chat session for a connection"""
    conn = get_connection_by_id(session_data.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Create remote session
    remote_conn = RemoteConnection(
        id=conn["id"],
        name=conn["name"],
        url=conn["url"],
        username=conn.get("username"),
        password=conn.get("password"),
        working_directory=conn.get("working_directory"),
        created_at=conn["created_at"],
        updated_at=conn["updated_at"]
    )

    try:
        session = await remote_client.get_or_create_session(remote_conn)

        # Save session to database
        db_create_session(
            id=session.session_id,
            connection_id=session_data.connection_id,
            remote_session_id=session.remote_session_id
        )

        update_connection_timestamp(session_data.connection_id)

        return {
            "id": session.session_id,
            "connection_id": session.connection_id,
            "remote_session_id": session.remote_session_id,
            "created_at": conn["created_at"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
async def api_get_session(session_id: str):
    """Get a specific session"""
    session = db_get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get("/api/connections/{conn_id}/sessions/latest")
async def api_get_latest_session(conn_id: int):
    """Get the most recent session for a connection, or create a new one"""
    conn = get_connection_by_id(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Get existing sessions
    sessions = get_sessions_by_connection(conn_id)

    if sessions:
        # Return the most recent session
        return sessions[0]

    # No session exists, create one
    remote_conn = RemoteConnection(
        id=conn["id"],
        name=conn["name"],
        url=conn["url"],
        username=conn.get("username"),
        password=conn.get("password"),
        working_directory=conn.get("working_directory"),
        created_at=conn["created_at"],
        updated_at=conn["updated_at"]
    )

    try:
        session = await remote_client.get_or_create_session(remote_conn)
        db_create_session(
            id=session.session_id,
            connection_id=conn_id,
            remote_session_id=session.remote_session_id
        )
        update_connection_timestamp(conn_id)
        return db_get_session(session.session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/sessions/{session_id}")
async def api_delete_session(session_id: str):
    """Delete a session"""
    await remote_client.close_session(session_id)
    db_delete_session(session_id)
    return {"success": True}


# ==================== WebSocket Chat Endpoint ====================

@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time chat with OpenCode

    session_id can be:
    - A session ID (string) that exists in the database
    - A device connection ID (int as string) - create/find session for it
    - A device ID (dev_xxx format) - create session for direct device chat
    """
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[WebSocket] Client connected: session_id={session_id}")

    await websocket.accept()

    # Try to find existing session
    session = db_get_session(session_id)

    # If session not found, check if it's a device connection ID or device ID
    if not session:
        try:
            # Check if it's a numeric device connection ID
            device_conn_id = int(session_id)
            device_conn = get_device_connection_by_id(device_conn_id)
            if device_conn:
                db_create_session(session_id, device_conn_id)
                session = db_get_session(session_id)
        except (ValueError, TypeError):
            # Check if it's a device ID format (dev_xxx)
            if session_id.startswith("dev_"):
                # Create a session for direct device chat (use 0 as placeholder connection_id)
                db_create_session(session_id, 0)
                session = db_get_session(session_id)

    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    # Get connection info from the session's connection_id
    conn = get_connection_by_id(session["connection_id"]) if session["connection_id"] else None

    # Determine the device ID (for dev_xxx format)
    device_id = session_id.replace("dev_", "") if session_id.startswith("dev_") else None

    # If we have a connection, use it
    if conn:
        remote_conn = RemoteConnection(
            id=conn["id"],
            name=conn["name"],
            url=conn["url"],
            username=conn.get("username"),
            password=conn.get("password"),
            working_directory=conn.get("working_directory"),
            created_at=conn["created_at"],
            updated_at=conn["updated_at"]
        )
    elif device_id:
        # Direct device chat - try to get device info from cache
        # Cache keys are: {project_id}_{filename}:{device_id}
        # We need to search for the device_id in cache
        device_url = "http://localhost:4096"  # Default
        device_name = f"Device {device_id}"

        # Search cache for this device
        for key, info in device_details_cache.items():
            if key.endswith(f":{device_id}"):
                device_url = info.get("url", device_url)
                device_name = info.get("device_name", device_name)
                break

        remote_conn = RemoteConnection(
            id=0,
            name=device_name,
            url=device_url,
            username="",
            password="",
            working_directory="",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    else:
        await websocket.send_json({"type": "error", "message": "No connection or device info found"})
        await websocket.close()
        return

    # Create/get remote session
    try:
        remote_session = await remote_client.get_or_create_session(
            remote_conn,
            session_id
        )
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        await websocket.close()
        return

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "prompt":
                content = message_data["content"]

                # Save user message to DB
                save_chat_message(session_id, "user", content)
                if debug_config.get("print_database_operations"):
                    logger.debug(f"[DB] WebSocket saved user message to session: {session_id}")

                # Send message to remote and return response
                try:
                    if debug_config.get("print_opencode_communication"):
                        logger.debug(f"[OpenCode] Sending message to remote session: {remote_session.remote_session_id}")
                    response = await remote_client.send_message(remote_session, content)
                    if debug_config.get("print_opencode_communication"):
                        logger.debug(f"[OpenCode] Received response: {response}")

                    # Save assistant response to DB
                    if response.get("parts"):
                        for part in response["parts"]:
                            if part.get("type") == "text" and part.get("text"):
                                save_chat_message(
                                    session_id, "assistant", part["text"])
                    await websocket.send_json({
                        "type": "message",
                        "data": response
                    })
                except Exception as e:
                    logger.error(f"[OpenCode] Error sending message: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })

            elif message_data.get("type") == "history":
                # Get chat history from database
                history = get_chat_messages(session_id)
                if debug_config.get("print_database_operations"):
                    logger.debug(f"[DB] WebSocket fetched {len(history)} messages for session: {session_id}")
                await websocket.send_json({
                    "type": "history",
                    "data": history
                })

    except WebSocketDisconnect:
        if debug_config.get("print_api_requests"):
            logger.debug(f"[WebSocket] Client disconnected: session_id={session_id}")
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass


# ==================== Project Endpoints ====================

@app.post("/api/projects", response_model=ProjectResponse)
async def api_create_project(project: ProjectCreate):
    """Create a new project"""
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] POST /api/projects - Creating project: {project.name}, path={project.path}")

    if not os.path.isdir(project.path):
        logger.warning(f"[API] Project path does not exist: {project.path}")
        raise HTTPException(
            status_code=400, message="Directory does not exist")

    project_id = create_project(name=project.name, path=project.path)
    result = get_project_by_id(project_id)
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] Project created: id={project_id}")
    return result


@app.get("/api/projects")
async def api_get_projects():
    """Get all projects"""
    return get_projects()


@app.get("/api/projects/{project_id}")
async def api_get_project(project_id: int):
    """Get a specific project"""
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/api/projects/{project_id}")
async def api_delete_project(project_id: int):
    """Delete a project and associated device connections"""
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}


@app.get("/api/projects/{project_id}/prompt")
async def api_get_project_prompt(project_id: int):
    """Read the prompt file from project root"""
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    prompt_path = os.path.join(project["path"], "prompt")
    if not os.path.exists(prompt_path):
        return {"prompt": ""}

    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"prompt": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read prompt: {str(e)}")


@app.post("/api/ai/analyze")
async def api_ai_analyze(request: dict):
    """Generate AI analysis using prompt template and device info

    Request body:
    {
        "prompt": "template prompt text",
        "device": { device info object },
        "project_id": 1,
        "filename": "test1"
    }
    """
    prompt_template = request.get("prompt", "")
    device_info = request.get("device", {})
    project_id = request.get("project_id")
    filename = request.get("filename", "")

    if not prompt_template:
        raise HTTPException(status_code=400, detail="Prompt is required")

    if not device_info:
        raise HTTPException(status_code=400, detail="Device info is required")

    # Build device context from device info
    device_context = f"""设备信息:
- ID: {device_info.get('id', 'N/A')}
- 名称: {device_info.get('device_name', device_info.get('name', 'N/A'))}
- 类型: {device_info.get('device_type', 'N/A')}
- 状态: {device_info.get('device_status', 'N/A')}
- 位置: {device_info.get('device_location', 'N/A')}
- IP: {device_info.get('device_ip', 'N/A')}
- 端口: {device_info.get('device_port', 'N/A')}
- 用户名: {device_info.get('device_username', 'N/A')}
- SSH端口: {device_info.get('device_ssh_port', 'N/A')}
- SSH用户: {device_info.get('device_ssh_username', 'N/A')}
"""

    # If there's wifi info, add it
    wifi_list = device_info.get("wifi_list", [])
    if wifi_list:
        wifi_context = "\nWiFi网络:"
        for wifi in wifi_list:
            wifi_context += f"\n  - SSID: {wifi.get('ssid', 'N/A')}, 密码: {wifi.get('password', 'N/A')}"
        device_context += wifi_context

    # Fill in the prompt template
    full_prompt = prompt_template.format(device_info=device_context)

    # Get device detail from cache
    cache_key = f"{project_id}_{filename}:{device_info.get('id')}"
    detail = device_details_cache.get(cache_key, {})

    # Build URL for local OpenCode service
    opencode_url = detail.get("url", "http://localhost:4096")

    # Try to send to local OpenCode service
    try:
        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{opencode_url}/api/chat",
                json={"prompt": full_prompt}
            )
            if response.status_code == 200:
                return {"response": response.json(), "prompt": full_prompt}
            else:
                return {"response": f"OpenCode服务返回错误: {response.status_code}", "prompt": full_prompt}
    except Exception as e:
        # If local OpenCode is not available, return the generated prompt
        return {"response": f"AI分析准备完成，请查看下方提示词，可手动发送给OpenCode:\n\n{full_prompt}", "prompt": full_prompt}


@app.post("/api/chat/device")
async def api_chat_device(request: dict):
    """Send a chat message to a device via OpenCode

    Request body:
    {
        "device_id": "server-a",
        "project_id": 1,
        "filename": "test1",
        "message": "Hello, how are you?"
    }
    """
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] POST /api/chat/device - device_id={request.get('device_id')}, project_id={request.get('project_id')}, filename={request.get('filename')}")

    device_id = request.get("device_id", "")
    project_id = request.get("project_id")
    filename = request.get("filename", "")
    message = request.get("message", "")

    if not device_id or not message:
        raise HTTPException(status_code=400, detail="device_id and message are required")

    # Find device info from cache
    cache_key_prefix = f"{project_id}_{filename}"
    device_info = None

    for key, info in device_details_cache.items():
        if key.startswith(cache_key_prefix) and key.endswith(f":{device_id}"):
            device_info = info
            break

    if not device_info:
        logger.warning(f"[API] Device not found in cache: {device_id}")
        raise HTTPException(status_code=404, detail="Device not found in cache")

    # Find device connection in database
    doc_id = f"{project_id}_{filename}"
    device_conn = None
    all_dev_conns = get_device_connections()
    for conn in all_dev_conns:
        if (conn["project_id"] == project_id and
            conn["document_id"] == doc_id and
            conn["device_id"] == device_id):
            device_conn = conn
            break

    if not device_conn:
        logger.warning(f"[API] Device connection not found in database: {device_id}")
        raise HTTPException(status_code=404, detail="Device connection not found in database")

    # Get or create device session
    device_session = get_device_session_by_device_connection(device_conn["id"])
    session_id = device_session["id"] if device_session else None

    if not device_session:
        # Create a new device session
        session_id = f"dev_{device_conn['id']}_{device_id}"
        create_device_session(
            id=session_id,
            device_connection_id=device_conn["id"],
            remote_session_id=None
        )
        device_session = get_device_session(session_id)
        if debug_config.get("print_database_operations"):
            logger.debug(f"[DB] Created device session: {session_id}")

    # Save user message to device chat messages
    save_device_chat_message(device_session["id"], "user", message)
    if debug_config.get("print_database_operations"):
        logger.debug(f"[DB] Saved user message to session: {device_session['id']}")

    # Build URL for local OpenCode service
    opencode_url = device_info.get("url", "http://localhost:4096")

    # Use httpx to communicate with OpenCode server directly
    # First create a session, then send message
    try:
        import httpx

        headers = {}
        if device_conn.get("username") and device_conn.get("password"):
            import base64
            credentials = f"{device_conn.get('username')}:{device_conn.get('password')}"
            headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"
        headers["Content-Type"] = "application/json"

        if debug_config.get("print_opencode_communication"):
            logger.debug(f"[OpenCode] Creating session at {opencode_url}")

        # Create a session on the OpenCode server
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Create session
            session_response = await client.post(
                f"{opencode_url}/session",
                headers=headers,
                json={}
            )

            if session_response.status_code not in (200, 201):
                error_msg = f"创建OpenCode会话失败: {session_response.status_code}"
                save_device_chat_message(device_session["id"], "assistant", error_msg)
                if debug_config.get("print_opencode_communication"):
                    logger.error(f"[OpenCode] Session creation failed: {session_response.status_code}")
                return {"response": error_msg, "success": False}

            session_data = session_response.json()
            remote_session_id = session_data.get("id")
            if debug_config.get("print_opencode_communication"):
                logger.debug(f"[OpenCode] Session created: {remote_session_id}")

            # Send message
            message_response = await client.post(
                f"{opencode_url}/session/{remote_session_id}/message",
                headers=headers,
                json={"parts": [{"type": "text", "text": message}]}
            )

            if message_response.status_code == 200:
                resp_data = message_response.json()
                if resp_data.get("parts"):
                    for part in resp_data["parts"]:
                        if part.get("type") == "text" and part.get("text"):
                            save_device_chat_message(device_session["id"], "assistant", part["text"])
                            if debug_config.get("print_opencode_communication"):
                                logger.debug(f"[OpenCode] Received response: {part['text'][:100]}...")
                            return {"response": part["text"], "success": True}
                elif resp_data.get("message"):
                    save_device_chat_message(device_session["id"], "assistant", resp_data["message"])
                    return {"response": resp_data["message"], "success": True}
                else:
                    save_device_chat_message(device_session["id"], "assistant", str(resp_data))
                    return {"response": str(resp_data), "success": True}
            else:
                error_msg = f"发送消息失败: {message_response.status_code} - {message_response.text}"
                save_device_chat_message(device_session["id"], "assistant", error_msg)
                if debug_config.get("print_opencode_communication"):
                    logger.error(f"[OpenCode] Message send failed: {message_response.status_code}")
                return {"response": error_msg, "success": False}

    except httpx.TimeoutException as e:
        error_msg = f"连接OpenCode超时（60秒）: 请检查OpenCode服务器是否运行正常，地址: {opencode_url}"
        save_device_chat_message(device_session["id"], "assistant", error_msg)
        logger.error(f"[OpenCode] Timeout connecting to {opencode_url}: {str(e)}")
        return {"response": error_msg, "success": False}
    except httpx.ConnectError as e:
        error_msg = f"无法连接到OpenCode服务器: {opencode_url}，请检查服务器地址和端口是否正确"
        save_device_chat_message(device_session["id"], "assistant", error_msg)
        logger.error(f"[OpenCode] Connect error to {opencode_url}: {str(e)}")
        return {"response": error_msg, "success": False}
    except Exception as e:
        error_msg = f"连接OpenCode失败: {str(e)}"
        save_device_chat_message(device_session["id"], "assistant", error_msg)
        logger.error(f"[OpenCode] Connection error: {str(e)}")
        return {"response": error_msg, "success": False}


@app.get("/api/projects/{project_id}/documents")
async def api_get_project_documents(project_id: int):
    """Get all markdown documents in a project"""
    project = get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        md_files = list_md_documents(project["path"])
        documents = []
        for filename in md_files:
            doc_id = f"{project_id}_{filename[:-3]}"  # Remove .md extension
            documents.append(DocumentInfo(
                id=doc_id,
                project_id=project_id,
                filename=filename[:-3],  # filename without extension
                full_path=os.path.join(project["path"], filename)
            ))
        return documents
    except FileNotFoundError:
        raise HTTPException(
            status_code=400, message="Project directory not found")


@app.post("/api/documents/parse")
async def api_parse_document(request: DocumentParseRequest):
    """Parse a markdown document and extract device information

    For each .md file, look for a corresponding .json file with the same name.
    If the .json exists, parse it instead of the .md file.
    """
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] POST /api/documents/parse - project_id={request.project_id}, filename={request.filename}")

    project = get_project_by_id(request.project_id)
    if not project:
        logger.warning(f"[API] Project not found: {request.project_id}")
        raise HTTPException(status_code=404, detail="Project not found")

    # First check for corresponding .json file
    json_path = os.path.join(project["path"], f"{request.filename}.json")
    md_path = os.path.join(project["path"], f"{request.filename}.md")

    # Use .json if it exists, otherwise fall back to .md
    if os.path.exists(json_path):
        file_path = json_path
    elif os.path.exists(md_path):
        file_path = md_path
    else:
        logger.warning(f"[API] Document not found: {request.filename}")
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        if debug_config.get("print_api_requests"):
            logger.debug(f"[API] Parsing document: {file_path}")
        result = parse_md_document_full(file_path)
        if debug_config.get("print_api_requests"):
            logger.debug(f"[API] Parsed {len(result.devices)} devices from document")

        # Convert device_details to dict format for response
        # Include extra_fields which contains mapped fields from field_mapping.yaml
        device_details_dict = {}
        for device_id, detail in result.device_details.items():
            detail_dict = {
                "id": detail.id,
                "device_name": detail.device_name,
                "device_type": detail.device_type,
                "device_status": detail.device_status,
                "device_location": detail.device_location,
                "device_ip": detail.device_ip,
                "device_port": detail.device_port,
                "device_username": detail.device_username,
                "device_password": detail.device_password,
                "device_ssh_port": detail.device_ssh_port,
                "device_ssh_username": detail.device_ssh_username,
                "wifi_list": [{"ssid": w.ssid, "password": w.password} for w in detail.wifi_list]
            }
            # Merge extra_fields (field mapping extended fields)
            detail_dict.update(detail.extra_fields)
            device_details_dict[device_id] = detail_dict

        # Store device details in cache for later retrieval
        doc_cache_key = f"{request.project_id}_{request.filename}"
        for device_id, detail_data in device_details_dict.items():
            cache_key = f"{doc_cache_key}:{device_id}"
            device_details_cache[cache_key] = detail_data

            # Create or update device connection in database
            # Check if device connection already exists
            existing_conns = get_device_connections()
            existing = None
            for conn in existing_conns:
                if (conn["project_id"] == request.project_id and
                    conn["document_id"] == doc_cache_key and
                    conn["device_id"] == device_id):
                    existing = conn
                    break

            if not existing:
                # Create new device connection
                if debug_config.get("print_database_operations"):
                    logger.debug(f"[DB] Creating device connection: project={request.project_id}, doc={doc_cache_key}, device={device_id}")
                create_device_connection(
                    project_id=request.project_id,
                    document_id=doc_cache_key,
                    device_id=device_id,
                    name=detail_data.get("device_name", f"Device {device_id}"),
                    url=detail_data.get("url", "http://localhost:4096"),
                    username=detail_data.get("device_username"),
                    password=detail_data.get("device_password")
                )
                if debug_config.get("print_database_operations"):
                    logger.debug(f"[DB] Created device connection for {device_id}")

        if debug_config.get("print_api_requests"):
            logger.debug(f"[API] Returning {len(result.devices)} devices, risk_analysis={result.risk_analysis.analysis_type}")

        return DocumentParseResponse(
            devices=[
                DeviceInfo(
                    id=d.id,
                    name=d.name,
                    host=d.host,
                    port=d.port,
                    username=d.username,
                    protocol=d.protocol,
                    group=d.group
                )
                for d in result.devices
            ],
            risk_analysis=RiskAnalysisData(
                generation_time=result.risk_analysis.generation_time,
                analysis_type=result.risk_analysis.analysis_type,
                time_range=result.risk_analysis.time_range,
                very_high_risk=result.risk_analysis.very_high_risk,
                high_risk=result.risk_analysis.high_risk,
                medium_risk=result.risk_analysis.medium_risk,
                low_risk=result.risk_analysis.low_risk
            ),
            device_details=device_details_dict
        )
    except Exception as e:
        logger.error(f"[API] Failed to parse document: {str(e)}")
        raise HTTPException(
            status_code=500, message=f"Failed to parse document: {str(e)}")


# ==================== Device Connection Endpoints ====================

@app.post("/api/devices", response_model=DeviceConnectionResponse)
async def api_create_device_connection(device: DeviceConnectionCreate):
    """Create a new device connection"""
    device_conn_id = create_device_connection(
        project_id=device.project_id,
        document_id=device.document_id,
        device_id=device.device_id,
        name=device.name,
        url=device.url,
        username=device.username,
        password=device.password
    )
    result = get_device_connection_by_id(device_conn_id)
    return DeviceConnectionResponse(
        id=result["id"],
        project_id=result["project_id"],
        document_id=result["document_id"],
        device_id=result["device_id"],
        name=result["name"],
        url=result["url"],
        username=result.get("username"),
        created_at=result["created_at"]
    )


@app.get("/api/devices")
async def api_get_devices():
    """Get all device connections"""
    logger = get_logger()
    debug_config = get_debug_config()
    if debug_config.get("print_api_requests"):
        logger.debug("[API] GET /api/devices - Fetching all device connections")
    result = get_device_connections()
    if debug_config.get("print_api_requests"):
        logger.debug(f"[API] Returning {len(result)} device connections")
    return result


@app.get("/api/devices/detail")
async def api_get_device_detail(device_id: str, project_id: int, filename: str):
    """Get device details for a specific device parsed from a document"""
    cache_key = f"{project_id}_{filename}:{device_id}"
    detail = device_details_cache.get(cache_key)
    if not detail:
        raise HTTPException(status_code=404, detail="Device detail not found")
    return detail


@app.get("/api/devices/{device_id}")
async def api_get_device(device_id: int):
    """Get a specific device connection"""
    device = get_device_connection_by_id(device_id)
    if not device:
        raise HTTPException(
            status_code=404, message="Device connection not found")
    return device


@app.delete("/api/devices/{device_id}")
async def api_delete_device(device_id: int):
    """Delete a device connection"""
    if not delete_device_connection(device_id):
        raise HTTPException(
            status_code=404, message="Device connection not found")
    return {"success": True}


@app.get("/api/devices/{device_id}/chat-history")
async def api_get_device_chat_history(device_id: int):
    """Get chat history for a device connection"""
    device_conn = get_device_connection_by_id(device_id)
    if not device_conn:
        raise HTTPException(status_code=404, detail="Device connection not found")

    # Get or create device session
    device_session = get_device_session_by_device_connection(device_id)
    if not device_session:
        return {"messages": []}

    messages = get_device_chat_messages(device_session["id"])
    return {"messages": messages}


# ==================== Password Endpoints ====================

@app.post("/api/auth/master-password")
async def api_set_master_password(data: MasterPasswordSet):
    """Set the master password for password encryption"""
    salt = generate_salt()
    password_hash = hash_password(data.password, salt)
    set_master_password_hash(password_hash, salt, 100_000)
    password_store.unlock(data.password, salt, password_hash)
    return {"success": True}


@app.post("/api/auth/verify")
async def api_verify_master_password(data: MasterPasswordVerify):
    """Verify the master password"""
    auth_data = get_master_password_hash()
    if not auth_data:
        raise HTTPException(status_code=400, detail="Master password not set")

    verified = password_store.unlock(
        data.password,
        auth_data["salt"],
        auth_data["password_hash"]
    )

    if not verified:
        raise HTTPException(status_code=401, detail="Invalid password")

    return {"success": True}


@app.get("/api/auth/status")
async def api_auth_status():
    """Get authentication status"""
    auth_data = get_master_password_hash()
    return {
        "has_master_password": auth_data is not None,
        "is_unlocked": password_store.is_unlocked()
    }


@app.post("/api/passwords", response_model=PasswordEntryResponse)
async def api_create_password(entry: PasswordEntryCreate):
    """Create a new password entry"""
    if not password_store.is_unlocked():
        raise HTTPException(
            status_code=401, message="Password store is locked")

    encrypted = password_store.encrypt(entry.password)
    entry_id = create_password_entry(
        category=entry.category,
        name=entry.name,
        username=entry.username,
        encrypted_password=encrypted,
        url=entry.url,
        notes=entry.notes
    )

    full_entry = get_password_entry_by_id(entry_id)
    return PasswordEntryResponse(
        id=full_entry["id"],
        category=full_entry["category"],
        name=full_entry["name"],
        username=full_entry["username"],
        url=full_entry["url"],
        notes=full_entry["notes"],
        created_at=full_entry["created_at"],
        updated_at=full_entry["updated_at"]
    )


@app.get("/api/passwords")
async def api_get_passwords():
    """Get all password entries (without passwords)"""
    if not password_store.is_unlocked():
        raise HTTPException(
            status_code=401, message="Password store is locked")

    entries = get_password_entries()
    return [
        PasswordEntryResponse(
            id=e["id"],
            category=e["category"],
            name=e["name"],
            username=e["username"],
            url=e["url"],
            notes=e["notes"],
            created_at=e["created_at"],
            updated_at=e["updated_at"]
        )
        for e in entries
    ]


@app.get("/api/passwords/{password_id}")
async def api_get_password(password_id: int):
    """Get a specific password entry with decrypted password"""
    if not password_store.is_unlocked():
        raise HTTPException(
            status_code=401, message="Password store is locked")

    entry = get_password_entry_by_id(password_id)
    if not entry:
        raise HTTPException(
            status_code=404, message="Password entry not found")

    decrypted_password = password_store.decrypt(entry["encrypted_password"])

    return {
        "id": entry["id"],
        "category": entry["category"],
        "name": entry["name"],
        "username": entry["username"],
        "password": decrypted_password,
        "url": entry["url"],
        "notes": entry["notes"]
    }


@app.delete("/api/passwords/{password_id}")
async def api_delete_password(password_id: int):
    """Delete a password entry"""
    if not password_store.is_unlocked():
        raise HTTPException(
            status_code=401, message="Password store is locked")

    if not db_delete_password_entry(password_id):
        raise HTTPException(
            status_code=404, message="Password entry not found")

    return {"success": True}


# ==================== Health Check ====================

@app.get("/api/health")
async def api_health():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
