import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setToken } from "@/lib/token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Zap } from "lucide-react";
import { useState } from "react";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const login = useLogin();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState("");

  const onSubmit = (data: LoginForm) => {
    setServerError("");
    login.mutate({ data }, {
      onSuccess: (result) => {
        const token = (result as unknown as { token?: string })?.token;
        if (token) setToken(token);
        queryClient.invalidateQueries();
        setLocation("/dashboard");
      },
      onError: (err: unknown) => {
        const e = err as { status?: number };
        if (e?.status === 401) {
          setServerError("Invalid email or password.");
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
          <p className="text-[28px] font-display font-semibold text-white leading-snug mb-3">
            "I've built the morning routine I'd been trying to create for two years."
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 60% 68%))" }}
            >
              PM
            </div>
            <div>
              <p className="text-white text-[13px] font-semibold">Priya M.</p>
              <p className="text-[12px]" style={{ color: "hsl(220 20% 55%)" }}>Marketing Lead</p>
            </div>
          </div>
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
              <h1 className="text-[26px] font-display font-semibold tracking-tight">Welcome back</h1>
              <p className="text-[13.5px] text-muted-foreground mt-1.5">Log in to continue your habit journey</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  placeholder="Your password"
                  data-testid="input-password"
                  className="h-10 rounded-xl text-[13.5px]"
                  {...register("password", { required: "Password is required" })}
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
                disabled={login.isPending}
                data-testid="button-login-submit"
                style={{
                  background: "linear-gradient(135deg, hsl(245 70% 58%), hsl(262 60% 65%))",
                  boxShadow: "0 4px 16px rgba(99,89,235,0.28)",
                }}
              >
                {login.isPending ? "Logging in..." : "Log in"}
              </Button>
            </form>

            <p className="text-center text-[13px] text-muted-foreground mt-6">
              Don't have an account?{" "}
              <Link href="/signup" className="font-semibold hover:underline" style={{ color: "hsl(245 70% 58%)" }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
