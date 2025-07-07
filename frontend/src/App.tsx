import React, { useState, useRef, useEffect } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import ClearIcon from '@mui/icons-material/Clear';
import './App.css';
import { BACKEND_URL, WS_URL, MAX_GUESSES, WORD_LENGTH } from './constants';
import { GameState, Guess } from './model/interfaces';

const getTileColors = (guess: string, answer: string) => {
  const colors = Array(WORD_LENGTH).fill('gray');
  const answerArr = answer.split('');
  const guessArr = guess.split('');
  const used = Array(WORD_LENGTH).fill(false);

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === answerArr[i]) {
      colors[i] = 'green';
      used[i] = true;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (colors[i] === 'green') continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (!used[j] && guessArr[i] === answerArr[j]) {
        colors[i] = 'yellow';
        used[j] = true;
        break;
      }
    }
  }
  return colors;
}

function App() {
  const initialSessionId = window.location.pathname.slice(1) || '';
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [player, setPlayer] = useState('');
  const [guess, setGuess] = useState('');
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [connected, setConnected] = useState(false);
  const [answer, setAnswer] = useState('');
  const [totalGuesses, setTotalGuesses] = useState(0);
  const [gameResult, setGameResult] = useState("");
  const [gridRows, setGridRows] = useState<string[]>([]);
  const [guessesLeft, setGuessesLeft] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);
  
  
  useEffect(() => {
    const allGuesses = guesses.sort((a, b) => a.timestamp - b.timestamp);
    setGridRows(Array.from({ length: MAX_GUESSES }, (_, i) =>
      allGuesses[i] ? allGuesses[i].guess.padEnd(WORD_LENGTH) : ''.padEnd(WORD_LENGTH)
    ));
    setGuessesLeft(totalGuesses < MAX_GUESSES);
  }, [guesses, connected, totalGuesses, players]);
  
  const clear = () => {
    setGuesses([]);
    setTotalGuesses(0);
    setAnswer('');
    setGameResult("");
    setConnected(false);
    setPlayers([]);
  }

  const createSession = async () => {
    if (sessionId) {
      try {
        const res = await fetch(`${BACKEND_URL}/reset_session/${sessionId}`, { method: 'POST' });
        if (!res.ok) {
          console.error('Failed to reset session');
        }
      } catch (error) {
        console.error('Failed to reset session:', error);
      }
      return;
    }
    clear();
    
    const res = await fetch(`${BACKEND_URL}/create_session`, { method: 'POST' });
    const data = await res.json();
    setSessionId(data.session_id);
    window.history.replaceState(null, '', `/${data.session_id}`);
  };

  const joinSession = () => {
    if (!sessionId || !player) return;

    ws.current = new window.WebSocket(`${WS_URL}${sessionId}/${player}`);
    ws.current.onopen = () => {
      setConnected(true)
      setPlayers(prevPlayers => !prevPlayers.includes(player) ? [...prevPlayers, player] : prevPlayers);
      
      ws.current?.send(JSON.stringify({ 
        player: player,
        type: "create"
      }));
    };
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data) as GameState;
      
      if (data.type === "reset") {
        setGuesses([]);
        setTotalGuesses(0);
        setAnswer(data.answer);
        setGameResult("");
        return;
      }
      
      if (data.result) {
        setGameResult(data.result);
        setGuesses(data.guesses)
        return;
      }
      
      if (data.guesses) {
        setGuesses(data.guesses);
        setTotalGuesses(Object.values(data.guesses).flat().length);
      }
      if (data.answer) setAnswer(data.answer);
      if (data.players) setPlayers(data.players);
    };
    ws.current.onclose = () => {
      clear();
    };
    window.history.replaceState(null, '', `/${sessionId}`);
  };

  const sendGuess = () => {
    if (ws.current && guess.length === WORD_LENGTH && guessesLeft && !gameResult) {
      ws.current.send(JSON.stringify({ player, guess }));
      setGuess('');
    }
  };
  
  return (
    <div className="App">
      <h1>Wordle With Friends</h1>
      <div>
        <div className="new-game-container">
          <Button variant="contained" color="primary" onClick={createSession} size="large">
            New Game
          </Button>
        </div>
        
        {connected && players && (
          <div style={{marginBottom: '1em'}}>
            <h4>Online Players:</h4>
            <div style={{fontSize: '1em', color: '#666'}}>
              {players.map((playerName, i, arr) => (
                <span key={playerName}>
                  <span style={{
                    color: playerName === player ? '#4CAF50' : '#2196F3',
                    fontWeight: playerName === player ? 'bold' : 'normal'
                  }}>
                    {playerName} {playerName === player && '(You)'}
                  </span>
                  {i < arr.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        )}
        {!connected && (
          <>
            <TextField
              label="Your Name"
              variant="outlined"
              value={player}
              onChange={e => setPlayer(e.target.value)}
              disabled={connected || !sessionId}
              style={{ marginRight: '1em' }}
              size="small"
              slotProps={{
                input: {
                  endAdornment: player && (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="clear name"
                        onClick={() => setPlayer('')}
                        edge="end"
                        size="small"
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                },
                htmlInput: {
                  minLength: 3, maxLength: 10, style: { height: 40, fontSize: '1.1em' }
                }
              }}
            />
            <Button
              variant="contained"
              color="secondary"
              onClick={joinSession}
              disabled={connected || !player}
              size="large"
              sx={{ height: '56px' }}
            >
              Join
            </Button>
          </>
        )}
      </div>
      <div>
        {connected && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1em', marginTop: '1.5em' }}>
              <TextField
                label="Your Guess"
                variant="outlined"
                value={guess}
                onChange={e => {
                  const value = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, WORD_LENGTH);
                  setGuess(value)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    sendGuess();
                  }
                }}
                slotProps={{
                  input: {
                    endAdornment: guess && (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="clear guess"
                          onClick={() => setGuess('')}
                          edge="end"
                          size="small"
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  },
                  htmlInput: {
                    maxLength: WORD_LENGTH, style: { textTransform: 'uppercase', fontWeight: 'bold', fontSize: '1.2em', letterSpacing: '0.2em' }
                  }
                }}
                disabled={!guessesLeft || gameResult.length > 0}
                autoComplete="off"
                sx={{ width: 180 }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={sendGuess}
                disabled={guess.length !== WORD_LENGTH || !guessesLeft}
                size="large"
                sx={{ height: '56px' }}
              >
                Send Guess
              </Button>
            </div>
            {gameResult && (
              <div style={{marginTop: 8}}>
                {gameResult === "win" ? (
                  <div style={{color: 'green'}}>
                    🎉 Congratulations! Answer: {answer.toUpperCase()}
                  </div>
                ) : (
                  <div style={{color: 'red'}}>
                    Game Over! The answer was: {answer.toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 5x5 grid for the current player with color feedback */}
        <div className="grid-container">
          {gridRows.map((row, rowIdx) => {
            const colors = row.trim() && answer ? getTileColors(row, answer) : Array(WORD_LENGTH).fill('');
            return (
              <div className="grid-row" key={rowIdx}>
                {row.split('').map((char, colIdx) => (
                  <div
                    className={`grid-tile${colors[colIdx] ? ' ' + colors[colIdx] : ''}`}
                    key={colIdx}
                  >
                    {char || ''}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {connected && (
          <>
            <h4>All Players' Guesses:</h4>
            <div className="players-guesses">
              {guesses.sort((a, b) => a.timestamp - b.timestamp).map((row, i) =>
                <div key={row.name + '-' + i}><b>{row.guess}</b> <span style={{color:'#888'}}>({row.name})</span></div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
