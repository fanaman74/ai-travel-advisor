interface Props { progress: number; message?: string }
export function LoadingPulse({ progress, message }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm text-gray-500 animate-pulse">{message ?? 'Discovering nearby places…'}</p>
      <p className="text-xs text-gray-400">{progress}%</p>
    </div>
  )
}
