<template>
  <div class="game-screen" :class="[`phase-${gameStore.gamePhase}`]">
    <header class="top-bar">
      <div class="room-info">
        <h1>Texas Hold'em</h1>
        <div class="meta-row">
          <span class="meta-pill">Room {{ displayRoomId }}</span>
          <span class="meta-pill">Blinds ${{ gameStore.smallBlind }}/{{ gameStore.bigBlind }}</span>
          <span class="meta-pill">{{ gameStore.players.length }} / {{ maxSeatLimit }} players</span>
        </div>
        <div class="meta-row secondary">
          <span class="meta-pill">Dealer: {{ dealerName }}</span>
          <span class="meta-pill">Phase: {{ phaseLabel }}</span>
          <span class="meta-pill" v-if="gameStore.currentBet > 0">Current bet ${{ gameStore.currentBet }}</span>
        </div>
      </div>

      <div class="control-cluster">
        <button class="btn icon-btn" @click="toggleSound" :aria-pressed="soundEnabled" title="Toggle Sound">
          <span aria-hidden="true">{{ soundEnabled ? '🔊' : '🔇' }}</span>
          <span class="sr-only">{{ soundEnabled ? 'Disable sound' : 'Enable sound' }}</span>
        </button>
        <button class="btn icon-btn" @click="showHelp" title="Game Rules & Help">
          <span>❓</span>
        </button>
        <button class="btn" @click="resetGame" v-if="gameStore.gamePhase !== 'waiting'">Restart</button>
        <button class="btn danger" @click="leaveGame">Leave</button>
      </div>

      <div class="account-panel">
        <div class="account-name">
          <span>{{ userStore.username }}</span>
          <small>ID: {{ userStore.user?.id || '?' }}</small>
        </div>
        <div class="account-chips">${{ formattedChips }}</div>
        <div class="account-stats">
          <span>Games {{ userStore.gamesPlayed }}</span>
          <span>Wins {{ userStore.gamesWon }}</span>
          <span>Win rate {{ userStore.winRate }}%</span>
        </div>
      </div>
    </header>

    <div class="round-indicator" aria-live="polite">
      <div class="round-chip">
        <span class="round-phase">{{ phaseLabel }}</span>
        <span v-if="phaseDescription" class="round-detail">{{ phaseDescription }}</span>
      </div>
    </div>

    <transition name="phase-banner">
      <div v-if="showPhaseBanner" class="phase-banner">
        <div class="phase-banner-content">
          <h2>{{ phaseBannerText }}</h2>
          <p v-if="phaseBannerSubtext">{{ phaseBannerSubtext }}</p>
        </div>
      </div>
    </transition>

    <transition name="modal">
      <div v-if="showHelpDialog" class="modal-overlay" @click="closeHelp">
        <div class="modal-content" @click.stop>
          <button class="modal-close" @click="closeHelp">✖</button>
          <h2>Texas Hold'em Rules</h2>
          <div class="help-content">
            <section>
              <h3>馃幆 Objective</h3>
              <p>Create the best 5-card poker hand using your 2 hole cards and 5 community cards.</p>
            </section>

            <section>
              <h3>馃儚 Game Phases</h3>
              <ul>
                <li><strong>Pre-Flop:</strong> Each player gets 2 hole cards. First betting round.</li>
                <li><strong>Flop:</strong> 3 community cards revealed. Second betting round.</li>
                <li><strong>Turn:</strong> 4th community card revealed. Third betting round.</li>
                <li><strong>River:</strong> 5th community card revealed. Final betting round.</li>
                <li><strong>Showdown:</strong> Players reveal hands. Best hand wins the pot.</li>
              </ul>
            </section>

            <section>
              <h3>馃幋 Hand Rankings (Best to Worst)</h3>
              <ol>
                <li>Royal Flush</li>
                <li>Straight Flush</li>
                <li>Four of a Kind</li>
                <li>Full House</li>
                <li>Flush</li>
                <li>Straight</li>
                <li>Three of a Kind</li>
                <li>Two Pair</li>
                <li>One Pair</li>
                <li>High Card</li>
              </ol>
            </section>

            <section>
              <h3>馃幉 Actions</h3>
              <ul>
                <li><strong>Fold:</strong> Give up and forfeit the current hand</li>
                <li><strong>Check:</strong> Pass action without betting (only if no bet to call)</li>
                <li><strong>Call:</strong> Match the current bet</li>
                <li><strong>Raise:</strong> Increase the current bet</li>
                <li><strong>All-in:</strong> Bet all your chips</li>
              </ul>
            </section>
          </div>

          <transition name="showdown-summary">
            <div v-if="showShowdownSummary" class="showdown-overlay" role="dialog" aria-modal="true">
              <div class="showdown-card">
                <div class="summary-header">
                  <div>
                    <h3>Showdown</h3>
                    <p class="summary-subtitle">Final hands for the pot</p>
                  </div>
                  <span class="summary-pot">Pot ${{ showdownPot }}</span>
                </div>

                <div class="summary-board">
                  <div
                    v-for="(card, index) in paddedCommunityCards"
                    :key="`showdown-board-${index}`"
                    class="card-slot"
                    :class="{ revealed: !!card }"
                  >
                    <span v-if="card" class="card-face" :class="getCardColor(card.suit)">
                      {{ card.suit }}{{ card.rank }}
                    </span>
                    <div v-else class="card-back small"></div>
                  </div>
                </div>

                <div class="summary-players">
                  <div
                    v-for="player in showdownPlayers"
                    :key="`showdown-player-${player.id}`"
                    class="summary-player"
                    :class="{ winner: player.isWinner }"
                  >
                    <div class="player-meta">
                      <span class="player-name">{{ player.name }}</span>
                      <span v-if="player.bestHand?.rankName" class="player-hand">{{ player.bestHand.rankName }}</span>
                      <span v-else class="player-hand muted">Revealed</span>
                    </div>
                    <div class="player-cards">
                      <div
                        v-for="(card, cIndex) in player.cards"
                        :key="`showdown-card-${player.id}-${cIndex}`"
                        class="card-slot"
                        :class="{ revealed: !!card?.rank }"
                      >
                        <span v-if="card?.rank" class="card-face" :class="getCardColor(card.suit)">
                          {{ card.suit }}{{ card.rank }}
                        </span>
                        <div v-else class="card-back small"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="summary-actions">
                  <button
                    v-if="gameStore.isRoomCreator"
                    class="btn primary large"
                    @click="startGame"
                    :disabled="!gameStore.canStartGame"
                  >
                    Deal Next Hand
                  </button>
                  <div v-else class="waiting-text">Waiting for the host to deal the next hand…</div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </transition>

    <main class="content">
      <section class="table-area">
        <div class="table-felt">
          <div class="table-glow"></div>

          <div class="pot-info" aria-live="polite">
            <span class="label">Pot</span>
            <span class="value">${{ gameStore.totalPot }}</span>
            <span class="call" v-if="callAmount > 0">To call ${{ callAmount }}</span>
          </div>

          <div class="community-row">
            <div
              v-for="(card, index) in paddedCommunityCards"
              :key="`community-${index}`"
              class="card-slot"
              :class="{ revealed: !!card }"
            >
              <span
                v-if="card"
                class="card-face"
                :class="getCardColor(card.suit)"
              >
                {{ card.suit }}{{ card.rank }}
              </span>
            </div>
          </div>

          <div
            v-if="dealerSeatClass"
            class="dealer-chip"
            :class="dealerSeatClass"
          >
            D
          </div>

          <div class="player-layer">
            <div
              v-for="seat in opponentSeats"
              :key="seat.player.id"
              class="seat"
              :class="[
                seat.seatClass,
                {
                  active: seat.player.id === currentTurnPlayerId,
                  folded: seat.player.folded,
                  allin: seat.player.allIn
                }
              ]"
            >
              <div
                v-if="seat.player.id === currentTurnPlayerId"
                class="turn-indicator"
                aria-hidden="true"
              >
                <span class="indicator-icon">⏰</span>
                <span class="indicator-text">Acting</span>
              </div>
              <div class="seat-frame">
                <div v-if="seat.player.folded" class="fold-badge" aria-hidden="true">
                  <span class="fold-icon">⛔</span>
                  <span class="fold-text">Fold</span>
                </div>
                <div class="seat-header">
                  <span class="name">{{ seat.player.name }}</span>
                  <span class="chips">${{ seat.player.chips }}</span>
                </div>
                <div class="seat-body">
                  <div
                    class="last-action"
                    :class="getActionClass(seat.player.lastAction)"
                    v-if="seat.player.lastAction && !seat.player.folded"
                  >
                    {{ formatPlayerAction(seat.player.lastAction) }}
                  </div>
                  <div class="bet-stack" v-if="seat.player.currentBet > 0 && !seat.player.folded">
                    Bet ${{ seat.player.currentBet }}
                  </div>
                </div>
                <div class="hole-cards">
                  <div
                    v-for="n in 2"
                    :key="`hole-${seat.player.id}-${n}`"
                    class="card-slot"
                    :class="{ revealed: shouldRevealPlayerCard(seat.player, n - 1) }"
                  >
                    <span
                      v-if="shouldRevealPlayerCard(seat.player, n - 1)"
                      class="card-face"
                      :class="getCardColor(seat.player.cards[n - 1]?.suit)"
                    >
                      {{ seat.player.cards[n - 1]?.suit }}{{ seat.player.cards[n - 1]?.rank }}
                    </span>
                    <div v-else class="card-back"></div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="!tablePlayers.length" class="empty-state">
              Waiting for players to join?
            </div>
          </div>
        </div>
        <div class="table-footer">
          <div
            v-if="gameStore.gamePhase === 'waiting' || (gameStore.gamePhase === 'showdown' && gameStore.gameFinished)"
            class="footer-waiting"
          >
            <div class="host-controls" v-if="gameStore.isRoomCreator">
              <div class="host-label">You are the Host</div>
              <div class="controls-row">
                <div class="seat-info">
                  {{ seatLabel }}
                  <small>Min {{ MIN_SEAT_COUNT }} / Max {{ maxSeatLimit }}</small>
                </div>
                <button class="btn success" @click="addAI" :disabled="!canAddAI">
                  Add AI
                </button>
                <button class="btn warning" @click="removeAI" :disabled="!canRemoveAI">
                  Remove AI
                </button>
                <button class="btn primary large" @click="startGame" :disabled="!gameStore.canStartGame">
                  {{ gameStore.gamePhase === 'waiting' ? 'Start Game' : 'Deal Next Hand' }}
                </button>
              </div>
            </div>

            <div class="waiting-banner" v-else>
              Waiting for the host to start the game...
            </div>
          </div>

          <div v-else-if="myPlayer" class="player-panel">
            <div class="panel-header">
              <div class="identity">
                <span class="label">You</span>
                <h3>{{ myPlayer.name }}</h3>
              </div>
              <div class="chip-summary">
                <span class="stack">Stack ${{ myPlayer.chips }}</span>
                <span v-if="myPlayer.currentBet > 0" class="bet">In pot ${{ myPlayer.currentBet }}</span>
                <span
                  v-if="gameStore.isMyTurn && callAmount > 0"
                  class="call-highlight"
                >
                  To call ${{ callAmount }}
                </span>
                <span v-else-if="gameStore.isMyTurn" class="call-highlight ready">
                  Your turn
                </span>
                <span v-if="myPlayer.folded" class="fold-flag" aria-hidden="true">
                  ⛔ Folded
                </span>
              </div>
            </div>
            <div class="panel-body">
              <div class="panel-cards">
                <div
                  v-for="n in 2"
                  :key="`panel-card-${n}`"
                  class="player-card"
                  :class="{ revealed: shouldRevealPlayerCard(myPlayer, n - 1) }"
                >
                  <div
                    v-if="shouldRevealPlayerCard(myPlayer, n - 1)"
                    class="card-face large"
                    :class="getCardColor(myPlayer.cards[n - 1]?.suit)"
                  >
                    {{ myPlayer.cards[n - 1]?.suit }}{{ myPlayer.cards[n - 1]?.rank }}
                  </div>
                  <div v-else class="card-back large"></div>
                </div>
              </div>
              <div class="panel-status">
                <div
                  class="status-line"
                  :class="getActionClass(myPlayer.lastAction)"
                  v-if="myPlayer.lastAction"
                >
                  {{ formatPlayerAction(myPlayer.lastAction) }}
                </div>
                <div class="status-line" v-else>
                  Waiting for action
                </div>
                <div class="status-line" v-if="myPlayer.bestHand && myPlayer.bestHand.rankName">
                  Best hand: {{ myPlayer.bestHand.rankName }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="sidebar">
        <section class="action-panel" :class="{ inactive: !gameStore.isMyTurn }">
          <h3>Actions</h3>
          <div class="action-buttons">
            <button class="btn ghost" @click="fold" :disabled="!gameStore.isMyTurn">Fold</button>
            <button class="btn ghost" @click="checkOrCall" :disabled="!gameStore.isMyTurn">
              {{ canCheck ? 'Check' : `Call $${callAmount}` }}
            </button>
            <button class="btn primary" @click="openRaisePanel" :disabled="!canRaise">
              Raise
            </button>
            <button class="btn danger" @click="allIn" :disabled="!gameStore.isMyTurn">All-in</button>
          </div>

          <transition name="raise-panel">
            <div v-if="showRaisePanel" class="raise-panel">
              <header>
                <span>Raise Amount</span>
                <button class="icon-btn" @click="closeRaisePanel">?</button>
              </header>
              <div class="slider-row">
                <input
                  type="range"
                  :min="Math.min(minRaiseValue, maxRaiseValue)"
                  :max="maxRaiseValue"
                  step="1"
                  v-model.number="raiseAmount"
                />
                <div class="slider-value">${{ raiseAmount }}</div>
              </div>
              <div class="quick-raise">
                <button class="btn light" @click="setRaiseFraction(0.25)">+25%</button>
                <button class="btn light" @click="setRaiseFraction(0.5)">+50%</button>
                <button class="btn light" @click="setRaiseFraction(1)">Pot</button>
                <button class="btn light" @click="setRaiseAllIn">All-in</button>
              </div>
              <button class="btn primary full" @click="confirmRaise">Confirm Raise</button>
            </div>
          </transition>
        </section>

        <section class="info-panel">
          <h3>Table Snapshot</h3>
          <ul>
            <li><span>Phase</span><span>{{ phaseLabel }}</span></li>
            <li><span>Dealer</span><span>{{ dealerName }}</span></li>
            <li><span>Your stack</span><span>${{ myStack }}</span></li>
            <li><span>Minimum raise</span><span>${{ Math.min(minRaiseValue, maxRaiseValue) }}</span></li>
          </ul>
        </section>

        <section class="log-panel">
          <h3>Game Log</h3>
          <div class="log-scroll">
            <div v-for="(entry, index) in gameLogs" :key="`log-${index}`" class="log-entry">
              {{ entry }}
            </div>
          </div>
        </section>

        <section class="chat-panel">
          <h3>Table Chat</h3>
          <div class="chat-scroll" ref="chatScrollRef">
            <div
              v-for="(msg, index) in chatMessages"
              :key="`chat-${index}`"
              class="chat-line"
              :class="{ mine: msg.userId === userStore.user?.id }"
            >
              <span class="user">{{ msg.username }}</span>
              <span class="message">{{ msg.message }}</span>
            </div>
          </div>
          <div class="chat-input-row">
            <input
              type="text"
              v-model="chatInput"
              placeholder="Say something?"
              maxlength="150"
              @keyup.enter="sendChatMessage"
            />
            <button class="btn primary" @click="sendChatMessage">Send</button>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'
import { useGameStore } from '../stores/game'
import socketService from '../services/socket'
import soundService from '../services/sound'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const gameStore = useGameStore()
const roomIdParam = ref(route.query.roomId || 'default-room')

const displayRoomId = computed(() => gameStore.roomId || roomIdParam.value || 'N/A')

const FALLBACK_MAX_SEATS = 10
const MIN_SEAT_COUNT = 4

const showRaisePanel = ref(false)
const raiseAmount = ref(0)
const gameLogs = ref([])
const chatMessages = ref([])
const chatInput = ref('')
const chatScrollRef = ref(null)
const soundEnabled = ref(soundService.enabled)
const showPhaseBanner = ref(false)
const phaseBannerText = ref('')
const phaseBannerSubtext = ref('')
let phaseBannerTimer = null
const showHelpDialog = ref(false)

const hasJoinedRoom = ref(false)
const socketListeners = []

const registerSocketListener = (event, handler) => {
  socketService.on(event, handler)
  socketListeners.push({ event, handler })
}

const cleanupSocketListeners = () => {
  socketListeners.forEach(({ event, handler }) => {
    socketService.off(event, handler)
  })
  socketListeners.length = 0
}

const opponentSeatClasses = [
  'seat-bottom-right',
  'seat-right-lower',
  'seat-right-upper',
  'seat-top-right',
  'seat-top-center',
  'seat-top-left',
  'seat-left-upper',
  'seat-left-lower',
  'seat-bottom-left'
]

const userId = computed(() => userStore.user?.id ?? null)
const myPlayer = computed(() => gameStore.myPlayer ?? null)
const maxSeatLimit = computed(() => gameStore.maxPlayers || FALLBACK_MAX_SEATS)
const seatLabel = computed(() => `${gameStore.players.length} / ${maxSeatLimit.value} seats`)
const tablePlayers = computed(() => gameStore.players || [])
const dealerIndex = computed(() => (typeof gameStore.dealerIndex === 'number' ? gameStore.dealerIndex : -1))
const opponentSeats = computed(() => {
  const players = tablePlayers.value || []
  if (!players.length) {
    return []
  }

  const myIndex = players.findIndex((player) => player.id === userId.value)
  const assignments = []
  const total = players.length
  let seatCursor = 0

  for (let offset = 0; offset < total; offset++) {
    const idx = myIndex === -1 ? offset : (myIndex + 1 + offset) % total
    const player = players[idx]
    if (!player || player.id === userId.value) {
      continue
    }

    const seatClass = opponentSeatClasses[seatCursor % opponentSeatClasses.length]
    assignments.push({ player, seatClass, orderIndex: seatCursor })
    seatCursor += 1
  }

  return assignments
})

const dealerSeatClass = computed(() => {
  if (dealerIndex.value === -1) return null
  const players = tablePlayers.value || []
  if (!players.length) return null
  const dealer = players[dealerIndex.value]
  if (!dealer) return null

  if (dealer.id === userId.value) {
    return 'my-seat'
  }

  const seat = opponentSeats.value.find((entry) => entry.player.id === dealer.id)
  return seat ? seat.seatClass : null
})

const showdownWinners = computed(() => gameStore.winners || [])

const showdownPot = computed(() => {
  if (gameStore.gamePhase !== 'showdown') {
    return 0
  }

  const resolved = Number(gameStore.lastPot || 0)
  if (resolved > 0) {
    return resolved
  }

  const potFallbacks = [gameStore.totalPot, gameStore.pot]
  for (const value of potFallbacks) {
    const numeric = Number(value || 0)
    if (numeric > 0) {
      return numeric
    }
  }

  return 0
})

const showdownPlayers = computed(() => {
  if (gameStore.gamePhase !== 'showdown') {
    return []
  }

  const winnerIds = new Set((showdownWinners.value || []).map((winner) => winner.id))

  return (tablePlayers.value || [])
    .filter((player) => player && player.active !== false && !player.folded)
    .map((player) => {
      const cards = Array.isArray(player.cards)
        ? player.cards.map((card) => {
            if (card && card.rank) {
              return { suit: card.suit, rank: card.rank }
            }
            return null
          })
        : []

      while (cards.length < 2) {
        cards.push(null)
      }

      return {
        id: player.id,
        name: player.name,
        cards,
        bestHand: player.bestHand || null,
        isWinner: winnerIds.has(player.id)
      }
    })
})

const showShowdownSummary = computed(
  () => gameStore.gamePhase === 'showdown' && showdownPlayers.value.length > 0
)

const dealerName = computed(() => {
  if (!tablePlayers.value.length) {
    return gameStore.gamePhase === 'waiting' ? 'Waiting' : 'N/A'
  }

  if (dealerIndex.value < 0 || dealerIndex.value >= tablePlayers.value.length) {
    return gameStore.gamePhase === 'waiting' ? 'Waiting' : 'N/A'
  }

  return tablePlayers.value[dealerIndex.value]?.name || 'N/A'
})

const paddedCommunityCards = computed(() => {
  const cards = gameStore.communityCards ? [...gameStore.communityCards] : []
  while (cards.length < 5) {
    cards.push(null)
  }
  return cards
})

const currentTurnPlayerId = computed(() => {
  if (gameStore.currentPlayerIndex == null || gameStore.currentPlayerIndex < 0) {
    return null
  }
  return tablePlayers.value[gameStore.currentPlayerIndex]?.id || null
})

const callAmount = computed(() => {
  const player = gameStore.myPlayer
  if (!player) return 0
  const target = (gameStore.currentBet || 0) - (player.currentBet || 0)
  return target > 0 ? Math.round(target) : 0
})

const canCheck = computed(() => callAmount.value === 0)
const canRaise = computed(() => gameStore.isMyTurn && (gameStore.myPlayer?.chips || 0) > 0)
const canAddAI = computed(() => gameStore.gamePhase === 'waiting' && gameStore.players.length < maxSeatLimit.value)
const canRemoveAI = computed(
  () =>
    gameStore.gamePhase === 'waiting' &&
    gameStore.aiPlayerCount > 0 &&
    gameStore.players.length > MIN_SEAT_COUNT
)

const maxRaiseValue = computed(() => {
  const player = gameStore.myPlayer
  if (!player) return 0
  return Math.max(0, player.chips || 0)
})

const minRaiseValue = computed(() => {
  const chips = maxRaiseValue.value
  if (chips <= 0) return 0
  const call = callAmount.value
  const base = Math.max(gameStore.minRaise || gameStore.bigBlind || 1, 1)
  const required = call + base
  if (required >= chips) {
    return chips
  }
  return required
})

const formattedChips = computed(() => (userStore.chips || 0).toLocaleString())
const myStack = computed(() => gameStore.myPlayer?.chips ?? 0)

const phaseNames = {
  waiting: 'Waiting',
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown'
}

const phaseDescriptions = {
  waiting: 'Gather players before dealing.',
  preflop: 'Players act on their hole cards.',
  flop: 'Three community cards reveal the board.',
  turn: 'The turn card changes the possibilities.',
  river: 'Final community card before the showdown.',
  showdown: 'Reveal hands to determine the winner.'
}

const phaseLabel = computed(() => phaseNames[gameStore.gamePhase] || (gameStore.gamePhase || '').toUpperCase())
const phaseDescription = computed(() => phaseDescriptions[gameStore.gamePhase] || '')

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

watch(showRaisePanel, (visible) => {
  if (visible) {
    const chips = maxRaiseValue.value
    if (chips <= 0) {
      raiseAmount.value = 0
      return
    }
    const base = Math.min(minRaiseValue.value || chips, chips)
    raiseAmount.value = base || chips
  }
})

watch(
  () => gameStore.isMyTurn,
  (isMyTurn) => {
    if (!isMyTurn) {
      showRaisePanel.value = false
    }
  }
)

watch(
  () => [callAmount.value, minRaiseValue.value, maxRaiseValue.value],
  () => {
    if (!showRaisePanel.value) return
    const chips = maxRaiseValue.value
    if (chips <= 0) {
      raiseAmount.value = 0
      return
    }
    const min = Math.min(minRaiseValue.value || chips, chips)
    raiseAmount.value = clamp(raiseAmount.value || min, min || 1, chips)
  }
)

const getCardColor = (suit) => (suit === '♥' || suit === '♦' ? 'red' : 'black')

const resolveActionKey = (action) => {
  if (!action) return ''
  if (typeof action === 'string') return action
  return action?.action || action?.type || ''
}

const normalizeActionKey = (rawKey) => (rawKey || '').toString().toLowerCase().replace(/-/g, '_')

const formatPlayerAction = (action) => {
  const key = normalizeActionKey(resolveActionKey(action))
  if (!key) return ''
  const map = {
    call: 'Called',
    raise: 'Raised',
    bet: 'Bet',
    fold: 'Folded',
    check: '✔ Checked',
    all_in: 'All-in',
    small_blind: 'Posted small blind',
    big_blind: 'Posted big blind'
  }
  const label = map[key] || key.replace(/_/g, ' ').toUpperCase()
  const amount = typeof action === 'object' && action?.amount ? ` $${action.amount}` : ''
  return `${label}${amount}`
}

const getActionClass = (action) => {
  const key = normalizeActionKey(resolveActionKey(action))
  const map = {
    check: 'action-check',
    call: 'action-call',
    raise: 'action-raise',
    bet: 'action-raise',
    fold: 'action-fold',
    all_in: 'action-all-in'
  }
  return map[key] || ''
}

const shouldRevealPlayerCard = (player, index) => {
  if (!player || !player.cards || !player.cards[index]) return false
  if (player.id === userStore.user?.id) return true
  if (gameStore.gamePhase === 'showdown' && !player.folded) return true
  return !!player.cards[index].revealed
}

const addLog = (message) => {
  const timestamp = new Date().toLocaleTimeString()
  gameLogs.value.unshift(`[${timestamp}] ${message}`)
  if (gameLogs.value.length > 80) {
    gameLogs.value.pop()
  }
}

const fold = () => {
  if (!gameStore.isMyTurn) return
  soundService.playFold()
  gameStore.sendAction('fold')
  addLog('You folded')
}

const checkOrCall = () => {
  if (!gameStore.isMyTurn) return
  if (canCheck.value) {
    soundService.playCheck()
    gameStore.sendAction('check')
    addLog('You checked')
  } else {
    soundService.playCall()
    gameStore.sendAction('call')
    addLog(`You called $${callAmount.value}`)
  }
}

const openRaisePanel = () => {
  if (!canRaise.value) return
  soundService.playClick()
  showRaisePanel.value = true
  const chips = maxRaiseValue.value
  if (chips <= 0) {
    raiseAmount.value = 0
    return
  }
  const base = Math.min(minRaiseValue.value || chips, chips)
  raiseAmount.value = base || chips
}

const closeRaisePanel = () => {
  showRaisePanel.value = false
}

const setRaiseFraction = (fraction) => {
  const chips = maxRaiseValue.value
  if (chips <= 0) return
  const call = callAmount.value
  const additional = Math.max(chips - call, 0) * fraction
  const target = Math.round(call + additional)
  const min = Math.min(minRaiseValue.value || chips, chips)
  raiseAmount.value = clamp(target || min, min || 1, chips)
}

const setRaiseAllIn = () => {
  raiseAmount.value = maxRaiseValue.value
}

const confirmRaise = () => {
  if (!gameStore.isMyTurn) return
  const chips = maxRaiseValue.value
  if (chips <= 0) {
    soundService.playError()
    ElMessage.error('Not enough chips to raise')
    return
  }
  const min = Math.min(minRaiseValue.value || chips, chips)
  const amount = Math.round(clamp(raiseAmount.value || min, min || 1, chips))
  if (amount < callAmount.value && amount < chips) {
    soundService.playError()
    ElMessage.error('Raise amount is too small')
    return
  }
  soundService.playRaise()
  gameStore.sendAction('raise', amount)
  addLog(`You raised to $${amount}`)
  showRaisePanel.value = false
}

const allIn = () => {
  if (!gameStore.isMyTurn) return
  soundService.playAllIn()
  gameStore.sendAction('all_in')
  addLog('You went all-in')
  showRaisePanel.value = false
}

const startGame = () => {
  soundService.playGameStart()
  gameStore.startGame()
  addLog('Game started')
}

const addAI = () => {
  if (!canAddAI.value) {
    return
  }
  soundService.playClick()
  gameStore.addAI()
  addLog('AI player added')
}

const removeAI = () => {
  if (!canRemoveAI.value) {
    return
  }
  soundService.playClick()
  gameStore.removeAI()
  addLog('AI player removed')
}

const resetGame = () => {
  if (gameStore.gamePhase === 'waiting') {
    return
  }
  soundService.playClick()
  gameStore.resetGame()
  addLog('Game reset')
}

const leaveGame = () => {
  hasJoinedRoom.value = false
  gameStore.leaveRoom()
  router.push('/')
}

const handleLogout = () => {
  soundService.playClick()
  hasJoinedRoom.value = false
  cleanupSocketListeners()
  gameStore.cleanup()
  gameStore.leaveRoom()
  userStore.logout()
  router.push('/login')
}

const sendChatMessage = () => {
  if (!chatInput.value || chatInput.value.trim().length === 0) {
    return
  }
  const message = chatInput.value.trim()
  socketService.sendChatMessage(message)
  chatInput.value = ''
}

const scrollChatToBottom = () => {
  if (chatScrollRef.value) {
    setTimeout(() => {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }, 50)
  }
}

watch(
  () => gameStore.gamePhase,
  (phase, previous) => {
    if (!phase || phase === previous) return
    showPhaseTransition(phase)
  }
)

watch(
  () => chatMessages.value.length,
  () => {
    scrollChatToBottom()
  }
)

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
  soundService.setEnabled(soundEnabled.value)
  if (soundEnabled.value) {
    soundService.playClick()
  }
}

