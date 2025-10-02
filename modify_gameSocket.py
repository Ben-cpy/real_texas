from pathlib import Path

def insert_constant(text):
    if 'const AI_ACTION_DELAY_MS' in text:
        return text
    for newline in ('\r\n', '\n'):
        marker = f'const DEFAULT_INITIAL_SEATS = 6{newline}{newline}'
        if marker in text:
            return text.replace(marker, marker + 'const AI_ACTION_DELAY_MS = 1000' + newline + newline, 1)
    return text

def replace_settimeout(text):
    return text.replace('}, 1000)\n\n        // Check if game is finished', '}, AI_ACTION_DELAY_MS)\n\n        // Check if game is finished', 1)\
                .replace('}, 1000)\r\n\r\n        // Check if game is finished', '}, AI_ACTION_DELAY_MS)\r\n\r\n        // Check if game is finished', 1)

def replace_comment(text):
    return text.replace('AI action interval - 5 second delay to let players see AI actions clearly', 'AI action interval - 1 second delay to keep actions readable without dragging on', 1)

def replace_delay(text):
    return text.replace('await new Promise(resolve => setTimeout(resolve, 5000))', 'await new Promise(resolve => setTimeout(resolve, AI_ACTION_DELAY_MS))', 1)

def remove_auto_start(text):
    import re
    pattern = re.compile(r'\s*setTimeout\(async \(\) => \{[\s\S]*?\}, 2500\)')
    return pattern.sub('', text, count=1)

def update_log(text):
    return text.replace('    console.log(`Game finished in room ${roomId}, winner: ${results.winner.name}`)', '    console.log(`Game finished in room ${roomId}, awaiting manual restart`)', 1)

def replace_start_game(text):
    start_marker = '  // Start game'
    end_marker = '  // Reset game'
    start = text.find(start_marker)
    end = text.find(end_marker, start)
    if start == -1 or end == -1:
        return text
    new_block = """  // Start game\n  socket.on('start_game', async () => {\n    try {\n      if (!socket.userId || !socket.currentRoomId) {\n        socket.emit('error', { error: 'Invalid game state' })\n        return\n      }\n\n      const game = activeRooms.get(socket.currentRoomId)\n      if (!game) {\n        socket.emit('error', { error: 'Game does not exist' })\n        return\n      }\n\n      const room = await GameRoom.findById(socket.currentRoomId)\n      if (room.creator_id !== socket.userId) {\n        socket.emit('error', { error: 'Only the host can start the game' })\n        return\n      }\n\n      let result\n      let continued = false\n\n      if (game.gameStarted && game.gameFinished) {\n        result = game.startNextHand()\n        continued = true\n      } else {\n        result = game.startGame()\n      }\n\n      if (result.success) {\n        await GameRoom.updateStatus(socket.currentRoomId, 'playing')\n        await GameRoom.updatePlayers(socket.currentRoomId, game.getPlayers())\n        await GameRoom.updateGameState(socket.currentRoomId, game.getGameState())\n\n        io.to(socket.currentRoomId).emit('game_started', {\n          gameState: game.getGameState(),\n          continuation: continued\n        })\n\n        await processAIActions(game, socket.currentRoomId, io)\n\n        console.log(`${continued ? 'Next hand' : 'Game'} started in room ${socket.currentRoomId}`)\n      } else {\n        socket.emit('error', { error: result.error })\n      }\n\n    } catch (error) {\n      console.error('Start game error:', error)\n      socket.emit('error', { error: 'Failed to start game' })\n    }\n  })\n\n"""
    return text[:start] + new_block + text[end:]

path = Path('backend/src/socket/gameSocket.js')
text = path.read_text(encoding='utf-8')
text = insert_constant(text)
text = replace_settimeout(text)
text = replace_comment(text)
text = replace_delay(text)
text = remove_auto_start(text)
text = update_log(text)
text = replace_start_game(text)
path.write_text(text, encoding='utf-8')
