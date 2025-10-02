// Poker game utilities and engine implementing full Texas Hold'em flow

const SUITS = ['?', '?', '?', '?']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const HAND_RANK_LABELS = {
  1: 'High Card',
  2: 'One Pair',
  3: 'Two Pair',
  4: 'Three of a Kind',
  5: 'Straight',
  6: 'Flush',
  7: 'Full House',
  8: 'Four of a Kind',
  9: 'Straight Flush'
}

const AI_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack']

function generateCombinations(items, k) {
  const indices = []
  const results = []

  function backtrack(start, depth) {
    if (depth === k) {
      results.push(indices.map((index) => items[index]))
      return
    }

    for (let i = start; i <= items.length - (k - depth); i++) {
      indices[depth] = i
      backtrack(i + 1, depth + 1)
    }
  }

  if (items.length >= k) {
    backtrack(0, 0)
  }

  return results
}

function detectStraight(values) {
  let unique = [...new Set(values)].sort((a, b) => b - a)
  if (unique.includes(14)) {
    unique = unique.concat(1) // Treat Ace as low for wheel straights
  }

  for (let i = 0; i <= unique.length - 5; i++) {
    let streak = 1
    for (let j = i; j < unique.length - 1 && streak < 5; j++) {
      if (unique[j] - 1 === unique[j + 1]) {
        streak += 1
      } else {
        break
      }
    }

    if (streak === 5) {
      const high = unique[i] === 1 ? 5 : unique[i]
      return { isStraight: true, highCard: high }
    }
  }

  return { isStraight: false, highCard: null }
}

function evaluateFiveCardHand(cards) {
  const sorted = [...cards].sort((a, b) => b.value - a.value)
  const values = sorted.map((card) => card.value)

  const suitCounts = new Map()
  const valueCounts = new Map()

  for (const card of sorted) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1)
    valueCounts.set(card.value, (valueCounts.get(card.value) || 0) + 1)
  }

  const isFlush = suitCounts.size === 1
  const straightInfo = detectStraight(values)
  const groups = [...valueCounts.entries()].map(([value, count]) => ({
    value: Number(value),
    count
  }))

  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.value - a.value
  })

  let rank = 1
  let rankValues = []
  let rankName = HAND_RANK_LABELS[rank]

  if (isFlush && straightInfo.isStraight) {
    rank = 9
    rankValues = [straightInfo.highCard]
    rankName = straightInfo.highCard === 14 ? 'Royal Flush' : HAND_RANK_LABELS[rank]
  } else if (groups[0].count === 4) {
    const quadValue = groups[0].value
    const kicker = groups[1].value
    rank = 8
    rankValues = [quadValue, kicker]
    rankName = HAND_RANK_LABELS[rank]
  } else if (groups[0].count === 3 && groups[1]?.count === 2) {
    rank = 7
    rankValues = [groups[0].value, groups[1].value]
    rankName = HAND_RANK_LABELS[rank]
  } else if (isFlush) {
    rank = 6
    rankValues = values
    rankName = HAND_RANK_LABELS[rank]
  } else if (straightInfo.isStraight) {
    rank = 5
    rankValues = [straightInfo.highCard]
    rankName = HAND_RANK_LABELS[rank]
  } else if (groups[0].count === 3) {
    const kickers = sorted.filter((card) => card.value !== groups[0].value).map((card) => card.value)
    rank = 4
    rankValues = [groups[0].value, ...kickers]
    rankName = HAND_RANK_LABELS[rank]
  } else if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairValues = [groups[0].value, groups[1].value].sort((a, b) => b - a)
    const kicker = sorted.find((card) => card.value !== pairValues[0] && card.value !== pairValues[1])?.value || 0
    rank = 3
    rankValues = [...pairValues, kicker]
    rankName = HAND_RANK_LABELS[rank]
  } else if (groups[0].count === 2) {
    const kickerValues = sorted.filter((card) => card.value !== groups[0].value).map((card) => card.value)
    rank = 2
    rankValues = [groups[0].value, ...kickerValues]
    rankName = HAND_RANK_LABELS[rank]
  } else {
    rank = 1
    rankValues = values
    rankName = HAND_RANK_LABELS[rank]
  }

  return {
    rank,
    values: rankValues,
    rankName,
    cards: sorted
  }
}

