import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Calendar,
  Check,
  LineChart,
  MessageSquare,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Marketing homepage — rich minimal: editorial type, single accent, quiet surfaces.
 * (The old “Cursor / vibe-coding demo” block was a closing CTA; it’s replaced with product copy.)
 */
export function SiteLanding() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-30 bg-background" />
      <div className="pointer-events-none fixed inset-0 -z-20 mesh-bg" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-pattern" />
      <div className="pointer-events-none fixed inset-0 -z-10 grain opacity-70" />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-foreground/[0.06] bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
        <div className="container flex h-14 max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2.5 outline-none transition-opacity hover:opacity-80"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition-transform group-hover:scale-[1.02]">
              <Target className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tightest">Habitly</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <NavLink href="#product">Product</NavLink>
            <NavLink href="#coach">Coach</NavLink>
            <NavLink href="#pricing">Pricing</NavLink>
            <Separator orientation="vertical" className="mx-2 hidden h-5 sm:block bg-foreground/10" />
            <Button variant="ghost" size="sm" className="h-8 text-[13px] text-muted-foreground" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-full bg-foreground px-4 text-[13px] text-background hover:bg-foreground/90"
              asChild
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">
        {/* Hero */}
        <section className="container px-6 pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="animate-fade-in text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Personalized habit tracker
            </p>
            <h1 className="mt-5 font-display text-[2.35rem] font-medium leading-[1.05] tracking-tightest text-foreground sm:text-5xl md:text-6xl lg:text-[3.35rem]">
              Small actions.
              <br />
              <span className="text-muted-foreground">Honest adaptation.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground md:text-base">
              Habitly learns your goals, time, energy, and friction — then keeps your plan humane when life wobbles:
              micro-fallbacks, coach check-ins, and a weekly review you can actually use.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-8 text-sm font-medium text-background transition-colors hover:bg-foreground/88"
              >
                Start free
                <ArrowRight className="h-4 w-4 opacity-80" strokeWidth={2} />
              </Link>
              <Button variant="ghost" size="sm" className="h-11 rounded-full text-muted-foreground hover:text-foreground" asChild>
                <a href="#pricing" className="gap-1.5">
                  See plans
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              </Button>
            </div>
            <p className="mt-8 text-[12px] text-muted-foreground/90">
              Optional OpenAI · Works with mock AI offline · Supabase for auth & data
            </p>
          </div>

          {/* Quiet proof row */}
          <div className="mx-auto mt-20 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              { t: "Context-first", d: "Plans use your real constraints — not a template." },
              { t: "Recovery-native", d: "Skips inform the next week instead of breaking you." },
              { t: "One focus weekly", d: "A single next step beats a dashboard of guilt." },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-2xl border border-foreground/[0.06] bg-card/80 px-6 py-7 text-left shadow-sm backdrop-blur-sm"
              >
                <div className="text-[13px] font-medium text-foreground">{c.t}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="container px-6">
          <Separator className="bg-foreground/[0.06]" />
        </div>

        {/* Product */}
        <section id="product" className="container scroll-mt-24 px-6 py-24 md:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Product</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tightest md:text-4xl">
              A calm operating system for habits
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Onboarding, planning, tracking, coaching, and weekly insight — structured so the UI stays legible when the week gets loud.
            </p>
          </div>

          <div className="mx-auto mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              className="lg:col-span-2"
              icon={Brain}
              title="Plans grounded in your life"
              body="Goals, availability, routine, energy, life mode, and blockers shape the first plan — and what gets adapted later."
            />
            <FeatureCard
              icon={Zap}
              title="Micro-fallbacks"
              body="Every habit carries a lighter version for low-energy days so identity doesn’t reset to zero."
            />
            <FeatureCard
              icon={LineChart}
              title="Weekly intelligence"
              body="Completion, windows, mood, and blockers compress into one insight and one next-week move."
            />
            <FeatureCard
              className="md:col-span-2"
              icon={Calendar}
              title="Reminders that can grow"
              body="In-app reminders now; the same layer can swap to push or email when you wire production infra."
            />
          </div>
        </section>

        {/* Coach */}
        <section id="coach" className="border-y border-foreground/[0.06] bg-muted/30">
          <div className="container grid gap-16 px-6 py-24 md:grid-cols-2 md:items-center md:gap-20 md:py-32">
            <div className="max-w-md">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">AI coach</p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-tightest md:text-4xl">
                Practical replies, grounded in your data
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                Short, specific guidance — tuned to missed days, low motivation, time scarcity, and energy dips — instead of generic motivation.
              </p>
              <ul className="mt-8 space-y-3 text-[14px] leading-relaxed text-foreground/90">
                {[
                  "References your active habits and recent logs",
                  "Offers time shifts, lighter versions, and recovery framing",
                  "Optional mood + blocker context per message",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-10 h-10 rounded-full border-foreground/10 px-6 text-[13px]" asChild>
                <Link href="/signup">Open the app</Link>
              </Button>
            </div>

            <ChatPreview />
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container scroll-mt-24 px-6 py-24 md:py-32">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tightest md:text-4xl">Straightforward tiers</h2>
            <p className="mt-4 text-[15px] text-muted-foreground">
              Start free. Upgrade when you want deeper coaching and richer weekly reports.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-3xl gap-5 md:grid-cols-2">
            <PlanCard
              name="Free"
              price="$0"
              description="Everything to run the core loop."
              lines={[
                "Onboarding + AI habit plan",
                "Daily dashboard & streaks",
                "Weekly summary",
                "Up to 5 active habits",
                "10 coach messages / day",
              ]}
              href="/signup"
              cta="Start with Free"
              emphasized={false}
            />
            <PlanCard
              name="Premium"
              price="$6"
              period="/ mo"
              description="When you want the full adaptive surface area."
              lines={[
                "Advanced coaching depth",
                "Rich weekly reports & windows",
                "Unlimited habits & coach chat",
                "Smarter reminders roadmap",
              ]}
              href="/signup"
              cta="Get started → upgrade in app"
              emphasized
            />
          </div>
        </section>

        {/* Closing CTA — what that old card was: final invitation, not “meta demo” copy */}
        <section className="container px-6 pb-28 md:pb-36">
          <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-foreground/[0.07] bg-card px-8 py-14 text-center shadow-sm md:px-16 md:py-16">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
            <Sparkles className="relative mx-auto h-5 w-5 text-primary/80" strokeWidth={1.5} aria-hidden />
            <h2 className="relative mt-5 font-display text-2xl font-medium tracking-tightest md:text-3xl">
              Your first week, designed to be forgiving
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              Create an account, complete onboarding, accept a plan you can edit, then live inside the dashboard and coach
              until Sunday&apos;s review.
            </p>
            <Link
              href="/signup"
              className="relative mt-9 inline-flex h-11 items-center justify-center rounded-full bg-foreground px-9 text-sm font-medium text-background transition-colors hover:bg-foreground/88"
            >
              Begin with Habitly
              <ArrowRight className="ml-2 h-4 w-4 opacity-80" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/[0.06] bg-background">
        <div className="container flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-12 text-[13px] text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-display font-medium text-foreground">Habitly</span>
            <span className="text-foreground/25">·</span>
            <span>Adaptive habit coach</span>
          </div>
          <div className="flex gap-8">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="transition-colors hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm" className="hidden h-8 px-2.5 text-[13px] text-muted-foreground hover:text-foreground sm:inline-flex" asChild>
      <a href={href}>{children}</a>
    </Button>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <Card
      className={`group border-foreground/[0.06] bg-card shadow-none transition-shadow duration-300 hover:shadow-md ${className}`}
    >
      <CardContent className="p-7 md:p-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/[0.06] bg-muted/40 text-foreground/80 transition-colors group-hover:border-foreground/10 group-hover:bg-muted/60">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </div>
        <h3 className="mt-5 font-display text-lg font-medium tracking-tight">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function ChatPreview() {
  return (
    <div className="ai-frame rounded-2xl border border-foreground/[0.06] bg-card">
      <div className="flex items-center justify-between border-b border-foreground/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Coach
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
          Live context
        </span>
      </div>
      <div className="space-y-3 p-5">
        <Msg from="user">Evenings are rough — I keep skipping my block.</Msg>
        <Msg from="coach">
          Let&apos;s shrink the commitment for 5 weekdays: do the{" "}
          <span className="font-medium text-foreground">2-minute fallback</span> only. If mornings are easier, we can
          slide the window — want that?
        </Msg>
        <Msg from="user">Yes, mornings work better.</Msg>
        <Msg from="coach">
          Move it to <span className="font-medium text-foreground">7:10–7:20</span>. One prep cue tonight: lay out shoes
          + bottle. That&apos;s the whole change.
        </Msg>
      </div>
    </div>
  );
}

function Msg({ from, children }: { from: "user" | "coach"; children: React.ReactNode }) {
  const coach = from === "coach";
  return (
    <div className={`flex ${coach ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed md:max-w-[88%] ${
          coach
            ? "rounded-bl-md border border-foreground/[0.06] bg-muted/25 text-foreground/90"
            : "rounded-br-md bg-foreground text-background"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  description,
  lines,
  href,
  cta,
  emphasized,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  lines: string[];
  href: string;
  cta: string;
  emphasized?: boolean;
}) {
  return (
    <Card
      className={`flex flex-col border-foreground/[0.06] bg-card shadow-none transition-shadow hover:shadow-md ${
        emphasized ? "ring-1 ring-primary/20 md:-translate-y-0.5" : ""
      }`}
    >
      <CardContent className="flex flex-1 flex-col p-8">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[15px] font-medium">{name}</span>
          {emphasized && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
              Full stack
            </span>
          )}
        </div>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="font-display text-4xl font-medium tracking-tightest">{price}</span>
          {period && <span className="text-sm text-muted-foreground">{period}</span>}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        <ul className="mt-8 flex-1 space-y-2.5 text-[13px]">
          {lines.map((line) => (
            <li key={line} className="flex gap-2.5 text-foreground/85">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className={`mt-10 inline-flex h-10 w-full items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
            emphasized
              ? "bg-foreground text-background hover:bg-foreground/88"
              : "border border-foreground/10 bg-transparent text-foreground hover:bg-muted/50"
          }`}
        >
          {cta}
        </Link>
      </CardContent>
    </Card>
  );
}
