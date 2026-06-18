'use client'
const OPTIONS = [{ label: '500m', value: 500 }, { label: '1km', value: 1000 }, { label: '5km', value: 5000 }, { label: '10km', value: 10000 }, { label: '25km', value: 25000 }]
interface Props { value: number; onChange: (value: number) => void }
export function RadiusSelector({ value, onChange }: Props) {
  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
      {OPTIONS.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`airbnb-chip whitespace-nowrap px-4 py-2 text-sm font-semibold ${
            value === opt.value ? 'airbnb-chip-active shadow-[0_8px_20px_rgba(34,34,34,0.14)]' : 'hover:border-[var(--line-strong)] hover:text-[#222222]'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
