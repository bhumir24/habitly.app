import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { useSignup } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setToken } from "@/lib/token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Zap, Check } from "lucide-react";
import { useState } from "react";

interface SignupForm {
  name: string;
  email: string;
  password: string;
}

const PERKS = [
  "AI-generated personalized habit plan",
  "Smart adaptive tracking & micro-habits",
  "Weekly insights with mood trends",
];

export default function SignupPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>();
  const signup = useSignup();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState("");

  const onSubmit = (data: SignupForm) => {
    setServerError("");
    signup.mutate({ data }, {
      onSuccess: (result) => {
        const token = (result as unknown as { token?: string })?.token;
        if (token) setToken(token);
        queryClient.invalidateQueries();
        setLocation("/onboarding");
      },
      onError: (err: unknown) => {
        const e = err as { status?: number };
        if (e?.status === 409) {
          setServerError("An account with this email already exists.");
        } else {
          setServerError("Something went wrong. Please try again.");
        }
      },
    });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(220 20% 97%)" }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex w-[420px] flex-col justify-between p-10 flex-shrink-0"
        style={{
          background: "linear-gradient(160deg, hsl(232 28% 13%) 0%, hsl(245 35% 20%) 100%)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 65% 68%))" }}
          >
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-semibold text-white text-[17px]">Habitly</span>
        </div>

        <div>
          <h2 className="text-[26px] font-display font-semibold text-white leading-snug mb-6">
            Build habits that stick, with AI on your side.
          </h2>
          <ul className="space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(99,89,235,0.3)" }}
                >
                  <Check className="w-3 h-3" style={{ color: "hsl(245 70% 70%)" }} />
                </div>
                <span className="text-[13.5px]" style={{ color: "hsl(220 20% 72%)" }}>{perk}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] mt-8" style={{ color: "hsl(220 20% 45%)" }}>
            No credit card required · Free forever plan
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        <nav className="px-6 h-14 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 65% 68%))" }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-semibold">Habitly</span>
          </div>
        </nav>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-[26px] font-display font-semibold tracking-tight">Create your account</h1>
              <p className="text-[13.5px] text-muted-foreground mt-1.5">Free forever, upgrade anytime</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[13px] font-medium">Full name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  data-testid="input-name"
                  className="h-10 rounded-xl text-[13.5px]"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name && <p className="text-destructive text-[12px]">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  data-testid="input-email"
                  className="h-10 rounded-xl text-[13.5px]"
                  {...register("email", { required: "Email is required" })}
                />
                {errors.email && <p className="text-destructive text-[12px]">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  data-testid="input-password"
                  className="h-10 rounded-xl text-[13.5px]"
                  {...register("password", { required: "Password is required", minLength: { value: 8, message: "Minimum 8 characters" } })}
                />
                {errors.password && <p className="text-destructive text-[12px]">{errors.password.message}</p>}
              </div>

              {serverError && (
                <div className="flex items-center gap-2 text-destructive text-[12.5px] bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10 font-semibold text-[13.5px] rounded-xl"
                disabled={signup.isPending}
                data-testid="button-signup-submit"
                style={{
                  background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))",
                  boxShadow: "0 4px 16px rgba(99,89,235,0.28)",
                }}
              >
                {signup.isPending ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="text-center text-[13px] text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: "hsl(245 70% 58%)" }}>
                Log in
              </Link>
            </p>

            <p className="text-center text-[11px] text-muted-foreground mt-4 px-4">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
