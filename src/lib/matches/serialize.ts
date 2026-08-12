import { z } from "zod";

import { gameStateSchema, shotResultSchema } from "@/lib/game/schema";
import type { MatchSnapshot } from "@/lib/matches/types";

const realtimeMatchSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  status: z.string(),
  invite_code: z.string().nullable(),
  version: z.number().int().nonnegative(),
  state: z.unknown().nullable(),
  last_shot: z.unknown().nullable(),
});

export function serializeMatch(row: unknown): MatchSnapshot {
  const parsed = realtimeMatchSchema.parse(row);
  return {
    id: parsed.id,
    kind: parsed.kind,
    status: parsed.status,
    inviteCode: parsed.invite_code,
    version: parsed.version,
    state: parsed.state ? gameStateSchema.parse(parsed.state) : null,
    lastShot: parsed.last_shot ? shotResultSchema.parse(parsed.last_shot) : null,
  };
}
