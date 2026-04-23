"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { login, signUp, type ActionState } from "@/actions/auth";

export function AuthForm({
  mode,
  nextPath,
}: {
  mode: "login" | "signup";
  nextPath?: string;
}) {
  const action = mode === "login" ? login : signUp;
  const [state, formAction] = useFormState<ActionState, FormData>(action, null);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Target className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {mode === "login"
            ? "Log in to your adaptive habit coach."
            : "90 seconds of setup, then your first plan."}
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          {nextPath && <input type="hidden" name="next" value={nextPath} />}
          {mode === "signup" && (
            <Field label="Full name" name="full_name" required placeholder="Alex Kim" />
          )}
          <Field label="Email" name="email" type="email" required placeholder="you@example.com" />
          <Field label="Password" name="password" type="password" required placeholder="••••••••" minLength={8} />
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <SubmitBtn label={mode === "login" ? "Log in" : "Create account"} />
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              No account?{" "}
              <Link className="text-primary underline" href="/signup">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have one?{" "}
              <Link className="text-primary underline" href="/login">
                Log in
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}
