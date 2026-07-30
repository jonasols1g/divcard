import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { CardRow, DivinationCard, Ladder, PriceSnapshot } from '../types'

export function useCardRows(league: string | null, ladder: Ladder) {
  const [rows, setRows] = useState<CardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!league) return
    let cancelled = false
    setLoading(true)

    Promise.all([
      getDocs(collection(db, 'divination_cards')),
      getDocs(
        query(
          collection(db, 'prices'),
          where('league', '==', league),
          where('ladder', '==', ladder),
        ),
      ),
    ])
      .then(([cardsSnapshot, pricesSnapshot]) => {
        if (cancelled) return

        const cards = cardsSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as DivinationCard,
        )
        const pricesByCardId = new Map<string, PriceSnapshot>()
        for (const doc of pricesSnapshot.docs) {
          const price = { id: doc.id, ...doc.data() } as PriceSnapshot
          pricesByCardId.set(price.cardId, price)
        }

        const result = cards.map((card) => ({
          ...card,
          price: pricesByCardId.get(card.id),
        }))
        setRows(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [league, ladder])

  return { rows, loading, error }
}
