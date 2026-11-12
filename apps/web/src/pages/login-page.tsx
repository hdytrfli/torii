import { useState } from "react"
import { Landmark, Loader } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { Button, Field, Input } from "../components/ui"

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
      <section className="hidden flex-col justify-between border-r border-line bg-brand p-10 text-brand-ink lg:flex">
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
          <div className="mt-8 grid grid-cols-3 gap-3 text-[11px] text-brand-ink/70">
            <div className="rounded-control border border-brand-ink/15 p-3">
              <div className="text-lg font-semibold text-brand-ink">Jellyfin</div>
              <div className="mt-1">first choice for candidates</div>
            </div>
            <div className="rounded-control border border-brand-ink/15 p-3">
              <div className="text-lg font-semibold text-brand-ink">AI</div>
              <div className="mt-1">only when no candidates exist</div>
            </div>
            <div className="rounded-control border border-brand-ink/15 p-3">
              <div className="text-lg font-semibold text-brand-ink">You</div>
              <div className="mt-1">always the final say</div>
            </div>
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
            <div className="flex items-center gap-2 text-sm text-ink-muted">
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
                {error ? (
                  <div className="rounded-control border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
                    {error}
                  </div>
                ) : null}
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
