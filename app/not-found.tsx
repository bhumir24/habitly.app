import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">This page does not exist.</p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
