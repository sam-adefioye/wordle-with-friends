export interface Guess {
    name: string;
    timestamp: number;
    guess: string;
}

export interface GameState {
    answer: string;
    guesses: Guess[];
    players: string[];
    sessionId: string;
    type?: string;
    result?: string;
    connected?: boolean;
}