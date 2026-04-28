import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const showDemoLogin = process.env.DEMO_LOGIN === "true";
  return <AuthForm mode="login" nextPath={searchParams.next} showDemoLogin={showDemoLogin} />;
}
