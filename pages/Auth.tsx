import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import NotiWordmark from "@/components/NotiWordmark";
import { NotiMark } from "@/components/brand/NotiMark";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

const signinSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email" }).max(255),
  password: z.string().min(6, { message: "At least 6 characters" }).max(72),
});

const signupSchema = signinSchema.extend({
  display_name: z
    .string()
    .trim()
    .min(1, { message: "Tell us your name" })
    .max(80, { message: "Name is too long" }),
});

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode: Mode = params.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const nextParam = params.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") ? nextParam : "/app";

  // If already signed in, send to next (or /app)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(safeNext, { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate(safeNext, { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, safeNext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const schema = mode === "signup" ? signupSchema : signinSchema;
    const parsed = schema.safeParse(
      mode === "signup"
        ? { email, password, display_name: name }
        : { email, password },
    );
    if (!parsed.success) {
      const first = parsed.error.errors[0]?.message ?? "Invalid input";
      toast.error(first);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${safeNext}`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // navigate happens via onAuthStateChange
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${safeNext}`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return; // browser redirects
      // Tokens received & session set — navigate
      navigate(safeNext, { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-dvh w-full"
      style={{ background: "hsl(60 8% 12%)", color: "hsl(78 12% 92%)" }}
    >
      <Link
        to="/"
        className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm opacity-70 transition-opacity hover:opacity-100"
        style={{ color: "hsl(78 6% 72%)" }}
      >
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <div className="mb-10 flex flex-col items-center gap-3">
          <NotiMark size={64} className="text-white" />
          <NotiWordmark size="xl" color="#ffffff" className="text-white" />
          <p className="text-sm" style={{ color: "hsl(78 6% 72%)" }}>
            {mode === "signin"
              ? "Welcome back. Pick up where you left off."
              : "Create an account to start capturing thoughts."}
          </p>
        </div>

        <div
          className="relative overflow-hidden rounded-[28px] border p-1 shadow-2xl"
          style={{
            borderColor: "hsl(60 10% 24%)",
            background:
              "linear-gradient(180deg, hsl(60 8% 19%) 0%, hsl(60 8% 15%) 100%)",
            boxShadow:
              "0 30px 80px -30px hsl(78 32% 78% / 0.18), 0 1px 0 0 hsl(78 12% 92% / 0.04) inset",
          }}
        >
          {/* Inner card so the gradient hairline reads as a soft frame */}
          <div
            className="rounded-[24px] p-6 sm:p-7"
            style={{ background: "hsl(60 8% 14%)" }}
          >
            {/* Mode tabs — segmented control. Replaces the awkward "Already
                have one? Sign in" footer and makes the choice obvious upfront. */}
            <div
              role="tablist"
              aria-label="Sign in or sign up"
              className="mb-6 grid grid-cols-2 rounded-full p-1 text-xs font-medium"
              style={{ background: "hsl(60 8% 9%)", border: "1px solid hsl(60 10% 24%)" }}
            >
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className="relative h-8 rounded-full transition-colors"
                  style={{
                    background: mode === m ? "hsl(78 32% 78%)" : "transparent",
                    color: mode === m ? "hsl(60 8% 9%)" : "hsl(78 6% 72%)",
                  }}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || submitting}
              className="group relative flex w-full items-center justify-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              style={{
                background: "#ffffff",
                color: "#1a1a18",
                boxShadow:
                  "0 6px 14px -6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.5) inset",
              }}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </button>

            <div
              className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "hsl(78 5% 54%)" }}
            >
              <div className="h-px flex-1" style={{ background: "hsl(60 10% 24%)" }} />
              or with email
              <div className="h-px flex-1" style={{ background: "hsl(60 10% 24%)" }} />
            </div>

            {/* Email/password — floating-label style */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <FloatingField
                  id="auth-name"
                  type="text"
                  label="Your name"
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              )}
              <FloatingField
                id="auth-email"
                type="email"
                label="Email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                maxLength={255}
                required
              />
              <FloatingField
                id="auth-password"
                type="password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                maxLength={72}
                required
                hint={mode === "signup" ? "At least 6 characters" : undefined}
              />

              <button
                type="submit"
                disabled={submitting || googleLoading}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-all hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
                style={{
                  background: "hsl(78 32% 78%)",
                  color: "hsl(60 8% 9%)",
                  boxShadow:
                    "0 10px 24px -10px hsl(78 32% 78% / 0.55), 0 1px 0 rgba(255,255,255,0.35) inset",
                }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup" ? "Create your account" : "Sign in"}
              </button>
            </form>
          </div>
        </div>


        <p className="mt-6 text-center text-xs" style={{ color: "hsl(78 5% 54%)" }}>
          By continuing you agree to be a calm, thoughtful person.
        </p>
      </div>
    </div>
  );
}

interface FloatingFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  hint?: string;
}

/**
 * FloatingField — minimal, designerly input. Border + bg are tokenised
 * inline so this stays in lockstep with the auth page palette without
 * polluting the rest of the design system. Label sits inside the field at
 * rest and floats up + shrinks once the field is focused or filled.
 */
function FloatingField({
  id, label, type, value, onChange, autoComplete, required, minLength, maxLength, hint,
}: FloatingFieldProps) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const filled = value.length > 0;
  const floated = focused || filled;

  return (
    <div>
      <div
        className="relative rounded-2xl transition-colors"
        style={{
          background: "hsl(60 8% 9%)",
          border: `1px solid ${focused ? "hsl(78 32% 78% / 0.55)" : "hsl(60 10% 24%)"}`,
          boxShadow: focused ? "0 0 0 4px hsl(78 32% 78% / 0.10)" : "none",
        }}
      >
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 transition-all"
          style={{
            top: floated ? "0.45rem" : "50%",
            transform: floated ? "translateY(0)" : "translateY(-50%)",
            fontSize: floated ? "10px" : "14px",
            letterSpacing: floated ? "0.14em" : "0",
            textTransform: floated ? "uppercase" : "none",
            color: floated ? "hsl(78 6% 62%)" : "hsl(78 5% 54%)",
            fontWeight: floated ? 500 : 400,
          }}
        >
          {label}
        </label>
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          className="w-full rounded-2xl bg-transparent pb-2.5 pl-4 pr-12 pt-6 text-[15px] outline-none"
          style={{ color: "hsl(78 12% 92%)" }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-opacity hover:opacity-100"
            style={{ color: "hsl(78 6% 62%)", opacity: 0.7 }}
          >
            {show ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="m1 1 22 22" />
                <path d="M9.5 9.5a3 3 0 0 0 4.24 4.24" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && (
        <p className="mt-1.5 pl-4 text-[11px]" style={{ color: "hsl(78 5% 54%)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

