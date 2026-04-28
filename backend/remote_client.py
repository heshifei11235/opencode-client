"""
Remote OpenCode client - connects to OpenCode servers via HTTP
"""
import asyncio
import json
import uuid
from typing import Optional, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
import httpx

from config import get_debug_config, get_logger


@dataclass
class RemoteConnection:
    id: int
    name: str
    url: str
    username: Optional[str]
    password: Optional[str]
    working_directory: Optional[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class RemoteSession:
    session_id: str
    connection_id: int
    remote_session_id: Optional[str] = None
    messages: list = field(default_factory=list)


class RemoteOpenCodeClient:
    """Client for connecting to remote OpenCode servers via HTTP"""

    def __init__(self):
        self._sessions: dict[str, RemoteSession] = {}

    async def test_connection(self, url: str, username: str = None, password: str = None) -> dict:
        """Test if we can connect to a remote OpenCode server"""
        logger = get_logger()
        debug_config = get_debug_config()
        if debug_config.get("print_opencode_communication"):
            logger.debug(f"[OpenCode] Testing connection to {url}")

        headers = {}
        if username and password:
            import base64
            credentials = f"{username}:{password}"
            headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"
        if debug_config.get("print_opencode_communication"):
            logger.debug(f"[OpenCode] Auth headers prepared: {'yes' if username and password else 'no'}")

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            try:
                response = await client.get(f"{url}/global/health", headers=headers)
                if debug_config.get("print_opencode_communication"):
                    logger.debug(f"[OpenCode] Health check response: {response.status_code}")
                # httpx returns response object for all status codes (doesn't raise for 4xx/5xx)
                if response.status_code >= 400:
                    if response.status_code == 401:
                        return {"success": False, "error": "Authentication required"}
                    elif response.status_code == 502:
                        return {"success": False, "error": "Bad gateway - check server address and port"}
                    return {"success": False, "error": f"Server error (HTTP {response.status_code})"}
                # Success (200)
                try:
                    result = {"success": True, "data": response.json()}
                    if debug_config.get("print_opencode_communication"):
                        logger.debug(f"[OpenCode] Connection test successful")
                    return result
                except Exception:
                    result = {"success": True, "data": {"healthy": True}}
                    if debug_config.get("print_opencode_communication"):
                        logger.debug(f"[OpenCode] Connection test successful (no JSON body)")
                    return result
            except httpx.ConnectError as e:
                if debug_config.get("print_opencode_communication"):
                    logger.debug(f"[OpenCode] Connection failed: {e}")
                return {"success": False, "error": "Connection failed - check URL and port"}
            except httpx.TimeoutException:
                if debug_config.get("print_opencode_communication"):
                    logger.debug(f"[OpenCode] Connection timed out")
                return {"success": False, "error": "Connection timed out"}
            except Exception as e:
                if debug_config.get("print_opencode_communication"):
                    logger.debug(f"[OpenCode] Connection error: {e}")
                return {"success": False, "error": str(e)}

    async def get_or_create_session(
        self,
        connection: RemoteConnection,
        session_id: str = None
    ) -> RemoteSession:
        """Get existing session or create a new one"""
        if session_id and session_id in self._sessions:
            return self._sessions[session_id]

        # Create new session on remote server
        headers = {}
        if connection.username and connection.password:
            import base64
            credentials = f"{connection.username}:{connection.password}"
            headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"
        headers["Content-Type"] = "application/json"

        # Build session creation request
        payload = {}
        if connection.working_directory:
            payload["cwd"] = connection.working_directory

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{connection.url}/session",
                    headers=headers,
                    json=payload
                )
                if response.status_code in (200, 201):
                    data = response.json()
                    remote_session_id = data.get("id")

                    session = RemoteSession(
                        session_id=session_id or str(uuid.uuid4()),
                        connection_id=connection.id,
                        remote_session_id=remote_session_id
                    )
                    self._sessions[session.session_id] = session
                    return session
                else:
                    raise Exception(
                        f"Failed to create session: {response.status_code}")
            except Exception as e:
                raise Exception(f"Failed to connect to OpenCode server: {e}")

    async def send_message(
        self,
        session: RemoteSession,
        content: str
    ) -> dict:
        """Send a message to the session and return the response"""
        logger = get_logger()
        debug_config = get_debug_config()

        connection = self._get_connection_for_session(session)
        if not connection:
            raise Exception("Connection not found")

        headers = {}
        if connection.get("username") and connection.get("password"):
            import base64
            credentials = f"{connection.get('username')}:{connection.get('password')}"
            headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"
        headers["Content-Type"] = "application/json"
        headers["Accept"] = "application/json"

        url = f"{connection.get('url')}/session/{session.remote_session_id}/message"
        payload = {
            "parts": [{"type": "text", "text": content}]
        }
        if debug_config.get("print_opencode_communication"):
            logger.debug(f"[OpenCode] Sending message to {url}")
            logger.debug(f"[OpenCode] Payload: {payload}")

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if debug_config.get("print_opencode_communication"):
                    logger.debug(f"[OpenCode] Response status: {response.status_code}")
                    logger.debug(f"[OpenCode] Response body: {response.text[:500] if response.text else 'empty'}")

                if response.status_code == 200:
                    return response.json()
                else:
                    raise Exception(
                        f"Failed to send message: {response.status_code}")

        except httpx.HTTPError as e:
            logger.error(f"[OpenCode] HTTP error: {type(e).__name__} - {str(e)}")
            raise Exception(
                f"HTTP error: {type(e).__name__} - {str(e) or 'Connection failed'}")

    async def get_session_history(
        self,
        session: RemoteSession
    ) -> list[dict]:
        """Get session message history"""
        connection = self._get_connection_for_session(session)
        if not connection:
            return []

        headers = {}
        if connection.get("username") and connection.get("password"):
            import base64
            credentials = f"{connection.get('username')}:{connection.get('password')}"
            headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(
                    f"{connection.get('url')}/session/{session.remote_session_id}/message",
                    headers=headers
                )
                if response.status_code == 200:
                    return response.json().get("messages", [])
            except Exception:
                pass
        return []

    async def close_session(self, session_id: str):
        """Close a session"""
        self._sessions.pop(session_id, None)

    def _get_connection_for_session(self, session: RemoteSession) -> Optional[dict]:
        """Get connection info for a session"""
        from database import get_connection_by_id
        return get_connection_by_id(session.connection_id)


# Global client instance
remote_client = RemoteOpenCodeClient()