const showHelp = () => {
  soundService.playClick()
  showHelpDialog.value = true
}

const closeHelp = () => {
  showHelpDialog.value = false
}

const joinCurrentRoom = () => {
  const targetRoom = roomIdParam.value
  if (!targetRoom) {
    return
  }
  const status = socketService.getStatus()
  if (!status.authenticated) {
    return
  }
  if (!hasJoinedRoom.value) {
    gameLogs.value = []
    chatMessages.value = []
    gameStore.joinRoom(targetRoom)
    addLog('Connected to game server')
    hasJoinedRoom.value = true
  }
}

const ensureAuthenticated = async () => {
  if (!userStore.token) {
    return
  }
  const status = socketService.getStatus()
  if (!status.connected) {
    try {
      await socketService.connect()
      socketService.authenticate(userStore.token)
    } catch (error) {
      console.error('Failed to connect socket:', error)
      ElMessage.error('Failed to connect to game server')
    }
    return
  }
  if (!status.authenticated) {
    socketService.authenticate(userStore.token)
    return
  }
  joinCurrentRoom()
}

const handleAuthenticated = () => {
  joinCurrentRoom()
}

const handleConnectionStatus = (data) => {
  if (data?.connected) {
    ensureAuthenticated()
  } else {
    hasJoinedRoom.value = false
  }
}

