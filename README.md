[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Wordle With Friends

## Getting Started

### Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

```bash
cd frontend && npm install
```

### Run the server

#### Option 1: Run in separate terminals

In one terminal (from the project root or backend directory):
```bash
uvicorn backend.main:app --reload
```

In another terminal (from the frontend directory):
```bash
cd frontend
npm start
```

#### Option 2: Run both with one command (requires npm and Python venv active)

From the project root:
```bash
npm run dev
```

---
