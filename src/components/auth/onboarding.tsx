"use client";

import { getData } from "country-list";
import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function Onboarding({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const countries = useMemo(() => getData().sort((a, b) => a.name.localeCompare(b.name)), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const countryCode = String(form.get("country") ?? "");
    if (form.get("age") !== "on") {
      setError("You must confirm that you are at least 16.");
      setBusy(false);
      return;
    }
    const { error: profileError } = await createClient().from("profiles").insert({
      id: userId,
      username,
      country_code: countryCode,
      is_16_plus: true,
    });
    if (profileError) {
      setError(profileError.code === "23505" ? "That username is already taken." : profileError.message);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <main className="centered-page">
      <section className="onboarding-box">
        <span className="eyebrow">CHICKGRAPH</span>
        <h1>Choose your player name</h1>
        <p className="muted">{email}</p>
        <form onSubmit={submit} className="form-stack">
          <label>Username<input name="username" minLength={3} maxLength={18} pattern="[A-Za-z0-9_]+" required /></label>
          <label>Country<select name="country" defaultValue="MX">{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
          <label className="checkbox-label"><input type="checkbox" name="age" required /><span>I confirm that I am at least 16 years old.</span></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary" disabled={busy}>{busy && <LoaderCircle className="spin" size={18} />}Enter ChickGraph</button>
        </form>
        <button className="text-button" onClick={signOut}><LogOut size={15} /> Sign out</button>
      </section>
    </main>
  );
}