const handleReconnected = () => {
  hasJoinedRoom.value = false
  ensureAuthenticated()
}

watch(
  () => route.query.roomId,
  (newRoomId) => {
    const resolvedRoom = newRoomId || 'default-room'
    if (roomIdParam.value !== resolvedRoom) {
      roomIdParam.value = resolvedRoom
      hasJoinedRoom.value = false
      if (socketService.getStatus().authenticated) {
        joinCurrentRoom()
      }
    }
  }
)

const showPhaseTransition = (phase) => {
  if (!phase) return

  phaseBannerText.value = phaseNames[phase] || (phase || '').toUpperCase()
  phaseBannerSubtext.value = phaseDescriptions[phase] || ''
  showPhaseBanner.value = true

  if (phaseBannerTimer) {
    clearTimeout(phaseBannerTimer)
  }

  phaseBannerTimer = setTimeout(() => {
    showPhaseBanner.value = false
    phaseBannerTimer = null
  }, 1800)
}

const setupSocketListeners = () => {
  const handlers = {
    game_update: (data) => {
      if (data.lastAction) {
        const action = data.lastAction
        addLog(`${action.playerName || action.player || 'Player'} ${formatPlayerAction(action)}`)
        const actionType = action.action || action.type
        if (actionType === 'fold') soundService.playFold()
        else if (actionType === 'check') soundService.playCheck()
        else if (actionType === 'call') soundService.playCall()
        else if (actionType === 'bet' || actionType === 'raise') soundService.playRaise()
        else if (actionType === 'all_in') soundService.playAllIn()
      }

      if (gameStore.isMyTurn) {
        soundService.playYourTurn()
      }
    },
    game_started: (data) => {
      soundService.playGameStart()
      soundService.playCardDeal()
      addLog('New hand started')
    },
    game_finished: (data) => {
      const winners =
        data?.winners ||
        data?.results?.winners ||
        (data?.winner ? [data.winner] : [])

      if (Array.isArray(winners) && winners.length > 0) {
        const winnerNames = winners.map((w) => w.name).join(', ')
        const potAmount = data?.pot ?? data?.results?.pot ?? 0
        addLog(`Hand finished. Winner(s): ${winnerNames} (Pot $${potAmount})`)
        const isWinner = winners.some((w) => w.id === userStore.user?.id)
        if (isWinner) {
          soundService.playWin()
        } else {
          soundService.playLose()
        }
      } else {
        addLog('Hand finished. Awaiting next hand…')
      }
    },
    player_joined: (data) => {
      const name = data?.player?.name || data?.playerName
      if (!name) {
        return
      }
      soundService.playNotification()
      addLog(`${name} joined the table`)
    },
    player_left: (data) => {
      const name =
        data?.player?.name ||
        data?.playerName ||
        gameStore.players.find((p) => p.id === data?.playerId)?.name ||
        'A player'
      soundService.playNotification()
      addLog(`${name} left the table`)
    },
    action_error: (data) => {
      soundService.playError()
      ElMessage.error(data.error)
      addLog(`Error: ${data.error}`)
    },
    error: (data) => {
      soundService.playError()
      ElMessage.error(data.error)
      addLog(`Error: ${data.error}`)
    },
    chat_message: (data) => {
      chatMessages.value.push({
        userId: data.userId,
        username: data.username,
        message: data.message,
        timestamp: data.timestamp
      })
      if (chatMessages.value.length > 50) {
        chatMessages.value.shift()
      }
    },
    achievements_unlocked: (data) => {
      if (data.playerId === userStore.user?.id) {
        soundService.playSuccess()
        data.achievements.forEach((achievement, index) => {
          setTimeout(() => {
            ElMessage.success({
              message: `馃帀 Achievement unlocked ${achievement.icon} ${achievement.name}\n${achievement.description}\nReward: ${achievement.reward} chips`,
              duration: 5000,
              showClose: true
            })
            addLog(`Achievement unlocked: ${achievement.name} (+${achievement.reward} chips)`)
          }, index * 1000)
        })
      } else {
        addLog(`Another player unlocked ${data.achievements.length} achievement(s)`)
      }
    },
    authenticated: handleAuthenticated,
    connection_status: handleConnectionStatus,
    reconnected: handleReconnected
  }

  Object.entries(handlers).forEach(([event, handler]) => {
    registerSocketListener(event, handler)
  })
}

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    await userStore.initFromStorage()
  }

  if (!userStore.isLoggedIn) {
    ElMessage.error('Please login first')
    router.push('/login')
    return
  }

  roomIdParam.value = route.query.roomId || 'default-room'

  gameStore.initSocket()
  setupSocketListeners()
  await ensureAuthenticated()
})

