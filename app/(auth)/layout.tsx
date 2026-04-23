export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 -z-10 grad-soft" />
      {children}
    </div>
  );
}
