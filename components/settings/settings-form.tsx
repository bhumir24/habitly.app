"use client";

import { useState, useTransition } from "react";
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
import type { EnergyLevel, Habit, LifeMode, Profile, Reminder } from "@/types";
import { createClient } from "@/lib/supabase/client";

export function SettingsForm({
  profile,
  habits,
  reminders,
}: {
  profile: Profile;
  habits: Habit[];
  reminders: Reminder[];
}) {
  const [p, setP] = useState<Profile>(profile);
  const [rem, setRem] = useState<Reminder[]>(reminders);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({
          full_name: p.full_name,
          timezone: p.timezone,
          life_mode: p.life_mode,
          energy_baseline: p.energy_baseline,
        })
        .eq("id", p.id);

      for (const r of rem) {
        await supabase
          .from("reminders")
          .update({ remind_at: r.remind_at, enabled: r.enabled })
          .eq("id", r.id);
      }
      setSaved(true);
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
            <Label>Timezone</Label>
            <Input
              value={p.timezone}
              onChange={(e) => setP({ ...p, timezone: e.target.value })}
              placeholder="UTC"
            />
          </div>
          <div>
            <Label>Life mode</Label>
            <Select
              value={p.life_mode}
              onValueChange={(v) => setP({ ...p, life_mode: v as LifeMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFE_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <div className="flex items-center justify-end gap-3">
        {saved && <Badge variant="success">Saved</Badge>}
        <Button onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  );
}