onBeforeUnmount(() => {
  if (phaseBannerTimer) {
    clearTimeout(phaseBannerTimer)
    phaseBannerTimer = null
  }
  cleanupSocketListeners()
  gameStore.cleanup()
  gameStore.leaveRoom()
  hasJoinedRoom.value = false
})
</script>
<style scoped>
* {
  box-sizing: border-box;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.game-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background:
    radial-gradient(circle at 18% 20%, rgba(59, 130, 246, 0.25), transparent 55%),
    radial-gradient(circle at 82% 80%, rgba(139, 92, 246, 0.25), transparent 55%),
    rgba(15, 23, 42, 0.93);
  color: #f8fafc;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(16px);
}

.room-info h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  color: rgba(226, 232, 240, 0.8);
  font-size: 0.85rem;
}

.meta-row.secondary {
  color: rgba(148, 163, 184, 0.9);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.25);
  font-weight: 500;
}

.control-cluster {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.account-panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 1rem;
  background: rgba(30, 41, 59, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  min-width: 220px;
}

.account-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 1rem;
}

.account-name small {
  color: rgba(148, 163, 184, 0.7);
  font-weight: 500;
}

.account-chips {
  font-size: 1.4rem;
  font-weight: 700;
  color: #facc15;
}

.account-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: rgba(203, 213, 225, 0.85);
}

