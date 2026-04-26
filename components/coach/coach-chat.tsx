"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, initials } from "@/lib/utils";
import { sendCoachMessage } from "@/actions/coach";
import type { CoachMessage } from "@/types";

const MOODS = [
  { v: 1, label: "😞" },
  { v: 2, label: "😕" },
  { v: 3, label: "🙂" },
  { v: 4, label: "😊" },
  { v: 5, label: "🤩" },
];

const STORAGE_KEY = "habitly_coach_messages";

function loadStoredMessages(initialMessages: CoachMessage[]): CoachMessage[] {
  if (typeof window === "undefined") return initialMessages;
  const navType = (
    performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
  )?.type;
  if (navType === "reload") {
    sessionStorage.removeItem(STORAGE_KEY);
    return initialMessages;
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as CoachMessage[];
  } catch {
    // ignore parse errors
  }
  return initialMessages;
}

export function CoachChat({
  initialMessages,
  fullName,
}: {
  initialMessages: CoachMessage[];
  fullName: string | null;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>(() =>
    loadStoredMessages(initialMessages)
  );
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [blocker, setBlocker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [messages]);

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
          context: {},
          created_at: new Date().toISOString(),
        },
      ]);
      setMood(null);
      setBlocker("");
    });
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
        <Badge variant="secondary">beta</Badge>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Say anything — "I'm exhausted today", "help me pick what to skip", or ask for a progression.
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} fullName={fullName} />
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

function Bubble({ msg, fullName }: { msg: CoachMessage; fullName: string | null }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
      <Avatar className="h-7 w-7">
        <AvatarFallback className={cn(isUser ? "bg-accent" : "bg-primary text-primary-foreground")}>
          {isUser ? initials(fullName) : <Bot className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border bg-background"
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}
