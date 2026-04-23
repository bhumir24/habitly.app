import { useState, useRef, useEffect } from "react";
import { useGetCoachMessages, useSendCoachMessage, getGetCoachMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Send, Loader2, Lock, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

const MOOD_OPTIONS = [
  { value: 1, label: "Rough", color: "hsl(0 70% 55%)" },
  { value: 2, label: "Meh", color: "hsl(25 80% 55%)" },
  { value: 3, label: "Okay", color: "hsl(38 80% 52%)" },
  { value: 4, label: "Good", color: "hsl(152 55% 45%)" },
  { value: 5, label: "Great", color: "hsl(245 70% 60%)" },
];

export default function CoachPage() {
  const { data: messages, isLoading } = useGetCoachMessages();
  const sendMessage = useSendCoachMessage();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(3);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  const handleSend = () => {
    if (!content.trim()) return;
    const text = content;
    setContent("");
    sendMessage.mutate(
      { data: { content: text, mood } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCoachMessagesQueryKey() });
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const reachedLimit =
    user?.tier === "free" &&
    ((messages as Array<{ role: string }> | undefined)
      ?.filter((m) => m.role === "user")
      .length ?? 0) >= 10;

  const selectedMood = MOOD_OPTIONS.find((m) => m.value === mood);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 0px)" }}>
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0"
          style={{ background: "white" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))" }}
          >
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-[14px]">AI Coach</h1>
            <p className="text-[12px] text-muted-foreground">Your personal habit companion</p>
          </div>
          {user?.tier === "free" && (
            <div className="ml-auto text-[11px] text-muted-foreground">
              {((messages as Array<{ role: string }> | undefined)?.filter((m) => m.role === "user").length ?? 0)}/10 messages today
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ background: "hsl(220 20% 97%)" }}>
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-14 rounded-2xl w-3/4" />
              <Skeleton className="h-20 rounded-2xl w-4/5 ml-auto" />
              <Skeleton className="h-16 rounded-2xl w-3/4" />
            </div>
          )}

          {!isLoading && (!messages || (messages as Array<unknown>).length === 0) && (
            <div className="text-center py-14">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, hsl(245 70% 95%), hsl(262 60% 95%))" }}
              >
                <Sparkles className="w-7 h-7" style={{ color: "hsl(245 70% 58%)" }} />
              </div>
              <h2 className="font-semibold text-[15px] mb-2">Start a conversation</h2>
              <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
                Your AI coach is here to help you stay consistent, work through blockers, and celebrate your wins.
              </p>
            </div>
          )}

          {(messages as Array<{ id: number; role: string; content: string; mood?: number; blockerNote?: string }> | undefined)?.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex items-end gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
                  style={{ background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))" }}
                >
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-3 text-[13.5px]",
                  msg.role === "user"
                    ? "rounded-br-md text-white"
                    : "rounded-bl-md bg-white border border-border text-foreground"
                )}
                style={
                  msg.role === "user"
                    ? {
                        background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))",
                        boxShadow: "0 2px 8px rgba(99,89,235,0.25)",
                      }
                    : { boxShadow: "var(--shadow-sm)" }
                }
                data-testid={`message-${msg.id}`}
              >
                {msg.blockerNote && (
                  <p className="text-[11px] opacity-70 mb-1 italic">Blocker: {msg.blockerNote}</p>
                )}
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.mood && msg.role === "user" && (
                  <p className="text-[11px] mt-1.5 opacity-70">
                    Feeling: {MOOD_OPTIONS.find((m) => m.value === msg.mood)?.label}
                  </p>
                )}
              </div>
            </div>
          ))}

          {sendMessage.isPending && (
            <div className="flex items-end gap-2.5 justify-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))" }}
              >
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div
                className="bg-white border border-border rounded-2xl rounded-bl-md px-4 py-3.5 flex items-center gap-1.5"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div
          className="flex-shrink-0 px-5 py-4 border-t border-border"
          style={{ background: "white" }}
        >
          {reachedLimit ? (
            <div
              className="p-4 rounded-2xl text-center border"
              style={{
                background: "linear-gradient(135deg, hsl(245 70% 97%), hsl(262 60% 97%))",
                borderColor: "hsl(245 70% 88%)",
              }}
            >
              <Lock className="w-5 h-5 mx-auto mb-2" style={{ color: "hsl(245 70% 58%)" }} />
              <p className="text-[13px] font-semibold mb-1">Daily limit reached</p>
              <p className="text-[12px] text-muted-foreground mb-3">
                Upgrade to Premium for unlimited AI coaching.
              </p>
              <Link href="/pricing">
                <Button size="sm" className="rounded-xl" data-testid="button-upgrade-coach">
                  Upgrade to Premium
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-muted-foreground font-medium">How are you feeling?</span>
                <div className="flex gap-1.5">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMood(m.value)}
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all",
                        mood === m.value
                          ? "text-white border-transparent"
                          : "border-border text-muted-foreground hover:border-primary/30 bg-transparent"
                      )}
                      style={
                        mood === m.value
                          ? { background: m.color, borderColor: m.color }
                          : {}
                      }
                      data-testid={`mood-${m.value}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your habits, share a win, or talk through a blocker..."
                  className="resize-none min-h-[44px] max-h-28 text-[13.5px] rounded-xl"
                  rows={2}
                  data-testid="input-coach-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!content.trim() || sendMessage.isPending}
                  size="icon"
                  className="h-auto self-end w-10 rounded-xl flex-shrink-0"
                  style={{
                    background: content.trim()
                      ? "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))"
                      : undefined,
                    boxShadow: content.trim() ? "0 4px 12px rgba(99,89,235,0.3)" : undefined,
                  }}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