.btn {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 0.45rem 1.1rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  color: #f8fafc;
  background: rgba(71, 85, 105, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 25px rgba(15, 23, 42, 0.3);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn.primary {
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  border-color: rgba(148, 163, 184, 0.25);
}

.btn.primary:hover:not(:disabled) {
  box-shadow: 0 18px 35px rgba(99, 102, 241, 0.4);
}

.btn.danger {
  background: linear-gradient(135deg, #f97316, #ef4444);
  border-color: rgba(248, 113, 113, 0.45);
}

.btn.success {
  background: linear-gradient(135deg, #10b981, #059669);
  border-color: rgba(16, 185, 129, 0.45);
}

.btn.success:hover:not(:disabled) {
  box-shadow: 0 18px 35px rgba(16, 185, 129, 0.4);
}

.btn.warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-color: rgba(245, 158, 11, 0.45);
}

.btn.warning:hover:not(:disabled) {
  box-shadow: 0 18px 35px rgba(245, 158, 11, 0.4);
}

.btn.ghost {
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.btn.light {
  background: rgba(148, 163, 184, 0.18);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #e2e8f0;
  padding: 0.35rem 0.9rem;
}

.btn.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  padding: 0;
  font-size: 1rem;
}

.btn.full {
  width: 100%;
}

.btn.large {
  padding: 0.65rem 2rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.phase-banner {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.9));
  padding: 2.25rem 3rem;
  border-radius: 1.5rem;
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.4);
  z-index: 80;
  text-align: center;
  color: #fff;
}

.phase-banner-content h2 {
  margin: 0;
  font-size: 2.25rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.phase-banner-content p {
  margin: 0.75rem 0 0;
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.85);
}

.phase-banner-enter-active {
  animation: banner-in 0.4s ease-out;
}

.phase-banner-leave-active {
  animation: banner-out 0.35s ease-in forwards;
}

@keyframes banner-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.85);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes banner-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
}