function compareHandRanks(first, second) {
  if (first.rank !== second.rank) {
    return first.rank - second.rank
  }

  const maxLength = Math.max(first.values.length, second.values.length)
  for (let i = 0; i < maxLength; i++) {
    const a = first.values[i] ?? 0
    const b = second.values[i] ?? 0
    if (a !== b) {
      return a - b
    }
  }

  return 0
}

function evaluateBestHand(cards) {
  const combos = generateCombinations(cards, 5)
  let best = null

  for (const combo of combos) {
    const evaluation = evaluateFiveCardHand(combo)
    if (!best || compareHandRanks(evaluation, best) > 0) {
      best = {
        ...evaluation,
        cards: evaluation.cards
      }
    }
  }

  return best
}

export class Card {
  constructor(suit, rank) {
    this.suit = suit
    this.rank = rank
    this.value = Card.getValue(rank)
  }

  static getValue(rank) {
    if (rank === 'A') return 14
    if (rank === 'K') return 13
    if (rank === 'Q') return 12
    if (rank === 'J') return 11
    return parseInt(rank, 10)
  }

  toString() {
    return `${this.suit}${this.rank}`
  }
}

export class Deck {
  constructor() {
    this.cards = []
    this.reset()
  }

  reset() {
    this.cards = []

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(suit, rank))
      }
    }

    this.shuffle()
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]
    }
  }

  deal() {
    return this.cards.pop()
  }

  getRemaining() {
    return this.cards.length
  }
}

function getPlayerSnapshot(player, phase) {
  const shouldRevealCards = phase === 'showdown'

  return {
    id: player.id,
    name: player.name,
    chips: player.chips,
    currentBet: player.currentBet,
    totalBet: player.totalBet,
    folded: player.folded,
    allIn: player.allIn,
    active: player.active,
    isAI: player.isAI || false,
    lastAction: player.lastAction,
    cards: player.cards.map((card) => ({
      suit: card.suit,
      rank: card.rank,
      revealed: shouldRevealCards
    })),
    bestHand: shouldRevealCards && player.bestHand
      ? {
          rank: player.bestHand.rank,
          rankName: player.bestHand.rankName,
          values: player.bestHand.values,
          cards: player.bestHand.cards.map((card) => ({ suit: card.suit, rank: card.rank }))
        }
      : null
  }
}

