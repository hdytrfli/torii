import { useState } from "react"
import { KeyRound, Plus, Trash2, UserRound } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import type { User } from "../lib/types"
import { Badge, Button, Card, EmptyState, Field, Input, Skeleton, Toggle } from "../components/ui"

export function UsersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ["users"], queryFn: api.users, enabled: !!user?.is_admin })
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["users"] })

  const create = useMutation({
    mutationFn: () => api.createUser(username, password, isAdmin),
    onSuccess: () => {
      setUsername("")
      setPassword("")
      setIsAdmin(false)
      setError(null)
      invalidate()
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteUser(id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  })

  if (!user?.is_admin) {
    return (
      <EmptyState
        title="Administrator access required"
        description="Ask an administrator to create or reset accounts."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          Access
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Accounts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Passwords are scrypt-hashed. Resetting a password signs that user out.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <Plus size={15} /> Create user
        </div>
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <Field label="Username">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Toggle
            label="Admin"
            checked={isAdmin}
            onChange={setIsAdmin}
          />
          <Button type="submit" disabled={create.isPending} className="self-end">
            Create
          </Button>
        </form>
        {error ? <div className="mt-3 text-xs text-danger">{error}</div> : null}
      </Card>

      {users.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card className="divide-y divide-line">
          {(users.data ?? []).map((account) => (
            <UserRow
              key={account.id}
              account={account}
              isSelf={account.id === user.id}
              onDelete={() => {
                if (window.confirm(`Delete ${account.username}?`)) remove.mutate(account.id)
              }}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

function UserRow({
  account,
  isSelf,
  onDelete,
}: {
  account: User
  isSelf: boolean
  onDelete: () => void
}) {
  const queryClient = useQueryClient()
  const reset = useMutation({
    mutationFn: (password: string) => api.resetPassword(account.id, password),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  })

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        <UserRound size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          {account.username}
          {account.is_admin ? <Badge variant="default">admin</Badge> : null}
          {isSelf ? <span className="text-[11px] text-ink-muted">you</span> : null}
        </div>
        <div className="text-[11px] text-ink-muted">
          Created {account.created_at?.slice(0, 10) ?? "—"}
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          const password = window.prompt(`New password for ${account.username}`)
          if (password) reset.mutate(password)
        }}
      >
        <KeyRound size={13} /> Reset
      </Button>
      {!isSelf ? (
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={13} /> Delete
        </Button>
      ) : null}
    </div>
  )
}
