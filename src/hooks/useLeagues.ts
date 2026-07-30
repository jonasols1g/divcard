import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { League } from '../types'

export function useLeagues() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getDocs(collection(db, 'leagues'))
      .then((snapshot) => {
        if (cancelled) return
        const result = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as League,
        )
        setLeagues(result)
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
  }, [])

  return { leagues, loading, error }
}
