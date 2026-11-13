import { useState } from "react"
import { FileSearch, Landmark, Loader, Server, Sparkles, UserRoundCheck } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { Alert, Button, Field, Input } from "../components/ui"

export function LoginPage() {
  const { login, setup } = useAuth()
  const setupStatus = useQuery({
    queryKey: ["setup-status"],
    queryFn: api.setupStatus,
    staleTime: 0,
  })
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const needsSetup = setupStatus.data?.needs_setup ?? false

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (needsSetup && password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setBusy(true)
    try {
      if (needsSetup) await setup(username, password)
      else await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between border-r border-brand-ink/10 bg-brand p-10 text-brand-ink lg:flex">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Landmark size={18} /> torii
        </div>
        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            A clean library starts with one honest match.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-brand-ink/70">
            Guessit parses the release. Jellyfin confirms the metadata. AI only steps in when
            there is nothing else to match. You approve the final rename.
          </p>
          <div className="mt-10 space-y-5">
            {[
              {
                icon: FileSearch,
                title: "Filename parsed first",
                description: "Release names are read before any provider lookup.",
              },
              {
                icon: Server,
                title: "Jellyfin confirms",
                description: "First choice for candidate metadata.",
              },
              {
                icon: Sparkles,
                title: "AI steps in last",
                description: "Only when there are no candidates to compare.",
              },
              {
                icon: UserRoundCheck,
                title: "You have the final say",
                description: "Every rename is reviewed before it is applied.",
              },
            ].map((step) => (
              <div key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-brand-ink/10 text-brand-ink/80">
                  <step.icon className="size-3.5" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-sm font-medium text-brand-ink">
                    {step.title}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-brand-ink/60">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-brand-ink/50">Self-hosted. Review-first. No silent renames.</div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand text-brand-ink">
              <Landmark size={16} />
            </span>
            <span className="text-sm font-semibold">torii</span>
          </div>
          {setupStatus.isLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-ink-muted">
              <Loader size={16} className="animate-spin" /> Checking setup…
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                {needsSetup ? "Create the first administrator" : "Sign in"}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {needsSetup
                  ? "This page disappears once the account exists."
                  : "Use your torii account to review the queue."}
              </p>
              <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
                <Field label="Username">
                  <Input
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    autoComplete={needsSetup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </Field>
                {needsSetup ? (
                  <Field label="Confirm password">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      required
                    />
                  </Field>
                ) : null}
                {error ? <Alert variant="error">{error}</Alert> : null}
                <Button type="submit" disabled={busy} className="mt-1">
                  {busy ? <Loader size={14} className="animate-spin" /> : null}
                  {needsSetup ? "Create administrator" : "Sign in"}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
