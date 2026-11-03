import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, lastEmailCookieName } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { LoginFormShell } from "./login-form";

// Server wrapper: a valid session skips the form entirely, and the remembered
// email is present on first paint — the owner never retypes what we know.
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const jar = await cookies();
  const defaultEmail = jar.get(lastEmailCookieName())?.value || "";
  return <LoginFormShell defaultEmail={defaultEmail} googleEnabled={googleConfigured()} />;
}
