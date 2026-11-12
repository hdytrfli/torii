import { useEffect, useMemo, useState } from "react"
import { Astroid, Check, RefreshCw, Undo2, X } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { pct, providerLabel, sourceLabel } from "../lib/format"
import { Badge, Button, Card, Field, Input, SourceBadge, StatusBadge } from "./ui"
import { DropdownSelect } from "./tremor/dropdown-select"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./tremor/drawer"

export function JobDrawer({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: job } = useQuery({ queryKey: ["job", jobId], queryFn: () => api.job(jobId) })
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.settings })
  const [title, setTitle] = useState("")
  const [year, setYear] = useState("")
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie")
  const [season, setSeason] = useState("")
  const [episode, setEpisode] = useState("")
  const [action, setAction] = useState<"move" | "copy" | "hardlink">("move")
  const [target, setTarget] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<"tmdb" | "imdb" | "tvdb">("tmdb")
  const [externalId, setExternalId] = useState("")

  useEffect(() => {
    if (settingsQuery.data) setAction(settingsQuery.data.action)
  }, [settingsQuery.data])

  useEffect(() => {
    if (!job) return
    setTitle(job.title ?? "")
    setYear(job.year == null ? "" : String(job.year))
    setMediaType(job.media_type === "tv" ? "tv" : "movie")
    setSeason(job.season == null ? "" : String(job.season))
    setEpisode(job.episode == null ? "" : String(job.episode))
    setTarget(job.target_path ?? "")
  }, [job])

  const payload = useMemo(
    () => ({
      title,
      year: year ? Number(year) : null,
      media_type: mediaType,
      season: season ? Number(season) : null,
      episode: episode ? Number(episode) : null,
    }),
    [title, year, mediaType, season, episode],
  )

  useEffect(() => {
    if (!job || !title) return
    const timer = window.setTimeout(() => {
      api.preview(job.id, payload).then((result) => setTarget(result.target)).catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [job, title, payload])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["groups"] })
    void queryClient.invalidateQueries({ queryKey: ["jobs"] })
    void queryClient.invalidateQueries({ queryKey: ["job", jobId] })
    void queryClient.invalidateQueries({ queryKey: ["stats"] })
  }

  const approve = useMutation({
    mutationFn: () => api.approve(jobId, { ...payload, action }),
    onSuccess: (result) => {
      invalidate()
      if (result.ok) onClose()
      else setError(result.message)
    },
    onError: (err: Error) => setError(err.message),
  })
  const identify = useMutation({
    mutationFn: () => api.identify(jobId, provider, externalId, mediaType),
    onSuccess: (updated) => {
      queryClient.setQueryData(["job", jobId], updated)
      invalidate()
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })
  const undo = useMutation({
    mutationFn: () => api.undo(jobId),
    onSuccess: (result) => {
      queryClient.setQueryData(["job", jobId], result.job)
      invalidate()
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })
  const askAi = useMutation({
    mutationFn: () => api.askAi(jobId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["job", jobId], updated)
      invalidate()
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })
  const reject = useMutation({
    mutationFn: () => api.reject(jobId),
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })
  const retry = useMutation({
    mutationFn: () => api.retry(jobId),
    onSuccess: () => {
      invalidate()
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const editable = job?.status !== "moved"
  const reviewable = job?.status === "needs_review" || job?.status === "ready"

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent className="sm:max-w-4xl">
        {!job ? (
          <DrawerBody className="text-sm text-gray-500">Loading job…</DrawerBody>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle>{job.title || "Untitled"}</DrawerTitle>
            </DrawerHeader>

            <DrawerBody className="-mx-6 overflow-y-auto border-t border-gray-200 px-6">
              <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-500">
                <StatusBadge status={job.status} />
                <span className="text-gray-300">·</span>
                <span>{job.media_type === "tv" ? "Shows" : "Movie"}</span>
                <span className="text-gray-300">·</span>
                <SourceBadge source={job.source} />
                <span className="text-gray-300">·</span>
                <span>{pct(job.confidence)} match</span>
              </div>

              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                <Card className="min-w-0 overflow-hidden p-0">
                  <div className="px-4 pb-4 pt-4">
                    <p className="break-all font-mono text-[11px] leading-5 text-gray-700">
                      {job.source_path}
                    </p>
                  </div>
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">
                    Original path
                  </div>
                </Card>
                <Card className="min-w-0 overflow-hidden p-0">
                  <div className="px-4 pb-4 pt-4">
                    <p className="break-all font-mono text-[11px] leading-5 text-gray-700">
                      {target || job.target_path || "—"}
                    </p>
                  </div>
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">
                    Target path
                  </div>
                </Card>
              </div>

              <div className="grid min-w-0 gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-5">
                {job.reason ? (
                  <p className="text-xs text-gray-500">
                    Matched with {sourceLabel(job.source)}: {job.reason}
                  </p>
                ) : null}

                {job.status === "moved" ? (
                  <p className="text-xs text-gray-500">
                    This job is read-only. Undo restores the source or removes the copy/link.
                  </p>
                ) : null}

                {editable ? (
                  <>
                    <section className="space-y-2">
                      <div className="text-xs font-medium text-gray-500">Identify by provider ID</div>
                      <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2">
                        <DropdownSelect
                          value={provider}
                          onChange={setProvider}
                          options={[
                            { value: "tmdb", label: "TMDb" },
                            { value: "imdb", label: "IMDb" },
                            { value: "tvdb", label: "TVDB" },
                          ]}
                        />
                        <Input
                          value={externalId}
                          onChange={(event) => setExternalId(event.target.value)}
                          placeholder={provider === "imdb" ? "tt0245429" : "129"}
                        />
                        <Button
                          variant="secondary"
                          onClick={() => identify.mutate()}
                          disabled={identify.isPending || !externalId.trim()}
                        >
                          Apply
                        </Button>
                      </div>
                      <p className="text-[10.5px] text-gray-500">
                        Resolved through Jellyfin, so no extra TMDb/TVDB key is needed.
                      </p>
                    </section>

                    <section className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Field label="Title">
                          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                        </Field>
                      </div>
                      <Field label="Year">
                        <Input
                          inputMode="numeric"
                          value={year}
                          onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))}
                        />
                      </Field>
                      <Field label="Type">
                        <DropdownSelect
                          value={mediaType}
                          onChange={(value) => {
                            setMediaType(value)
                            if (value === "movie") {
                              setSeason("")
                              setEpisode("")
                            }
                          }}
                          options={[
                            { value: "movie", label: "Movie" },
                            { value: "tv", label: "Show" },
                          ]}
                        />
                      </Field>
                      {mediaType === "tv" ? (
                        <>
                          <Field label="Season">
                            <Input
                              inputMode="numeric"
                              value={season}
                              onChange={(event) => setSeason(event.target.value.replace(/\D/g, ""))}
                            />
                          </Field>
                          <Field label="Episode">
                            <Input
                              inputMode="numeric"
                              value={episode}
                              onChange={(event) => setEpisode(event.target.value.replace(/\D/g, ""))}
                            />
                          </Field>
                        </>
                      ) : null}
                      <div className="col-span-2">
                        <Field label="Action">
                          <DropdownSelect
                            value={action}
                            onChange={setAction}
                            options={[
                              { value: "move", label: "Move" },
                              { value: "copy", label: "Copy" },
                              { value: "hardlink", label: "Hardlink" },
                            ]}
                          />
                        </Field>
                      </div>
                    </section>

                  </>
                ) : null}

                {error ? (
                  <div className="rounded-control border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
                    {error}
                  </div>
                ) : null}
              </div>

              <aside className="min-w-0 space-y-4">
                {job.status !== "moved" && job.candidates_json && job.candidates_json.length > 0 ? (
                  <section>
                    <div className="mb-2 text-xs font-medium text-gray-500">Provider candidates</div>
                    <div className="flex flex-col gap-2">
                      {job.candidates_json.map((candidate, index) => (
                        <Card
                          key={`${candidate.provider}-${candidate.provider_id}-${index}`}
                          className="overflow-hidden p-0"
                        >
                          <div className="px-4 pb-4 pt-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium text-gray-900">
                                {candidate.title} {candidate.year ? `(${candidate.year})` : ""}
                              </span>
                              <Badge variant="default">{pct(candidate.score / 100)}</Badge>
                            </div>
                            {candidate.overview ? (
                              <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">
                                {candidate.overview}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2">
                            <span className="text-[11px] text-gray-500">
                              {providerLabel(candidate.provider)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setTitle(candidate.title)
                                setYear(candidate.year == null ? "" : String(candidate.year))
                                setMediaType(candidate.kind === "tv" ? "tv" : "movie")
                              }}
                            >
                              Use
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>
                ) : null}
              </aside>
              </div>
            </DrawerBody>

            <DrawerFooter>
              {job.status === "moved" ? (
                <Button variant="secondary" onClick={() => undo.mutate()} disabled={undo.isPending}>
                  <Undo2 size={14} /> Undo apply
                </Button>
              ) : reviewable ? (
                <>
                  <Button onClick={() => approve.mutate()} disabled={approve.isPending || !title}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" onClick={() => askAi.mutate()} disabled={askAi.isPending}>
                    <Astroid size={14} /> Ask AI
                  </Button>
                  <Button variant="secondary" onClick={() => retry.mutate()} disabled={retry.isPending}>
                    <RefreshCw size={14} className={retry.isPending ? "animate-spin" : ""} /> Retry
                  </Button>
                  <Button variant="danger" onClick={() => reject.mutate()} disabled={reject.isPending}>
                    <X size={14} /> Reject
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => retry.mutate()} disabled={retry.isPending}>
                  <RefreshCw size={14} className={retry.isPending ? "animate-spin" : ""} /> Retry
                </Button>
              )}
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
