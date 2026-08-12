import { ZodError } from "zod";

import { createClient } from "@/lib/supabase/server";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) throw new HttpError("Sign in to continue.", 401);
  return {
    supabase,
    user: {
      id: userId,
      email:
        typeof data.claims.email === "string" ? data.claims.email : undefined,
    },
  };
}

export function databaseError(error: { message: string } | null) {
  if (!error) return;
  const expected = [
    "Authentication required",
    "Complete your profile",
    "Room not found",
    "This room is no longer open",
    "This room is full",
    "Messages must contain",
    "You are sending messages too quickly",
    "A player can only have one open match",
    "The match state is stale",
  ];
  const message = expected.find((prefix) => error.message.includes(prefix));
  throw new HttpError(message ? error.message : "The request could not be completed.");
}

export function routeError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  if (
    error instanceof Error &&
    (error.name === "GameRuleError" || error.name === "ExpressionError")
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
