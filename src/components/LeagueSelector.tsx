import type { Ladder } from '../types'

interface Props {
  ladder: Ladder
  onLadderChange: (ladder: Ladder) => void
  leagueName: string | null
}

export function LeagueSelector({ ladder, onLadderChange, leagueName }: Props) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <span className="text-sm text-neutral-400">
        League: <span className="font-medium text-neutral-100">{leagueName ?? '…'}</span>
      </span>
      <div className="flex overflow-hidden rounded-md border border-neutral-700">
        {(['softcore', 'hardcore'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onLadderChange(option)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              ladder === option
                ? 'bg-purple-600 text-white'
                : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            {option === 'softcore' ? 'Softcore Trade' : 'Hardcore Trade'}
          </button>
        ))}
      </div>
    </div>
  )
}
