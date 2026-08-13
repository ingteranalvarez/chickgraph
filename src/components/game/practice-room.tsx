"use client";

import {
  ArrowLeft,
  Bot,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FormulaBar } from "@/components/game/formula-bar";
import { GameBoard } from "@/components/game/game-board";
import { chooseBotExpression } from "@/lib/game/bot";
import { createInitialState, fireShot, skipExpiredTurn } from "@/lib/game/engine";
import type {
  GamePlayer,
  GameState,
  ShotResult,
} from "@/lib/game/types";
import type { PublicProfile } from "@/lib/profiles/types";

const BOT_ID = "20000000-0000-4000-8000-000000000002";

interface PracticeShot {
  id: string;
  username: string;
  expression: string;
  result: string;
}

function practiceMatchId(seed: number): string {
  return `30000000-0000-4000-8000-${seed.toString(16).padStart(12, "0")}`;
}

function createPracticeState(profile: PublicProfile, seed: number): GameState {
  const players: GamePlayer[] = [
    {
      id: profile.id,
      username: profile.username,
      countryCode: profile.country_code,
      color: "cyan",
      seat: 0,
    },
    {
      id: BOT_ID,
      username: "GraphBot",
      countryCode: "AI",
      color: "coral",
      seat: 1,
    },
  ];
  return createInitialState({
    matchId: practiceMatchId(seed),
    players,
    seed,
  });
}

function compactShot(shot: ShotResult, maxPoints = 520): ShotResult {
  if (shot.points.length <= maxPoints) return shot;
  const stride = Math.ceil(shot.points.length / maxPoints);
  const points = shot.points.filter((_, index) => index % stride === 0);
  const lastPoint = shot.points.at(-1);
  if (lastPoint && points.at(-1) !== lastPoint) points.push(lastPoint);
  return { ...shot, points };
}

function shotResultLabel(shot: ShotResult): string {
  if (shot.hitChickId) return "Chicken hit";
  if (shot.endReason === "obstacle") return "Blocked";
  if (shot.endReason === "bounds") return "Out of bounds";
  if (shot.endReason === "invalid-number") return "Undefined";
  return "Miss";
}

