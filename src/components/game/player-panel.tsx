"use client";

import { Send } from "lucide-react";
import { FormEvent } from "react";

import type { GameState } from "@/lib/game/types";
import type { ChatMessage } from "@/lib/matches/types";

export function PlayerPanel({
  state,
  userId,
  onlineIds,
  messages,
  onMessage,
}: {
  state: GameState;
  userId: string;
  onlineIds: Set<string>;
  messages: ChatMessage[];
  onMessage: (body: string) => Promise<void>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    const body = input.value.trim();
    if (!body) return;
    input.value = "";
    await onMessage(body);
  }

  return (
    <aside className="player-panel">
      <div className="player-list">
        <div className="panel-label">PLAYERS</div>
        {state.players.map((player) => {
          const alive = state.chickens.filter((chicken) => chicken.ownerId === player.id && chicken.alive).length;
          const active = state.currentPlayerId === player.id;
          return (
            <div key={player.id} className={`player-row color-${player.color} ${active ? "active" : ""}`}>
              <span className="player-swatch"></span>
              <div className="player-name"><strong>{player.username}</strong><span>{player.countryCode} {player.id === userId ? " · YOU" : ""}</span></div>
              <div className="life-pips" aria-label={`${alive} chickens alive`}>
                {[0, 1].map((slot) => <span key={slot} className={slot < alive ? "alive" : "lost"}></span>)}
              </div>
              <span className={`presence-dot ${onlineIds.has(player.id) ? "online" : ""}`} title={onlineIds.has(player.id) ? "Online" : "Reconnecting"}></span>
            </div>
          );
        })}
      </div>

      <div className="chat-section">
        <div className="panel-label">MATCH CHAT</div>
        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <p key={message.id} className={message.user_id === userId ? "own-message" : ""}>
              <strong>{message.username}</strong><span>{message.body}</span>
            </p>
          ))}
          {messages.length === 0 && <div className="chat-empty">No messages yet.</div>}
        </div>
        <form className="chat-form" onSubmit={submit}>
          <input name="message" maxLength={240} placeholder="Message" autoComplete="off" aria-label="Chat message" />
          <button className="icon-button" title="Send message"><Send size={16} /></button>
        </form>
      </div>
    </aside>
  );
}
