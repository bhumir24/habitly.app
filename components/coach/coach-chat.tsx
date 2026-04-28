"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Send, Bot, Loader2, Download, Trash2, Plus, Check, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, initials } from "@/lib/utils";
import { sendCoachMessage } from "@/actions/coach";
import { addGeneratedHabit } from "@/actions/habits";
import type { CoachMessage, GeneratedHabit, HabitEdit } from "@/types";

const MOODS = [
  { v: 1, label: "😞" },
  { v: 2, label: "😕" },
  { v: 3, label: "🙂" },
  { v: 4, label: "😊" },
  { v: 5, label: "🤩" },
];

const STORAGE_KEY = "habitly_coach_messages";

export function CoachChat({
  initialMessages,
  fullName,
}: {
  initialMessages: CoachMessage[];
  fullName: string | null;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [blocker, setBlocker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CoachMessage[];
        if (parsed.length > 0) setMessages(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    setError(null);

    const optimistic: CoachMessage = {
      id: `tmp-${Date.now()}`,
      user_id: "me",
      role: "user",
      content,
      context: { mood, blocker },
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");

    startTransition(async () => {
      const res = await sendCoachMessage({
        content,
        mood: mood ?? undefined,
        blocker: blocker || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          user_id: "me",
          role: "assistant",
          content: res.reply,
          context: {
            ...(res.habitSuggestion ? { habitSuggestion: res.habitSuggestion } : {}),
            ...(res.habitEdit ? { habitEdit: res.habitEdit } : {}),
          },
          created_at: new Date().toISOString(),
        },
      ]);
      setMood(null);
      setBlocker("");
    });
  };

  const handleSave = () => {
    if (messages.length === 0) return;
    const lines = messages.map((m) => {
      const who = m.role === "user" ? (fullName ?? "You") : "Coach";
      const ts = new Date(m.created_at).toLocaleString();
      return `[${ts}] ${who}: ${m.content}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habitly-coach-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Coach</div>
            <div className="text-xs text-muted-foreground">
              Context-aware · references your habits & mood
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={messages.length === 0}
            title="Download chat as text"
            aria-label="Save chat"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={messages.length === 0}
            title="Clear chat"
            aria-label="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Badge variant="secondary">beta</Badge>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Say anything — "I'm exhausted today", "help me pick what to skip", or ask for a progression.
          </div>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            msg={m}
            fullName={fullName}
            onHabitAdded={(id) =>
              setMessages((prev) =>
                prev.map((x) =>
                  x.id === id
                    ? { ...x, context: { ...x.context, habitAdded: true } }
                    : x
                )
              )
            }
          />
        ))}
        {isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Coach is thinking…
          </div>
        )}
      </div>

      <div className="space-y-2 border-t p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Mood:</span>
          {MOODS.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMood(mood === m.v ? null : m.v)}
              className={cn(
                "rounded-full border px-2 py-1 text-base leading-none transition",
                mood === m.v && "border-primary bg-primary/10"
              )}
              aria-label={`Mood ${m.v}`}
            >
              {m.label}
            </button>
          ))}
          <input
            className="ml-2 min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
            placeholder="Blocker (optional)"
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
          />
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message your coach…"
            className="min-h-[44px] resize-none"
          />
          <Button onClick={submit} disabled={isPending || !draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function Bubble({
  msg,
  fullName,
  onHabitAdded,
}: {
  msg: CoachMessage;
  fullName: string | null;
  onHabitAdded: (id: string) => void;
}) {
  const isUser = msg.role === "user";
  const habitSuggestion = !isUser
    ? (msg.context?.habitSuggestion as GeneratedHabit | undefined)
    : undefined;
  const habitEdit = !isUser
    ? (msg.context?.habitEdit as HabitEdit | undefined)
    : undefined;
  const alreadyAdded = !!msg.context?.habitAdded;

  return (
    <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
      <Avatar className="h-7 w-7">
        <AvatarFallback className={cn(isUser ? "bg-accent" : "bg-primary text-primary-foreground")}>
          {isUser ? initials(fullName) : <Bot className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[80%] space-y-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm shadow-sm",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm border bg-background"
          )}
        >
          {msg.content}
        </div>
        {habitSuggestion && (
          <HabitSuggestionCard
            habit={habitSuggestion}
            initialAdded={alreadyAdded}
            onAdded={() => onHabitAdded(msg.id)}
          />
        )}
        {habitEdit && <HabitEditCard edit={habitEdit} />}
      </div>
    </div>
  );
}

function HabitSuggestionCard({
  habit,
  initialAdded,
  onAdded,
}: {
  habit: GeneratedHabit;
  initialAdded: boolean;
  onAdded: () => void;
}) {
  const [state, setState] = useState<"idle" | "adding" | "added">(
    initialAdded ? "added" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setState("adding");
    const res = await addGeneratedHabit(habit);
    if (!res.ok) {
      setError(res.error);
      setState("idle");
      return;
    }
    setState("added");
    onAdded();
  };

  if (state === "added") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-success/30 bg-success/5 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-success">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">"{habit.title}" added to your plan.</span>
        </div>
        <Link href="/dashboard">
          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs border-success/40 text-success hover:bg-success/10">
            View Dashboard <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card px-3.5 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{habit.title}</p>
          <p className="text-xs text-muted-foreground">
            {habit.duration_minutes}m · {habit.preferred_time.replace(/_/g, " ")} · {habit.difficulty}
          </p>
          {habit.purpose && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{habit.purpose}</p>
          )}
          {habit.fallback_habit && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium">Fallback:</span> {habit.fallback_habit}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="default"
          className="h-7 shrink-0 gap-1 px-2 text-xs"
          onClick={handleAdd}
          disabled={state === "adding"}
        >
          {state === "adding" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <><Plus className="h-3 w-3" /> Add</>
          )}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function HabitEditCard({ edit }: { edit: HabitEdit }) {
  const FIELD_LABELS: Record<string, string> = {
    duration_minutes: "Duration",
    preferred_time: "Time slot",
    frequency: "Frequency",
    difficulty: "Difficulty",
    fallback_habit: "Fallback",
  };

  const changes = Object.entries(edit.patch).map(([key, val]) => {
    const display =
      key === "duration_minutes"
        ? `${val} min`
        : typeof val === "string"
        ? val.replace(/_/g, " ")
        : String(val);
    return { label: FIELD_LABELS[key] ?? key, display };
  });

  const hasChanges = changes.length > 0;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            "{edit.title}" {hasChanges ? "updated" : "already in your plan"}
          </div>
          {edit.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{edit.description}</p>
          )}
          {hasChanges && (
            <ul className="mt-2 space-y-1">
              {changes.map(({ label, display }) => (
                <li key={label} className="flex items-center gap-1.5 text-xs">
                  <Check className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-medium">{display}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/dashboard">
          <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs">
            Dashboard <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
