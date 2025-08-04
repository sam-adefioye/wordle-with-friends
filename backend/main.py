from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, Response, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from backend.words import load_words
from enum import Enum
from time import time
import uuid
import json
import random
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WORD_LIST = load_words()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_ID_PREFIX = 'wordle-answer-'
PLAYERS_KEY = 'players'
GUESSES_KEY = 'guesses'
ANSWER_KEY = 'answer'
SESSION_TTL_SECONDS = 60 * 60 * 24

class Action(Enum):
    CREATE = "create"
    GET = "get"
    RESET = "reset"

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_URL = os.environ.get("REDIS_URL")

if REDIS_URL:
    red_cache = Redis.from_url(REDIS_URL, decode_responses=True)
    logger.info(f"Redis connection initialized with REDIS_URL")
else:
    red_cache = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
    logger.info(f"Redis connection initialized with host: {REDIS_HOST}, port: {REDIS_PORT}")

def get_random_word() -> str:
    try:
        response = requests.get("https://random-word-api.vercel.app/api?words=1&length=5")
        if response.status_code == 200:
            words = response.json()
            if words:
                return words[0]
    except Exception as e:
        logger.error(f"Error fetching word from API: {e}")
    return random.choice(WORD_LIST)

def new_game_state() -> dict:
    return {
        ANSWER_KEY: get_random_word(),
        GUESSES_KEY: [],
        PLAYERS_KEY: []
    }

async def get_or_create_game_state(action: Action, session_id = None) -> dict:
    if not session_id or action == Action.CREATE.value:
        return new_game_state()

    session_id_str = f"{SESSION_ID_PREFIX}{session_id}"
    try:
        isExistingSession = await red_cache.exists(session_id_str)
        if isExistingSession:
            if action == Action.GET.value:
                game_state = await red_cache.get(session_id_str)
                return json.loads(game_state)
            elif action == Action.RESET.value:
                session_id_str = f"{SESSION_ID_PREFIX}{session_id}"
                game_state = await red_cache.get(session_id_str)
                game_state_obj = json.loads(game_state)
                game_state_obj[GUESSES_KEY] = []
                game_state_obj[ANSWER_KEY] = get_random_word()
                return game_state_obj
        else:
            return new_game_state()
    except Exception as e:
        logger.error(f"Error in get_or_create_game_state: {e}")
        pass
    finally:
        return new_game_state()


class ConnectionManager:
    def __init__(self):
        # Now: {session_id: {player_name: websocket}}
        self.active_connections: dict = {}

    async def connect(self, session_id: str, player: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
        self.active_connections[session_id][player] = websocket

    def disconnect(self, session_id: str, player: str):
        if session_id in self.active_connections and player in self.active_connections[session_id]:
            del self.active_connections[session_id][player]
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for ws in self.active_connections[session_id].values():
                await ws.send_json(message)

manager = ConnectionManager()

@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    try:
        # Test Redis connection
        await red_cache.ping()
        return {"status": "healthy", "redis": "connected", "word_count": len(WORD_LIST)}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}

@app.post("/create_session")
async def create_session():
    session_id = str(uuid.uuid4())
    game_state = new_game_state()
    await red_cache.set(f"{SESSION_ID_PREFIX}{session_id}", json.dumps(game_state))
    await red_cache.expire(f"{SESSION_ID_PREFIX}{session_id}", SESSION_TTL_SECONDS)
    return JSONResponse({"session_id": session_id})


@app.post("/reset_session/{session_id}")
async def reset_session(session_id: str):
    session_id_str = f"{SESSION_ID_PREFIX}{session_id}"
    game_state = await get_or_create_game_state(Action.RESET, session_id)
    await red_cache.set(session_id_str, json.dumps(game_state))
    await red_cache.expire(session_id_str, SESSION_TTL_SECONDS)

    try:
        await manager.broadcast(session_id, {**game_state, "type": Action.RESET.value})
    except Exception:
        pass
    
    return Response(status_code=200)


@app.websocket("/ws/{session_id}/{player}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, player: str):
    await manager.connect(session_id, player, websocket)

    try:
        while True:
            session_id_str = f"{SESSION_ID_PREFIX}{session_id}"
            data = await websocket.receive_json()
            player = data.get("player")
            guess = data.get("guess")
            type = data.get("type")
            broadcast_data = {}
            game_result = {}

            async with red_cache.pipeline() as pipe:

                if type and type == Action.CREATE.value and player:
                    pipe.get(session_id_str)
                    results = await pipe.execute()
                    game_state_json = results[0]
                    if game_state_json:
                        game_state = json.loads(game_state_json)
                        game_state[PLAYERS_KEY].append(player)
                        await red_cache.set(session_id_str, json.dumps(game_state))
                        await red_cache.expire(session_id_str, SESSION_TTL_SECONDS)
                    await manager.broadcast(session_id, game_state);

                pipe.get(session_id_str)
                results = await pipe.execute()
                game_state_json = results[0]
                
                if game_state_json:
                    game_state = json.loads(game_state_json)
                else:
                    game_state = new_game_state()

                if player and player not in game_state[PLAYERS_KEY]:
                    game_state[PLAYERS_KEY].append(player)
                if player and guess:
                    game_state[GUESSES_KEY].append({'name': player, 'timestamp': time(), 'guess': guess})
                
                broadcast_data = {**game_state}
                total_guesses = len(game_state[GUESSES_KEY])

                if player and guess and total_guesses < 6:
                    if guess == game_state[ANSWER_KEY]:
                        game_result = {"result": "win"}
                    elif total_guesses == 5:
                        game_result = {"result": "loss"}
                if game_result:
                    broadcast_data = {**broadcast_data, **game_result}

                await red_cache.set(session_id_str, json.dumps(game_state))
                await red_cache.expire(session_id_str, SESSION_TTL_SECONDS)
            
            if type != Action.CREATE.value:
                await manager.broadcast(session_id, broadcast_data)
    except WebSocketDisconnect:
        manager.disconnect(session_id, player)
