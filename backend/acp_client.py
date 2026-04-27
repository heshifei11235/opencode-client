import asyncio
import json
import os
import subprocess
import uuid
from typing import Optional, AsyncIterator, Callable
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ACPMessage:
    jsonrpc: str = "2.0"
    id: Optional[str] = None
    method: Optional[str] = None
    params: Optional[dict] = None
    result: Optional[dict] = None
    error: Optional[dict] = None


class ACPSession:
    def __init__(self, session_id: str, working_directory: str, process: asyncio.subprocess.Process):
        self.session_id = session_id
        self.working_directory = working_directory
        self.process = process
        self.messages: list[dict] = []
        self._input_queue: asyncio.Queue[str] = asyncio.Queue()
        self._message_handlers: list[Callable[[dict], None]] = []
        self._closed = False

    async def start_reading(self):
        """Start reading stdout in background"""
        async def read_stdout():
            while not self._closed:
                try:
                    line = await self.process.stdout.readline()
                    if not line:
                        break
                    decoded = line.decode().strip()
                    if decoded:
                        await self._handle_message(decoded)
                except Exception:
                    break

        asyncio.create_task(read_stdout())

    async def _handle_message(self, raw_message: str):
        try:
            message = json.loads(raw_message)
            self.messages.append({
                "timestamp": datetime.now().isoformat(),
                "message": message
            })
            for handler in self._message_handlers:
                handler(message)
        except json.JSONDecodeError:
            pass

    def add_message_handler(self, handler: Callable[[dict], None]):
        self._message_handlers.append(handler)

    async def send(self, method: str, params: dict) -> str:
        msg_id = str(uuid.uuid4())
        message = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": method,
            "params": params
        }
        await self.process.stdin.write((json.dumps(message) + "\n").encode())
        await self.process.stdin.drain()
        return msg_id

    async def send_prompt(self, content: str) -> AsyncIterator[dict]:
        """Send a prompt and yield responses"""
        result_id = str(uuid.uuid4())
        response_queue: asyncio.Queue[dict] = asyncio.Queue()

        def handler(message: dict):
            asyncio.create_task(response_queue.put(message))

        self.add_message_handler(handler)

        # Send the prompt request
        await self.send("prompt", {
            "prompt": content,
            "id": result_id
        })

        # Yield responses as they come
        while True:
            try:
                response = await asyncio.wait_for(response_queue.get(), timeout=60.0)
                yield response
                if response.get("method") == "prompt_complete":
                    break
            except asyncio.TimeoutError:
                break

    async def close(self):
        self._closed = True
        if self.process and not self.process.returncode:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self.process.kill()


class ACPClient:
    def __init__(self):
        self.sessions: dict[str, ACPSession] = {}
        self._lock = asyncio.Lock()

    async def create_session(self, working_directory: str) -> ACPSession:
        """Create a new ACP session by spawning opencode acp process"""
        session_id = str(uuid.uuid4())

        env = {**os.environ}
        env["OPENCODE_CLIENT"] = "acp"

        process = await asyncio.create_subprocess_exec(
            "opencode",
            "acp",
            "--cwd",
            working_directory,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )

        session = ACPSession(session_id, working_directory, process)
        await session.start_reading()

        # Initialize the connection
        init_result = await asyncio.wait_for(
            session.send("initialize", {
                "protocolVersion": 1,
                "agentName": "opencode",
                "capabilities": {
                    "streaming": True,
                    "tools": True
                }
            }),
            timeout=30.0
        )

        async with self._lock:
            self.sessions[session_id] = session

        return session

    async def get_session(self, session_id: str) -> Optional[ACPSession]:
        return self.sessions.get(session_id)

    async def close_session(self, session_id: str):
        session = self.sessions.pop(session_id, None)
        if session:
            await session.close()

    async def close_all(self):
        for session_id in list(self.sessions.keys()):
            await self.close_session(session_id)


# Global client instance
acp_client = ACPClient()
