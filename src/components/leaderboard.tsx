"use client";

import { LoaderCircle, Medal } from "lucide-react";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";

interface RankedPlayer {
  id: string;
  username: string;
  country_code: string;
  rating: number;
  wins: number;
  losses: number;
  games_played: number;
}

export function Leaderboard({ currentUserId }: { currentUserId: string }) {
  const [players, setPlayers] = useState<RankedPlayer[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ players: RankedPlayer[] }>("/api/leaderboard")
      .then((result) => setPlayers(result.players))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load rankings."));
  }, []);

  return (
    <main className="leaderboard-page">
      <div className="leaderboard-heading"><div><span className="eyebrow">WORLD RANKING</span><h1>Leaderboard</h1></div><Medal size={32} /></div>
      {error && <div className="inline-alert">{error}</div>}
      {!players ? (
        <div className="loading-state"><LoaderCircle className="spin" size={24} /> Loading rankings</div>
      ) : (
        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <thead><tr><th>Rank</th><th>Player</th><th>Country</th><th>Rating</th><th>Record</th><th>Games</th></tr></thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id} className={player.id === currentUserId ? "current-player" : ""}>
                  <td><span className={`rank-number rank-${index + 1}`}>{index + 1}</span></td>
                  <td><strong>{player.username}</strong>{player.id === currentUserId && <small>YOU</small>}</td>
                  <td>{player.country_code}</td>
                  <td><b>{player.rating}</b></td>
                  <td>{player.wins} - {player.losses}</td>
                  <td>{player.games_played}</td>
                </tr>
              ))}
              {players.length === 0 && <tr><td colSpan={6} className="empty-table">No ranked matches yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
