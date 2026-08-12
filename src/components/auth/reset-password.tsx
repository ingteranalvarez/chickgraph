"use client";

import { Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function ResetPassword() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else setDone(true);
    setBusy(false);
  }

  return (
    <main className="centered-page">
      <section className="onboarding-box">
        <span className="eyebrow">CHICKGRAPH</span>
        <h1>Set a new password</h1>
        {done ? (
          <><p className="form-notice"><Check size={16} /> Password updated.</p><Link className="button button-primary" href="/">Return to ChickGraph</Link></>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            <label>New password<input type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="button button-primary" disabled={busy}>{busy && <LoaderCircle className="spin" size={18} />}Update password</button>
          </form>
        )}
      </section>
    </main>
  );
}
