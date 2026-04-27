import asyncio
from typing import Optional
from acp_client import acp_client, ACPSession


class SessionManager:
    def __init__(self):
        self._active_sessions: dict[str, dict] = {}

    async def create_session(self, connection_id: int, working_directory: str) -> dict:
        """Create a new chat session for a connection"""
        session = await acp_client.create_session(working_directory)

        session_info = {
            "id": session.session_id,
            "connection_id": connection_id,
            "working_directory": working_directory,
            "created_at": asyncio.get_event_loop().time(),
            "messages": []
        }

        self._active_sessions[session.session_id] = session_info
        return session_info

    async def get_session(self, session_id: str) -> Optional[dict]:
        return self._active_sessions.get(session_id)

    async def close_session(self, session_id: str):
        await acp_client.close_session(session_id)
        self._active_sessions.pop(session_id, None)

    def get_active_sessions(self) -> list[dict]:
        return list(self._active_sessions.values())


# Global instance
session_manager = SessionManager()
