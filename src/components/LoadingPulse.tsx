interface Props { progress: number; message?: string }
export function LoadingPulse({ progress, message }: Props) {
  return (
    <div className="airbnb-card flex flex-col gap-4 p-5 stagger-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#222222]">Finding nearby places</p>
          <p className="text-sm text-[var(--text-muted)]">{message ?? 'Discovering nearby places…'}</p>
        </div>
        <span className="text-sm font-semibold text-[#ff385c]">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f1ece8]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ff385c,#ff7a59)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
