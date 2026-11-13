import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function HomeNewsletterCta({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  return (
    <section
      className={cn("border-t border-border bg-secondary", className)}
      aria-labelledby="home-newsletter-heading"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="eyebrow text-crimson">Stay informed</div>
          <h2 id="home-newsletter-heading" className="mt-1 font-serif text-3xl text-ink">
            The Diplomacy Lens Briefing
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A concise morning digest of embassies, capitals, and conflict desks — curated for
            readers who need clarity fast.
          </p>
        </div>
        <form
          className="w-full max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.includes("@")) {
              setStatus("error");
              return;
            }
            setStatus("loading");
            window.setTimeout(() => setStatus("success"), 600);
          }}
        >
          <label htmlFor="home-newsletter-email" className="sr-only">
            Email address
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="home-newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status !== "idle") setStatus("idle");
              }}
              placeholder="you@example.com"
              className="h-11 flex-1 rounded-sm border border-input bg-background px-3 text-sm outline-none focus:border-navy"
              disabled={status === "loading" || status === "success"}
            />
            <button
              type="submit"
              disabled={status === "loading" || status === "success"}
              className="h-11 rounded-sm bg-crimson px-5 text-xs font-semibold uppercase tracking-widest text-crimson-foreground hover:opacity-90 disabled:opacity-60"
            >
              {status === "loading"
                ? "Subscribing…"
                : status === "success"
                  ? "Subscribed"
                  : "Subscribe"}
            </button>
          </div>
          {status === "error" ? (
            <p className="mt-2 text-xs text-crimson" role="alert">
              Enter a valid email address.
            </p>
          ) : null}
          {status === "success" ? (
            <p className="mt-2 text-xs text-emerald-700" role="status">
              You&apos;re on the list.{" "}
              <Link to="/newsletter" className="underline hover:text-crimson">
                Manage preferences
              </Link>
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
