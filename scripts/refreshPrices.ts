/**
 * Kjøres periodisk (planlagt: hvert 30. min via en scheduled Claude Code
 * routine). Henter gjeldende league fra poe.ninja, priser alle divination
 * cards og deres belønningsitems for softcore+hardcore trade, og skriver
 * resultatet til Firestore (`prices`, `leagues`).
 *
 * Kjøring: npx tsx scripts/refreshPrices.ts
 */
import { db } from './lib/firebaseAdmin'
import {
  CLASSIC_CURRENCY_ALIASES,
  EXCHANGE_TYPES,
  STASH_TYPES,
  fetchExchangeOverview,
  fetchLeagues,
  fetchStashOverview,
  slugify,
} from './lib/poeNinja'
import type { DivinationCard, Ladder } from '../src/types'

async function buildExchangeMap(league: string) {
  const merged = new Map<string, number>()
  let divineRate = 0
  for (const type of EXCHANGE_TYPES) {
    const overview = await fetchExchangeOverview(league, type)
    if (type === 'Currency') divineRate = overview.divineRate
    for (const [id, chaosValue] of overview.byId) {
      merged.set(id, chaosValue)
    }
  }
  return { merged, divineRate }
}

async function buildStashMap(league: string) {
  const merged = new Map<string, number>()
  for (const type of STASH_TYPES) {
    const byName = await fetchStashOverview(league, type)
    for (const [name, chaosValue] of byName) {
      merged.set(name, chaosValue)
    }
  }
  return merged
}

function resolveRewardChaosValue(
  card: DivinationCard,
  cardsById: Map<string, number>,
  stashByName: Map<string, number>,
  exchangeById: Map<string, number>,
): number | undefined {
  const nameLower = card.rewardItemName.toLowerCase()

  const stashHit = stashByName.get(nameLower)
  if (stashHit !== undefined) return stashHit

  // belønningen kan være et annet divination card (f.eks. "The Nurse" -> "The Doctor")
  const cardHit = cardsById.get(slugify(card.rewardItemName))
  if (cardHit !== undefined) return cardHit

  const aliasId = CLASSIC_CURRENCY_ALIASES[nameLower]
  const exchangeHit = exchangeById.get(aliasId ?? slugify(card.rewardItemName))
  if (exchangeHit !== undefined) return exchangeHit

  return undefined
}

async function refreshLeague(leagueName: string, ladder: Ladder, allCards: DivinationCard[]) {
  console.log(`[${ladder}] ${leagueName}: henter priser...`)

  const cardOverview = await fetchExchangeOverview(leagueName, 'DivinationCard')
  const { merged: exchangeById, divineRate } = await buildExchangeMap(leagueName)
  const stashByName = await buildStashMap(leagueName)
  const rate = divineRate || cardOverview.divineRate

  let written = 0
  let batch = db.batch()
  let batchCount = 0

  for (const card of allCards) {
    const cardChaosValue = cardOverview.byId.get(card.slug)
    if (cardChaosValue === undefined) continue
    if (card.rewardValueType !== 'fixed') continue

    const rewardChaosValue = resolveRewardChaosValue(
      card,
      cardOverview.byId,
      stashByName,
      exchangeById,
    )
    if (rewardChaosValue === undefined) continue

    const setCost = cardChaosValue * card.stackSize
    const profitChaos = card.rewardQuantity * rewardChaosValue - setCost
    const roiPercent = setCost > 0 ? (profitChaos / setCost) * 100 : 0

    const priceDoc = {
      league: leagueName,
      ladder,
      cardId: card.id,
      cardChaosValue,
      cardDivineValue: cardChaosValue * rate,
      rewardChaosValue,
      rewardDivineValue: rewardChaosValue * rate,
      setCost,
      profitChaos,
      roiPercent,
      capturedAt: new Date().toISOString(),
    }

    batch.set(db.collection('prices').doc(`${leagueName}_${ladder}_${card.id}`), priceDoc)
    batchCount++
    written++

    if (batchCount >= 400) {
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }
  }
  if (batchCount > 0) await batch.commit()

  await db
    .collection('leagues')
    .doc(ladder)
    .set({
      name: leagueName,
      ladder,
      isActive: true,
      capturedAt: new Date().toISOString(),
    })

  console.log(`[${ladder}] ${leagueName}: skrev ${written} prisoppføringer.`)
}

async function main() {
  const leagues = await fetchLeagues()
  const softcore = leagues.find(
    (l) => l.name !== 'Standard' && l.name !== 'Hardcore' && !l.name.startsWith('Hardcore '),
  )
  if (!softcore) throw new Error('Fant ikke gjeldende softcore-league hos poe.ninja')
  const hardcore = leagues.find((l) => l.name === `Hardcore ${softcore.name}`)
  if (!hardcore) throw new Error(`Fant ikke hardcore-motstykke til ${softcore.name}`)

  console.log(`Gjeldende league: ${softcore.name} / ${hardcore.name}`)

  const cardsSnapshot = await db.collection('divination_cards').get()
  const allCards = cardsSnapshot.docs.map((doc) => doc.data() as DivinationCard)
  console.log(`Leste ${allCards.length} kort fra divination_cards.`)

  await refreshLeague(softcore.name, 'softcore', allCards)
  await refreshLeague(hardcore.name, 'hardcore', allCards)

  console.log('Ferdig.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
