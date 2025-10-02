# How to Add a New AI Bot Strategy

This document provides a guide for developers looking to add a new AI bot strategy to the poker game.

## Overview

The AI's decision-making process is centralized within the `PokerGame` class in `backend/src/services/PokerGame.js`. To add a new AI strategy, you will primarily be working within this file.

## Key Files and Functions

### 1. `backend/src/services/PokerGame.js`

This file contains the core game logic and the existing AI implementation.

#### **`getAIAction(player)`**

This is the primary function to modify. It's responsible for deciding the AI's next move based on the current game state.

*   **Input:**
    *   `player`: The AI player object, which contains information like their cards (`player.cards`), chips, and current bet.

*   **Output:**
    *   An object representing the AI's action. The object should have the following structure:
        *   `{ action: 'fold' }`
        *   `{ action: 'check' }`
        *   `{ action: 'call' }`
        *   `{ action: 'raise', amount: <number> }`
        *   `{ action: 'all_in' }`

You can add your new AI strategy by creating a new function (e.g., `getAdvancedAIAction`) and then calling it from within `getAIAction`, perhaps based on a new property on the `player` object (e.g., `player.strategy`).

#### **`calculateHandStrength(player)`**

This function evaluates the strength of the AI's hand. You can enhance this function or create a new one to provide more nuanced hand evaluations for your new AI strategy.

*   **Input:**
    *   `player`: The AI player object.

*   **Output:**
    *   A number between 0 and 1, representing the hand strength.

#### **`getPlayerPosition(player)`**

This function determines the player's position at the table (early, middle, or late). This is a crucial factor in poker strategy, and you can use this information in your new AI logic.

*   **Input:**
    *   `player`: The AI player object.
*   **Output:**
    *   A string: `'early'`, `'middle'`, or `'late'`.

### 2. Game State

The `PokerGame` class instance (`this`) holds the complete game state. Here are some of the most important properties you'll need to use for your AI's decision-making:

*   `this.communityCards`: An array of the community cards on the table.
*   `this.pot`: The total size of the pot.
*   `this.currentBet`: The current highest bet that must be matched.
*   `this.phase`: The current phase of the game (`'preflop'`, `'flop'`, `'turn'`, `'river'`).
*   `this.players`: An array of all players in the game.

## Steps to Add a New AI Strategy

1.  **Create a New AI Logic Function:** In `PokerGame.js`, create a new function, for example, `getStrategyOneAIAction(player)`. This function will contain the logic for your new AI.

2.  **Integrate the New Strategy:** In the `getAIAction` function, add a mechanism to select which AI strategy to use. For example, you could add a `strategy` property to the AI player object and use a `switch` statement to call the appropriate function.

    ```javascript
    getAIAction(player) {
      switch (player.strategy) {
        case 'strategy_one':
          return this.getStrategyOneAIAction(player);
        case 'default':
        default:
          // Existing AI logic here
      }
    }
    ```

3.  **Assign the Strategy to AI Players:** When creating AI players in the `addAIPlayer` function, you can assign your new strategy to them.

    ```javascript
    addAIPlayer() {
      // ...
      this.addPlayer({
        // ...
        isAI: true,
        strategy: 'strategy_one' // or 'default'
      });
    }
    ```

By following these steps, you can successfully integrate a new, more advanced AI strategy into the game.