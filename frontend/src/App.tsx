import React, { useState, useRef, useEffect } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import ClearIcon from '@mui/icons-material/Clear';
import ReplayIcon from '@mui/icons-material/Replay';
import './App.css';
import { BACKEND_URL, WS_URL, MAX_GUESSES, WORD_LENGTH } from './constants';
import { GameState, Guess } from './model/interfaces';

// Animated Background Component
interface AnimatedWordBackgroundProps {
  className?: string;
  opacity?: number;
  wordCount?: number;
  speed?: number;
  customWords?: string[];
}

const AnimatedWordBackground: React.FC<AnimatedWordBackgroundProps> = ({ 
  className = '', 
  opacity = 0.22, // increased for more visibility
  wordCount = 22, // more words
  speed = 900,    // more frequent
  customWords = null 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [words] = useState(customWords || [
    'AUDIO', 'CRANE', 'SLATE', 'PIANO', 'ADIEU', 'HOUSE', 'MOUSE', 'ABOUT',
    'TEARS', 'ARISE', 'RAISE', 'STARE', 'LATER', 'ALERT', 'TRADE', 'BREAD',
    'LEARN', 'HEART', 'WORLD', 'PHONE', 'LIGHT', 'POWER', 'SMILE', 'PEACE',
    'DREAM', 'MAGIC', 'QUICK', 'SMART', 'BRAVE', 'SHINE', 'FLAME', 'STORM'
  ]);

  const directions = ['move-up', 'move-down', 'move-left', 'move-right'];
  const sizes = ['small', 'medium', 'large'];

  const createWord = () => {
    if (!containerRef.current) return;

    const word = document.createElement('div');
    word.className = 'animated-word';
    word.textContent = words[Math.floor(Math.random() * words.length)];
    
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    word.classList.add(size);
    
    const direction = directions[Math.floor(Math.random() * directions.length)];
    word.classList.add(direction);
    
    if (direction === 'move-up' || direction === 'move-down') {
      word.style.left = Math.random() * 100 + '%';
    } else {
      word.style.top = Math.random() * 100 + '%';
    }
    
    const duration = Math.random() * 10 + 8;
    word.style.animationDuration = duration + 's';
    
    const delay = Math.random() * 2;
    word.style.animationDelay = delay + 's';
    
    // Use a more contrasting colour for the animated words
    word.style.color = `rgba(0, 0, 0, 0.08)`;
    word.style.textShadow = 'none';

    containerRef.current.appendChild(word);
    
    setTimeout(() => {
      if (word.parentNode) {
        word.parentNode.removeChild(word);
      }
    }, (duration + delay) * 1000);
  };

  useEffect(() => {
    for (let i = 0; i < wordCount; i++) {
      setTimeout(() => createWord(), i * 200);
    }

    const interval = setInterval(() => {
      createWord();
    }, speed);

    return () => clearInterval(interval);
  }, [wordCount, speed]);

  const styles = {
    container: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none' as const,
      zIndex: 0,
    }
  };

  return (
    <>
      <style>{`
        .animated-word {
          position: absolute;
          font-family: 'Roboto', 'Arial', sans-serif;
          font-weight: 600;
          color: rgba(33, 150, 243, ${opacity});
          text-transform: uppercase;
          letter-spacing: 2px;
          user-select: none;
          pointer-events: none;
          white-space: nowrap;
        }

        .animated-word.small { font-size: 14px; }
        .animated-word.medium { font-size: 18px; }
        .animated-word.large { font-size: 24px; }

        .animated-word.move-up { animation: moveUp linear infinite; }
        .animated-word.move-down { animation: moveDown linear infinite; }
        .animated-word.move-left { animation: moveLeft linear infinite; }
        .animated-word.move-right { animation: moveRight linear infinite; }

        @keyframes moveUp {
          from { transform: translateY(100vh); }
          to { transform: translateY(-100px); }
        }

        @keyframes moveDown {
          from { transform: translateY(-100px); }
          to { transform: translateY(100vh); }
        }

        @keyframes moveLeft {
          from { transform: translateX(100vw); }
          to { transform: translateX(-300px); }
        }

        @keyframes moveRight {
          from { transform: translateX(-300px); }
          to { transform: translateX(100vw); }
        }
      `}</style>
      
      <div 
        ref={containerRef}
        className={`animated-word-container ${className}`}
        style={styles.container}
      />
    </>
  );
};

const getTileColors = (guess: string, answer: string) => {
  const colors = Array(WORD_LENGTH).fill('gray');
  const answerArr = answer.split('');
  const guessArr = guess.split('');
  const used = Array(WORD_LENGTH).fill(false);

  const letterIndices: Record<string, number[]> = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    const letter = answerArr[i];
    const letterArr = letterIndices[letter] || [];
    letterArr.push(i);
    letterIndices[letter] = letterArr;
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === answerArr[i]) {
      colors[i] = 'green';
      used[i] = true;
      letterIndices[guessArr[i]] = letterIndices[guessArr[i]].filter((index) => index !== i);
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    let letterIndex = letterIndices[guessArr[i]];
    if (letterIndex && letterIndex.length > 0 && !letterIndex.includes(i) && !used[i]) {
      colors[i] = 'yellow';
      used[i] = true;
      letterIndices[guessArr[i]].shift();
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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [shouldFocusName, setShouldFocusName] = useState(false);
  
  
  useEffect(() => {
    const allGuesses = guesses.sort((a, b) => a.timestamp - b.timestamp);
    setGridRows(Array.from({ length: MAX_GUESSES }, (_, i) =>
      allGuesses[i] ? allGuesses[i].guess.padEnd(WORD_LENGTH) : ''.padEnd(WORD_LENGTH)
    ));
    setGuessesLeft(totalGuesses <= MAX_GUESSES);
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
      nameInputRef.current?.focus();
      nameInputRef.current?.click();
      return;
    }
    clear();
    
    const res = await fetch(`${BACKEND_URL}/create_session`, { method: 'POST' });
    const data = await res.json();
    setSessionId(data.session_id);
    window.history.replaceState(null, '', `/${data.session_id}`);
    setShouldFocusName(true);
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
      
      if (data.type === "ping") {
        ws.current?.send(JSON.stringify({ type: "pong" }));
        return;
      }
      
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
  
  useEffect(() => {
    if (shouldFocusName && sessionId && nameInputRef.current && !connected) {
      nameInputRef.current.focus();
      nameInputRef.current.click();
      setShouldFocusName(false);
    }
  }, [shouldFocusName, sessionId, connected]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Animated Background */}
      <AnimatedWordBackground 
        opacity={0.22}
        wordCount={22}
        speed={900}
      />
      
      {/* Main App Content */}
      <div className="App">
        <h1>Wordle w/ Friends &#x1F3C6;</h1>
        <div>
          <div className="new-game-container">
            <Button 
              variant="contained" 
              color="primary" 
              onClick={createSession} 
              size="large"
              disabled={!connected && !!sessionId}
            >
              {gameResult || sessionId ? <ReplayIcon fontSize="medium" /> : 'New Game'}
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
                inputRef={nameInputRef}
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
                  disabled={(connected && !guessesLeft) || gameResult.length > 0}
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
                  Guess
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
    </div>
  );
}

export default App;