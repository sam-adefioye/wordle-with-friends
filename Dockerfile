# ---------- FRONTEND BUILD STAGE ----------
FROM node:20 AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ---------- BACKEND BUILD STAGE ----------
FROM python:3.11-slim AS backend

WORKDIR /app

# Set environment variable to indicate Docker
ENV IN_DOCKER=1

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m venv venv && \
    . venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/
COPY backend/words.json ./backend/words.json

# Copy frontend build to backend (to serve as static files)
COPY --from=frontend-build /app/frontend/build ./frontend_build

# Copy entrypoint script
COPY ./start.sh .

# Expose port
EXPOSE 8000

# Entrypoint
CMD ["./start.sh"] 