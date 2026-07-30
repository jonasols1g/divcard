/**
 * Tynn client for poe.ninjas offentlige (men udokumenterte/stabile-i-praksis)
 * economy-endepunkter. Verifisert manuelt mot live poe.ninja-trafikk:
 *
 * - Leagues:          /poe1/api/economy/leagues
 * - Bulk exchange:    /poe1/api/economy/exchange/current/overview?type=X&league=Y
 *                      (divination cards, currency, fragments, scarabs, essences,
 *                      oils, delirium orbs, omens, artifacts, allflame embers -
 *                      alt som er "bulk-tradeable" via PoEs Currency Exchange)
 * - Stash listings:   /poe1/api/economy/stash/current/item/overview?type=X&league=Y
 *                      (unique items, maps, gems - alt som fortsatt kun listes
 *                      individuelt i stash tabs)
 *
 * Legacy `poe.ninja/api/data/itemoverview`-endepunktet (brukt av eldre
 * community-verktøy/dokumentasjon) er dødt på dagens poe.ninja.
 *
 * Merk: poe.ninja sin Cloudflare-beskyttelse blokkerer (403) Node sin
 * innebygde `fetch` basert på TLS-fingerprint, men slipper gjennom vanlig
 * `curl`. Vi shell'er derfor ut til `curl` for disse kallene i stedet for
 * å bruke fetch direkte.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const USER_AGENT = 'Mozilla/5.0 (compatible; divcard/1.0; personlig verktoy)'

async function fetchJson<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync(
    'curl',
    ['-s', '-A', USER_AGENT, '-H', 'Accept: application/json', '--fail', url],
    { maxBuffer: 100 * 1024 * 1024 },
  )
  return JSON.parse(stdout) as T
}

export interface PoeNinjaLeague {
  id: string
  name: string
}

export async function fetchLeagues(): Promise<PoeNinjaLeague[]> {
  return fetchJson<PoeNinjaLeague[]>('https://poe.ninja/poe1/api/economy/leagues')
}

interface ExchangeLine {
  id: string
  primaryValue: number
}

interface ExchangeItemMeta {
  id: string
  name: string
  /** relativ sti - prefiks med https://web.poecdn.com */
  image?: string
}

interface ExchangeOverviewResponse {
  core: { rates: { divine: number } }
  lines: ExchangeLine[]
  items: ExchangeItemMeta[]
}

export interface ExchangeOverview {
  /** chaos -> divine kurs, dvs. divineValue = chaosValue * divineRate */
  divineRate: number
  /** id (slug) -> pris i chaos */
  byId: Map<string, number>
  /** id (slug) -> ikon-URL (kun tilgjengelig for enkelte kategorier, f.eks. Currency) */
  iconById: Map<string, string>
}

export const EXCHANGE_TYPES = [
  'DivinationCard',
  'Currency',
  'Fragment',
  'Scarab',
  'Essence',
  'Oil',
  'DeliriumOrb',
  'Omen',
  'Artifact',
  'AllflameEmber',
] as const

export async function fetchExchangeOverview(
  league: string,
  type: string,
): Promise<ExchangeOverview> {
  const url = `https://poe.ninja/poe1/api/economy/exchange/current/overview?type=${encodeURIComponent(type)}&league=${encodeURIComponent(league)}`
  const data = await fetchJson<ExchangeOverviewResponse>(url)
  const byId = new Map<string, number>()
  for (const line of data.lines) {
    byId.set(line.id, line.primaryValue)
  }
  const iconById = new Map<string, string>()
  for (const item of data.items) {
    if (item.image) iconById.set(item.id, `https://web.poecdn.com${item.image}`)
  }
  return { divineRate: data.core.rates.divine, byId, iconById }
}

interface RawModifier {
  text: string
  optional: boolean
}

export interface StashLine {
  name: string
  chaosValue: number
  /** kun satt når item har lenker (våpen/rustning) */
  links?: number
  /** kun satt (og true) for corrupted gems - poe.ninja sporer ikke corrupted for vanlige uniques */
  corrupted?: boolean
  /** kun satt for skill gems */
  gemLevel?: number
  listingCount: number
  icon?: string
  flavourText?: string
  explicitModifiers?: RawModifier[]
  implicitModifiers?: RawModifier[]
}

interface StashOverviewResponse {
  lines: StashLine[]
}

export const STASH_TYPES = [
  'UniqueWeapon',
  'UniqueArmour',
  'UniqueAccessory',
  'UniqueFlask',
  'UniqueJewel',
  'UniqueMap',
  'UniqueRelic',
  'ClusterJewel',
  'Map',
  'BlightedMap',
  'BlightRavagedMap',
  'SkillGem',
] as const

export async function fetchStashOverview(league: string, type: string): Promise<StashLine[]> {
  const url = `https://poe.ninja/poe1/api/economy/stash/current/item/overview?type=${encodeURIComponent(type)}&league=${encodeURIComponent(league)}`
  const data = await fetchJson<StashOverviewResponse>(url)
  return data.lines
}

/**
 * poe.ninja bruker fulle kebab-case-slugs av visningsnavnet for de aller
 * fleste bulk-exchange-kategorier (Scarab, Essence, Fragment, Oil, osv), men
 * et lite knippe "klassiske" basisvalutaer har korte, historiske id-er
 * (chaos, divine, exalted, jewellers, ...) som ikke kan utledes fra navnet.
 * Denne tabellen dekker dem; alt annet slugifiseres.
 */
export const CLASSIC_CURRENCY_ALIASES: Record<string, string> = {
  'orb of alchemy': 'alch',
  'alchemy shard': 'alchemy-shard',
  'orb of alteration': 'alt',
  'ancient orb': 'ancient-orb',
  "awakener's orb": 'awakeners-orb',
  "glassblower's bauble": 'bauble',
  'blessed orb': 'blessed',
  'orb of chance': 'chance',
  'chaos orb': 'chaos',
  'chromatic orb': 'chrome',
  'divine orb': 'divine',
  'exalted orb': 'exalted',
  'orb of fusing': 'fusing',
  "gemcutter's prism": 'gcp',
  "hinekora's lock": 'hinekoras-lock',
  "jeweller's orb": 'jewellers',
  'mirror of kalandra': 'mirror',
  'mirror shard': 'mirror-shard',
  "maven's orb": 'mavens-orb',
  'portal scroll': 'portal',
  'regal orb': 'regal',
  'orb of regret': 'regret',
  'orb of scouring': 'scour',
  "armourer's scrap": 'scrap',
  'stacked deck': 'stacked-deck',
  'orb of transmutation': 'transmute',
  'vaal orb': 'vaal',
  "blacksmith's whetstone": 'whetstone',
  'scroll of wisdom': 'wisdom',
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
