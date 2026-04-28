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
import { ENERGY_LEVELS, LIFE_MODES } from "@/lib/constants";
import { getTimezoneSelectOptions } from "@/lib/timezones";
import { cn } from "@/lib/utils";
import type { EnergyLevel, Habit, LifeMode, Profile, Reminder } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { TimezoneCombobox } from "@/components/settings/timezone-combobox";
import { revalidateTrackerPages } from "@/actions/revalidate";

const MAX_LIFE_MODES = 2;

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
  const [rem, setRem] = useState<Reminder[]>(reminders);
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
      const supabase = createClient();
      const primary = lifeModes[0] ?? p.life_mode;

      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: p.id,
            full_name: p.full_name,
            timezone: p.timezone,
            life_mode: primary,
            energy_baseline: p.energy_baseline,
          },
          { onConflict: "id" }
        );

      if (profileErr) {
        setSaveError(profileErr.message);
        return;
      }

      if (hasOnboarding) {
        const modes = lifeModes.length >= 1 ? lifeModes.slice(0, MAX_LIFE_MODES) : [primary];
        const { error: onboardErr } = await supabase
          .from("onboarding_responses")
          .update({
            routine: { ...onboardingRoutine, life_modes: modes },
            life_mode: primary,
          })
          .eq("user_id", p.id);
        if (onboardErr) {
          setSaveError(onboardErr.message);
          return;
        }
      }

      setP((prev) => ({ ...prev, life_mode: primary }));

      for (const r of rem) {
        const { error: remErr } = await supabase
          .from("reminders")
          .update({ remind_at: r.remind_at, enabled: r.enabled })
          .eq("id", r.id);
        if (remErr) {
          setSaveError(remErr.message);
          return;
        }
      }
      setSaved(true);
      await revalidateTrackerPages();
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
            In-app reminders. Push & email will be added.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {rem.length === 0 && (
            <p className="text-sm text-muted-foreground">No reminders yet.</p>
          )}
          {rem.map((r, i) => {
            const habit = habitMap.get(r.habit_id);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {habit?.title ?? "Archived habit"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {habit?.duration_minutes ?? "?"}m · channel: {r.channel}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
