'use client'
interface Props { options: string[]; active: string[]; onChange: (active: string[]) => void }
export function FilterBar({ options, active, onChange }: Props) {
  function toggle(opt: string) {
    onChange(active.includes(opt) ? active.filter(x => x !== opt) : [...active, opt])
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {options.map(opt => (
        <button key={opt} onClick={() => toggle(opt)}
          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active.includes(opt) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}>
          {opt}
        </button>
      ))}
    </div>
  )
}
