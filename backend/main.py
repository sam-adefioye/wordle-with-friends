from tkinter.constants import WORD
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from backend.words import load_words
from enum import Enum
from time import time
import uuid
import json
import random

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

class Action(Enum):
    CREATE = "create"
    GET = "get"
    RESET = "reset"

red_cache = Redis(host='localhost', port=6379, db=0, decode_responses=True)

def get_random_word():
    return random.choice(WORD_LIST)

def new_game_state():
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
    except Exception:
        pass
    finally:
        return new_game_state()


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        self.active_connections[session_id].remove(websocket)
        if not self.active_connections[session_id]:
            del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@app.post("/create_session")
async def create_session():
    session_id = str(uuid.uuid4())
    game_state = new_game_state()
    await red_cache.set(f"{SESSION_ID_PREFIX}{session_id}", json.dumps(game_state))
    return JSONResponse({"session_id": session_id})


@app.post("/reset_session/{session_id}")
async def reset_session(session_id: str):
    session_id_str = f"{SESSION_ID_PREFIX}{session_id}"
    game_state = await get_or_create_game_state(Action.RESET, session_id)
    await red_cache.set(session_id_str, json.dumps(game_state))

    try:
        await manager.broadcast(session_id, {
            PLAYERS_KEY: game_state[PLAYERS_KEY],
            GUESSES_KEY: game_state[GUESSES_KEY],
            ANSWER_KEY: game_state[ANSWER_KEY],
            "type": Action.RESET.value
        })
    except Exception:
        pass
    
    return JSONResponse({"status": "reset", "session_id": session_id})


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)    
    session_id_str = f"{SESSION_ID_PREFIX}{session_id}"

    try:
        while True:
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
                    await manager.broadcast(session_id, {
                        PLAYERS_KEY: game_state[PLAYERS_KEY],
                        GUESSES_KEY: game_state[GUESSES_KEY],
                        ANSWER_KEY: game_state[ANSWER_KEY]}
                    );

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
                
                broadcast_data = {
                    PLAYERS_KEY: game_state[PLAYERS_KEY],
                    GUESSES_KEY: game_state[GUESSES_KEY],
                    ANSWER_KEY: game_state[ANSWER_KEY]
                }
                total_guesses = len(game_state[GUESSES_KEY])

                if player and guess and total_guesses < 6:
                    if guess == game_state[ANSWER_KEY]:
                        game_result = {"result": "win"}
                    elif total_guesses == 5:
                        game_result = {"result": "loss"}
                if game_result:
                    broadcast_data = {**broadcast_data, **game_result}

                await red_cache.set(session_id_str, json.dumps(game_state))
            await manager.broadcast(session_id, broadcast_data)
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket) 