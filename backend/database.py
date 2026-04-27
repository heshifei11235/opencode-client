import sqlite3
from datetime import datetime
from typing import Optional, List
from contextlib import contextmanager

DATABASE_PATH = "opencode_client.db"


@contextmanager
def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    with get_connection() as conn:
        cursor = conn.cursor()

        # Projects table - stores local project directories
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Device connections table - stores device connection info
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS device_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                document_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                username TEXT,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)

        # Connections table - stores remote OpenCode server info
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                username TEXT,
                password TEXT,
                working_directory TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Sessions table - stores session info
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                connection_id INTEGER NOT NULL,
                remote_session_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (connection_id) REFERENCES connections(id)
            )
        """)

        # Chat messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        # Password entries table (encrypted)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                username TEXT NOT NULL,
                encrypted_password BLOB NOT NULL,
                url TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Master password hash table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auth (
                id INTEGER PRIMARY KEY,
                password_hash TEXT NOT NULL,
                salt BLOB NOT NULL,
                iterations INTEGER NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Device sessions table - stores chat sessions for devices
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS device_sessions (
                id TEXT PRIMARY KEY,
                device_connection_id INTEGER NOT NULL,
                remote_session_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_connection_id) REFERENCES device_connections(id)
            )
        """)

        # Device chat messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS device_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_session_id) REFERENCES device_sessions(id)
            )
        """)


# Connection operations
def create_connection(
    name: str,
    url: str,
    username: str = None,
    password: str = None,
    working_directory: str = None
) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO connections (name, url, username, password, working_directory)
               VALUES (?, ?, ?, ?, ?)""",
            (name, url, username, password, working_directory)
        )
        return cursor.lastrowid


def get_connections() -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, url, username, working_directory, created_at, updated_at
            FROM connections ORDER BY updated_at DESC
        """)
        rows = cursor.fetchall()
        # Don't return password in list view
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "url": row["url"],
                "username": row["username"],
                "working_directory": row["working_directory"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            }
            for row in rows
        ]


def get_connection_by_id(id: int) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM connections WHERE id = ?", (id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_connection(id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE connection_id = ?", (id,))
        cursor.execute("DELETE FROM connections WHERE id = ?", (id,))
        return cursor.rowcount > 0


def update_connection_timestamp(id: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE connections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (id,)
        )


# Session operations
def create_session(id: str, connection_id: int, remote_session_id: str = None) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO sessions (id, connection_id, remote_session_id)
               VALUES (?, ?, ?)""",
            (id, connection_id, remote_session_id)
        )
        return cursor.lastrowid


def get_session(id: str) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_sessions_by_connection(connection_id: int) -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM sessions WHERE connection_id = ? ORDER BY updated_at DESC",
            (connection_id,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def delete_session(id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (id,))
        cursor.execute("DELETE FROM sessions WHERE id = ?", (id,))
        return cursor.rowcount > 0


# Chat message operations
def save_chat_message(session_id: str, role: str, content: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO chat_messages (session_id, role, content)
               VALUES (?, ?, ?)""",
            (session_id, role, content)
        )
        return cursor.lastrowid


def get_chat_messages(session_id: str) -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT role, content, timestamp FROM chat_messages
               WHERE session_id = ? ORDER BY timestamp ASC""",
            (session_id,)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": str(i + 1),
                "role": row["role"],
                "content": row["content"],
                "timestamp": row["timestamp"]
            }
            for i, row in enumerate(rows)
        ]


# Device session operations
def create_device_session(id: str, device_connection_id: int, remote_session_id: str = None) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO device_sessions (id, device_connection_id, remote_session_id)
               VALUES (?, ?, ?)""",
            (id, device_connection_id, remote_session_id)
        )
        return cursor.lastrowid


def get_device_session(id: str) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM device_sessions WHERE id = ?", (id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_device_session_by_device_connection(device_connection_id: int) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM device_sessions WHERE device_connection_id = ? ORDER BY updated_at DESC LIMIT 1",
            (device_connection_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def update_device_session_timestamp(id: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE device_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (id,)
        )


def delete_device_session(id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM device_chat_messages WHERE device_session_id = ?", (id,))
        cursor.execute("DELETE FROM device_sessions WHERE id = ?", (id,))
        return cursor.rowcount > 0


# Device chat message operations
def save_device_chat_message(device_session_id: str, role: str, content: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO device_chat_messages (device_session_id, role, content)
               VALUES (?, ?, ?)""",
            (device_session_id, role, content)
        )
        return cursor.lastrowid


def get_device_chat_messages(device_session_id: str) -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT role, content, timestamp FROM device_chat_messages
               WHERE device_session_id = ? ORDER BY timestamp ASC""",
            (device_session_id,)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": str(i + 1),
                "role": row["role"],
                "content": row["content"],
                "timestamp": row["timestamp"]
            }
            for i, row in enumerate(rows)
        ]


# Password operations
def create_password_entry(
    category: str,
    name: str,
    username: str,
    encrypted_password: bytes,
    url: Optional[str] = None,
    notes: Optional[str] = None
) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO password_entries
               (category, name, username, encrypted_password, url, notes)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (category, name, username, encrypted_password, url, notes)
        )
        return cursor.lastrowid


def get_password_entries() -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, category, name, username, url, notes,
                   created_at, updated_at
            FROM password_entries ORDER BY updated_at DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_password_entry_by_id(id: int) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM password_entries WHERE id = ?",
            (id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_password_entry(id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM password_entries WHERE id = ?", (id,))
        return cursor.rowcount > 0


# Auth operations
def get_master_password_hash() -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM auth WHERE id = 1")
        row = cursor.fetchone()
        return dict(row) if row else None


def set_master_password_hash(password_hash: str, salt: bytes, iterations: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO auth (id, password_hash, salt, iterations, updated_at)
            VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (password_hash, salt, iterations))


# ==================== Project Operations ====================

def create_project(name: str, path: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO projects (name, path) VALUES (?, ?)",
            (name, path)
        )
        return cursor.lastrowid


def get_projects() -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_project_by_id(id: int) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_project(id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        # Delete associated device connections first
        cursor.execute("DELETE FROM device_connections WHERE project_id = ?", (id,))
        cursor.execute("DELETE FROM projects WHERE id = ?", (id,))
        return cursor.rowcount > 0


# ==================== Device Connection Operations ====================

def create_device_connection(
    project_id: int,
    document_id: str,
    device_id: str,
    name: str,
    url: str,
    username: str = None,
    password: str = None
) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO device_connections
               (project_id, document_id, device_id, name, url, username, password)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (project_id, document_id, device_id, name, url, username, password)
        )
        return cursor.lastrowid


def get_device_connections() -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, project_id, document_id, device_id, name, url, username, created_at
            FROM device_connections ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_device_connection_by_id(id: int) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM device_connections WHERE id = ?", (id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_device_connections_by_project(project_id: int) -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM device_connections WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_device_connection_by_device_id(device_id: str) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM device_connections WHERE device_id = ?", (device_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_device_connection(id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM device_connections WHERE id = ?", (id,))
        return cursor.rowcount > 0