function PracticePanel({
  state,
  botThinking,
  shots,
}: {
  state: GameState;
  botThinking: boolean;
  shots: PracticeShot[];
}) {
  return (
    <aside className="player-panel practice-panel">
      <div className="player-list">
        <div className="panel-label">PLAYERS</div>
        {state.players.map((player) => {
          const alive = state.chickens.filter(
            (chicken) => chicken.ownerId === player.id && chicken.alive,
          ).length;
          const active = state.currentPlayerId === player.id;
          const isBot = player.id === BOT_ID;
          return (
            <div
              key={player.id}
              className={`player-row color-${player.color} ${active ? "active" : ""}`}
            >
              <span className="player-swatch"></span>
              <div className="player-name">
                <strong>{player.username}</strong>
                <span>
                  {isBot ? `BOT${botThinking ? " · THINKING" : ""}` : `${player.countryCode} · YOU`}
                </span>
              </div>
              <div className="life-pips" aria-label={`${alive} chickens alive`}>
                {[0, 1].map((slot) => (
                  <span key={slot} className={slot < alive ? "alive" : "lost"}></span>
                ))}
              </div>
              <span className="presence-dot online" title="Online"></span>
            </div>
          );
        })}
      </div>

      <div className="practice-log">
        <div className="panel-label">SHOT LOG</div>
        <div className="practice-log-list" aria-live="polite">
          {shots.length === 0 ? (
            <div className="chat-empty">No shots yet.</div>
          ) : (
            shots.map((shot) => (
              <div className="practice-log-entry" key={shot.id}>
                <div><strong>{shot.username}</strong><span>{shot.result}</span></div>
                <code>y = {shot.expression}</code>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

export function PracticeRoom({
  profile,
  seed,
  onExit,
  onRematch,
}: {
  profile: PublicProfile;
  seed: number;
  onExit: () => void;
  onRematch: () => void;
}) {
  const [state, setState] = useState(() => createPracticeState(profile, seed));
  const [lastShot, setLastShot] = useState<ShotResult | null>(null);
  const [shots, setShots] = useState<PracticeShot[]>([]);
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const timeoutAttempt = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const deadline = state.turnDeadline;
  const secondsLeft = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1_000))
    : 0;
  const timerLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const isYourTurn = state.currentPlayerId === profile.id && state.status === "active";
  const botThinking = state.currentPlayerId === BOT_ID && state.status === "active";
  const currentPlayer = state.players.find((player) => player.id === state.currentPlayerId);
  const winner = state.players.find((player) => player.id === state.winnerId);

  function recordShot(shot: ShotResult, username: string) {
    setShots((current) => [
      {
        id: `${shot.turnNumber}-${shot.shooterId}`,
        username,
        expression: shot.expression,
        result: shotResultLabel(shot),
      },
      ...current,
    ].slice(0, 10));
  }

  useEffect(() => {
    if (state.status !== "active" || state.currentPlayerId !== BOT_ID) return;
    const timer = window.setTimeout(() => {
      try {
        const expression = chooseBotExpression(state, BOT_ID);
        const outcome = fireShot(state, {
          playerId: BOT_ID,
          expression,
          expectedVersion: state.version,
        });
        const shot = compactShot(outcome.shot);
        setLastShot(shot);
        setState(outcome.state);
        recordShot(shot, "GraphBot");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "GraphBot could not fire.");
      }
    }, 1_050);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state.status !== "active" || secondsLeft > 0) return;
    if (timeoutAttempt.current === state.version) return;
    timeoutAttempt.current = state.version;
    const timer = window.setTimeout(() => {
      try {
        setState(skipExpiredTurn(state));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The turn could not advance.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, state]);

  async function fire(expression: string) {
    if (!isYourTurn) return;
    setFiring(true);
    setError("");
    try {
      const outcome = fireShot(state, {
        playerId: profile.id,
        expression,
        expectedVersion: state.version,
      });
      const shot = compactShot(outcome.shot);
      setLastShot(shot);
      setState(outcome.state);
      recordShot(shot, profile.username);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The shot failed.");
    } finally {
      setFiring(false);
    }
  }

  return (
    <main className="match-page">
      <div className="match-statusbar">
        <div className="match-meta">
          <span className="connection-badge connected"><Bot size={14} /> Local</span>
          <span>Practice 1v1</span>
          <span>Turn {state.turnNumber + 1}</span>
        </div>
        <div className={`turn-clock ${secondsLeft <= 10 ? "urgent" : ""}`}>
          <small>
            {state.status === "finished"
              ? "MATCH OVER"
              : isYourTurn
                ? "YOUR TURN"
                : botThinking
                  ? "BOT THINKING"
                  : `${currentPlayer?.username ?? "GraphBot"}'S TURN`}
          </small>
          <strong>{state.status === "finished" ? "--" : timerLabel}</strong>
        </div>
        <button className="button button-secondary resign-button" onClick={onExit}>
          <ArrowLeft size={17} /> <span>Exit</span>
        </button>
      </div>

      {error && <div className="match-error" role="alert">{error}</div>}

      <div className="match-workspace">
        <section className="arena-section">
          <GameBoard state={state} shot={lastShot} userId={profile.id} />
          {state.status === "finished" && (
            <div className="match-result">
              <span className="eyebrow">PRACTICE COMPLETE</span>
              <h2>{winner?.id === profile.id ? "Victory" : "GraphBot wins"}</h2>
              <div className="practice-result-actions">
                <button className="button button-primary" onClick={onRematch}>
                  <RotateCcw size={17} /> Rematch
                </button>
                <button className="button button-secondary" onClick={onExit}>
                  Lobby
                </button>
              </div>
            </div>
          )}
        </section>
        <PracticePanel
          state={state}
          botThinking={botThinking}
          shots={shots}
        />
      </div>

      <FormulaBar
        disabled={!isYourTurn || state.status === "finished"}
        busy={firing || botThinking}
        onFire={fire}
      />
    </main>
  );
}
