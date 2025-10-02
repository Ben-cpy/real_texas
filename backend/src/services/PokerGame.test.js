/**
 * Unit Tests for Poker Game Engine
 */

import { Card, Deck, PokerGame } from './PokerGame.js'

describe('Card Class', () => {
  test('should create a card with correct suit and rank', () => {
    const card = new Card('♠', 'A')
    expect(card.suit).toBe('♠')
    expect(card.rank).toBe('A')
    expect(card.value).toBe(14)
  })

  test('should calculate correct value for face cards', () => {
    expect(new Card('♠', 'K').value).toBe(13)
    expect(new Card('♠', 'Q').value).toBe(12)
    expect(new Card('♠', 'J').value).toBe(11)
  })

  test('should calculate correct value for number cards', () => {
    expect(new Card('♠', '10').value).toBe(10)
    expect(new Card('♠', '5').value).toBe(5)
    expect(new Card('♠', '2').value).toBe(2)
  })

  test('should have correct toString representation', () => {
    const card = new Card('♠', 'A')
    expect(card.toString()).toBe('♠A')
  })
})

describe('Deck Class', () => {
  test('should create a full deck of 52 cards', () => {
    const deck = new Deck()
    expect(deck.cards.length).toBe(52)
  })

  test('should shuffle cards randomly', () => {
    const deck1 = new Deck()
    const deck2 = new Deck()

    // Decks should be different after shuffling (very unlikely to be the same)
    const deck1Str = deck1.cards.map(c => c.toString()).join(',')
    const deck2Str = deck2.cards.map(c => c.toString()).join(',')

    expect(deck1Str).not.toBe(deck2Str)
  })

  test('should deal cards correctly', () => {
    const deck = new Deck()
    const initialCount = deck.cards.length

    const card1 = deck.deal()
    expect(deck.cards.length).toBe(initialCount - 1)
    expect(card1).toBeInstanceOf(Card)

    const card2 = deck.deal()
    expect(deck.cards.length).toBe(initialCount - 2)
    expect(card2).toBeInstanceOf(Card)
    expect(card1).not.toBe(card2)
  })

  test('should reset deck to 52 cards', () => {
    const deck = new Deck()
    deck.deal()
    deck.deal()
    deck.deal()

    deck.reset()
    expect(deck.cards.length).toBe(52)
  })

  test('should get correct remaining cards count', () => {
    const deck = new Deck()
    expect(deck.getRemaining()).toBe(52)

    deck.deal()
    expect(deck.getRemaining()).toBe(51)

    deck.deal()
    deck.deal()
    expect(deck.getRemaining()).toBe(49)
  })
})

