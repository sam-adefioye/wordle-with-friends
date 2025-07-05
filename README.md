[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Wordle With Friends

## Backend (FastAPI)

### Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### Run the server

```bash
uvicorn backend.main:app --reload
```

- POST `/create_session` to create a new game session.
- WebSocket `/ws/{session_id}` to join a session.
