import { type Chip } from './api'

export function SuggestionChips({ chips, onPick }: { chips: Chip[]; onPick: (text: string) => void }) {
  if (!chips.length) return null
  return (
    <div className="asst-chips">
      {chips.map((c) => (
        <button key={c.text} type="button" className="asst-chip" onClick={() => onPick(c.text)}>
          {c.label}
        </button>
      ))}
    </div>
  )
}
