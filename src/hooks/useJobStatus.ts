'use client'
import { useState, useEffect, useRef } from 'react'

interface JobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | null
  progress: number
  placesFound: number | null
}

export function useJobStatus(jobId: string | null) {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    status: null, progress: 0, placesFound: null,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/job-status/${jobId}`)
        const data = await res.json()
        setJobStatus({
          status: data.status,
          progress: data.progress ?? 0,
          placesFound: data.placesFound,
        })
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch {}
    }

    poll()
    intervalRef.current = setInterval(poll, 3_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [jobId])

  return jobStatus
}
