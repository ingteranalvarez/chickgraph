"use client";

import { getData } from "country-list";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register" | "recover" | "verify";

export function AuthScreen({ confirmationError }: { confirmationError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    confirmationError ? "That confirmation link is invalid or expired." : "",
  );
  const [notice, setNotice] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const countries = useMemo(() => getData().sort((a, b) => a.name.localeCompare(b.name)), []);
  const verificationMode = process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_MODE ?? "link";
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.refresh();
        return;
      }

      if (mode === "recover") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (resetError) throw resetError;
        setNotice("Password reset email sent.");
        return;
      }

      if (mode === "verify") {
        const token = String(form.get("token") ?? "").replace(/\s/g, "");
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: pendingEmail,
          token,
          type: "signup",
        });
        if (verifyError) throw verifyError;
        router.refresh();
        return;
      }

      const username = String(form.get("username") ?? "").trim();
      const countryCode = String(form.get("country") ?? "");
      const is16Plus = form.get("age") === "on";
      if (!/^[A-Za-z0-9_]{3,18}$/.test(username)) {
        throw new Error("Username must be 3-18 letters, numbers, or underscores.");
      }
      if (!is16Plus) throw new Error("You must confirm that you are at least 16.");

      const availability = await fetch(
        `/api/profile/username?value=${encodeURIComponent(username)}`,
      ).then((response) => response.json() as Promise<{ available: boolean }>);
      if (!availability.available) throw new Error("That username is already taken.");

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            username,
            country_code: countryCode,
            is_16_plus: true,
          },
        },
      });
      if (signUpError) throw signUpError;
      setPendingEmail(email);
      setMode("verify");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setError("");
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-scene" aria-label="ChickGraph game preview">
        <div className="auth-brand">ChickGraph</div>
        <svg className="auth-graph" viewBox="0 0 760 620" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <line key={`v-${index}`} x1={index * 84} x2={index * 84} y1="0" y2="620" />
          ))}
          {Array.from({ length: 8 }, (_, index) => (
            <line key={`h-${index}`} x1="0" x2="760" y1={index * 88} y2={index * 88} />
          ))}
          <path d="M 0 480 C 175 470, 235 70, 390 300 S 625 570, 760 105" />
          <circle cx="565" cy="250" r="54" />
        </svg>
        <Image
          className="auth-chick auth-chick-cyan"
          src="/chickens/cyan.png"
          width={220}
          height={220}
          priority
          alt="Cyan ChickGraph chicken"
        />
        <Image
          className="auth-chick auth-chick-coral"
          src="/chickens/coral.png"
          width={170}
          height={170}
          priority
          alt="Coral ChickGraph chicken"
        />
        <div className="auth-formula">y = 0.4x + 3sin(x)</div>
      </section>

      <section className="auth-panel">
        <div className="auth-box">
          {mode === "verify" ? (
            <>
              <button className="icon-button auth-back" onClick={() => switchMode("login")} title="Back to sign in">
                <ArrowLeft size={18} />
              </button>
              <div className="auth-icon"><Mail size={22} /></div>
              <h1>Check your inbox</h1>
              <p className="muted auth-copy">{pendingEmail}</p>
              {verificationMode === "code" ? (
                <form onSubmit={submit} className="form-stack">
                  <label>
                    Verification code
                    <input name="token" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} />
                  </label>
                  <button className="button button-primary" disabled={busy}>
                    {busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
                    Verify email
                  </button>
                </form>
              ) : (
                <p className="auth-confirmation">Open the confirmation link in the email, then return here.</p>
              )}
            </>
          ) : (
            <>
              <div className="auth-heading">
                <span className="eyebrow">CHICKGRAPH</span>
                <h1>{mode === "register" ? "Create account" : mode === "recover" ? "Reset password" : "Welcome back"}</h1>
              </div>

              {mode !== "recover" && (
                <div className="segmented" aria-label="Authentication mode">
                  <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Sign in</button>
                  <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Register</button>
                </div>
              )}

              <form onSubmit={submit} className="form-stack">
                {mode === "register" && (
                  <>
                    <label>
                      Username
                      <input name="username" autoComplete="username" minLength={3} maxLength={18} pattern="[A-Za-z0-9_]+" required />
                    </label>
                    <label>
                      Country
                      <select name="country" defaultValue="MX" required>
                        {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                      </select>
                    </label>
                  </>
                )}
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" required />
                </label>
                {mode !== "recover" && (
                  <label>
                    Password
                    <span className="password-field">
                      <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} required />
                      <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} title={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </span>
                  </label>
                )}
                {mode === "register" && (
                  <label className="checkbox-label">
                    <input type="checkbox" name="age" required />
                    <span>I confirm that I am at least 16 years old.</span>
                  </label>
                )}
                {error && <p className="form-error" role="alert">{error}</p>}
                {notice && <p className="form-notice" role="status">{notice}</p>}
                <button className="button button-primary" disabled={busy}>
                  {busy && <LoaderCircle className="spin" size={18} />}
                  {mode === "register" ? "Create account" : mode === "recover" ? "Send reset email" : "Sign in"}
                </button>
              </form>

              {mode === "login" && (
                <button className="text-button" onClick={() => switchMode("recover")}>Forgot password?</button>
              )}
              {mode === "recover" && (
                <button className="text-button" onClick={() => switchMode("login")}><ArrowLeft size={15} /> Back to sign in</button>
              )}
              {googleEnabled && mode !== "recover" && (
                <>
                  <div className="or-divider"><span>or</span></div>
                  <button
                    type="button"
                    className="button button-secondary auth-google-button"
                    onClick={googleSignIn}
                    disabled={busy}
                  >
                    <Image
                      className="auth-google-logo"
                      src="/google-g.png"
                      width={200}
                      height={204}
                      alt=""
                    />
                    Continue with Google
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
