"use client";

import {
  Coffee,
  Code2,
  LogOut,
  Medal,
  Play,
  Radio,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GameRoom } from "@/components/game/game-room";
import { Leaderboard } from "@/components/leaderboard";
import { Lobby } from "@/components/lobby";
import type { MatchSnapshot } from "@/lib/matches/types";
import type { PublicProfile } from "@/lib/profiles/types";
import { createClient } from "@/lib/supabase/client";

type View = "play" | "leaderboard";

export function AppShell({
  profile,
  initialMatch,
  userId,
}: {
  profile: PublicProfile;
  initialMatch: MatchSnapshot | null;
  userId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("play");
  const [match, setMatch] = useState<MatchSnapshot | null>(initialMatch);

  async function signOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <div className="app-frame">
      <header className="app-header">
        <button className="wordmark" onClick={() => setView("play")}>ChickGraph</button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "play" ? "active" : ""} onClick={() => setView("play")}>
            <Play size={16} fill="currentColor" /> Play
          </button>
          <button className={view === "leaderboard" ? "active" : ""} onClick={() => setView("leaderboard")}>
            <Medal size={17} /> Leaderboard
          </button>
        </nav>
        <div className="account-strip">
          <span className="live-status"><Radio size={14} /> Online</span>
          <span className="rating-chip">{profile.rating} Elo</span>
          <span className="profile-chip"><UserRound size={15} /> {profile.username} <b>{profile.country_code}</b></span>
          <a className="icon-button" href="https://github.com/ingteranalvarez/chickgraph" target="_blank" rel="noreferrer" title="View source code"><Code2 size={17} /></a>
          <a className="icon-button" href="https://github.com/sponsors/ingteranalvarez" target="_blank" rel="noreferrer" title="Support ChickGraph"><Coffee size={17} /></a>
          <button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      {view === "leaderboard" && !match ? (
        <Leaderboard currentUserId={userId} />
      ) : match ? (
        <GameRoom
          initialMatch={match}
          userId={userId}
          onMatchChange={setMatch}
          onExit={() => setMatch(null)}
        />
      ) : (
        <Lobby profile={profile} onMatch={setMatch} />
      )}
    </div>
  );
}
