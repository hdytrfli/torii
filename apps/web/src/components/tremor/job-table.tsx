import { useState } from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { Job } from "../../lib/types"
import { basename, episodeLabel, pct } from "../../lib/format"
import { SourceBadge, StatusBadge } from "../ui"

const PAGE_SIZE = 10

export function JobTable({ jobs }: { jobs: Job[] }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE))
  const rows = jobs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="mt-8 space-y-3">
      <div className="relative overflow-hidden overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b border-line">
            <tr>
              {["Title", "Type", "Source", "Confidence", "Target", "Status"].map((header) => (
                <th key={header} className="px-3 py-2.5 text-xs font-medium text-gray-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((job) => {
              const episode = episodeLabel(job)
              return (
                <tr key={job.id} className="odd:bg-gray-50">
                  <td className="max-w-[260px] truncate px-3 py-2.5 font-medium text-gray-900">
                    {job.title || basename(job.source_path)}
                    {job.year ? <span className="ml-1 font-normal text-gray-500">({job.year})</span> : null}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-gray-600">
                    {job.media_type ?? "movie"}
                    {episode ? <span className="ml-1 text-gray-400">{episode}</span> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <SourceBadge source={job.source} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{pct(job.confidence)}</td>
                  <td className="max-w-[360px] truncate px-3 py-2.5 font-mono text-[11px] text-gray-500">
                    {job.target_path ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={job.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Page {page + 1} of {pages} · {jobs.length} jobs
        </span>
        <div className="flex items-center gap-1">
          <button className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-40" onClick={() => setPage(0)} disabled={page === 0} aria-label="First page">
            <ChevronsLeft size={15} />
          </button>
          <button className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-40" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page">
            <ChevronLeft size={15} />
          </button>
          <button className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-40" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Next page">
            <ChevronRight size={15} />
          </button>
          <button className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-40" onClick={() => setPage(pages - 1)} disabled={page >= pages - 1} aria-label="Last page">
            <ChevronsRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
