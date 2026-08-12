"use client";

import {
  Copy,
  DoorOpen,
  LoaderCircle,
  LockKeyhole,
  Search,
  Swords,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import type { MatchSnapshot } from "@/lib/matches/types";
import type { PublicProfile } from "@/lib/profiles/types";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase.database.types";

interface MatchmakingResponse {
  status: "idle" | "waiting" | "matched";
  match: MatchSnapshot | null;
  joinedAt?: string | null;
}

export function Lobby({
  profile,
  onMatch,
}: {
  profile: PublicProfile;
  onMatch: (match: MatchSnapshot) => void;
}) {
  const [queueing, setQueueing] = useState(false);
  const [busyAction, setBusyAction] = useState<"queue" | "create" | "join" | null>(null);
  const [error, setError] = useState("");

  const checkQueue = useCallback(async () => {
    try {
      const result = await apiRequest<MatchmakingResponse>("/api/matchmaking");
      setQueueing(result.status === "waiting");
      if (result.match) onMatch(result.match);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check the queue.");
    }
  }, [onMatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkQueue(), 0);
    return () => window.clearTimeout(timer);
  }, [checkQueue]);

  useEffect(() => {
    if (!queueing) return;
    const interval = window.setInterval(() => void checkQueue(), 1800);
    return () => window.clearInterval(interval);
  }, [checkQueue, queueing]);

  useEffect(() => {
    if (!queueing) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`queue:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_players",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const seat = payload.new as Tables<"match_players">;
          apiRequest<{ match: MatchSnapshot }>(`/api/matches/${seat.match_id}`)
            .then((result) => onMatch(result.match))
            .catch(() => void checkQueue());
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [checkQueue, onMatch, profile.id, queueing]);

  async function joinQueue() {
    setBusyAction("queue");
    setError("");
    try {
      const result = await apiRequest<MatchmakingResponse>("/api/matchmaking", { method: "POST" });
      setQueueing(result.status === "waiting");
      if (result.match) onMatch(result.match);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join the queue.");
    } finally {
      setBusyAction(null);
    }
  }

  async function leaveQueue() {
    setBusyAction("queue");
    try {
      await apiRequest("/api/matchmaking", { method: "DELETE" });
      setQueueing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not leave the queue.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createRoom() {
    setBusyAction("create");
    setError("");
    try {
      const { match } = await apiRequest<{ match: MatchSnapshot }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ action: "create" }),
      });
      onMatch(match);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the room.");
    } finally {
      setBusyAction(null);
    }
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("join");
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    try {
      const { match } = await apiRequest<{ match: MatchSnapshot }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ action: "join", code }),
      });
      onMatch(match);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join the room.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="lobby-page">
      <div className="lobby-heading">
        <div><span className="eyebrow">PLAY</span><h1>Choose a match</h1></div>
        <div className="career-line"><span>{profile.games_played} games</span><span>{profile.wins} wins</span><span>{profile.losses} losses</span></div>
      </div>

      {error && <div className="inline-alert" role="alert"><span>{error}</span><button className="icon-button" onClick={() => setError("")} title="Dismiss"><X size={16} /></button></div>}

      <section className={`queue-panel ${queueing ? "is-searching" : ""}`}>
        <div className="queue-identity">
          <div className="mode-icon"><Swords size={24} /></div>
          <div><span className="section-kicker">RANKED 1V1</span><h2>{queueing ? "Finding your opponent" : "Quick match"}</h2></div>
        </div>
        <dl className="mode-facts">
          <div><dt>Mode</dt><dd>Normal functions</dd></div>
          <div><dt>Turn</dt><dd>60 seconds</dd></div>
          <div><dt>Units</dt><dd>2 chickens</dd></div>
        </dl>
        {queueing ? (
          <div className="queue-actions"><span className="searching-label"><LoaderCircle className="spin" size={18} /> Searching worldwide</span><button className="button button-secondary" onClick={leaveQueue} disabled={busyAction === "queue"}><X size={17} /> Cancel</button></div>
        ) : (
          <button className="button button-primary queue-button" onClick={joinQueue} disabled={busyAction !== null}>{busyAction === "queue" ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}Find opponent</button>
        )}
      </section>

      <div className="private-grid">
        <section className="private-section">
          <div className="section-heading"><div className="mode-icon light"><LockKeyhole size={21} /></div><div><span className="section-kicker">PRIVATE 1V1</span><h2>Create a room</h2></div></div>
          <div className="room-visual"><Users size={28} /><span></span><DoorOpen size={28} /></div>
          <button className="button button-dark" onClick={createRoom} disabled={busyAction !== null}>{busyAction === "create" ? <LoaderCircle className="spin" size={18} /> : <Copy size={17} />}Create invite code</button>
        </section>

        <section className="private-section">
          <div className="section-heading"><div className="mode-icon light"><DoorOpen size={21} /></div><div><span className="section-kicker">INVITATION</span><h2>Join a room</h2></div></div>
          <form className="join-room-form" onSubmit={joinRoom}>
            <label>ROOM CODE<input name="code" minLength={6} maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder="ABC123" required /></label>
            <button className="button button-dark" disabled={busyAction !== null}>{busyAction === "join" ? <LoaderCircle className="spin" size={18} /> : <DoorOpen size={17} />}Join room</button>
          </form>
        </section>
      </div>

      <footer className="lobby-footer"><span>Basic mode</span><span>Desktop preview</span><a href="https://github.com/ingteranalvarez/chickgraph" target="_blank" rel="noreferrer">Source code</a></footer>
    </main>
  );
}
