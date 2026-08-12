"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Flag,
  LoaderCircle,
  Radio,
  Unplug,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { FormulaBar } from "@/components/game/formula-bar";
import { GameBoard } from "@/components/game/game-board";
import { PlayerPanel } from "@/components/game/player-panel";
import { apiRequest } from "@/lib/api/client";
import { serializeMatch } from "@/lib/matches/serialize";
import type { ChatMessage, MatchSnapshot } from "@/lib/matches/types";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase.database.types";

export function GameRoom({
  initialMatch,
  userId,
  onMatchChange,
  onExit,
}: {
  initialMatch: MatchSnapshot;
  userId: string;
  onMatchChange: (match: MatchSnapshot) => void;
  onExit: () => void;
}) {
  const [match, setMatch] = useState(initialMatch);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set([userId]));
  const [connected, setConnected] = useState(false);
  const [firing, setFiring] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const timeoutAttempt = useRef<number | null>(null);
  const matchRef = useRef(initialMatch);
  const syncInFlight = useRef(false);
  const messagesInFlight = useRef(false);

  const updateMatch = useCallback(
    (next: MatchSnapshot) => {
      matchRef.current = next;
      setMatch(next);
      onMatchChange(next);
    },
    [onMatchChange],
  );

  const syncMatch = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const { match: next } = await apiRequest<{ match: MatchSnapshot }>(
        `/api/matches/${match.id}`,
      );
      updateMatch(next);
      if (next.status === "abandoned") onExit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sync the match.");
    } finally {
      syncInFlight.current = false;
    }
  }, [match.id, onExit, updateMatch]);

  const loadMessages = useCallback(async () => {
    if (!matchRef.current.state || messagesInFlight.current) return;
    messagesInFlight.current = true;
    try {
      const result = await apiRequest<{ messages: ChatMessage[] }>(
        `/api/matches/${match.id}/messages`,
      );
      setMessages(result.messages);
    } catch {
      // Match state polling remains available if chat is temporarily unavailable.
    } finally {
      messagesInFlight.current = false;
    }
  }, [match.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void syncMatch(), 3_500);
    return () => window.clearInterval(timer);
  }, [syncMatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMessages(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`match:${match.id}`, {
        config: { presence: { key: userId } },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          try {
            const next = serializeMatch(payload.new);
            updateMatch(next);
            if (next.status === "abandoned") onExit();
          } catch {
            void syncMatch();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          const row = payload.new as Tables<"messages">;
          const username =
            matchRef.current.state?.players.find(
              (player) => player.id === row.user_id,
            )?.username ?? "Unknown";
          const next: ChatMessage = {
            id: row.id,
            user_id: row.user_id,
            username,
            body: row.body,
            created_at: row.created_at,
          };
          setMessages((current) =>
            current.some((message) => message.id === next.id)
              ? current
              : [...current, next],
          );
        },
      )
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, onlineAt: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [match.id, onExit, syncMatch, updateMatch, userId]);

  const deadline = match.state?.turnDeadline;
  const secondsLeft = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1_000))
    : 0;
  const timerLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  useEffect(() => {
    const state = match.state;
    if (!state || state.status !== "active" || secondsLeft > 0) return;
    if (timeoutAttempt.current === state.version) return;
    timeoutAttempt.current = state.version;
    apiRequest<{ match: MatchSnapshot }>(`/api/matches/${match.id}/timeout`, {
      method: "POST",
    })
      .then((result) => updateMatch(result.match))
      .catch(() => void syncMatch());
  }, [match.id, match.state, secondsLeft, syncMatch, updateMatch]);

  async function fire(expression: string) {
    const state = match.state;
    if (!state) return;
    setFiring(true);
    setError("");
    try {
      const { match: next } = await apiRequest<{ match: MatchSnapshot }>(
        `/api/matches/${match.id}/fire`,
        {
          method: "POST",
          body: JSON.stringify({ expression, expectedVersion: state.version }),
        },
      );
      updateMatch(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The shot failed.");
      await syncMatch();
    } finally {
      setFiring(false);
    }
  }

  async function sendMessage(body: string) {
    try {
      await apiRequest(`/api/matches/${match.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      await loadMessages();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The message could not be sent.");
    }
  }

  async function leaveMatch() {
    const active = match.state?.status === "active";
    if (active && !window.confirm("Resign this match? Your opponent will win.")) return;
    setLeaving(true);
    setError("");
    try {
      const result = await apiRequest<{ match?: MatchSnapshot }>(
        `/api/matches/${match.id}`,
        { method: "DELETE" },
      );
      if (result.match) updateMatch(result.match);
      else onExit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not leave the match.");
    } finally {
      setLeaving(false);
    }
  }

  async function copyCode() {
    if (!match.inviteCode) return;
    await navigator.clipboard.writeText(match.inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  if (!match.state) {
    return (
      <main className="waiting-room">
        <button className="button button-secondary waiting-back" onClick={leaveMatch} disabled={leaving}>
          {leaving ? <LoaderCircle className="spin" size={17} /> : <ArrowLeft size={17} />} Cancel room
        </button>
        <div className="waiting-stage">
          <span className="eyebrow">PRIVATE ROOM</span>
          <h1>Waiting for your opponent</h1>
          <button className="invite-code" onClick={copyCode} title="Copy room code">
            <span>{match.inviteCode}</span>{copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
          <div className="waiting-chickens" aria-hidden="true">
            <Image src="/chickens/cyan.png" width={180} height={180} alt="" priority />
            <div><Users size={22} /><span></span></div>
            <div className="waiting-slot">?</div>
          </div>
          <p className="connection-line"><Radio size={15} /> Room is live</p>
        </div>
      </main>
    );
  }

  const state = match.state;
  const currentPlayer = state.players.find((player) => player.id === state.currentPlayerId);
  const winner = state.players.find((player) => player.id === state.winnerId);
  const isYourTurn = state.currentPlayerId === userId && state.status === "active";

  return (
    <main className="match-page">
      <div className="match-statusbar">
        <div className="match-meta">
          <span className={`connection-badge ${connected ? "connected" : ""}`}>
            {connected ? <Radio size={14} /> : <Unplug size={14} />}
            {connected ? "Live" : "Reconnecting"}
          </span>
          <span>{match.kind === "public" ? "Ranked 1v1" : `Private · ${match.inviteCode}`}</span>
          <span>Turn {state.turnNumber + 1}</span>
        </div>
        <div className={`turn-clock ${secondsLeft <= 10 ? "urgent" : ""}`}>
          <small>{state.status === "finished" ? "MATCH OVER" : isYourTurn ? "YOUR TURN" : `${currentPlayer?.username ?? "Opponent"}'S TURN`}</small>
          <strong>{state.status === "finished" ? "--" : timerLabel}</strong>
        </div>
        <button className="button button-secondary resign-button" onClick={state.status === "finished" ? onExit : leaveMatch} disabled={leaving}>
          {leaving ? <LoaderCircle className="spin" size={17} /> : state.status === "finished" ? <ArrowLeft size={17} /> : <Flag size={17} />}
          {state.status === "finished" ? "Lobby" : "Resign"}
        </button>
      </div>

      {error && <div className="match-error"><span>{error}</span><button className="icon-button" title="Dismiss" onClick={() => setError("")}><X size={16} /></button></div>}

      <div className="match-workspace">
        <section className="arena-section">
          <GameBoard state={state} shot={match.lastShot} userId={userId} />
          {state.status === "finished" && (
            <div className="match-result">
              <span className="eyebrow">MATCH COMPLETE</span>
              <h2>{winner?.id === userId ? "Victory" : winner ? `${winner.username} wins` : "Draw"}</h2>
              <button className="button button-primary" onClick={onExit}>Return to lobby</button>
            </div>
          )}
        </section>
        <PlayerPanel
          state={state}
          userId={userId}
          onlineIds={onlineIds}
          messages={messages}
          onMessage={sendMessage}
        />
      </div>

      <FormulaBar disabled={!isYourTurn || state.status === "finished"} busy={firing} onFire={fire} />
    </main>
  );
}
