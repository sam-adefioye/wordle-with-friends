export interface GameState {
    answer: string;
    guesses: Record<string, string[]>;
    players: string[];
    sessionId: string;
}