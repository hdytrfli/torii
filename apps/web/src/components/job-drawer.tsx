import { useEffect, useMemo, useState } from "react"
import { Check, RefreshCw, Sparkles, X } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { pct, sourceLabel } from "../lib/format"
import { Badge, Button, Field, Input, Select, SourceBadge } from "./ui"

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
      api
        .preview(job.id, payload)
        .then((result) => setTarget(result.target))
        .catch(() => undefined)
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-surface shadow-card">
        {!job ? (
          <div className="p-6 text-sm text-ink-muted">Loading job…</div>
        ) : (
          <>
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-ink">
                  {job.title || "Untitled"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                  <Badge>{job.media_type ?? "movie"}</Badge>
                  <SourceBadge source={job.source} />
                  <span>{pct(job.confidence)} confidence</span>
                </div>
                <div className="mt-1 truncate font-mono text-[10.5px] text-ink-muted">
                  {job.source_path}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X size={16} />
              </Button>
            </header>

            <div className="flex flex-col gap-4 p-5">
              {job.reason ? (
                <p className="text-xs text-ink-muted">
                  Matched with {sourceLabel(job.source)}: {job.reason}
                </p>
              ) : null}

              {job.candidates_json && job.candidates_json.length > 0 ? (
                <section>
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                    Provider candidates
                  </div>
                  <div className="flex flex-col gap-2">
                    {job.candidates_json.map((candidate, index) => (
                      <button
                        key={`${candidate.provider}-${candidate.provider_id}-${index}`}
                        type="button"
                        onClick={() => {
                          setTitle(candidate.title)
                          setYear(candidate.year == null ? "" : String(candidate.year))
                          setMediaType(candidate.kind === "tv" ? "tv" : "movie")
                        }}
                        className="rounded-control border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-ink">
                            {candidate.title} {candidate.year ? `(${candidate.year})` : ""}
                          </span>
                          <Badge tone="info">{pct(candidate.score / 100)}</Badge>
                        </div>
                        {candidate.overview ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-ink-muted">
                            {candidate.overview}
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-control border border-line bg-surface-muted/50 p-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                  Identify by provider ID
                </div>
                <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2">
                  <Select
                    value={provider}
                    onChange={(event) =>
                      setProvider(event.target.value as "tmdb" | "imdb" | "tvdb")
                    }
                  >
                    <option value="tmdb">TMDb</option>
                    <option value="imdb">IMDb</option>
                    <option value="tvdb">TVDB</option>
                  </Select>
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
                <p className="mt-2 text-[10.5px] text-ink-muted">
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
                  <Select
                    value={mediaType}
                    onChange={(event) => {
                      const value = event.target.value as "movie" | "tv"
                      setMediaType(value)
                      if (value === "movie") {
                        setSeason("")
                        setEpisode("")
                      }
                    }}
                  >
                    <option value="movie">Movie</option>
                    <option value="tv">Show</option>
                  </Select>
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
                    <Select
                      value={action}
                      onChange={(event) =>
                        setAction(event.target.value as "move" | "copy" | "hardlink")
                      }
                    >
                      <option value="move">Move</option>
                      <option value="copy">Copy</option>
                      <option value="hardlink">Hardlink</option>
                    </Select>
                  </Field>
                </div>
              </section>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                  Target
                </div>
                <div className="break-all rounded-control border border-line bg-surface-muted px-3 py-2 font-mono text-[11px] text-ink">
                  {target || "—"}
                </div>
              </div>

              {error ? (
                <div className="rounded-control border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Button onClick={() => approve.mutate()} disabled={approve.isPending || !title}>
                  <Check size={14} /> Approve
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => askAi.mutate()}
                  disabled={askAi.isPending}
                >
                  <Sparkles size={14} /> Ask AI
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => retry.mutate()}
                  disabled={retry.isPending}
                >
                  <RefreshCw size={14} className={retry.isPending ? "animate-spin" : ""} /> Retry
                </Button>
                <Button
                  variant="danger"
                  onClick={() => reject.mutate()}
                  disabled={reject.isPending}
                >
                  <X size={14} /> Reject
                </Button>
                <span className="ml-auto text-[10.5px] text-ink-muted">
                  {job.status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