export class PokerGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId
    this.smallBlind = options.smallBlind || 10
    this.bigBlind = options.bigBlind || 20
    this.maxPlayers = options.maxPlayers || 6
    this.desiredSeatCount = Math.min(
      this.maxPlayers,
      Math.max(3, options.desiredSeatCount || this.maxPlayers)
    )

    this.players = []
    this.deck = new Deck()
    this.communityCards = []
    this.pot = 0
    this.currentBet = 0
    this.minimumRaiseAmount = this.bigBlind
    this.currentPlayerIndex = -1
    this.dealerIndex = 0
    this.phase = 'waiting'
    this.gameStarted = false
    this.gameFinished = false
    this.lastAction = null
    this.smallBlindIndex = -1
    this.bigBlindIndex = -1
    this.actionHistory = []
    this.latestResults = null
  }

  addPlayer(player) {
    if (this.players.length >= this.maxPlayers) {
      return false
    }

    if (this.players.some((existing) => existing.id === player.id)) {
      return false
    }

    const initialChips = Number.isFinite(player.chips) ? player.chips : 1000

    this.players.push({
      id: player.id,
      name: player.name,
      chips: initialChips,
      socketId: player.socketId ?? null,
      cards: [],
      currentBet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      active: true,
      isAI: player.isAI || false,
      lastAction: null,
      hasActedThisRound: false,
      handRank: null,
      bestHand: null,
      initialChips
    })

    return true
  }

  addAIPlayer() {
    const aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const aiIndex = this.players.filter((player) => player.isAI).length
    const name = `AI ${AI_NAMES[aiIndex % AI_NAMES.length]}`

    return this.addPlayer({
      id: aiId,
      name,
      chips: 1000,
      socketId: null,
      isAI: true
    })
  }

  removeAIPlayer() {
    for (let i = this.players.length - 1; i >= 0; i--) {
      if (this.players[i].isAI) {
        this.players.splice(i, 1)
        return true
      }
    }
    return false
  }

  countRealPlayers() {
    return this.players.filter((player) => !player.isAI).length
  }

  setDesiredSeatCount(count) {
    const realPlayers = this.countRealPlayers()
    const sanitized = Math.max(realPlayers, Math.max(3, Math.min(this.maxPlayers, count)))
    this.desiredSeatCount = sanitized

    return {
      success: true,
      desiredSeatCount: this.desiredSeatCount
    }
  }

  syncAIPlayers() {
    if (this.gameStarted) {
      return
    }

    if (!this.singlePlayerMode) {
      return
    }

    const target = this.desiredSeatCount

    while (this.players.length < target) {
      if (!this.addAIPlayer()) {
        break
      }
    }

    while (this.players.length > target) {
      if (!this.removeAIPlayer()) {
        break
      }
    }
  }

  removePlayer(playerId) {
    const index = this.players.findIndex((player) => player.id === playerId)
    if (index === -1) {
      return false
    }

    this.players.splice(index, 1)

    if (this.gameStarted && index <= this.currentPlayerIndex) {
      this.currentPlayerIndex = Math.max(0, this.currentPlayerIndex - 1)
    }

    return true
  }

  startGame() {
    const activeCount = this.players.filter((player) => player.active !== false).length
    if (activeCount < 2) {
      return { success: false, error: 'At least 2 players are required to start the game' }
    }

    if (this.gameStarted) {
      return { success: false, error: 'Game has already started' }
    }

    this.gameStarted = true
    this.latestResults = null
    this.beginHand()

    return { success: true }
  }

  beginHand() {
    this.ensureDealerIndex()
    this.deck.reset()
    this.communityCards = []
    this.pot = 0
    this.currentBet = 0
    this.minimumRaiseAmount = this.bigBlind
    this.phase = 'preflop'
    this.gameFinished = false
    this.currentPlayerIndex = -1
    this.smallBlindIndex = -1
    this.bigBlindIndex = -1
    this.actionHistory = []
    this.lastAction = null
    this.latestResults = null

    this.players.forEach((player) => {
      player.cards = []
      player.currentBet = 0
      player.totalBet = 0
      player.folded = player.chips <= 0
      player.allIn = player.chips <= 0
      player.active = player.chips > 0 || player.active
      player.hasActedThisRound = player.allIn || player.folded || !player.active
      player.lastAction = null
      player.handRank = null
      player.bestHand = null
      player.initialChips = player.chips
    })

    this.dealHoleCards()
    this.postBlinds()
    this.currentPlayerIndex = this.determineFirstToAct('preflop')

    if (this.currentPlayerIndex === -1) {
      this.advancePhase()
    }
  }

  startNextHand() {
    const activePlayers = this.players.filter((player) => player.active && player.chips > 0)
    if (activePlayers.length < 2) {
      this.gameStarted = false
      this.gameFinished = true
      return { success: false, error: 'Not enough players to start a new hand' }
    }

    this.advanceDealer()
    this.beginHand()

    return { success: true, gameState: this.getGameState() }
  }

  ensureDealerIndex() {
    if (this.players.length === 0) {
      this.dealerIndex = 0
      return
    }

    const dealer = this.players[this.dealerIndex]
    if (!dealer || !dealer.active || dealer.chips <= 0) {
      const next = this.players.findIndex((player) => player.active && player.chips > 0)
      this.dealerIndex = next === -1 ? 0 : next
    }
  }

  advanceDealer() {
    if (this.players.length === 0) {
      this.dealerIndex = 0
      return
    }

    const nextDealer = this.findNextIndex(this.dealerIndex, (player) => player.active && player.chips > 0)
    if (nextDealer !== -1) {
      this.dealerIndex = nextDealer
    }
  }

  dealHoleCards() {
    const startIndex = this.findNextIndex(this.dealerIndex, (player) => player.active && player.chips > 0, true)
    if (startIndex === -1) {
      return
    }

    for (let round = 0; round < 2; round++) {
      let index = startIndex
      for (let count = 0; count < this.players.length; count++) {
        const player = this.players[index]
        if (player && player.active && player.chips > 0) {
          player.cards.push(this.deck.deal())
        }
        index = (index + 1) % this.players.length
      }
    }
  }

  postBlinds() {
    const activeIndices = this.players
      .map((player, idx) => ({ player, idx }))
      .filter(({ player }) => player.active && player.chips > 0)

    if (activeIndices.length < 2) {
      return
    }

    if (activeIndices.length === 2) {
      // Heads-up: dealer posts small blind, other posts big blind
      const dealerIndex = this.dealerIndex
      const dealerPlayer = this.players[dealerIndex]
      if (!dealerPlayer.active || dealerPlayer.chips === 0) {
        this.ensureDealerIndex()
      }

      this.smallBlindIndex = this.dealerIndex
      this.bigBlindIndex = activeIndices.find(({ idx }) => idx !== this.smallBlindIndex)?.idx ?? this.smallBlindIndex
    } else {
      this.smallBlindIndex = this.findNextIndex(this.dealerIndex, (player) => player.active && player.chips > 0)
      this.bigBlindIndex = this.findNextIndex(this.smallBlindIndex, (player) => player.active && player.chips > 0)
    }

    if (this.smallBlindIndex !== -1) {
      const player = this.players[this.smallBlindIndex]
      const amount = Math.min(this.smallBlind, player.chips)
      const paid = this.playerBet(player, amount)
      player.lastAction = {
        action: 'small_blind',
        type: 'small_blind',
        playerId: player.id,
        playerName: player.name,
        amount: paid,
        phase: this.phase,
        timestamp: Date.now()
      }
      player.hasActedThisRound = false
    }

    if (this.bigBlindIndex !== -1) {
      const player = this.players[this.bigBlindIndex]
      const amount = Math.min(this.bigBlind, player.chips)
      const paid = this.playerBet(player, amount)
      player.lastAction = {
        action: 'big_blind',
        type: 'big_blind',
        playerId: player.id,
        playerName: player.name,
        amount: paid,
        phase: this.phase,
        timestamp: Date.now()
      }
      player.hasActedThisRound = false
      this.currentBet = Math.max(this.currentBet, player.currentBet)
    }

    this.minimumRaiseAmount = this.bigBlind
  }

  findNextIndex(startIndex, predicate, includeStart = false) {
    if (this.players.length === 0) {
      return -1
    }

    const total = this.players.length
    for (let step = includeStart ? 0 : 1; step <= total; step++) {
      const idx = (startIndex + step + total) % total
      const player = this.players[idx]
      if (predicate(player, idx)) {
        return idx
      }
    }

    return -1
  }

  determineFirstToAct(phase) {
    const eligible = (player) =>
      player && player.active && !player.folded && !player.allIn && player.chips > 0

    const activeIndices = this.players
      .map((player, idx) => ({ player, idx }))
      .filter(({ player }) => player.active && !player.folded)

    if (activeIndices.length === 0) {
      return -1
    }

    if (phase === 'preflop') {
      if (activeIndices.length === 2) {
        const sbIndex = this.smallBlindIndex !== -1 ? this.smallBlindIndex : this.dealerIndex
        if (eligible(this.players[sbIndex])) {
          return sbIndex
        }
        return this.findNextIndex(sbIndex, eligible)
      }

      const bbIndex = this.bigBlindIndex !== -1 ? this.bigBlindIndex : this.findNextIndex(this.dealerIndex, (player) => player.active && player.chips > 0)
      return this.findNextIndex(bbIndex, eligible)
    }

    return this.findNextIndex(this.dealerIndex, eligible)
  }

  playerBet(player, amount) {
    const actual = Math.min(amount, player.chips)
    if (actual <= 0) {
      return 0
    }

    player.chips -= actual
    player.currentBet += actual
    player.totalBet += actual
    this.pot += actual

    if (player.chips === 0) {
      player.allIn = true
      player.hasActedThisRound = true
    }

    return actual
  }

  handlePlayerAction(playerId, rawAction, rawAmount = 0) {
    if (!this.gameStarted || this.gameFinished) {
      return { success: false, error: 'Game is not in progress' }
    }

    const action = (rawAction || '').toLowerCase()
    const amount = Number.isFinite(rawAmount) ? rawAmount : Number(rawAmount) || 0

    const player = this.players.find((p) => p.id === playerId)
    if (!player || !player.active) {
      return { success: false, error: 'Invalid player' }
    }

    if (player.folded) {
      return { success: false, error: 'Player has already folded' }
    }

    if (player.allIn) {
      return { success: false, error: 'Player is all-in' }
    }

    const currentPlayer = this.players[this.currentPlayerIndex]
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, error: 'Not your turn' }
    }

    let result

    switch (action) {
      case 'fold':
        result = this.handleFold(player)
        break
      case 'check':
        result = this.handleCheck(player)
        break
      case 'call':
        result = this.handleCall(player)
        break
      case 'bet':
      case 'raise':
        result = this.handleRaise(player, amount)
        break
      case 'all_in':
      case 'all-in':
        result = this.handleAllIn(player)
        break
      default:
        return { success: false, error: 'Invalid action' }
    }

    if (!result.success) {
      return result
    }

    const summary = {
      action: result.action,
      type: result.action,
      playerId: player.id,
      playerName: player.name,
      amount: result.amount || 0,
      totalBet: player.currentBet,
      phase: this.phase,
      timestamp: Date.now()
    }

    player.lastAction = summary
    player.hasActedThisRound = true
    this.lastAction = summary
    this.actionHistory.push(summary)

    const remainingPlayers = this.players.filter((p) => p.active && !p.folded)
    if (remainingPlayers.length <= 1) {
      this.finishHandByFold(remainingPlayers[0])
      return { success: true, action: summary }
    }

    const roundComplete = this.isRoundComplete()

    if (result.requiresResponse) {
      this.resetActionFlagsExcept(player.id)
    }

    if (this.gameFinished) {
      return { success: true, action: summary }
    }

    if (roundComplete) {
      this.advancePhase()
    } else {
      this.nextPlayer()
    }

    if (!this.gameFinished && this.players.filter((p) => p.active && !p.folded).length <= 1) {
      this.finishHandByFold(this.players.find((p) => p.active && !p.folded))
    }

    return { success: true, action: summary }
  }

  handleFold(player) {
    player.folded = true
    player.hasActedThisRound = true
    return { success: true, action: 'fold' }
  }

  handleCheck(player) {
    if (this.currentBet > player.currentBet) {
      return { success: false, error: 'Cannot check when facing a bet' }
    }

    return { success: true, action: 'check' }
  }

  handleCall(player) {
    const callAmount = Math.max(0, this.currentBet - player.currentBet)
    if (callAmount === 0) {
      return this.handleCheck(player)
    }

    const paid = this.playerBet(player, callAmount)
    return {
      success: true,
      action: 'call',
      amount: paid,
      requiresResponse: false
    }
  }

  handleRaise(player, declaredAmount) {
    const previousHighest = this.currentBet
    const amountToInvest = Math.max(0, Number(declaredAmount) || 0)
    const actualAmount = Math.min(amountToInvest, player.chips)
    const targetTotal = player.currentBet + actualAmount

    if (actualAmount <= 0) {
      return { success: false, error: 'Invalid raise amount' }
    }

    if (targetTotal <= previousHighest) {
      return { success: false, error: 'Raise must exceed current bet' }
    }

    const raiseSize = targetTotal - previousHighest
    const minimumRaise = previousHighest === 0 ? this.bigBlind : this.minimumRaiseAmount

    const isAllIn = actualAmount === player.chips
    if (raiseSize < minimumRaise && !isAllIn) {
      return { success: false, error: `Minimum raise is ${minimumRaise}` }
    }

    const paid = this.playerBet(player, actualAmount)
    this.currentBet = Math.max(this.currentBet, player.currentBet)

    if (targetTotal > previousHighest) {
      if (raiseSize >= minimumRaise) {
        this.minimumRaiseAmount = raiseSize
      }
    }

    return {
      success: true,
      action: previousHighest === 0 ? 'bet' : 'raise',
      amount: paid,
      requiresResponse: true
    }
  }
  handleAllIn(player) {
    const amount = player.chips
    if (amount <= 0) {
      return { success: false, error: 'No chips remaining' }
    }

    const paid = this.playerBet(player, amount)
    const previousHighest = this.currentBet
    this.currentBet = Math.max(this.currentBet, player.currentBet)

    const raiseSize = this.currentBet - previousHighest
    if (raiseSize > 0) {
      if (raiseSize >= this.minimumRaiseAmount) {
        this.minimumRaiseAmount = raiseSize
      }
    }

    return {
      success: true,
      action: 'all_in',
      amount: paid,
      requiresResponse: raiseSize > 0 && raiseSize >= this.minimumRaiseAmount
    }
  }

  resetActionFlagsExcept(playerId) {
    this.players.forEach((player) => {
      if (player.id === playerId) {
        player.hasActedThisRound = true
        return
      }

      if (!player.active || player.folded) {
        player.hasActedThisRound = true
        return
      }

      if (player.allIn || player.chips === 0) {
        player.hasActedThisRound = true
        return
      }

      player.hasActedThisRound = false
    })
  }

  nextPlayer() {
    const nextIndex = this.findNextIndex(this.currentPlayerIndex, (player) =>
      player && player.active && !player.folded && !player.allIn && player.chips > 0
    )

    this.currentPlayerIndex = nextIndex
  }

  isRoundComplete() {
    const activePlayers = this.players.filter((player) => player.active && !player.folded)

    if (activePlayers.length <= 1) {
      return true
    }

    const actionable = activePlayers.filter((player) => !player.allIn && player.chips > 0)
    if (actionable.length === 0) {
      return true
    }

    const unmatched = actionable.filter((player) => player.currentBet !== this.currentBet)
    if (unmatched.length > 0) {
      return false
    }

    return actionable.every((player) => player.hasActedThisRound)
  }

  resetForNextBettingRound() {
    this.players.forEach((player) => {
      player.currentBet = 0
      player.hasActedThisRound = player.allIn || player.folded || !player.active
      if (player.allIn && player.chips === 0) {
        player.hasActedThisRound = true
      }
    })

    this.currentBet = 0
    this.minimumRaiseAmount = this.bigBlind
  }

  advancePhase() {
    if (this.gameFinished) {
      return
    }

    const nextPhaseMap = {
      preflop: 'flop',
      flop: 'turn',
      turn: 'river',
      river: 'showdown'
    }

    let nextPhase = nextPhaseMap[this.phase] || 'showdown'
    this.phase = nextPhase

    if (this.phase === 'flop') {
      this.deck.deal() // Burn card
      for (let i = 0; i < 3; i++) {
        this.communityCards.push(this.deck.deal())
      }
    } else if (this.phase === 'turn' || this.phase === 'river') {
      this.deck.deal()
      this.communityCards.push(this.deck.deal())
    }

    if (this.phase === 'showdown') {
      this.resolveShowdown()
      return
    }

    this.resetForNextBettingRound()
    this.currentPlayerIndex = this.determineFirstToAct(this.phase)

    if (this.currentPlayerIndex === -1) {
      this.advancePhase()
    }
  }

  finishHandByFold(winner) {
    if (!winner) {
      this.gameFinished = true
      this.phase = 'showdown'
      return
    }

    const totalPot = this.pot
    winner.chips += this.pot
    this.pot = 0

    this.players.forEach((player) => {
      player.bestHand = null
      player.handRank = null
      player.currentBet = 0
    })

    this.latestResults = {
      pot: totalPot,
      winners: [
        {
          id: winner.id,
          name: winner.name,
          chipsWon: totalPot,
          finalChips: winner.chips,
          hand: null,
          reason: 'all_folded'
        }
      ],
      winner: {
        id: winner.id,
        name: winner.name,
        chipsWon: totalPot,
        finalChips: winner.chips,
        hand: null,
        reason: 'all_folded'
      },
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        finalChips: player.chips,
        chipsChange: player.chips - player.initialChips,
        folded: player.folded,
        isAI: player.isAI || false
      }))
    }

    this.gameFinished = true
    this.phase = 'showdown'
    this.currentPlayerIndex = -1
  }

  resolveShowdown() {
    const contestants = this.players.filter((player) => player.active && !player.folded)

    if (contestants.length === 0) {
      this.finishHandByFold(null)
      return
    }

    contestants.forEach((player) => {
      const allCards = player.cards.concat(this.communityCards)
      if (allCards.length >= 5) {
        const evaluation = evaluateBestHand(allCards)
        player.bestHand = evaluation
        player.handRank = evaluation
      }
    })

    const contributions = this.players.map((player, idx) => ({
      idx,
      player,
      remaining: player.totalBet
    }))

    const pots = []
    let totalPotAccounted = 0

    while (true) {
      const remainingPlayers = contributions.filter((entry) => entry.remaining > 0)
      if (remainingPlayers.length === 0) {
        break
      }

      const level = Math.min(...remainingPlayers.map((entry) => entry.remaining))
      const participants = contributions.filter((entry) => entry.remaining > 0)
      const eligible = participants
        .filter((entry) => {
          const player = entry.player
          return player.active && !player.folded
        })
        .map((entry) => entry.idx)

      const potAmount = level * participants.length
      totalPotAccounted += potAmount

      pots.push({
        amount: potAmount,
        participants: participants.map((entry) => entry.idx),
        eligible
      })

      participants.forEach((entry) => {
        entry.remaining -= level
      })
    }

    const payouts = new Map()

    pots.forEach((pot) => {
      const eligiblePlayers = pot.eligible
        .map((idx) => this.players[idx])
        .filter((player) => player && !player.folded)

      if (eligiblePlayers.length === 0) {
        return
      }

      let best = eligiblePlayers[0]
      for (let i = 1; i < eligiblePlayers.length; i++) {
        const candidate = eligiblePlayers[i]
        if (compareHandRanks(candidate.bestHand, best.bestHand) > 0) {
          best = candidate
        }
      }

      const winners = eligiblePlayers.filter(
        (player) => compareHandRanks(player.bestHand, best.bestHand) === 0
      )

      const share = Math.floor(pot.amount / winners.length)
      let remainder = pot.amount - share * winners.length

      const sortedWinners = [...winners].sort(
        (a, b) => this.players.indexOf(a) - this.players.indexOf(b)
      )

      sortedWinners.forEach((winner) => {
        let totalShare = share
        if (remainder > 0) {
          totalShare += 1
          remainder -= 1
        }

        winner.chips += totalShare
        payouts.set(winner.id, (payouts.get(winner.id) || 0) + totalShare)
      })
    })

    this.pot = Math.max(0, this.pot - totalPotAccounted)
    if (this.pot > 0) {
      // In case of rounding issues, distribute leftover to best hand
      const remainingContestants = contestants.slice().sort((a, b) => compareHandRanks(b.bestHand, a.bestHand))
      const recipient = remainingContestants[0]
      recipient.chips += this.pot
      payouts.set(recipient.id, (payouts.get(recipient.id) || 0) + this.pot)
      this.pot = 0
    }

    const winnersDetailed = [...payouts.entries()].map(([playerId, chipsWon]) => {
      const player = this.players.find((p) => p.id === playerId)
      return {
        id: player.id,
        name: player.name,
        chipsWon,
        finalChips: player.chips,
        hand: player.bestHand
          ? {
              rank: player.bestHand.rank,
              rankName: player.bestHand.rankName,
              cards: player.bestHand.cards.map((card) => ({ suit: card.suit, rank: card.rank }))
            }
          : null
      }
    })

    winnersDetailed.sort((a, b) => b.chipsWon - a.chipsWon)

    const totalPot = this.players.reduce((sum, player) => sum + (player.totalBet || 0), 0)

    this.latestResults = {
      pot: totalPot,
      winners: winnersDetailed,
      winner: winnersDetailed[0] || null,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        finalChips: player.chips,
        chipsChange: player.chips - player.initialChips,
        folded: player.folded,
        isAI: player.isAI || false,
        bestHand: player.bestHand
          ? {
              rank: player.bestHand.rank,
              rankName: player.bestHand.rankName,
              cards: player.bestHand.cards.map((card) => ({ suit: card.suit, rank: card.rank }))
            }
          : null
      }))
    }

    this.gameFinished = true
    this.phase = 'showdown'
    this.currentPlayerIndex = -1
  }
  getAIAction(player) {
    const callAmount = Math.max(0, this.currentBet - player.currentBet)
    const random = Math.random()

    const handStrength = this.calculateHandStrength(player)
    const potOdds = callAmount === 0 ? 0 : callAmount / (this.pot + callAmount)
    const position = this.getPlayerPosition(player)

    if (player.chips <= callAmount) {
      return handStrength > 0.45 ? { action: 'all_in' } : { action: 'fold' }
    }

    if (callAmount === 0) {
      if (handStrength > 0.7) {
        const raiseAmount = Math.min(player.chips, Math.max(this.bigBlind, Math.floor(this.pot * (0.4 + random * 0.4))))
        return { action: 'raise', amount: raiseAmount }
      }

      if (handStrength > 0.4) {
        if (random < 0.3) {
          return { action: 'raise', amount: Math.min(player.chips, this.bigBlind * 2) }
        }
        return { action: 'check' }
      }

      return { action: 'check' }
    }

    if (handStrength > 0.75) {
      if (random < 0.6) {
        const raiseAmount = Math.min(player.chips, Math.floor((this.currentBet - player.currentBet) + this.minimumRaiseAmount + this.pot * 0.2))
        return { action: 'raise', amount: Math.max(raiseAmount, this.minimumRaiseAmount) }
      }
      return { action: 'call' }
    }

    if (handStrength > 0.5) {
      if (potOdds < handStrength - 0.1) {
        return { action: 'call' }
      }
      return random < 0.5 ? { action: 'call' } : { action: 'fold' }
    }

    if (handStrength > 0.3) {
      if (callAmount <= this.bigBlind && random < 0.4) {
        return { action: 'call' }
      }
      return { action: 'fold' }
    }

    if (position === 'late' && random < 0.15) {
      return { action: 'call' }
    }

    return { action: 'fold' }
  }

  calculateHandStrength(player) {
    if (!player.cards || player.cards.length === 0) {
      return 0
    }

    const allCards = player.cards.concat(this.communityCards)
    if (allCards.length < 5) {
      const [card1, card2] = player.cards
      if (!card1 || !card2) {
        return 0
      }

      if (card1.value === card2.value) {
        if (card1.value >= 12) return 0.75
        if (card1.value >= 9) return 0.6
        return 0.45
      }

      const highCard = Math.max(card1.value, card2.value)
      const suited = card1.suit === card2.suit
      const connected = Math.abs(card1.value - card2.value) === 1

      let strength = highCard / 20
      if (suited) strength += 0.1
      if (connected) strength += 0.05
      return Math.min(0.6, strength)
    }

    const bestHand = evaluateBestHand(allCards)

    const rankStrength = {
      9: 0.95,
      8: 0.9,
      7: 0.8,
      6: 0.7,
      5: 0.6,
      4: 0.5,
      3: 0.4,
      2: 0.3,
      1: 0.2
    }

    return rankStrength[bestHand.rank] || 0.3
  }

  getPlayerPosition(player) {
    const index = this.players.findIndex((p) => p.id === player.id)
    if (index === -1) {
      return 'early'
    }

    const activeOrder = []
    for (let i = 0; i < this.players.length; i++) {
      const idx = (this.dealerIndex + i + 1) % this.players.length
      const candidate = this.players[idx]
      if (candidate.active && !candidate.folded) {
        activeOrder.push(candidate.id)
      }
    }

    const positionIndex = activeOrder.indexOf(player.id)
    if (positionIndex === -1) {
      return 'early'
    }

    if (positionIndex <= Math.floor(activeOrder.length / 3)) {
      return 'early'
    }

    if (positionIndex <= Math.floor((activeOrder.length * 2) / 3)) {
      return 'middle'
    }

    return 'late'
  }

  processAIAction() {
    if (this.currentPlayerIndex === -1 || this.gameFinished) {
      return null
    }

    const player = this.players[this.currentPlayerIndex]
    if (!player || !player.isAI || player.folded || !player.active || player.allIn) {
      return null
    }

    const decision = this.getAIAction(player)

    const actionType = decision.action
    const amount = decision.amount ?? 0

    const result = this.handlePlayerAction(player.id, actionType, amount)
    if (!result.success) {
      player.folded = true
      player.lastAction = {
        action: 'fold',
        type: 'fold',
        playerId: player.id,
        playerName: player.name,
        amount: 0,
        phase: this.phase,
        timestamp: Date.now()
      }
      this.lastAction = player.lastAction
      this.actionHistory.push(player.lastAction)
      if (!this.gameFinished) {
        this.nextPlayer()
      }
      return {
        playerId: player.id,
        playerName: player.name,
        actionSummary: player.lastAction,
        gameState: this.getGameState()
      }
    }

    return {
      playerId: player.id,
      playerName: player.name,
      actionSummary: result.action,
      gameState: this.getGameState()
    }
  }

  isGameFinished() {
    if (this.gameFinished) {
      return true
    }

    const activePlayers = this.players.filter((player) => player.active && !player.folded)

    if (this.gameStarted && activePlayers.length <= 1) {
      this.gameFinished = true
      return true
    }

    return false
  }

  getGameResults() {
    if (!this.gameFinished) {
      return null
    }

    return this.latestResults
  }

  evaluateHand(cards) {
    return evaluateBestHand(cards)
  }

  getGameState() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      pot: this.pot,
      currentBet: this.currentBet,
      minRaise: this.minimumRaiseAmount,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      communityCards: this.communityCards.map((card) => ({
        suit: card.suit,
        rank: card.rank,
        revealed: true
      })),
      players: this.players.map((player) => getPlayerSnapshot(player, this.phase)),
      desiredSeatCount: this.desiredSeatCount,
      gameStarted: this.gameStarted,
      gameFinished: this.gameFinished,
      lastAction: this.lastAction
    }
  }

  getPlayers() {
    return this.players.map((player) => ({
      id: player.id,
      name: player.name,
      chips: player.chips,
      active: player.active,
      isAI: player.isAI || false
    }))
  }

  getPlayerCount() {
    return this.players.length
  }
}
