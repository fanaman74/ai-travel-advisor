'use client'
const OPTIONS = [{ label: '500m', value: 500 }, { label: '1km', value: 1000 }, { label: '5km', value: 5000 }, { label: '10km', value: 10000 }, { label: '25km', value: 25000 }]
interface Props { value: number; onChange: (value: number) => void }
export function RadiusSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {OPTIONS.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
