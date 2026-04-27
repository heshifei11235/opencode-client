# OpenCode Client

A web application for managing multiple remote OpenCode server connections with a unified chat interface and password memo functionality.

## Architecture Overview

```
┌─────────────┐     HTTP/WebSocket     ┌──────────────────┐     HTTP      ┌─────────────────┐
│   Browser   │ ◄─────────────────────► │   FastAPI Server  │ ◄──────────► │ OpenCode Server │
│  (React)    │     localhost:3000      │   (Python)        │   localhost:4096    │  (Remote)       │
│             │                         │   localhost:8000 │               │                 │
└─────────────┘                         └──────────────────┘               └─────────────────┘
        │                                        │
        │                                        ▼
        │                               ┌──────────────────┐
        │                               │   SQLite DB      │
        │                               │ opencode_client.db│
        │                               └──────────────────┘
```

## Project Structure

```
opencode-client/
├── README.md              # This file
├── backend/               # Python FastAPI backend
│   ├── main.py           # FastAPI app entry point + WebSocket endpoint
│   ├── remote_client.py  # HTTP client for OpenCode server communication
│   ├── database.py       # SQLite database operations
│   ├── models.py         # Pydantic request/response models
│   ├── password_store.py # AES-256 password encryption/decryption
│   ├── session_manager.py# Session management utilities
│   ├── acp_client.py     # (Reserved) ACP protocol client
│   └── requirements.txt  # Python dependencies
│
└── frontend/             # React + TypeScript frontend
    ├── src/
    │   ├── App.tsx              # Main application component
    │   ├── main.tsx             # React entry point
    │   ├── index.css            # Global styles
    │   ├── components/          # UI components
    │   │   ├── Sidebar.tsx      # Connection list + navigation
    │   │   ├── ChatPanel.tsx    # Chat interface
    │   │   ├── PasswordPanel.tsx# Password management
    │   │   └── ReservePanel.tsx  # Reserved for future use
    │   ├── stores/
    │   │   └── appStore.ts      # Zustand state management
    │   ├── types/
    │   │   └── index.ts         # TypeScript type definitions
    │   └── lib/
    │       └── utils.ts         # Utility functions
    ├── package.json
    └── vite.config.ts           # Vite + proxy configuration
```

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: SQLite with direct SQL
- **Encryption**: cryptography (Fernet AES-256)
- **HTTP Client**: httpx (async)
- **Server**: Uvicorn

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Database Schema

### Tables

#### connections
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Connection name |
| url | TEXT | OpenCode server URL |
| username | TEXT | Auth username (optional) |
| password | TEXT | Auth password (optional, stored plain) |
| working_directory | TEXT | Default working directory |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### sessions
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| connection_id | INTEGER | Foreign key to connections |
| remote_session_id | TEXT | OpenCode server session ID |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### chat_messages
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key (auto-increment) |
| session_id | TEXT | Foreign key to sessions |
| role | TEXT | 'user' or 'assistant' |
| content | TEXT | Message content |
| timestamp | TIMESTAMP | Message time |

#### password_entries
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| category | TEXT | 'website', 'app', or 'email' |
| name | TEXT | Entry name |
| username | TEXT | Username |
| encrypted_password | BLOB | AES-256 encrypted password |
| url | TEXT | URL (optional) |
| notes | TEXT | Notes (optional) |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### auth
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key (always 1) |
| password_hash | TEXT | PBKDF2 password hash |
| salt | BLOB | Password salt |
| iterations | INTEGER | PBKDF2 iterations |
| updated_at | TIMESTAMP | Last update time |

## API Endpoints

### Connection Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/connections | Create new connection |
| GET | /api/connections | List all connections |
| GET | /api/connections/{id} | Get connection details |
| DELETE | /api/connections/{id} | Delete connection |
| POST | /api/connections/test | Test connection |
| GET | /api/connections/{id}/sessions/latest | Get or create session for connection |

### Session Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/sessions | Create new session |
| GET | /api/sessions/{id} | Get session details |
| DELETE | /api/sessions/{id} | Delete session |

### WebSocket Chat
| Endpoint | Description |
|----------|-------------|
| WS /ws/chat/{session_id} | Real-time chat via WebSocket |

#### WebSocket Message Types

**Client → Server:**
```json
{ "type": "prompt", "content": "Hello" }
{ "type": "history" }
```

**Server → Client:**
```json
{ "type": "message", "data": { "parts": [...] } }
{ "type": "history", "data": [...] }
{ "type": "error", "message": "..." }
```

### Password Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/master-password | Set master password |
| POST | /api/auth/verify | Verify master password |
| GET | /api/auth/status | Get auth status |
| POST | /api/passwords | Create password entry |
| GET | /api/passwords | List all entries (without passwords) |
| GET | /api/passwords/{id} | Get entry with decrypted password |
| DELETE | /api/passwords/{id} | Delete entry |

## Frontend State Management

The Zustand store (`appStore.ts`) manages:

```typescript
interface AppState {
  // View
  activeView: 'chat' | 'password'
  setActiveView: (view) => void

  // Connections
  connections: Connection[]
  activeConnectionId: number | null

  // Chat sessions (per-connection)
  chatSessions: Record<number, ChatSession>
  // ChatSession = { sessionId: string | null, messages: ChatMessage[] }

  // Passwords
  passwords: PasswordEntry[]
  authStatus: AuthStatus
}
```

## Security

### Password Encryption
- Master password → PBKDF2 (100,000 iterations) → AES-256 key
- Password entries encrypted with Fernet (AES-256)
- Salt generated using `os.urandom(16)`

### Authentication
- Basic Auth header for OpenCode server communication
- Session-based auth with optional master password

## Configuration

### Backend Environment
```bash
# Optional: Run OpenCode server with authentication
OPENCODE_SERVER_USERNAME=opencode \
OPENCODE_SERVER_PASSWORD=your_password \
opencode serve --hostname 0.0.0.0 --port 4096
```

### Frontend Proxy (vite.config.ts)
- `/api` → `http://localhost:8000`
- `/ws` → `ws://localhost:8000`

## Getting Started

### 1. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 3. Start Backend
```bash
cd backend
python3 -m uvicorn main:app --port 8000 --reload
```

### 4. Start Frontend
```bash
cd frontend
npm run dev
```

### 5. Access Application
Open http://localhost:3000

### 6. Add OpenCode Server Connection
- Click "Add Connection" in sidebar
- Enter OpenCode server URL (e.g., http://192.168.1.100:4096)
- Optionally set username/password if server requires auth
- Click "Test Connection" to verify
- Click "Add" to save and connect

## Key Features

1. **Multi-Connection Management**: Connect to multiple OpenCode servers
2. **Per-Connection Sessions**: Each connection maintains its own chat history
3. **Persistent Chat History**: Messages stored in SQLite, survive page refresh
4. **Password Memo**: AES-256 encrypted password storage with master password
5. **Real-time Chat**: WebSocket-based communication
6. **Connection Testing**: Verify connectivity before adding

## Known Limitations

1. **Response Time**: OpenCode server response can take 10+ seconds
2. **No Streaming**: ACP protocol doesn't support real-time streaming
3. **No HTTPS**: Local development uses HTTP
4. **Plain Password Storage**: Connection passwords stored unencrypted in DB