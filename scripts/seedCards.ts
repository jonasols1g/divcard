/**
 * Engangs-/vedlikeholdsscript: henter den kanoniske divination card-listen
 * fra poedb.tw (generert fra spillets egne datafiler) og seeder Firestore
 * `divination_cards`-collectionen med statisk referansedata.
 *
 * Kjør på nytt når GGG legger til/fjerner kort (sjelden - typisk rundt nye
 * expansions), ikke på cron sammen med prisoppdateringen.
 *
 * Kjøring: npx tsx scripts/seedCards.ts
 */
import * as cheerio from 'cheerio'
import { db } from './lib/firebaseAdmin'
import { slugify } from './lib/poeNinja'
import type { DivinationCard } from '../src/types'

const POEDB_URL = 'https://poedb.tw/us/Divination_Cards'
const USER_AGENT = 'divcard/1.0 (personlig verktøy; kontakt: jonasolseng@gmail.com)'

const REWARD_CLASSES = [
  'currencyitem',
  'uniqueitem',
  'gemitem',
  'rareitem',
  'whiteitem',
  'magicitem',
  'normal',
] as const

interface ParsedCard {
  name: string
  href: string
  stackSize: number | null
  rewardClass: string | null
  rewardText: string
}

function parsePoedbCards(html: string): ParsedCard[] {
  const $ = cheerio.load(html)
  const selector = REWARD_CLASSES.map((c) => `.explicitMod span.${c}`).join(', ')
  const byHref = new Map<string, ParsedCard>()

  $('a.divination.DivinationCard').each((_, el) => {
    const $el = $(el)
    const name = $el.text().trim()
    if (!name) return // hopp over ikon-lenken (samme href, ingen tekst)
    const href = $el.attr('href')
    if (!href) return

    const $container = $el.parent()
    const propText = $container.find('.property').first().text().trim()
    const stackMatch = propText.match(/Stack Size:\s*\d+\s*\/\s*(\d+)/)
    const stackSize = stackMatch ? parseInt(stackMatch[1], 10) : null

    const explicitModEl = $container.find('.explicitMod').first()
    const rewardSpan = explicitModEl.find(selector).first()
    const rewardClass = rewardSpan.attr('class') ?? null
    const rewardText = rewardSpan.length
      ? rewardSpan.text().trim()
      : explicitModEl.text().trim()

    const entry: ParsedCard = { name, href, stackSize, rewardClass, rewardText }
    const existing = byHref.get(href)
    if (!existing) {
      byHref.set(href, entry)
      return
    }
    // Siden listes noen kort flere ganger på siden (varianter/gjentakelser),
    // behold oppføringen med mest komplett data.
    const score = (e: ParsedCard) => (e.stackSize ? 2 : 0) + (e.rewardClass ? 1 : 0)
    if (score(entry) > score(existing)) byHref.set(href, entry)
  })

  return Array.from(byHref.values())
}

function parseReward(
  parsed: ParsedCard,
  allCardNames: Set<string>,
): Pick<DivinationCard, 'rewardItemName' | 'rewardQuantity' | 'rewardValueType'> {
  const { rewardClass, rewardText } = parsed

  // Generisk/tilfeldig "Map" (uansett rarity-klasse) - ikke en spesifikk unik map.
  if (rewardText === 'Map' || rewardText === 'Divination Card') {
    return { rewardItemName: rewardText, rewardQuantity: 1, rewardValueType: 'variable' }
  }

  if (rewardClass === 'currencyitem') {
    const match = rewardText.match(/^(\d+)x\s+(.+)$/)
    return {
      rewardItemName: match ? match[2] : rewardText,
      rewardQuantity: match ? parseInt(match[1], 10) : 1,
      rewardValueType: 'fixed',
    }
  }

  if (rewardClass === 'uniqueitem' || rewardClass === 'gemitem') {
    return { rewardItemName: rewardText, rewardQuantity: 1, rewardValueType: 'fixed' }
  }

  if (rewardClass === 'rareitem' || rewardClass === 'whiteitem' || rewardClass === 'magicitem' || rewardClass === 'normal') {
    // Rare/magic/normal-rarity bases har vilkårlige affikser - ingen fast pris.
    return { rewardItemName: rewardText, rewardQuantity: 1, rewardValueType: 'variable' }
  }

  // rewardClass === null: enten "Disabled" (filtrert bort før dette kalles),
  // eller belønningen er selve navnet på et ANNET divination card.
  if (allCardNames.has(rewardText)) {
    return { rewardItemName: rewardText, rewardQuantity: 1, rewardValueType: 'fixed' }
  }

  return { rewardItemName: rewardText || 'Ukjent', rewardQuantity: 1, rewardValueType: 'unknown' }
}

async function main() {
  console.log(`Henter ${POEDB_URL} ...`)
  const res = await fetch(POEDB_URL, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`poedb.tw svarte ${res.status}`)
  const html = await res.text()

  const parsed = parsePoedbCards(html)
  console.log(`Fant ${parsed.length} kort-oppføringer på poedb.`)

  const active = parsed.filter((c) => c.rewardText !== 'Disabled' && c.rewardText !== '')
  console.log(`${parsed.length - active.length} kort er "Disabled"/uten data og hoppes over.`)

  const allCardNames = new Set(active.map((c) => c.name))

  const cards: DivinationCard[] = active.map((p) => {
    const reward = parseReward(p, allCardNames)
    const slug = slugify(p.name)
    return {
      id: slug,
      slug,
      name: p.name,
      stackSize: p.stackSize ?? -1,
      wikiUrl: `https://poedb.tw/us/${p.href}`,
      ...reward,
      // manglende stackSize kan ikke prises uansett - overstyr til 'unknown'
      rewardValueType: p.stackSize === null ? 'unknown' : reward.rewardValueType,
    }
  })

  const missingStack = cards.filter((c) => c.stackSize === -1)
  if (missingStack.length > 0) {
    console.warn(
      `Advarsel: ${missingStack.length} kort mangler stack size hos poedb og er markert 'unknown':`,
      missingStack.map((c) => c.name).join(', '),
    )
  }

  console.log(`Skriver ${cards.length} kort til Firestore (divination_cards)...`)
  const batchSize = 400
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = db.batch()
    for (const card of cards.slice(i, i + batchSize)) {
      batch.set(db.collection('divination_cards').doc(card.id), card)
    }
    await batch.commit()
    console.log(`  ... ${Math.min(i + batchSize, cards.length)}/${cards.length}`)
  }

  const byValueType = {
    fixed: cards.filter((c) => c.rewardValueType === 'fixed').length,
    variable: cards.filter((c) => c.rewardValueType === 'variable').length,
    unknown: cards.filter((c) => c.rewardValueType === 'unknown').length,
  }
  console.log('Ferdig.', byValueType)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
