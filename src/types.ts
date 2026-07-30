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
}

export interface CardRow extends DivinationCard {
  price?: PriceSnapshot
}
