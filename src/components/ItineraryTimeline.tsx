import type { ItineraryStop } from '@/types'
interface Props { stops: ItineraryStop[] }
export function ItineraryTimeline({ stops }: Props) {
  return (
    <div className="flex flex-col gap-0">
      {stops.map((stop, idx) => (
        <div key={idx} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-indigo-600 mt-1 flex-shrink-0" />
            {idx < stops.length - 1 && <div className="w-0.5 bg-indigo-200 flex-1 my-1" />}
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-indigo-600 font-semibold">{stop.time}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">{stop.duration}</span>
            </div>
            <p className="font-medium text-gray-900 text-sm">{stop.name}</p>
            {stop.notes && <p className="text-xs text-gray-500 mt-0.5">{stop.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
