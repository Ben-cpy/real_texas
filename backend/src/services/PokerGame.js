// 扑克牌工具类
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

// 牌堆类
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

// 德州扑克游戏逻辑
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

  // 添加玩家
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

  // 添加AI玩家
  addAIPlayer() {
    const aiId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const aiIndex = this.players.filter(player => player.isAI).length + 1
    const aiPlayer = {
      id: aiId,
      name: `AI玩家${aiIndex}`,
      chips: 1000,
      socketId: null,
      isAI: true
    }
    return this.addPlayer(aiPlayer)
  }

  // 移除AI玩家
  removeAIPlayer() {
    for (let i = this.players.length - 1; i >= 0; i--) {
      if (this.players[i].isAI) {
        this.players.splice(i, 1)
        return true
      }
    }
    return false
  }

  // 统计真实玩家数量
  countRealPlayers() {
    return this.players.filter(player => !player.isAI).length
  }

  // 设置目标玩家数
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

  // 根据目标玩家数同步AI
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

  // 获取玩家数量
  getPlayerCount() {
    return this.players.length
  }

  // 获取活跃玩家列表
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

  // 移除玩家
  removePlayer(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) return false

    this.players.splice(playerIndex, 1)
    
    // 如果游戏进行中，需要调整当前玩家索引
    if (this.gameStarted && playerIndex <= this.currentPlayerIndex) {
      this.currentPlayerIndex = Math.max(0, this.currentPlayerIndex - 1)
    }

    return true
  }

  // 开始游戏
  startGame() {
    if (this.players.length < 2) {
      return { success: false, error: '至少需要2名玩家才能开始游戏' }
    }

    if (this.gameStarted) {
      return { success: false, error: '游戏已经开始' }
    }

    this.gameStarted = true
    this.newHand()
    
    return { success: true }
  }

  // 开始新一手牌
  newHand() {
    this.deck.reset()
    this.communityCards = []
    this.pot = 0
    this.currentBet = 0
    this.phase = 'preflop'
    this.gameFinished = false
    this.actionHistory = []

    // 重置玩家状态
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

    // 发底牌
    this.dealHoleCards()
    
    // 下盲注
    this.postBlinds()
    
    // 设置第一个行动玩家（大盲注后一位）
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
      return { success: false, error: '没有足够的玩家开始新一局' }
    }

    this.advanceDealer()
    this.gameFinished = false
    this.gameStarted = true
    this.newHand()

    return { success: true, gameState: this.getGameState() }
  }

  // 发底牌
  dealHoleCards() {
    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        if (player.active) {
          player.cards.push(this.deck.deal())
        }
      }
    }
  }

  // 下盲注
  postBlinds() {
    const activePlayersCount = this.players.filter(p => p.active).length
    if (activePlayersCount < 2) return

    // 小盲注
    const smallBlindIndex = (this.dealerIndex + 1) % this.players.length
    const smallBlindPlayer = this.players[smallBlindIndex]
    if (smallBlindPlayer && smallBlindPlayer.active) {
      this.playerBet(smallBlindPlayer, Math.min(this.smallBlind, smallBlindPlayer.chips))
    }

    // 大盲注
    const bigBlindIndex = (this.dealerIndex + 2) % this.players.length
    const bigBlindPlayer = this.players[bigBlindIndex]
    if (bigBlindPlayer && bigBlindPlayer.active) {
      this.playerBet(bigBlindPlayer, Math.min(this.bigBlind, bigBlindPlayer.chips))
      this.currentBet = bigBlindPlayer.currentBet
    }
  }

  // 处理玩家行动
  handlePlayerAction(playerId, action, amount = 0) {
    const player = this.players.find(p => p.id === playerId)
    if (!player || !player.active || player.folded) {
      return { success: false, error: '无效的玩家' }
    }

    if (this.players[this.currentPlayerIndex].id !== playerId) {
      return { success: false, error: '不是您的回合' }
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
        return { success: false, error: '无效的行动' }
    }

    if (actionResult.success) {
      this.actionHistory.push({
        playerId,
        action,
        amount: actionResult.amount || 0,
        timestamp: Date.now()
      })

      // 移动到下一个玩家
      this.nextPlayer()
      
      // 检查是否需要进入下一阶段
      if (this.isRoundComplete()) {
        this.nextPhase()
      }
    }

    return actionResult
  }

  // 改进的AI策略
  getAIAction(player) {
    const callAmount = this.currentBet - player.currentBet
    const random = Math.random()

    // 如果没钱了，只能弃牌或全押
    if (player.chips <= callAmount) {
      const handStrength = this.calculateHandStrength(player)
      return handStrength > 0.5 ? { action: 'all_in' } : { action: 'fold' }
    }

    // 计算手牌强度
    const handStrength = this.calculateHandStrength(player)
    const potOdds = callAmount / (this.pot + callAmount)
    const position = this.getPlayerPosition(player)

    // 如果不需要跟注（可以过牌）
    if (callAmount === 0) {
      // 强牌：加注
      if (handStrength > 0.7) {
        const raiseAmount = Math.floor(this.pot * (0.5 + random * 0.5))
        return { action: 'bet', amount: Math.min(raiseAmount, player.chips) }
      }
      // 中等牌：有时加注，有时过牌
      if (handStrength > 0.4) {
        if (random < 0.3) {
          return { action: 'bet', amount: this.bigBlind }
        }
        return { action: 'check' }
      }
      // 弱牌：过牌
      return { action: 'check' }
    }

    // 需要跟注的情况
    // 强牌：加注
    if (handStrength > 0.75) {
      if (random < 0.7) {
        const raiseAmount = Math.floor(this.currentBet * 2 + this.pot * 0.3)
        return { action: 'bet', amount: Math.min(raiseAmount, player.chips) }
      }
      return { action: 'call' }
    }

    // 中等牌：根据赔率决定
    if (handStrength > 0.5) {
      if (potOdds < handStrength - 0.1) {
        return { action: 'call' }
      }
      return random < 0.6 ? { action: 'call' } : { action: 'fold' }
    }

    // 中下牌：谨慎跟注
    if (handStrength > 0.3) {
      if (callAmount <= this.bigBlind * 2 && random < 0.5) {
        return { action: 'call' }
      }
      return { action: 'fold' }
    }

    // 弱牌：大多数情况弃牌，偶尔诈唬
    if (position === 'late' && random < 0.15) {
      // 后位偶尔诈唬
      return { action: 'call' }
    }

    return { action: 'fold' }
  }

  // 计算手牌强度（0-1之间，1最强）
  calculateHandStrength(player) {
    if (!player.cards || player.cards.length === 0) {
      return 0
    }

    // 使用当前可见的牌评估手牌
    const allCards = player.cards.concat(this.communityCards)
    const handRank = this.evaluateHand(allCards)

    // 根据牌型等级返回强度
    // 9: 同花顺, 8: 四条, 7: 葫芦, 6: 同花, 5: 顺子, 4: 三条, 3: 两对, 2: 一对, 1: 高牌
    const rankToStrength = {
      9: 0.95 + Math.random() * 0.05,  // 同花顺: 0.95-1.0
      8: 0.90 + Math.random() * 0.05,  // 四条: 0.90-0.95
      7: 0.80 + Math.random() * 0.10,  // 葫芦: 0.80-0.90
      6: 0.70 + Math.random() * 0.10,  // 同花: 0.70-0.80
      5: 0.60 + Math.random() * 0.10,  // 顺子: 0.60-0.70
      4: 0.50 + Math.random() * 0.10,  // 三条: 0.50-0.60
      3: 0.40 + Math.random() * 0.10,  // 两对: 0.40-0.50
      2: 0.25 + Math.random() * 0.15,  // 一对: 0.25-0.40
      1: 0.10 + Math.random() * 0.15   // 高牌: 0.10-0.25
    }

    let strength = rankToStrength[handRank.rank] || 0.2

    // preflop阶段，只看手牌
    if (this.communityCards.length === 0) {
      const [card1, card2] = player.cards
      // 对子
      if (card1.value === card2.value) {
        if (card1.value >= 10) strength = 0.8 + Math.random() * 0.1  // 大对子
        else if (card1.value >= 7) strength = 0.6 + Math.random() * 0.15
        else strength = 0.4 + Math.random() * 0.15
      }
      // 高牌
      else if (card1.value >= 12 || card2.value >= 12) {
        strength = 0.5 + Math.random() * 0.2
      }
      // 同花
      else if (card1.suit === card2.suit) {
        strength += 0.1
      }
      // 连牌
      else if (Math.abs(card1.value - card2.value) === 1) {
        strength += 0.05
      }
    }

    return Math.min(strength, 1.0)
  }

  // 获取玩家位置（早/中/晚）
  getPlayerPosition(player) {
    const playerIndex = this.players.findIndex(p => p.id === player.id)
    const positionFromDealer = (playerIndex - this.dealerIndex + this.players.length) % this.players.length
    const activePlayers = this.players.filter(p => p.active && !p.folded).length

    if (positionFromDealer <= activePlayers / 3) return 'early'
    if (positionFromDealer <= activePlayers * 2 / 3) return 'middle'
    return 'late'
  }

  // 处理AI行动
  processAIAction() {
    if (this.currentPlayerIndex === -1 || this.gameFinished) {
      return null
    }
    
    const currentPlayer = this.players[this.currentPlayerIndex]
    if (!currentPlayer || !currentPlayer.isAI || currentPlayer.folded || !currentPlayer.active) {
      return null
    }
    
    console.log(`AI ${currentPlayer.name} 开始行动，当前下注: ${this.currentBet}, 玩家下注: ${currentPlayer.currentBet}`)
    
    const aiDecision = this.getAIAction(currentPlayer)
    console.log(`AI决策: ${aiDecision.action}, 金额: ${aiDecision.amount || 0}`)
    
    const result = this.handlePlayerAction(currentPlayer.id, aiDecision.action, aiDecision.amount)
    
    if (result.success) {
      console.log(`AI行动成功: ${aiDecision.action}`)
      return {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        action: aiDecision.action,
        amount: result.amount || aiDecision.amount || 0,
        gameState: this.getGameState()
      }
    } else {
      console.log(`AI行动失败: ${result.error}`)
    }
    
    return null
  }

  // 弃牌
  handleFold(player) {
    player.folded = true
    return { 
      success: true, 
      action: { type: 'fold', player: player.name }
    }
  }

  // 过牌
  handleCheck(player) {
    if (this.currentBet > player.currentBet) {
      return { success: false, error: '无法过牌，当前有下注' }
    }
    
    return { 
      success: true, 
      action: { type: 'check', player: player.name }
    }
  }

  // 跟注
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

  // 下注/加注
  handleBet(player, amount) {
    const minBet = this.currentBet > 0 ? this.currentBet * 2 : this.bigBlind
    const maxBet = player.chips
    
    if (amount < minBet && amount < maxBet) {
      return { success: false, error: `最小下注金额为 ${minBet}` }
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

  // 全押
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

  // 玩家下注
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

  // 下一个玩家
  nextPlayer() {
    this.currentPlayerIndex = this.getNextActivePlayer(this.currentPlayerIndex + 1)
  }

  // 获取下一个活跃玩家
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

  // 检查回合是否完成
  isRoundComplete() {
    const activePlayers = this.players.filter(p => p.active && !p.folded)
    
    if (activePlayers.length <= 1) {
      return true
    }

    // 检查所有活跃玩家是否都下注相同金额或全押
    const nonAllInPlayers = activePlayers.filter(p => !p.allIn)
    if (nonAllInPlayers.length === 0) {
      return true
    }

    const currentBetAmount = this.currentBet
    return nonAllInPlayers.every(p => p.currentBet === currentBetAmount)
  }

  // 进入下一阶段
  nextPhase() {
    // 重置玩家当前下注
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

    // 设置下一轮的第一个行动玩家（庄家后第一个活跃玩家）
    this.currentPlayerIndex = this.getNextActivePlayer(this.dealerIndex + 1)
  }

  // 发翻牌
  dealFlop() {
    this.deck.deal() // 烧一张牌
    for (let i = 0; i < 3; i++) {
      this.communityCards.push(this.deck.deal())
    }
  }

  // 发转牌
  dealTurn() {
    this.deck.deal() // 烧一张牌
    this.communityCards.push(this.deck.deal())
  }

  // 发河牌
  dealRiver() {
    this.deck.deal() // 烧一张牌
    this.communityCards.push(this.deck.deal())
  }

  // 摊牌
  showdown() {
    const activePlayers = this.players.filter(p => p.active && !p.folded)
    
    if (activePlayers.length === 1) {
      // 只有一个玩家，直接获胜
      const winner = activePlayers[0]
      winner.chips += this.pot
      this.gameFinished = true
      return
    }

    // 评估所有玩家的牌力
    activePlayers.forEach(player => {
      player.handRank = this.evaluateHand(player.cards.concat(this.communityCards))
    })

    // 确定获胜者
    activePlayers.sort((a, b) => this.compareHands(b.handRank, a.handRank))
    const winner = activePlayers[0]
    
    // 分配奖池
    winner.chips += this.pot
    this.gameFinished = true
  }

  // 评估牌力（简化版本）
  evaluateHand(cards) {
    // 这里是简化的牌力评估，实际应用中需要更复杂的算法
    // 返回值越大牌力越强
    const values = cards.map(c => c.value).sort((a, b) => b - a)

    // 检查同花
    const suits = cards.map(c => c.suit)
    const isFlush = suits.some(suit => suits.filter(s => s === suit).length >= 5)

    // 检查顺子
    const isStraight = this.checkStraight(values)

    // 检查对子、三条等
    const counts = this.countValues(values)
    const countValues = Object.values(counts).sort((a, b) => b - a)

    if (isFlush && isStraight) return { rank: 9, values } // 同花顺
    if (countValues[0] === 4) return { rank: 8, values } // 四条
    if (countValues[0] === 3 && countValues[1] === 2) return { rank: 7, values } // 葫芦
    if (isFlush) return { rank: 6, values } // 同花
    if (isStraight) return { rank: 5, values } // 顺子
    if (countValues[0] === 3) return { rank: 4, values } // 三条
    if (countValues[0] === 2 && countValues[1] === 2) return { rank: 3, values } // 两对
    if (countValues[0] === 2) return { rank: 2, values } // 一对

    return { rank: 1, values } // 高牌
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
    
    // 如果牌型相同，比较具体数值
    for (let i = 0; i < Math.min(hand1.values.length, hand2.values.length); i++) {
      if (hand1.values[i] !== hand2.values[i]) {
        return hand1.values[i] - hand2.values[i]
      }
    }
    
    return 0
  }

  // 获取游戏状态
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

  // 获取玩家列表
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

  // 检查游戏是否结束
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

  // 获取游戏结果
  getGameResults() {
    if (!this.gameFinished) return null

    const activePlayers = this.players.filter(p => p.active && !p.folded)
    let winner = null

    if (activePlayers.length === 1) {
      winner = activePlayers[0]
    } else {
      // 找到牌力最强的玩家
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