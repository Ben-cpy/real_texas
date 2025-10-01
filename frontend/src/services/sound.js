/**
 * Sound Effects Service
 * Manages game sound effects using Web Audio API
 */

class SoundService {
  constructor() {
    this.enabled = true
    this.volume = 0.5
    this.sounds = {}

    // Load settings from localStorage
    const savedVolume = localStorage.getItem('soundVolume')
    const savedEnabled = localStorage.getItem('soundEnabled')

    if (savedVolume !== null) {
      this.volume = parseFloat(savedVolume)
    }
    if (savedEnabled !== null) {
      this.enabled = savedEnabled === 'true'
    }
  }

  /**
   * Enable/disable sound
   */
  setEnabled(enabled) {
    this.enabled = enabled
    localStorage.setItem('soundEnabled', enabled)
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    localStorage.setItem('soundVolume', this.volume)
  }

  /**
   * Play a beep sound using Web Audio API
   * @param {number} frequency - Sound frequency in Hz
   * @param {number} duration - Duration in milliseconds
   * @param {string} type - Waveform type: 'sine', 'square', 'sawtooth', 'triangle'
   */
  playBeep(frequency = 440, duration = 100, type = 'sine') {
    if (!this.enabled) return

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type

      gainNode.gain.setValueAtTime(this.volume * 0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration / 1000)
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  /**
   * Game event sounds
   */

  // Card dealing sound
  playCardDeal() {
    this.playBeep(200, 50, 'sine')
  }

  // Chip bet sound
  playChipBet() {
    this.playBeep(300, 80, 'triangle')
    setTimeout(() => this.playBeep(350, 60, 'triangle'), 40)
  }

  // Button click sound
  playClick() {
    this.playBeep(800, 30, 'square')
  }

  // Fold sound
  playFold() {
    this.playBeep(150, 100, 'sawtooth')
  }

  // Check sound
  playCheck() {
    this.playBeep(500, 50, 'sine')
  }

  // Call sound
  playCall() {
    this.playBeep(400, 100, 'sine')
    setTimeout(() => this.playBeep(450, 80, 'sine'), 60)
  }

  // Raise sound
  playRaise() {
    this.playBeep(500, 80, 'triangle')
    setTimeout(() => this.playBeep(600, 80, 'triangle'), 60)
    setTimeout(() => this.playBeep(700, 100, 'triangle'), 120)
  }

  // All-in sound
  playAllIn() {
    this.playBeep(400, 100, 'square')
    setTimeout(() => this.playBeep(500, 100, 'square'), 80)
    setTimeout(() => this.playBeep(600, 100, 'square'), 160)
    setTimeout(() => this.playBeep(700, 150, 'square'), 240)
  }

  // Win sound
  playWin() {
    this.playBeep(523, 100, 'sine') // C
    setTimeout(() => this.playBeep(659, 100, 'sine'), 100) // E
    setTimeout(() => this.playBeep(784, 200, 'sine'), 200) // G
  }

  // Lose sound
  playLose() {
    this.playBeep(400, 150, 'sawtooth')
    setTimeout(() => this.playBeep(350, 150, 'sawtooth'), 120)
    setTimeout(() => this.playBeep(300, 200, 'sawtooth'), 240)
  }

  // Your turn notification
  playYourTurn() {
    this.playBeep(880, 100, 'sine')
    setTimeout(() => this.playBeep(880, 100, 'sine'), 150)
  }

  // Game start sound
  playGameStart() {
    this.playBeep(392, 100, 'sine') // G
    setTimeout(() => this.playBeep(523, 100, 'sine'), 100) // C
    setTimeout(() => this.playBeep(659, 150, 'sine'), 200) // E
  }

  // Community cards reveal
  playRevealCards() {
    this.playBeep(500, 80, 'triangle')
    setTimeout(() => this.playBeep(600, 80, 'triangle'), 60)
    setTimeout(() => this.playBeep(700, 80, 'triangle'), 120)
  }

  // Error/invalid action sound
  playError() {
    this.playBeep(200, 200, 'sawtooth')
  }

  // Success sound
  playSuccess() {
    this.playBeep(600, 80, 'sine')
    setTimeout(() => this.playBeep(800, 100, 'sine'), 80)
  }

  // Notification sound
  playNotification() {
    this.playBeep(700, 100, 'sine')
    setTimeout(() => this.playBeep(900, 100, 'sine'), 100)
  }
}

// Create singleton instance
const soundService = new SoundService()

export default soundService
