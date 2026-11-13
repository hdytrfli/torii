import { useState } from "react"
import { MoreHorizontal, Plus } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import type { User } from "../lib/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/tremor/dropdown"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/tremor/dialog"
import { Badge, Button, Field, Input, Skeleton, Switch } from "../components/ui"

export function UsersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const users = useQuery({ queryKey: ["users"], queryFn: api.users, enabled: !!user?.is_admin })
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["users"] })

  const create = useMutation({
    mutationFn: () => api.createUser(username, password, isAdmin),
    onSuccess: () => {
      setOpen(false)
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

  const reset = useMutation({
    mutationFn: ({ id, nextPassword }: { id: number; nextPassword: string }) =>
      api.resetPassword(id, nextPassword),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  })

  if (!user?.is_admin) {
    return <p className="text-sm text-gray-500">Administrator access required.</p>
  }

  return (
    <>
      <section aria-labelledby="existing-users">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h3 id="existing-users" className="scroll-mt-10 font-semibold text-gray-900">
              Users
            </h3>
            <p className="text-sm leading-6 text-gray-500">
              Administrators can add, manage, and remove users.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="mt-4 w-full gap-2 sm:mt-0 sm:w-fit">
                <Plus className="-ml-1 size-4 shrink-0" aria-hidden="true" />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  create.mutate()
                }}
              >
                <DialogHeader>
                  <DialogTitle>Add user to this workspace</DialogTitle>
                  <DialogDescription className="mt-1 text-sm leading-6">
                    Create a local account. Passwords are scrypt-hashed.
                  </DialogDescription>
                  <div className="mt-4">
                    <Field label="Username">
                      <Input
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="Username"
                        className="mt-2"
                        required
                      />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Password">
                      <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        className="mt-2"
                        required
                      />
                    </Field>
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                    <Switch checked={isAdmin} onChange={setIsAdmin} />
                    Administrator
                  </label>
                  {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
                </DialogHeader>
                <DialogFooter className="mt-6">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" className="mt-2 w-full sm:mt-0 sm:w-fit">
                      Go back
                    </Button>
                  </DialogClose>
                  <Button type="submit" className="w-full sm:w-fit" disabled={create.isPending}>
                    Add user
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {users.isLoading ? (
          <Skeleton className="mt-6 h-40" />
        ) : (
          <ul role="list" className="mt-6 divide-y divide-gray-200">
            {(users.data ?? []).map((account) => (
              <UserRow
                key={account.id}
                account={account}
                isSelf={account.id === user.id}
                onDelete={() => {
                  if (window.confirm(`Delete ${account.username}?`)) remove.mutate(account.id)
                }}
                onReset={() => {
                  const nextPassword = window.prompt(`New password for ${account.username}`)
                  if (nextPassword) reset.mutate({ id: account.id, nextPassword })
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function UserRow({
  account,
  isSelf,
  onDelete,
  onReset,
}: {
  account: User
  isSelf: boolean
  onDelete: () => void
  onReset: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-x-6 py-2.5">
      <div className="flex min-w-0 items-center gap-x-4">
        <span className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs uppercase text-gray-700 sm:flex">
          {account.username.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {account.username}
            {isSelf ? <span className="ml-2 text-xs font-normal text-gray-400">you</span> : null}
          </p>
          <p className="truncate text-xs text-gray-500">
            {account.is_admin ? "Administrator" : "Reviewer"} - added{" "}
            {account.created_at?.slice(0, 10) ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={account.is_admin ? "default" : "neutral"}>
          {account.is_admin ? "Admin" : "Reviewer"}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="group size-8 p-0 hover:border hover:border-gray-300 hover:bg-gray-50 data-[state=open]:border-gray-300 data-[state=open]:bg-gray-50"
            >
              <MoreHorizontal className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={onReset} disabled={isSelf}>
              Reset password
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onDelete}
              disabled={isSelf}
              className="text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