.content {
  flex: 1;
  display: flex;
  gap: 1.5rem;
}

.table-area {
  flex: 2.3;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.table-felt {
  position: relative;
  width: 100%;
  max-width: 980px;
  aspect-ratio: 16 / 9;
  border-radius: 220px;
  background: radial-gradient(circle at center, rgba(30, 64, 175, 0.18), rgba(15, 23, 42, 0.92));
  border: 2px solid rgba(148, 163, 184, 0.22);
  box-shadow: inset 0 0 60px rgba(15, 23, 42, 0.9), 0 25px 55px rgba(15, 23, 42, 0.5);
  overflow: hidden;
}

.table-glow {
  position: absolute;
  inset: 10%;
  border-radius: 180px;
  border: 1px dashed rgba(148, 163, 184, 0.2);
  pointer-events: none;
}

.round-indicator {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  pointer-events: none;
  z-index: 50;
}

.pot-info {
  position: absolute;
  top: 6%;
  left: 8%;
  transform: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 0.35rem;
  padding: 0.7rem 1.15rem;
  min-width: 210px;
  background: rgba(15, 23, 42, 0.78);
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45);
  color: #e2e8f0;
  z-index: 2;
}

.round-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  color: rgba(226, 232, 240, 0.9);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.45);
}

.round-phase {
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
}

.round-detail {
  font-size: 0.68rem;
  text-transform: none;
  letter-spacing: 0;
  color: rgba(226, 232, 240, 0.7);
}

.pot-info .label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(226, 232, 240, 0.75);
}

.pot-info .value {
  font-size: 1.35rem;
  font-weight: 700;
}

.pot-info .call {
  font-size: 0.75rem;
  color: rgba(226, 232, 240, 0.7);
}

.community-row {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.6rem;
}

.card-slot {
  width: 70px;
  height: 98px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.45);
}

.card-slot.revealed {
  background: #ffffff;
  border-color: rgba(148, 163, 184, 0.45);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
}

