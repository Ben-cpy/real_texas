// Poker card utility class
export class Card {
  constructor(suit, rank) {
    this.suit = suit // ♠ ♥ ♦ ♣
    this.rank = rank // 2-10, J, Q, K, A
    this.value = this.getValue()
  }

  getValue() {
    if (this.rank === 'A') return 14
    if (this.rank === 'K') return 13
    if (this.rank === 'Q') return 12
    if (this.rank === 'J') return 11
    return parseInt(this.rank)
  }

  toString() {
    return `${this.suit}${this.rank}`
  }
}

// Deck class
export class Deck {
  constructor() {
    this.cards = []
    this.reset()
  }

  reset() {
    this.cards = []
    const suits = ['♠', '♥', '♦', '♣']
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    
    for (const suit of suits) {
      for (const rank of ranks) {
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

// Texas Hold'em poker game logic
export class PokerGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId
    this.smallBlind = options.smallBlind || 10
    this.bigBlind = options.bigBlind || 20
    this.maxPlayers = options.maxPlayers || 6
    this.desiredSeatCount = Math.min(this.maxPlayers, Math.max(3, options.desiredSeatCount || this.maxPlayers))
    
    this.players = []
    this.deck = new Deck()
    this.communityCards = []
    this.pot = 0
    this.currentBet = 0
    this.currentPlayerIndex = 0
    this.dealerIndex = 0
    this.phase = 'waiting' // waiting, preflop, flop, turn, river, showdown
    this.gameStarted = false
    this.gameFinished = false
    
    this.actionHistory = []
  }

  // Add player
  addPlayer(player) {
    if (this.players.length >= this.maxPlayers) {
      return false
    }
    
    if (this.players.some(p => p.id === player.id)) {
      return false
    }

    this.players.push({
      id: player.id,
      name: player.name,
      chips: player.chips,
      socketId: player.socketId,
      cards: [],
      currentBet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      active: true,
      isAI: player.isAI || false
    })

    return true
  }

  // Add AI player
  addAIPlayer() {
    const aiNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
    const aiId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const aiIndex = this.players.filter(player => player.isAI).length
    const aiName = aiNames[aiIndex % aiNames.length]
    const aiPlayer = {
      id: aiId,
      name: aiName,
      chips: 1000,
      socketId: null,
      isAI: true
    }
    return this.addPlayer(aiPlayer)
  }

  // Remove AI player
  removeAIPlayer() {
    for (let i = this.players.length - 1; i >= 0; i--) {
      if (this.players[i].isAI) {
        this.players.splice(i, 1)
        return true
      }
    }
    return false
  }

  // Count real players
  countRealPlayers() {
    return this.players.filter(player => !player.isAI).length
  }

  // Set desired seat count
  setDesiredSeatCount(count) {
    const realPlayers = this.countRealPlayers()
    const sanitizedCount = Math.max(realPlayers, Math.max(3, Math.min(this.maxPlayers, count)))
    this.desiredSeatCount = sanitizedCount
    if (!this.gameStarted) {
      this.syncAIPlayers()
    }
    return {
      success: true,
      desiredSeatCount: this.desiredSeatCount
    }
  }

  // Sync AI players based on desired seat count
  syncAIPlayers() {
    if (this.gameStarted) {
      return
    }

    const realPlayers = this.countRealPlayers()
    const targetTotal = Math.max(realPlayers, Math.min(this.desiredSeatCount, this.maxPlayers))

    while (this.players.length > targetTotal) {
      if (!this.removeAIPlayer()) {
        break
      }
    }

    let safety = 0
    while (this.players.length < targetTotal && safety < 10) {
      if (!this.addAIPlayer()) {
        break
      }
      safety += 1
    }
  }

  // Get player count
  getPlayerCount() {
    return this.players.length
  }

  // Get active players list
  getPlayers() {
    return this.players.map(player => ({
      id: player.id,
      name: player.name,
      chips: player.chips,
      isAI: player.isAI || false,
      active: player.active,
      folded: player.folded,
      allIn: player.allIn,
      currentBet: player.currentBet,
      totalBet: player.totalBet
    }))
  }

  // Remove player
  removePlayer(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) return false

    this.players.splice(playerIndex, 1)
    
    // If game is in progress, need to adjust current player index
    if (this.gameStarted && playerIndex <= this.currentPlayerIndex) {
      this.currentPlayerIndex = Math.max(0, this.currentPlayerIndex - 1)
    }

    return true
  }

  // Start game
  startGame() {
    if (this.players.length < 2) {
      return { success: false, error: 'At least 2 players are required to start the game' }
    }

    if (this.gameStarted) {
      return { success: false, error: 'Game has already started' }
    }

    this.gameStarted = true
    this.newHand()
    
    return { success: true }
  }

  // Start new hand
  newHand() {
    this.deck.reset()
    this.communityCards = []
    this.pot = 0
    this.currentBet = 0
    this.phase = 'preflop'
    this.gameFinished = false
    this.actionHistory = []

    // Reset player states
    this.players.forEach(player => {
      player.cards = []
      player.currentBet = 0
      player.totalBet = 0
      player.folded = false
      player.allIn = false
      player.active = player.chips > 0
      player.initialChips = player.chips
      player.handRank = null
      player.lastAction = null
    })

    // Deal hole cards
    this.dealHoleCards()

    // Post blinds
    this.postBlinds()
    
    // Set first action player (after big blind)
    this.currentPlayerIndex = this.getNextActivePlayer((this.dealerIndex + 3) % this.players.length)
  }

  advanceDealer() {
    const eligibleIndices = this.players
      .map((player, idx) => ({ player, idx }))
      .filter(({ player }) => player.chips > 0 && player.active !== false)

    if (eligibleIndices.length === 0) {
      return
    }

    const currentDealerPosition = eligibleIndices.findIndex(({ idx }) => idx === this.dealerIndex)
    const nextPosition = currentDealerPosition === -1
      ? 0
      : (currentDealerPosition + 1) % eligibleIndices.length

    this.dealerIndex = eligibleIndices[nextPosition].idx
  }

  startNextHand() {
    const activePlayers = this.players.filter(player => player.active && player.chips > 0)
    if (activePlayers.length < 2) {
      this.gameStarted = false
      this.gameFinished = true
      return { success: false, error: 'Not enough players to start a new hand' }
    }

    this.advanceDealer()
    this.gameFinished = false
    this.gameStarted = true
    this.newHand()

    return { success: true, gameState: this.getGameState() }
  }

  // Deal hole cards
  dealHoleCards() {
    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        if (player.active) {
          player.cards.push(this.deck.deal())
        }
      }
    }
  }

  // Post blinds
  postBlinds() {
    const activePlayersCount = this.players.filter(p => p.active).length
    if (activePlayersCount < 2) return

    // Small blind
    const smallBlindIndex = (this.dealerIndex + 1) % this.players.length
    const smallBlindPlayer = this.players[smallBlindIndex]
    if (smallBlindPlayer && smallBlindPlayer.active) {
      this.playerBet(smallBlindPlayer, Math.min(this.smallBlind, smallBlindPlayer.chips))
    }

    // Big blind
    const bigBlindIndex = (this.dealerIndex + 2) % this.players.length
    const bigBlindPlayer = this.players[bigBlindIndex]
    if (bigBlindPlayer && bigBlindPlayer.active) {
      this.playerBet(bigBlindPlayer, Math.min(this.bigBlind, bigBlindPlayer.chips))
      this.currentBet = bigBlindPlayer.currentBet
    }
  }

  // Handle player action
  handlePlayerAction(playerId, action, amount = 0) {
    const player = this.players.find(p => p.id === playerId)
    if (!player || !player.active || player.folded) {
      return { success: false, error: 'Invalid player' }
    }

    if (this.players[this.currentPlayerIndex].id !== playerId) {
      return { success: false, error: 'Not your turn' }
    }

    let actionResult = { success: true, action: null }

    switch (action) {
      case 'fold':
        actionResult = this.handleFold(player)
        break
      case 'check':
        actionResult = this.handleCheck(player)
        break
      case 'call':
        actionResult = this.handleCall(player)
        break
      case 'bet':
      case 'raise':
        actionResult = this.handleBet(player, amount)
        break
      case 'all_in':
        actionResult = this.handleAllIn(player)
        break
      default:
        return { success: false, error: 'Invalid action' }
    }

    if (actionResult.success) {
      this.actionHistory.push({
        playerId,
        action,
        amount: actionResult.amount || 0,
        timestamp: Date.now()
      })

      // Move to next player
      this.nextPlayer()
      
      // Check if need to move to next phase
      if (this.isRoundComplete()) {
        this.nextPhase()
      }
    }

    return actionResult
  }

  // Improved AI strategy
  getAIAction(player) {
    const callAmount = this.currentBet - player.currentBet
    const random = Math.random()

    // If out of chips, can only fold or go all-in
    if (player.chips <= callAmount) {
      const handStrength = this.calculateHandStrength(player)
      return handStrength > 0.5 ? { action: 'all_in' } : { action: 'fold' }
    }

    // Calculate hand strength
    const handStrength = this.calculateHandStrength(player)
    const potOdds = callAmount / (this.pot + callAmount)
    const position = this.getPlayerPosition(player)

    // If no need to call (can check)
    if (callAmount === 0) {
      // Strong hand: raise
      if (handStrength > 0.7) {
        const raiseAmount = Math.floor(this.pot * (0.5 + random * 0.5))
        return { action: 'bet', amount: Math.min(raiseAmount, player.chips) }
      }
      // Medium hand: sometimes raise, sometimes check
      if (handStrength > 0.4) {
        if (random < 0.3) {
          return { action: 'bet', amount: this.bigBlind }
        }
        return { action: 'check' }
      }
      // Weak hand: check
      return { action: 'check' }
    }

    // Need to call situations
    // Strong hand: raise
    if (handStrength > 0.75) {
      if (random < 0.7) {
        const raiseAmount = Math.floor(this.currentBet * 2 + this.pot * 0.3)
        return { action: 'bet', amount: Math.min(raiseAmount, player.chips) }
      }
      return { action: 'call' }
    }

    // Medium hand: decide based on pot odds
    if (handStrength > 0.5) {
      if (potOdds < handStrength - 0.1) {
        return { action: 'call' }
      }
      return random < 0.6 ? { action: 'call' } : { action: 'fold' }
    }

    // Low-medium hand: cautious calling
    if (handStrength > 0.3) {
      if (callAmount <= this.bigBlind * 2 && random < 0.5) {
        return { action: 'call' }
      }
      return { action: 'fold' }
    }

    // Weak hand: mostly fold, occasional bluff
    if (position === 'late' && random < 0.15) {
      // Occasional bluff in late position
      return { action: 'call' }
    }

    return { action: 'fold' }
  }

  // Calculate hand strength (0-1, where 1 is strongest)
  calculateHandStrength(player) {
    if (!player.cards || player.cards.length === 0) {
      return 0
    }

    // Evaluate hand using currently visible cards
    const allCards = player.cards.concat(this.communityCards)
    const handRank = this.evaluateHand(allCards)

    // Return strength based on hand rank
    // 9: Straight flush, 8: Four of a kind, 7: Full house, 6: Flush, 5: Straight, 4: Three of a kind, 3: Two pair, 2: One pair, 1: High card
    const rankToStrength = {
      9: 0.95 + Math.random() * 0.05,  // Straight flush: 0.95-1.0
      8: 0.90 + Math.random() * 0.05,  // Four of a kind: 0.90-0.95
      7: 0.80 + Math.random() * 0.10,  // Full house: 0.80-0.90
      6: 0.70 + Math.random() * 0.10,  // Flush: 0.70-0.80
      5: 0.60 + Math.random() * 0.10,  // Straight: 0.60-0.70
      4: 0.50 + Math.random() * 0.10,  // Three of a kind: 0.50-0.60
      3: 0.40 + Math.random() * 0.10,  // Two pair: 0.40-0.50
      2: 0.25 + Math.random() * 0.15,  // One pair: 0.25-0.40
      1: 0.10 + Math.random() * 0.15   // High card: 0.10-0.25
    }

    let strength = rankToStrength[handRank.rank] || 0.2

    // Preflop stage, only consider hole cards
    if (this.communityCards.length === 0) {
      const [card1, card2] = player.cards
      // Pair
      if (card1.value === card2.value) {
        if (card1.value >= 10) strength = 0.8 + Math.random() * 0.1  // High pair
        else if (card1.value >= 7) strength = 0.6 + Math.random() * 0.15
        else strength = 0.4 + Math.random() * 0.15
      }
      // High cards
      else if (card1.value >= 12 || card2.value >= 12) {
        strength = 0.5 + Math.random() * 0.2
      }
      // Suited
      else if (card1.suit === card2.suit) {
        strength += 0.1
      }
      // Connected
      else if (Math.abs(card1.value - card2.value) === 1) {
        strength += 0.05
      }
    }

    return Math.min(strength, 1.0)
  }

  // Get player position (early/middle/late)
  getPlayerPosition(player) {
    const playerIndex = this.players.findIndex(p => p.id === player.id)
    const positionFromDealer = (playerIndex - this.dealerIndex + this.players.length) % this.players.length
    const activePlayers = this.players.filter(p => p.active && !p.folded).length

    if (positionFromDealer <= activePlayers / 3) return 'early'
    if (positionFromDealer <= activePlayers * 2 / 3) return 'middle'
    return 'late'
  }

  // Process AI action
  processAIAction() {
    if (this.currentPlayerIndex === -1 || this.gameFinished) {
      return null
    }
    
    const currentPlayer = this.players[this.currentPlayerIndex]
    if (!currentPlayer || !currentPlayer.isAI || currentPlayer.folded || !currentPlayer.active) {
      return null
    }
    
    console.log(`AI ${currentPlayer.name} starting action, current bet: ${this.currentBet}, player bet: ${currentPlayer.currentBet}`)

    const aiDecision = this.getAIAction(currentPlayer)
    console.log(`AI decision: ${aiDecision.action}, amount: ${aiDecision.amount || 0}`)
    
    const result = this.handlePlayerAction(currentPlayer.id, aiDecision.action, aiDecision.amount)
    
    if (result.success) {
      console.log(`AI action successful: ${aiDecision.action}`)
      return {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        action: aiDecision.action,
        amount: result.amount || aiDecision.amount || 0,
        gameState: this.getGameState()
      }
    } else {
      console.log(`AI action failed: ${result.error}`)
    }
    
    return null
  }

  // Fold
  handleFold(player) {
    player.folded = true
    return { 
      success: true, 
      action: { type: 'fold', player: player.name }
    }
  }

  // Check
  handleCheck(player) {
    if (this.currentBet > player.currentBet) {
      return { success: false, error: 'Cannot check, there is a current bet' }
    }
    
    return { 
      success: true, 
      action: { type: 'check', player: player.name }
    }
  }

  // Call
  handleCall(player) {
    const callAmount = this.currentBet - player.currentBet
    if (callAmount <= 0) {
      return this.handleCheck(player)
    }

    const actualAmount = Math.min(callAmount, player.chips)
    this.playerBet(player, actualAmount)
    
    return { 
      success: true, 
      amount: actualAmount,
      action: { type: 'call', player: player.name, amount: actualAmount }
    }
  }

  // Bet/Raise
  handleBet(player, amount) {
    const minBet = this.currentBet > 0 ? this.currentBet * 2 : this.bigBlind
    const maxBet = player.chips
    
    if (amount < minBet && amount < maxBet) {
      return { success: false, error: `Minimum bet amount is ${minBet}` }
    }

    if (amount > maxBet) {
      amount = maxBet
    }

    const totalBet = player.currentBet + amount
    this.playerBet(player, amount)
    this.currentBet = Math.max(this.currentBet, totalBet)
    
    return { 
      success: true, 
      amount,
      action: { type: 'bet', player: player.name, amount }
    }
  }

  // All-in
  handleAllIn(player) {
    const amount = player.chips
    this.playerBet(player, amount)
    player.allIn = true
    
    const totalBet = player.currentBet
    this.currentBet = Math.max(this.currentBet, totalBet)
    
    return { 
      success: true, 
      amount,
      action: { type: 'all_in', player: player.name, amount }
    }
  }

  // Player bet
  playerBet(player, amount) {
    const actualAmount = Math.min(amount, player.chips)
    player.chips -= actualAmount
    player.currentBet += actualAmount
    player.totalBet += actualAmount
    this.pot += actualAmount

    if (player.chips === 0) {
      player.allIn = true
    }
  }

  // Next player
  nextPlayer() {
    this.currentPlayerIndex = this.getNextActivePlayer(this.currentPlayerIndex + 1)
  }

  // Get next active player
  getNextActivePlayer(startIndex) {
    for (let i = 0; i < this.players.length; i++) {
      const index = (startIndex + i) % this.players.length
      const player = this.players[index]
      if (player.active && !player.folded && !player.allIn) {
        return index
      }
    }
    return -1
  }

  // Check if round is complete
  isRoundComplete() {
    const activePlayers = this.players.filter(p => p.active && !p.folded)
    
    if (activePlayers.length <= 1) {
      return true
    }

    // Check if all active players have bet the same amount or are all-in
    const nonAllInPlayers = activePlayers.filter(p => !p.allIn)
    if (nonAllInPlayers.length === 0) {
      return true
    }

    const currentBetAmount = this.currentBet
    return nonAllInPlayers.every(p => p.currentBet === currentBetAmount)
  }

  // Move to next phase
  nextPhase() {
    // Reset player current bets
    this.players.forEach(player => {
      player.currentBet = 0
    })
    this.currentBet = 0

    switch (this.phase) {
      case 'preflop':
        this.phase = 'flop'
        this.dealFlop()
        break
      case 'flop':
        this.phase = 'turn'
        this.dealTurn()
        break
      case 'turn':
        this.phase = 'river'
        this.dealRiver()
        break
      case 'river':
        this.phase = 'showdown'
        this.showdown()
        return
    }

    // Set first action player for next round (first active player after dealer)
    this.currentPlayerIndex = this.getNextActivePlayer(this.dealerIndex + 1)
  }

  // Deal flop
  dealFlop() {
    this.deck.deal() // Burn one card
    for (let i = 0; i < 3; i++) {
      this.communityCards.push(this.deck.deal())
    }
  }

  // Deal turn
  dealTurn() {
    this.deck.deal() // Burn one card
    this.communityCards.push(this.deck.deal())
  }

  // Deal river
  dealRiver() {
    this.deck.deal() // Burn one card
    this.communityCards.push(this.deck.deal())
  }

  // Showdown
  showdown() {
    const activePlayers = this.players.filter(p => p.active && !p.folded)

    if (activePlayers.length === 1) {
      // Only one player left, they win directly
      const winner = activePlayers[0]
      winner.chips += this.pot
      this.gameFinished = true
      return
    }

    // Evaluate all players' hands
    activePlayers.forEach(player => {
      player.handRank = this.evaluateHand(player.cards.concat(this.communityCards))
    })

    // Determine winner
    activePlayers.sort((a, b) => this.compareHands(b.handRank, a.handRank))
    const winner = activePlayers[0]

    // Distribute pot
    winner.chips += this.pot
    this.gameFinished = true
  }

  // Evaluate hand strength (simplified version)
  evaluateHand(cards) {
    // This is a simplified hand evaluation, more complex algorithms needed in production
    // Higher return value means stronger hand
    const values = cards.map(c => c.value).sort((a, b) => b - a)

    // Check for flush
    const suits = cards.map(c => c.suit)
    const isFlush = suits.some(suit => suits.filter(s => s === suit).length >= 5)

    // Check for straight
    const isStraight = this.checkStraight(values)

    // Check for pairs, three of a kind, etc.
    const counts = this.countValues(values)
    const countValues = Object.values(counts).sort((a, b) => b - a)

    if (isFlush && isStraight) return { rank: 9, values } // Straight flush
    if (countValues[0] === 4) return { rank: 8, values } // Four of a kind
    if (countValues[0] === 3 && countValues[1] === 2) return { rank: 7, values } // Full house
    if (isFlush) return { rank: 6, values } // Flush
    if (isStraight) return { rank: 5, values } // Straight
    if (countValues[0] === 3) return { rank: 4, values } // Three of a kind
    if (countValues[0] === 2 && countValues[1] === 2) return { rank: 3, values } // Two pair
    if (countValues[0] === 2) return { rank: 2, values } // One pair

    return { rank: 1, values } // High card
  }

  checkStraight(values) {
    const uniqueValues = [...new Set(values)].sort((a, b) => b - a)

    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      let consecutive = 1
      for (let j = i; j < uniqueValues.length - 1 && consecutive < 5; j++) {
        if (uniqueValues[j] - 1 === uniqueValues[j + 1]) {
          consecutive += 1
        } else if (uniqueValues[j] !== uniqueValues[j + 1]) {
          break
        }
      }

      if (consecutive >= 5) {
        return true
      }
    }

    if (uniqueValues.includes(14)) {
      const wheel = [5, 4, 3, 2]
      if (wheel.every(value => uniqueValues.includes(value))) {
        return true
      }
    }

    return false
  }

  countValues(values) {
    return values.reduce((acc, value) => {
      acc[value] = (acc[value] || 0) + 1
      return acc
    }, {})
  }

  compareHands(hand1, hand2) {
    if (hand1.rank !== hand2.rank) {
      return hand1.rank - hand2.rank
    }
    
    // If hand ranks are the same, compare specific values
    for (let i = 0; i < Math.min(hand1.values.length, hand2.values.length); i++) {
      if (hand1.values[i] !== hand2.values[i]) {
        return hand1.values[i] - hand2.values[i]
      }
    }
    
    return 0
  }

  // Get game state
  getGameState() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      communityCards: this.communityCards.map(card => ({
        suit: card.suit,
        rank: card.rank,
        revealed: true
      })),
      players: this.players.map(player => ({
        id: player.id,
        name: player.name,
        chips: player.chips,
        currentBet: player.currentBet,
        folded: player.folded,
        allIn: player.allIn,
        active: player.active,
        isAI: player.isAI || false,
        cards: player.cards.map(card => ({
          suit: card.suit,
          rank: card.rank
        }))
      })),
      desiredSeatCount: this.desiredSeatCount,
      gameStarted: this.gameStarted,
      gameFinished: this.gameFinished
    }
  }

  // Get player list
  getPlayers() {
    return this.players.map(player => ({
      id: player.id,
      name: player.name,
      chips: player.chips,
      active: player.active,
      isAI: player.isAI || false
    }))
  }

  // 获取玩家数量
  getPlayerCount() {
    return this.players.length
  }

  // Check if game is finished
  isGameFinished() {
    if (this.gameFinished) {
      return true
    }

    const activePlayers = this.players.filter(player => player.active && !player.folded)

    if (activePlayers.length <= 1 && this.gameStarted) {
      this.gameFinished = true
      return true
    }

    return false
  }

  // Get game results
  getGameResults() {
    if (!this.gameFinished) return null

    const activePlayers = this.players.filter(p => p.active && !p.folded)
    let winner = null

    if (activePlayers.length === 1) {
      winner = activePlayers[0]
    } else {
      // Find player with strongest hand
      activePlayers.forEach(player => {
        if (!player.handRank) {
          player.handRank = this.evaluateHand(player.cards.concat(this.communityCards))
        }
      })
      
      activePlayers.sort((a, b) => this.compareHands(b.handRank, a.handRank))
      winner = activePlayers[0]
    }

    const winnerInfo = {
      id: winner.id,
      name: winner.name,
      chips: winner.chips
    }

    return {
      winner: winnerInfo,
      winners: [winnerInfo],
      pot: this.pot,
      players: this.players.map(player => ({
        id: player.id,
        name: player.name,
        finalChips: player.chips,
        chipsChange: player.chips - (player.initialChips || 0),
        folded: player.folded,
        isAI: player.isAI || false
      }))
    }
  }
}