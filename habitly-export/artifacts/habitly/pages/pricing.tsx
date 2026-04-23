import { useAuth } from "@/hooks/use-auth";
import { useUpdateProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const freeFeatures = [
  "Up to 5 active habits",
  "Daily check-ins & streaks",
  "10 AI coach messages per day",
  "Weekly insights",
  "Micro-habit fallbacks",
];

const premiumFeatures = [
  "Everything in Free",
  "Unlimited active habits",
  "Unlimited AI coaching",
  "Priority AI generation",
  "Custom reminders",
  "Advanced mood charts",
  "Export your data",
];

export default function PricingPage() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpgrade = () => {
    updateProfile.mutate(
      { data: { tier: "premium" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({
            title: "Welcome to Premium!",
            description: "All features are now unlocked.",
          });
        },
      }
    );
  };

  const isPremium = user?.tier === "premium";

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-display font-semibold mb-2">Upgrade your practice</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Premium unlocks unlimited AI coaching, advanced insights, and everything you need to build lasting habits.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-card border border-card-border rounded-2xl p-6">
            <p className="text-xs font-medium text-muted-foreground mb-1">Free</p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-3xl font-display font-semibold">$0</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled>
              {isPremium ? "Previous plan" : "Current plan"}
            </Button>
          </div>

          <div className="bg-primary text-primary-foreground rounded-2xl p-6 relative">
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1 bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium">
                <Star className="w-3 h-3" />
                Most popular
              </div>
            </div>
            <p className="text-xs font-medium text-primary-foreground/70 mb-1">Premium</p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-3xl font-display font-semibold">$9</span>
              <span className="text-sm text-primary-foreground/70">/mo</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {premiumFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-white flex-shrink-0" />
                  <span className="text-primary-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full bg-white text-primary hover:bg-white/90"
              onClick={handleUpgrade}
              disabled={isPremium || updateProfile.isPending}
              data-testid="button-upgrade-premium"
            >
              {isPremium ? "Current plan" : updateProfile.isPending ? "Upgrading..." : "Upgrade to Premium"}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Cancel anytime. No questions asked.
        </p>
      </div>
    </AppShell>
  );
}