.card-face {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.card-face.red {
  color: #dc2626;
}

.card-face.black {
  color: #111827;
}

.dealer-chip {
  position: absolute;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #facc15;
  color: #1f2937;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 25px rgba(250, 204, 21, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.7);
  pointer-events: none;
}

.dealer-chip.seat-bottom-right {
  bottom: 22%;
  right: 18%;
}

.dealer-chip.seat-right-lower {
  bottom: 38%;
  right: 10%;
}

.dealer-chip.seat-right-upper {
  top: 38%;
  right: 10%;
}

.dealer-chip.seat-top-right {
  top: 22%;
  right: 20%;
}

.dealer-chip.seat-top-center {
  top: 18%;
  left: 50%;
  transform: translateX(-50%);
}

.dealer-chip.seat-top-left {
  top: 22%;
  left: 20%;
}

.dealer-chip.seat-left-upper {
  top: 38%;
  left: 10%;
}

.dealer-chip.seat-left-lower {
  bottom: 38%;
  left: 10%;
}

.dealer-chip.seat-bottom-left {
  bottom: 22%;
  left: 18%;
}

.player-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.seat {
  position: absolute;
  width: 170px;
  pointer-events: none;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.seat-frame {
  position: relative;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 18px;
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  box-shadow: 0 12px 25px rgba(15, 23, 42, 0.5);
}

.seat-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  font-size: 0.9rem;
}

.seat-header .chips {
  color: #facc15;
}

.seat-body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: rgba(226, 232, 240, 0.76);
}

.last-action {
  font-weight: 600;
}

.last-action.action-check,
.status-line.action-check {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.18);
  color: #0ea5e9;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 0 14px rgba(14, 165, 233, 0.35);
}

.bet-stack {
  color: rgba(125, 211, 252, 0.95);
}

.hole-cards {
  display: flex;
  gap: 0.4rem;
}

.hole-cards .card-slot {
  width: 46px;
  height: 64px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.35);
}

.hole-cards .card-slot.revealed {
  background: #ffffff;
  border-color: rgba(148, 163, 184, 0.45);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
}

.seat.me .seat-frame {
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: 0 16px 40px rgba(56, 189, 248, 0.25);
}

.seat.active .seat-frame {
  border-color: #facc15;
  border-width: 2px;
  box-shadow: 0 24px 60px rgba(250, 204, 21, 0.45);
  background: rgba(30, 41, 59, 0.92);
}

.turn-indicator {
  position: absolute;
  left: -44px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #fbbf24;
  font-size: 0.78rem;
  pointer-events: none;
  letter-spacing: 0.08em;
}
.turn-indicator .indicator-icon {
  font-size: 1rem;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.55));
}
.turn-indicator .indicator-text {
  font-weight: 700;
  text-transform: uppercase;
}

.fold-badge {
  position: absolute;
  top: -10px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.7);
  color: #fca5a5;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  pointer-events: none;
}
.fold-badge .fold-icon {
  font-size: 0.8rem;
}
.fold-badge .fold-text {
  font-size: 0.66rem;
}

.seat.folded {
  opacity: 0.45;
}

.seat.allin .seat-frame {
  border-color: rgba(250, 204, 21, 0.6);
}

.seat-bottom-right { bottom: 12%; right: 14%; }
.seat-right-lower { bottom: 28%; right: 6%; }
.seat-right-upper { top: 28%; right: 6%; }
.seat-top-right { top: 12%; right: 16%; }
.seat-top-center { top: 6%; left: 50%; transform: translateX(-50%); }
.seat-top-left { top: 12%; left: 16%; }
.seat-left-upper { top: 28%; left: 6%; }
.seat-left-lower { bottom: 28%; left: 6%; }
.seat-bottom-left { bottom: 12%; left: 14%; }

.my-seat {
  bottom: 6%;
  left: 50%;
  transform: translateX(-50%);
}

.seat.my-seat {
  width: 230px;
  pointer-events: none;
  z-index: 2;
}

.seat.my-seat .seat-frame {
  padding: 0.85rem 1.1rem;
  gap: 0.55rem;
}

.dealer-chip.my-seat {
  bottom: 26%;
  left: 50%;
  transform: translateX(-50%);
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1rem;
  color: rgba(226, 232, 240, 0.75);
  background: rgba(15, 23, 42, 0.6);
  padding: 0.75rem 1.2rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.table-footer {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: stretch;
  margin-top: 1.75rem;
}

.showdown-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  z-index: 6;
}

.showdown-card {
  width: min(760px, 100%);
  max-height: 100%;
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.6);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.showdown-card .summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.showdown-card .summary-header h3 {
  margin: 0;
  font-size: 1.4rem;
}

.showdown-card .summary-subtitle {
  margin: 0.35rem 0 0;
  color: rgba(226, 232, 240, 0.7);
  font-size: 0.9rem;
}

.showdown-card .summary-pot {
  color: #facc15;
  font-weight: 600;
  font-size: 1.1rem;
}

.showdown-card .summary-board {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.showdown-card .summary-board .card-slot {
  width: 60px;
  height: 84px;
}

.showdown-card .summary-board .card-face {
  font-size: 1rem;
}

.showdown-card .summary-players {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.showdown-card .summary-player {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(30, 41, 59, 0.7);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  text-align: center;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.showdown-card .summary-player.winner {
  border-color: rgba(250, 204, 21, 0.75);
  box-shadow: 0 16px 34px rgba(250, 204, 21, 0.25);
}

.showdown-card .player-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #e2e8f0;
}

.showdown-card .player-hand {
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.85);
}

.showdown-card .player-hand.muted {
  color: rgba(148, 163, 184, 0.6);
}

.showdown-card .player-cards {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.showdown-card .player-cards .card-slot {
  width: 48px;
  height: 68px;
}

.showdown-card .player-cards .card-face {
  font-size: 0.95rem;
}

.showdown-card .summary-actions {
  display: flex;
  justify-content: center;
  align-items: center;
}

.showdown-card .waiting-text {
  color: rgba(226, 232, 240, 0.8);
  font-size: 0.95rem;
}

.showdown-summary-enter-active,
.showdown-summary-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.showdown-summary-enter-from,
.showdown-summary-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
.footer-waiting {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}

.player-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.6rem;
  background: rgba(15, 23, 42, 0.78);
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 24px 45px rgba(15, 23, 42, 0.48);
  min-width: 360px;
  max-width: 520px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.2rem;
}

.identity {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.identity .label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.85);
}

.identity h3 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #f8fafc;
}

.chip-summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.9);
}

.chip-summary .stack {
  font-weight: 600;
  font-size: 1rem;
}

.chip-summary .bet {
  color: rgba(244, 114, 182, 0.85);
}
.chip-summary .fold-flag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.15);
  color: #fca5a5;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.7rem;
}

.call-highlight {
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.call-highlight.ready {
  background: rgba(74, 222, 128, 0.18);
  color: #4ade80;
}

.panel-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
}

.panel-cards {
  display: flex;
  gap: 0.9rem;
}

.player-card {
  width: 76px;
  height: 108px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.34);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-card.revealed {
  background: #ffffff;
  border-color: rgba(148, 163, 184, 0.5);
  box-shadow: 0 20px 32px rgba(15, 23, 42, 0.28);
}

