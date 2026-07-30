import { useMemo, useState } from 'react'
import { useLeagues } from '../hooks/useLeagues'
import { useCardRows } from '../hooks/useCardRows'
import { LeagueSelector } from './LeagueSelector'
import type { CardRow, Ladder } from '../types'

type SortKey = 'roiPercent' | 'profitChaos' | 'name' | 'setCost'

const TRADE_SEARCH_URL = (cardName: string) =>
  `https://www.pathofexile.com/trade/search?q=${encodeURIComponent(cardName)}`

export function CardTable() {
  const { leagues, loading: leaguesLoading, error: leaguesError } = useLeagues()
  const [ladder, setLadder] = useState<Ladder>('softcore')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('roiPercent')

  const activeLeague = leagues.find((l) => l.ladder === ladder && l.isActive) ?? null

  const { rows, loading: rowsLoading, error: rowsError } = useCardRows(
    activeLeague?.name ?? null,
    ladder,
  )

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      row.name.toLowerCase().includes(search.toLowerCase()),
    )

    return filtered.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      const aVal = sortValue(a, sortKey)
      const bVal = sortValue(b, sortKey)
      return bVal - aVal
    })
  }, [rows, search, sortKey])

  const loading = leaguesLoading || rowsLoading
  const error = leaguesError ?? rowsError

  return (
    <div>
      <LeagueSelector ladder={ladder} onLadderChange={setLadder} leagueName={activeLeague?.name ?? null} />

      <input
        type="search"
        placeholder="Søk etter kort…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />

      {error && <p className="mb-4 text-sm text-red-400">Feil: {error}</p>}
      {loading && <p className="text-sm text-neutral-400">Laster…</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-md border border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <Th label="Kort" onClick={() => setSortKey('name')} active={sortKey === 'name'} />
                <th className="px-3 py-2 font-medium">Stack</th>
                <th className="px-3 py-2 font-medium">Belønning</th>
                <Th label="Settkost" onClick={() => setSortKey('setCost')} active={sortKey === 'setCost'} />
                <Th label="Profitt" onClick={() => setSortKey('profitChaos')} active={sortKey === 'profitChaos'} />
                <Th label="ROI %" onClick={() => setSortKey('roiPercent')} active={sortKey === 'roiPercent'} />
                <th className="px-3 py-2 font-medium">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {visibleRows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                    Ingen kort funnet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function sortValue(row: CardRow, key: SortKey): number {
  if (key === 'roiPercent') return row.price?.roiPercent ?? -Infinity
  if (key === 'profitChaos') return row.price?.profitChaos ?? -Infinity
  if (key === 'setCost') return row.price?.setCost ?? -Infinity
  return 0
}

function Th({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <th className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={`hover:text-neutral-100 ${active ? 'text-purple-400' : ''}`}
      >
        {label}
      </button>
    </th>
  )
}

function Row({ row }: { row: CardRow }) {
  const price = row.price
  const isFixed = row.rewardValueType === 'fixed'
  const profitPositive = (price?.profitChaos ?? 0) > 0

  return (
    <tr className="hover:bg-neutral-900/50">
      <td className="px-3 py-2 font-medium text-neutral-100">{row.name}</td>
      <td className="px-3 py-2 text-neutral-400">{row.stackSize}</td>
      <td className="px-3 py-2 text-neutral-400">
        {row.rewardItemName}
        {!isFixed && (
          <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-yellow-500">
            {row.rewardValueType === 'variable' ? 'variabel' : 'ukjent'}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-neutral-400">
        {price ? `${price.setCost.toFixed(1)} c` : '–'}
      </td>
      <td className={`px-3 py-2 font-medium ${price && isFixed ? (profitPositive ? 'text-green-400' : 'text-red-400') : 'text-neutral-500'}`}>
        {price && isFixed ? `${price.profitChaos.toFixed(1)} c` : '–'}
      </td>
      <td className={`px-3 py-2 font-medium ${price && isFixed ? (profitPositive ? 'text-green-400' : 'text-red-400') : 'text-neutral-500'}`}>
        {price && isFixed ? `${price.roiPercent.toFixed(0)}%` : '–'}
      </td>
      <td className="px-3 py-2">
        <a
          href={TRADE_SEARCH_URL(row.name)}
          target="_blank"
          rel="noreferrer"
          className="text-purple-400 hover:underline"
        >
          Trade ↗
        </a>
      </td>
    </tr>
  )
}
