"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, BellRing } from "lucide-react";
import { ENERGY_LEVELS, LIFE_MODES } from "@/lib/constants";
import { getTimezoneSelectOptions } from "@/lib/timezones";
import { cn } from "@/lib/utils";
import type { EnergyLevel, Habit, LifeMode, Profile, Reminder } from "@/types";
import { TimezoneCombobox } from "@/components/settings/timezone-combobox";
import { saveSettings, type ReminderSaveItem } from "@/actions/settings";
import { savePushSubscription } from "@/actions/push";

const MAX_LIFE_MODES = 2;

function urlBase64ToUint8Array(b64: string) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function requestBrowserNotification(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const existing = await reg.pushManager.getSubscription();
    if (existing) return true;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    await savePushSubscription(sub.toJSON());
    return true;
  } catch {
    return false;
  }
}

export function SettingsForm({
  profile,
  habits,
  reminders,
  initialLifeModes,
  onboardingRoutine = {},
  hasOnboarding = false,
}: {
  profile: Profile;
  habits: Habit[];
  reminders: Reminder[];
  initialLifeModes: LifeMode[];
  onboardingRoutine?: Record<string, unknown>;
  hasOnboarding?: boolean;
}) {
  const [p, setP] = useState<Profile>(profile);
  const [lifeModes, setLifeModes] = useState<LifeMode[]>(() => {
    const base = initialLifeModes.length ? initialLifeModes : [profile.life_mode];
    return base.slice(0, MAX_LIFE_MODES);
  });
  // Build one row per active habit — use existing reminder if present, else sensible defaults
  const IDEAL: Record<string, string> = {
    early_morning: "06:30", morning: "08:00", midday: "12:30",
    afternoon: "15:30", evening: "19:00", night: "22:30", any: "09:00",
  };
  const reminderByHabit = new Map(reminders.map((r) => [r.habit_id, r]));
  const [rem, setRem] = useState<ReminderSaveItem[]>(
    habits.map((h) => {
      const existing = reminderByHabit.get(h.id);
      return existing
        ? { id: existing.id, habit_id: h.id, remind_at: existing.remind_at, enabled: existing.enabled, channel: existing.channel }
        : { habit_id: h.id, remind_at: IDEAL[h.preferred_time] ?? "09:00", enabled: false, channel: "in_app" as const };
    })
  );
  const [timezoneTouched, setTimezoneTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (timezoneTouched) return;
    if (p.timezone && p.timezone !== "UTC") return;
    try {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (localTz && localTz !== p.timezone) {
        setP((prev) => ({ ...prev, timezone: localTz }));
      }
    } catch {
      // Ignore Intl availability edge cases.
    }
  }, [p.timezone, timezoneTouched]);

  useEffect(() => {
    setP(profile);
  }, [profile]);

  const timezoneOptions = useMemo(() => {
    const base = getTimezoneSelectOptions();
    if (p.timezone && !base.some((o) => o.value === p.timezone)) {
      return [{ value: p.timezone, label: `${p.timezone} (current)` }, ...base];
    }
    return base;
  }, [p.timezone]);

  const toggleLifeMode = (v: LifeMode) => {
    setLifeModes((prev) => {
      if (prev.includes(v)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== v);
      }
      if (prev.length >= MAX_LIFE_MODES) return prev;
      return [...prev, v];
    });
  };

  const save = () =>
    startTransition(async () => {
      setSaveError(null);
      const primary = lifeModes[0] ?? p.life_mode;
      const res = await saveSettings({
        full_name: p.full_name,
        timezone: p.timezone,
        life_mode: primary,
        energy_baseline: p.energy_baseline,
        lifeModes,
        reminders: rem,
        hasOnboarding,
        onboardingRoutine,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setP((prev) => ({ ...prev, life_mode: primary }));
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    });

  const habitMap = new Map(habits.map((h) => [h.id, h]));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <Input
              value={p.full_name ?? ""}
              onChange={(e) => setP({ ...p, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="profile-timezone-input">Timezone</Label>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Type to search or open the list. Saved timezone drives “today” on your dashboard.
            </p>
            <TimezoneCombobox
              id="profile-timezone-input"
              options={timezoneOptions}
              value={p.timezone}
              onSelect={(iana) => {
                setTimezoneTouched(true);
                setP({ ...p, timezone: iana });
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Life mode</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Select up to {MAX_LIFE_MODES} — we use both for coaching context.
            </p>
            <div className="flex flex-wrap gap-2">
              {LIFE_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  disabled={!lifeModes.includes(m.value) && lifeModes.length >= MAX_LIFE_MODES}
                  onClick={() => toggleLifeMode(m.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    lifeModes.includes(m.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:border-foreground/30 hover:bg-accent",
                    !lifeModes.includes(m.value) &&
                      lifeModes.length >= MAX_LIFE_MODES &&
                      "cursor-not-allowed opacity-50 hover:border-inherit hover:bg-transparent"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Energy baseline</Label>
            <Select
              value={p.energy_baseline}
              onValueChange={(v) =>
                setP({ ...p, energy_baseline: v as EnergyLevel })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENERGY_LEVELS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminders</CardTitle>
          <p className="text-xs text-muted-foreground">
            Choose how you want to be notified for each habit. "Browser" sends a push notification; "Email" sends an email.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {rem.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active habits yet. Add a habit on the Dashboard first.
            </p>
          )}
          {rem.map((r, i) => {
            const habit = habitMap.get(r.habit_id);
            return (
              <div
                key={r.id ?? r.habit_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {habit?.title ?? "Archived habit"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {habit?.duration_minutes ?? "?"}m · {habit?.preferred_time?.replace(/_/g, " ") ?? "any time"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Channel toggle: in_app vs email */}
                  <div className="flex rounded-md border overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={async () => {
                        const granted = await requestBrowserNotification();
                        if (granted) {
                          setRem(rem.map((x, j) => (j === i ? { ...x, channel: "in_app" } : x)));
                        } else {
                          alert("Allow notifications in your browser settings, then try again.");
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 transition",
                        r.channel === "in_app"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                      title="Browser push notification"
                    >
                      <BellRing className="h-3 w-3" />
                      Browser
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRem(rem.map((x, j) => (j === i ? { ...x, channel: "email" } : x)))
                      }
                      className={cn(
                        "flex items-center gap-1 border-l px-2.5 py-1.5 transition",
                        r.channel === "email"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                      title="Email notification"
                    >
                      <Mail className="h-3 w-3" />
                      Email
                    </button>
                  </div>
                  <Input
                    type="time"
                    value={r.remind_at.slice(0, 5)}
                    onChange={(e) =>
                      setRem(rem.map((x, j) => (j === i ? { ...x, remind_at: e.target.value } : x)))
                    }
                    className="h-9 w-28"
                  />
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) =>
                      setRem(rem.map((x, j) => (j === i ? { ...x, enabled: v } : x)))
                    }
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <div className="flex items-center gap-3">
        {saved && <Badge variant="success">Saved</Badge>}
        <Button onClick={save} disabled={isPending || lifeModes.length < 1}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
        </div>
      </div>
    </div>
  );
}