describe('PokerGame Class', () => {
  let game

  beforeEach(() => {
    game = new PokerGame('test-room', {
      smallBlind: 10,
      bigBlind: 20,
      maxPlayers: 6
    })
  })

  describe('Player Management', () => {
    test('should add a player successfully', () => {
      const player = {
        id: 'player1',
        name: 'Alice',
        chips: 1000,
        socketId: 'socket1'
      }

      const result = game.addPlayer(player)
      expect(result).toBe(true)
      expect(game.players.length).toBe(1)
      expect(game.players[0].name).toBe('Alice')
    })

    test('should not add duplicate player', () => {
      const player = {
        id: 'player1',
        name: 'Alice',
        chips: 1000,
        socketId: 'socket1'
      }

      game.addPlayer(player)
      const result = game.addPlayer(player)

      expect(result).toBe(false)
      expect(game.players.length).toBe(1)
    })

    test('should not exceed max players', () => {
      for (let i = 0; i < 6; i++) {
        game.addPlayer({
          id: `player${i}`,
          name: `Player ${i}`,
          chips: 1000,
          socketId: `socket${i}`
        })
      }

      const extraPlayer = {
        id: 'player7',
        name: 'Extra',
        chips: 1000,
        socketId: 'socket7'
      }

      const result = game.addPlayer(extraPlayer)
      expect(result).toBe(false)
      expect(game.players.length).toBe(6)
    })

    test('should remove a player successfully', () => {
      game.addPlayer({ id: 'player1', name: 'Alice', chips: 1000, socketId: 'socket1' })
      game.addPlayer({ id: 'player2', name: 'Bob', chips: 1000, socketId: 'socket2' })

      const result = game.removePlayer('player1')
      expect(result).toBe(true)
      expect(game.players.length).toBe(1)
      expect(game.players[0].name).toBe('Bob')
    })

    test('should get correct player count', () => {
      expect(game.getPlayerCount()).toBe(0)

      game.addPlayer({ id: 'player1', name: 'Alice', chips: 1000, socketId: 'socket1' })
      expect(game.getPlayerCount()).toBe(1)

      game.addPlayer({ id: 'player2', name: 'Bob', chips: 1000, socketId: 'socket2' })
      expect(game.getPlayerCount()).toBe(2)
    })

    test('should add AI player successfully', () => {
      game.addAIPlayer()
      expect(game.players.length).toBe(1)
      expect(game.players[0].isAI).toBe(true)
      expect(game.players[0].name).toContain('AI')
    })
  })

  describe('Game Flow', () => {
    beforeEach(() => {
      // Add players for game
      game.addPlayer({ id: 'player1', name: 'Alice', chips: 1000, socketId: 'socket1' })
      game.addPlayer({ id: 'player2', name: 'Bob', chips: 1000, socketId: 'socket2' })
    })

    test('should start game successfully with enough players', () => {
      const result = game.startGame()
      expect(result.success).toBe(true)
      expect(game.gameStarted).toBe(true)
      expect(game.phase).toBe('preflop')
    })

    test('should not start game with less than 2 players', () => {
      const singlePlayerGame = new PokerGame('test-room-2')
      singlePlayerGame.addPlayer({ id: 'player1', name: 'Alice', chips: 1000, socketId: 'socket1' })

      const result = singlePlayerGame.startGame()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('should deal correct number of cards to each player', () => {
      game.startGame()

      game.players.forEach(player => {
        expect(player.cards.length).toBe(2)
        expect(player.cards[0]).toBeInstanceOf(Card)
        expect(player.cards[1]).toBeInstanceOf(Card)
      })
    })

    test('should initialize pot correctly with blinds', () => {
      game.startGame()
      // Small blind (10) + Big blind (20) = 30
      expect(game.pot).toBe(30)
    })

    test('should handle fold action correctly', () => {
      game.startGame()
      const currentPlayer = game.players[game.currentPlayerIndex]

      const result = game.handlePlayerAction(currentPlayer.id, 'fold')
      expect(result.success).toBe(true)
      expect(currentPlayer.folded).toBe(true)
    })

    test('should handle check action when no bet', () => {
      game.startGame()
      game.currentBet = 0
      const currentPlayer = game.players[game.currentPlayerIndex]
      currentPlayer.currentBet = 0

      const result = game.handlePlayerAction(currentPlayer.id, 'check')
      expect(result.success).toBe(true)
    })

    test('should not allow check when there is a bet', () => {
      game.startGame()
      game.currentBet = 100
      const currentPlayer = game.players[game.currentPlayerIndex]

      const result = game.handlePlayerAction(currentPlayer.id, 'check')
      expect(result.success).toBe(false)
    })

    test('should handle call action correctly', () => {
      game.startGame()
      const currentPlayer = game.players[game.currentPlayerIndex]
      const initialChips = currentPlayer.chips

      const result = game.handlePlayerAction(currentPlayer.id, 'call')
      expect(result.success).toBe(true)
      expect(currentPlayer.chips).toBeLessThan(initialChips)
    })

    test('should handle all-in correctly', () => {
      game.startGame()
      const currentPlayer = game.players[game.currentPlayerIndex]
      const initialChips = currentPlayer.chips

      const result = game.handlePlayerAction(currentPlayer.id, 'all_in')
      expect(result.success).toBe(true)
      expect(currentPlayer.chips).toBe(0)
      expect(currentPlayer.allIn).toBe(true)
      expect(game.pot).toBeGreaterThan(30)
    })
  })

  describe('Hand Evaluation', () => {
    test('should correctly identify a pair', () => {
      const cards = [
        new Card('♠', 'A'),
        new Card('♥', 'A'),
        new Card('♣', '7'),
        new Card('♦', '5'),
        new Card('♠', '3')
      ]

      const result = game.evaluateHand(cards)
      expect(result.rank).toBe(2) // One Pair
    })

    test('should correctly identify two pair', () => {
      const cards = [
        new Card('♠', 'A'),
        new Card('♥', 'A'),
        new Card('♣', 'K'),
        new Card('♦', 'K'),
        new Card('♠', '3')
      ]

      const result = game.evaluateHand(cards)
      expect(result.rank).toBe(3) // Two Pair
    })

    test('should correctly identify three of a kind', () => {
      const cards = [
        new Card('♠', 'A'),
        new Card('♥', 'A'),
        new Card('♣', 'A'),
        new Card('♦', 'K'),
        new Card('♠', '3')
      ]

      const result = game.evaluateHand(cards)
      expect(result.rank).toBe(4) // Three of a Kind
    })

    test('should correctly identify a flush', () => {
      const cards = [
        new Card('♠', 'A'),
        new Card('♠', 'K'),
        new Card('♠', '7'),
        new Card('♠', '5'),
        new Card('♠', '3')
      ]

      const result = game.evaluateHand(cards)
      expect(result.rank).toBe(6) // Flush
    })

    test('should correctly identify a full house', () => {
      const cards = [
        new Card('♠', 'A'),
        new Card('♠', 'A'),
        new Card('♠', 'A'),
        new Card('♠', 'K'),
        new Card('♠', 'K')
      ]

      const result = game.evaluateHand(cards)
      expect(result.rank).toBe(7) // Full House
    })

    test('should correctly identify four of a kind', () => {
      const cards = [
        new Card('♠', 'A'),
        new Card('♠', 'A'),
        new Card('♠', 'A'),
        new Card('♠', 'A'),
        new Card('♠', 'K')
      ]

      const result = game.evaluateHand(cards)
      expect(result.rank).toBe(8) // Four of a Kind
    })
  })

  describe('Game State', () => {
    beforeEach(() => {
      game.addPlayer({ id: 'player1', name: 'Alice', chips: 1000, socketId: 'socket1' })
      game.addPlayer({ id: 'player2', name: 'Bob', chips: 1000, socketId: 'socket2' })
    })

    test('should return correct game state', () => {
      game.startGame()
      const state = game.getGameState()

      expect(state.roomId).toBe('test-room')
      expect(state.phase).toBe('preflop')
      expect(state.pot).toBe(30)
      expect(state.currentBet).toBeDefined()
      expect(state.players).toHaveLength(2)
    })

    test('should correctly determine if game is finished', () => {
      expect(game.isGameFinished()).toBe(false)

      game.startGame()
      expect(game.isGameFinished()).toBe(false)

      // Simulate one player folding
      const player1 = game.players[0]
      player1.folded = true

      expect(game.isGameFinished()).toBe(true)
    })
  })

  describe('AI Decision Making', () => {
    beforeEach(() => {
      game.addAIPlayer()
    })

    test('AI should make a decision', () => {
      const aiPlayer = game.players[0]
      const decision = game.getAIAction(aiPlayer)

      expect(decision).toBeDefined()
      expect(decision.action).toBeDefined()
      expect(['fold', 'check', 'call', 'bet', 'all_in']).toContain(decision.action)
    })

    test('AI with no chips should fold or all-in', () => {
      const aiPlayer = game.players[0]
      aiPlayer.chips = 0
      game.currentBet = 100

      const decision = game.getAIAction(aiPlayer)
      expect(['fold', 'all_in']).toContain(decision.action)
    })

    test('AI should calculate hand strength', () => {
      const aiPlayer = game.players[0]
      aiPlayer.cards = [
        new Card('♠', 'A'),
        new Card('♠', 'A')
      ]
      game.communityCards = []

      const strength = game.calculateHandStrength(aiPlayer)
      expect(strength).toBeGreaterThan(0.7) // Pocket aces should be strong
      expect(strength).toBeLessThanOrEqual(1)
    })
  })
})

