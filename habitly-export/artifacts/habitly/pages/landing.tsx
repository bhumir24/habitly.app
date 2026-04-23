import { Link } from "wouter";
import { Zap, Sparkles, BarChart3, Check, ArrowRight, Star, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Sparkles,
    title: "AI-generated habit plan",
    description: "Answer a few questions and receive a personalized habit stack tailored to your life, energy, and goals.",
    gradient: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))",
  },
  {
    icon: Zap,
    title: "Adaptive daily tracking",
    description: "When life gets in the way, Habitly adapts. Micro-habits and smart fallbacks keep your streak alive.",
    gradient: "linear-gradient(135deg, hsl(25 90% 58%), hsl(38 85% 62%))",
  },
  {
    icon: BarChart3,
    title: "Deep weekly insights",
    description: "Visual mood trends, completion charts, and AI coaching that evolves with your progress each week.",
    gradient: "linear-gradient(135deg, hsl(200 70% 52%), hsl(220 65% 58%))",
  },
];

const stats = [
  { value: "94%", label: "Streak retention" },
  { value: "3.2x", label: "Faster habit formation" },
  { value: "12 min", label: "Average daily check-in" },
];

const plans = [
  {
    name: "Free",
    price: "0",
    period: "",
    desc: "Perfect to get started",
    features: [
      "Up to 5 active habits",
      "Daily check-ins & streaks",
      "10 AI coach messages/day",
      "Weekly insights",
    ],
    cta: "Get started free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "9",
    period: "/mo",
    desc: "For serious habit builders",
    features: [
      "Unlimited active habits",
      "Unlimited AI coach messages",
      "Priority AI generation",
      "Custom reminders",
      "Advanced insights & charts",
      "Export your data",
    ],
    cta: "Start free trial",
    href: "/signup",
    highlighted: true,
  },
];