.card-face.large {
  font-size: 2.1rem;
}

.card-back {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 2px solid rgba(248, 250, 252, 0.7);
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.3), transparent 50%),
    radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.2), transparent 48%),
    linear-gradient(135deg, rgba(30, 64, 175, 0.95), rgba(220, 38, 38, 0.85));
  box-shadow: inset 0 0 22px rgba(15, 23, 42, 0.45), 0 12px 22px rgba(15, 23, 42, 0.35);
  position: relative;
  overflow: hidden;
}

.card-back.large {
  border-radius: 14px;
}

.card-back::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: inherit;
  border: 1px solid rgba(248, 250, 252, 0.4);
  background: repeating-linear-gradient(
    45deg,
    rgba(248, 250, 252, 0.2) 0,
    rgba(248, 250, 252, 0.2) 6px,
    transparent 6px,
    transparent 12px
  );
  mix-blend-mode: screen;
}

.card-back::after {
  content: '';
  position: absolute;
  inset: 16px;
  border-radius: inherit;
  border: 2px solid rgba(248, 250, 252, 0.35);
  box-shadow: inset 0 0 12px rgba(15, 23, 42, 0.4);
}

.panel-status {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 160px;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.85);
}

.status-line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.host-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: rgba(99, 102, 241, 0.15);
  padding: 1rem 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.host-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #818cf8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.seat-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 23, 42, 0.5);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  min-width: 110px;
  gap: 0.2rem;
}

.seat-info small {
  font-size: 0.7rem;
  letter-spacing: 0;
  text-transform: none;
  color: rgba(148, 163, 184, 0.8);
  font-weight: 400;
}

.waiting-banner {
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.85);
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 10px;
}

.sidebar {
  flex: 0.75;
  max-width: 320px;
  min-width: 260px;
  display: grid;
  gap: 1rem;
  grid-template-rows: min-content min-content 1fr 1fr;
}

.sidebar section {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45);
}

.log-panel {
  min-height: 0;
}

.log-scroll {
  flex: 1;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-entry {
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.85);
  line-height: 1.35;
}

.log-entry::before {
  content: '•';
  margin-right: 0.35rem;
  color: rgba(148, 163, 184, 0.7);
}

.chat-panel {
  min-height: 0;
}

.chat-scroll {
  flex: 1;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.chat-line {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.85);
}

.chat-line.mine {
  align-items: flex-end;
  color: #c7d2fe;
}

.chat-line .user {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.85);
}

.chat-line.mine .user {
  color: #a5b4fc;
}

.chat-line .message {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.75rem;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.chat-line.mine .message {
  background: rgba(129, 140, 248, 0.25);
  border-color: rgba(129, 140, 248, 0.4);
}

.chat-input-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.chat-input-row input {
  flex: 1;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.7);
  padding: 0.55rem 0.75rem;
  color: #f8fafc;
  font-size: 0.85rem;
}

.chat-input-row input::placeholder {
  color: rgba(148, 163, 184, 0.6);
}

.sidebar h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.action-panel.inactive {
  opacity: 0.55;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.raise-panel {
  background: rgba(30, 41, 59, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 16px;
  padding: 0.75rem;
  gap: 0.65rem;
  display: flex;
  flex-direction: column;
}

.raise-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.raise-panel .icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.2);
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-row input[type='range'] {
  flex: 1;
  accent-color: #6366f1;
  height: 4px;
}

.slider-value {
  font-weight: 600;
  font-size: 0.95rem;
}

.quick-raise {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.quick-raise .btn {
  padding: 0.4rem 0;
}

.info-panel ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.info-panel li {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.8);
}

.log-scroll,
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.log-entry {
  font-size: 0.8rem;
  color: rgba(226, 232, 240, 0.78);
  padding: 0.35rem 0.45rem;
  border-radius: 10px;
  background: rgba(30, 41, 59, 0.6);
}

.chat-line {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.85);
}

.chat-line.mine {
  align-items: flex-end;
  color: #c7d2fe;
}

.chat-line .user {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.85);
}

.chat-line.mine .user {
  color: #a5b4fc;
}

.chat-line .message {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.75rem;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.chat-line.mine .message {
  background: rgba(129, 140, 248, 0.25);
  border-color: rgba(129, 140, 248, 0.4);
}

.raise-panel-enter-active {
  animation: raise-in 0.25s ease-out;
}

.raise-panel-leave-active {
  animation: raise-out 0.2s ease-in forwards;
}

@keyframes raise-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes raise-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(10px);
  }
}

@media (max-width: 1200px) {
  .content {
    flex-direction: column;
  }
  .sidebar {
    grid-template-rows: repeat(4, minmax(0, auto));
  }
}

@media (max-width: 768px) {
  .turn-indicator {
    left: -30px;
    font-size: 0.72rem;
    gap: 0.25rem;
  }
  .game-screen {
    padding: 1rem;
  }
  .content {
    gap: 1rem;
  }
  .table-felt {
    aspect-ratio: 4 / 3;
  }
  .round-indicator {
    bottom: 1rem;
    left: 1rem;
  }
  .seat {
    width: 150px;
  }
  .seat-bottom-right { bottom: 10%; right: 8%; }
  .seat-right-lower { bottom: 28%; right: 4%; }
  .seat-right-upper { top: 26%; right: 4%; }
  .seat-top-right { top: 10%; right: 12%; }
  .seat-top-center { top: 4%; left: 50%; transform: translateX(-50%); }
  .seat-top-left { top: 10%; left: 12%; }
  .seat-left-upper { top: 26%; left: 4%; }
  .seat-left-lower { bottom: 28%; left: 4%; }
  .seat-bottom-left { bottom: 10%; left: 8%; }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1.5rem;
}

.modal-content {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 24px;
  padding: 2rem;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.6);
  position: relative;
}

.modal-close {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(71, 85, 105, 0.5);
  color: #e2e8f0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: rgba(71, 85, 105, 0.8);
  transform: scale(1.1);
}

.modal-content h2 {
  margin: 0 0 1.5rem;
  font-size: 1.75rem;
  color: #f8fafc;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.help-content section {
  background: rgba(15, 23, 42, 0.4);
  padding: 1.25rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.help-content h3 {
  margin: 0 0 0.75rem;
  font-size: 1.15rem;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.help-content p {
  margin: 0;
  color: rgba(203, 213, 225, 0.9);
  line-height: 1.6;
}

.help-content ul,
.help-content ol {
  margin: 0;
  padding-left: 1.5rem;
  color: rgba(203, 213, 225, 0.9);
  line-height: 1.8;
}

.help-content li {
  margin-bottom: 0.5rem;
}

.help-content strong {
  color: #38bdf8;
  font-weight: 600;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content {
  transform: scale(0.9) translateY(20px);
  opacity: 0;
}

.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}
</style>










