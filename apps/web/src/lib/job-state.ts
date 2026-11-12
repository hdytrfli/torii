import type { Job } from "./types"

export const BLOCKED_REASON_LABELS: Record<string, string> = {
  source_missing: "Source missing",
  target_missing: "Target missing",
  target_exists: "Target exists",
  duplicate_target: "Duplicate target",
  invalid_layout: "Invalid layout",
  invalid_action: "Invalid action",
  operation_failed: "File operation failed",
  permission_denied: "Permission problem",
}

export function blockedReasonLabel(reason: string | null | undefined) {
  if (!reason) return null
  return BLOCKED_REASON_LABELS[reason] ?? reason.replaceAll("_", " ")
}

export function isReviewable(job: Job) {
  return job.status === "needs_review" && !job.blocked_reason
}

export function canUndo(job: Job) {
  return job.status === "moved"
}

export function canRetry(job: Job) {
  return job.status !== "moved"
}