const testimonials = [
  {
    quote: "I've tried dozens of habit apps. Habitly is the first one where the AI coaching actually feels personal.",
    author: "Sarah K.",
    role: "Product Designer",
    avatar: "SK",
  },
  {
    quote: "The micro-habit fallback feature alone has saved my streak more times than I can count.",
    author: "Marcus T.",
    role: "Software Engineer",
    avatar: "MT",
  },
  {
    quote: "Within 3 weeks I had built the morning routine I'd been trying to create for two years.",
    author: "Priya M.",
    role: "Marketing Lead",
    avatar: "PM",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 border-b border-border backdrop-blur-md"
        style={{ background: "rgba(248,249,252,0.88)" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 65% 68%))" }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-semibold text-[16px]">Habitly</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-[13px] rounded-xl">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="text-[13px] rounded-xl gap-1.5 font-semibold"
              >
                Get started
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, hsl(245 70% 97%) 0%, hsl(220 20% 97%) 40%, hsl(262 60% 97%) 100%)",
          }}
        />
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, hsl(245 70% 80%), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(262 60% 78%), transparent 70%)" }}
        />

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-semibold mb-7"
            style={{
              background: "linear-gradient(135deg, hsl(245 70% 95%), hsl(262 60% 95%))",
              color: "hsl(245 70% 52%)",
              border: "1px solid hsl(245 70% 88%)",
            }}
          >
            <Sparkles className="w-3 h-3" />
            AI-powered habit intelligence
          </div>

          <h1 className="text-5xl sm:text-6xl font-display font-semibold leading-[1.1] tracking-tight mb-6">
            Build habits that
            <span
              className="block"
              style={{
                background: "linear-gradient(135deg, hsl(245 70% 55%), hsl(262 60% 62%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              actually stick.
            </span>
          </h1>

          <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Habitly learns your schedule, energy patterns, and goals to generate a personalized habit plan — then adapts it every week based on what's actually working.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <Button
                size="lg"
                className="h-12 px-7 text-[15px] font-semibold rounded-xl gap-2"
                style={{
                  background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))",
                  boxShadow: "0 8px 24px rgba(99,89,235,0.35)",
                }}
              >
                Start for free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-12 px-7 text-[15px] rounded-xl">
                Log in
              </Button>
            </Link>
          </div>

          <p className="text-[12px] text-muted-foreground mt-4">No credit card required · Free forever plan</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.value}>
                <p
                  className="text-3xl font-display font-semibold"
                  style={{
                    background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.value}
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-3">
            Everything you need to build lasting habits
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-xl mx-auto">
            Not just a tracker — an intelligent partner that adapts to your life.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border bg-white"
              style={{
                borderColor: "hsl(220 14% 91%)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: f.gradient }}
              >
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-[15px] mb-2">{f.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 border-y border-border" style={{ background: "hsl(220 20% 98%)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" style={{ color: "hsl(38 90% 55%)" }} />
              ))}
            </div>
            <h2 className="text-2xl font-display font-semibold">Loved by habit builders</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="p-5 rounded-2xl bg-white border"
                style={{ borderColor: "hsl(220 14% 91%)", boxShadow: "var(--shadow-sm)" }}
              >
                <p className="text-[13.5px] text-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                    style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 60% 68%))" }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold">{t.author}</p>
                    <p className="text-[11px] text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-3">Simple, transparent pricing</h2>
          <p className="text-[15px] text-muted-foreground">Start free, upgrade when you're ready.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-2xl border p-7 relative"
              style={
                plan.highlighted
                  ? {
                      background: "linear-gradient(160deg, hsl(232 28% 14%) 0%, hsl(245 35% 20%) 100%)",
                      border: "1px solid hsl(245 35% 28%)",
                      boxShadow: "0 16px 48px rgba(30,28,60,0.25)",
                    }
                  : {
                      background: "white",
                      borderColor: "hsl(220 14% 91%)",
                      boxShadow: "var(--shadow-sm)",
                    }
              }
            >
              {plan.highlighted && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, hsl(38 90% 55%), hsl(25 90% 62%))" }}
                >
                  Most popular
                </div>
              )}
              <p
                className="text-[13px] font-semibold mb-1"
                style={{ color: plan.highlighted ? "hsl(245 70% 70%)" : "hsl(245 70% 58%)" }}
              >
                {plan.name}
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span
                  className="text-4xl font-display font-semibold"
                  style={{ color: plan.highlighted ? "white" : "hsl(224 20% 10%)" }}
                >
                  ${plan.price}
                </span>
                {plan.period && (
                  <span
                    className="text-[14px] mb-1"
                    style={{ color: plan.highlighted ? "hsl(220 20% 55%)" : "hsl(220 10% 46%)" }}
                  >
                    {plan.period}
                  </span>
                )}
              </div>
              <p
                className="text-[12px] mb-5"
                style={{ color: plan.highlighted ? "hsl(220 20% 55%)" : "hsl(220 10% 46%)" }}
              >
                {plan.desc}
              </p>
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5">
                    <div
                      className="w-4.5 h-4.5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: plan.highlighted
                          ? "rgba(99,89,235,0.25)"
                          : "hsl(245 70% 95%)",
                      }}
                    >
                      <Check
                        className="w-2.5 h-2.5"
                        style={{ color: plan.highlighted ? "hsl(245 70% 70%)" : "hsl(245 70% 58%)" }}
                      />
                    </div>
                    <span
                      className="text-[13px]"
                      style={{ color: plan.highlighted ? "hsl(220 20% 82%)" : "hsl(224 20% 20%)" }}
                    >
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={plan.href}>
                <Button
                  className="w-full rounded-xl font-semibold"
                  style={
                    plan.highlighted
                      ? {
                          background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(262 60% 66%))",
                          color: "white",
                          boxShadow: "0 4px 16px rgba(99,89,235,0.4)",
                        }
                      : {}
                  }
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 mx-6 mb-16 rounded-3xl relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(232 28% 14%) 0%, hsl(245 35% 22%) 100%)",
          maxWidth: "calc(100% - 48px)",
          margin: "0 auto 64px",
        }}
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/4" />
        <div className="relative text-center px-6 py-4">
          <div className="flex items-center justify-center gap-2 mb-5">
            <Shield className="w-5 h-5 text-white/60" />
            <Users className="w-5 h-5 text-white/60" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-white mb-3">
            Start building better habits today
          </h2>
          <p className="text-[14px] text-white/60 mb-7 max-w-md mx-auto">
            Join thousands of people who've transformed their routines with AI-powered habit coaching.
          </p>
          <Link href="/signup">
            <Button
              size="lg"
              className="h-11 px-8 text-[14px] font-semibold rounded-xl gap-2"
              style={{
                background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 60% 68%))",
                boxShadow: "0 8px 24px rgba(99,89,235,0.4)",
              }}
            >
              Get started for free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 65% 68%))" }}
          >
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="font-display font-semibold text-[14px]">Habitly</span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          &copy; {new Date().getFullYear()} Habitly. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
