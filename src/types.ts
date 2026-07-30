export type Ladder = 'softcore' | 'hardcore'

export type RewardValueType = 'fixed' | 'variable' | 'unknown'

export interface DivinationCard {
  id: string
  /** kebab-case slug (matcher poe.ninja sin exchange-overview "id" for DivinationCard) */
  slug: string
  name: string
  stackSize: number
  rewardItemName: string
  rewardQuantity: number
  rewardValueType: RewardValueType
  /** påkrevd antall lenker for at reward-oppslaget skal matche riktig variant (f.eks. 6-link) */
  rewardLinks?: number
  /** kun for gemitem: påkrevd gem-nivå (f.eks. 21 for "Level 21 X Gem") */
  rewardGemLevel?: number
  /** reward er corrupted (informativt - brukes til pris-matching kun for gems, poe.ninja sporer ikke corrupted for vanlige uniques) */
  rewardCorrupted?: boolean
  flavourText?: string
  artFilename?: string
  wikiUrl?: string
}

export interface League {
  id: string
  name: string
  ladder: Ladder
  isActive: boolean
  capturedAt: string
}

export interface PriceSnapshot {
  id: string
  league: string
  ladder: Ladder
  cardId: string
  cardChaosValue: number
  cardDivineValue: number
  rewardChaosValue: number
  rewardDivineValue: number
  setCost: number
  profitChaos: number
  roiPercent: number
  capturedAt: string
  rewardIcon?: string
  rewardFlavourText?: string
  rewardExplicitMods?: string[]
  rewardImplicitMods?: string[]
}

export interface CardRow extends DivinationCard {
  price?: PriceSnapshot
}
