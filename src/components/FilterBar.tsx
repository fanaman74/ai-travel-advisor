'use client'
interface Props { options: string[]; active: string[]; onChange: (active: string[]) => void }
export function FilterBar({ options, active, onChange }: Props) {
  function toggle(opt: string) {
    onChange(active.includes(opt) ? active.filter(x => x !== opt) : [...active, opt])
  }
  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
      {options.map(opt => (
        <button key={opt} onClick={() => toggle(opt)}
          className={`airbnb-chip whitespace-nowrap px-4 py-2 text-sm font-semibold ${
            active.includes(opt) ? 'airbnb-chip-active shadow-[0_8px_20px_rgba(34,34,34,0.14)]' : 'hover:border-[var(--line-strong)] hover:text-[#222222]'
          }`}>
          {opt}
        </button>
      ))}
    </div>
  )
}
