import { Suspense } from "react";
import { LoginLinkHandler } from "./login-link-handler";

export const metadata = { title: "Signing you in", robots: { index: false, follow: false } };

// Lands here from an admin-generated magiclink (see
// /api/admin/accounts/create-test) rather than a normal email click, so
// there's no SSR request carrying a session — same implicit-flow hash-token
// situation /reset-password already handles, just for sign-in instead of
// password recovery. See login-link-handler.tsx for why this has to run
// client-side.
export default function LoginLinkPage() {
  return (
    <Suspense>
      <LoginLinkHandler />
    </Suspense>
  );
}
