#!/bin/bash
set -e
source venv/bin/activate
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 