import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useListReminders,
  useCreateReminder,
  useUpdateReminder,
  useDeleteReminder,
  useUpdateProfile,
  useListHabits,
  useUpdateHabit,
  useDeleteHabit,
  getListRemindersQueryKey,
  getListHabitsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: reminders, isLoading: remindersLoading } = useListReminders();
  const { data: habits, isLoading: habitsLoading } = useListHabits();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newReminderLabel, setNewReminderLabel] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("08:00");
  const [editingHabit, setEditingHabit] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleAddReminder = () => {
    if (!newReminderLabel.trim()) return;
    createReminder.mutate(
      { data: { label: newReminderLabel, time: newReminderTime, enabled: true } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
          setNewReminderLabel("");
          toast({ title: "Reminder added" });
        },
      }
    );
  };

  const handleToggleReminder = (id: number, enabled: boolean) => {
    updateReminder.mutate(
      { id, data: { enabled } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() }) }
    );
  };

  const handleDeleteReminder = (id: number) => {
    deleteReminder.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
          toast({ title: "Reminder removed" });
        },
      }
    );
  };

  const handleSaveHabit = (id: number) => {
    updateHabit.mutate(
      { id, data: { title: editTitle } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          setEditingHabit(null);
          toast({ title: "Habit updated" });
        },
      }
    );
  };

  const handleDeleteHabit = (id: number) => {
    deleteHabit.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          toast({ title: "Habit removed" });
        },
      }
    );
  };

  const handleToggleHabit = (id: number, isActive: boolean) => {
    updateHabit.mutate(
      { id, data: { isActive } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() }) }
    );
  };

  const handleUpgrade = () => {
    updateProfile.mutate(
      { data: { tier: "premium" } },
      {
        onSuccess: () => {
          toast({ title: "Upgraded to Premium!", description: "Enjoy unlimited access." });
          queryClient.invalidateQueries();
        },
      }
    );
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-display font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account, habits, and reminders</p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-card-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Account</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <span className={cn(
                  "text-xs px-2.5 py-1 rounded-full font-medium",
                  user?.tier === "premium"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {user?.tier === "premium" ? "Premium" : "Free"}
                </span>
              </div>
              {user?.tier === "free" && (
                <div className="pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">
                    Upgrade to Premium for unlimited AI coaching, advanced insights, and more.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleUpgrade}
                    disabled={updateProfile.isPending}
                    data-testid="button-upgrade"
                  >
                    Upgrade to Premium — $9/mo
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Reminders
            </h2>

            {remindersLoading && <Skeleton className="h-16 rounded-xl" />}

            <div className="space-y-2 mb-4">
              {(reminders as Array<{ id: number; label: string; time: string; enabled: boolean }> | undefined)?.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => handleToggleReminder(r.id, v)}
                    data-testid={`toggle-reminder-${r.id}`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.time}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteReminder(r.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    data-testid={`button-delete-reminder-${r.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!remindersLoading && (!reminders || (reminders as Array<unknown>).length === 0) && (
                <p className="text-sm text-muted-foreground">No reminders yet.</p>
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-border">
              <Input
                placeholder="Reminder label"
                value={newReminderLabel}
                onChange={(e) => setNewReminderLabel(e.target.value)}
                className="flex-1"
                data-testid="input-reminder-label"
              />
              <input
                type="time"
                value={newReminderTime}
                onChange={(e) => setNewReminderTime(e.target.value)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="input-reminder-time"
              />
              <Button
                size="icon"
                onClick={handleAddReminder}
                disabled={!newReminderLabel.trim() || createReminder.isPending}
                data-testid="button-add-reminder"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Active Habits</h2>

            {habitsLoading && <Skeleton className="h-24 rounded-xl" />}

            <div className="space-y-2">
              {(habits as Array<{ id: number; title: string; isActive: boolean; currentStreak: number }> | undefined)?.map((habit) => (
                <div key={habit.id} className="flex items-center gap-3 py-2">
                  <Switch
                    checked={habit.isActive}
                    onCheckedChange={(v) => handleToggleHabit(habit.id, v)}
                    data-testid={`toggle-habit-${habit.id}`}
                  />
                  {editingHabit === habit.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        data-testid={`input-edit-habit-${habit.id}`}
                      />
                      <button
                        onClick={() => handleSaveHabit(habit.id)}
                        className="text-primary"
                        data-testid={`button-save-habit-${habit.id}`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingHabit(null)}
                        className="text-muted-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="text-sm font-medium">{habit.title}</p>
                      {habit.currentStreak > 0 && (
                        <p className="text-xs text-muted-foreground">{habit.currentStreak}d streak</p>
                      )}
                    </div>
                  )}
                  {editingHabit !== habit.id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingHabit(habit.id); setEditTitle(habit.title); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`button-edit-habit-${habit.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHabit(habit.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        data-testid={`button-delete-habit-${habit.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!habitsLoading && (!habits || (habits as Array<unknown>).length === 0) && (
                <p className="text-sm text-muted-foreground">No habits yet. Complete onboarding first.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
