import { z } from "zod";

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const gameStateSchema = z.object({
  matchId: z.string().uuid(),
  status: z.enum(["waiting", "active", "finished", "abandoned"]),
  version: z.number().int().nonnegative(),
  seed: z.number().int().nonnegative(),
  turnNumber: z.number().int().nonnegative(),
  currentPlayerId: z.string().uuid().nullable(),
  turnDeadline: z.string().datetime().nullable(),
  winnerId: z.string().uuid().nullable(),
  players: z.array(
    z.object({
      id: z.string().uuid(),
      username: z.string(),
      countryCode: z.string().length(2),
      color: z.enum(["cyan", "coral", "lime", "yellow"]),
      seat: z.number().int().min(0).max(3),
    }),
  ),
  chickens: z.array(
    pointSchema.extend({
      id: z.string(),
      ownerId: z.string().uuid(),
      slot: z.number().int().min(0).max(1),
      alive: z.boolean(),
    }),
  ),
  obstacles: z.array(
    pointSchema.extend({
      id: z.string(),
      radius: z.number().positive(),
    }),
  ),
});

export const shotResultSchema = z.object({
  expression: z.string(),
  shooterId: z.string().uuid(),
  shooterChickId: z.string(),
  turnNumber: z.number().int().nonnegative(),
  points: z.array(pointSchema),
  endReason: z.enum([
    "chicken",
    "obstacle",
    "bounds",
    "invalid-number",
    "range",
  ]),
  hitChickId: z.string().nullable(),
});
