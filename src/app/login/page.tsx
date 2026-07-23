import { Suspense } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in — Ripplewatch" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-4" />
          </span>
          Ripplewatch
        </Link>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
