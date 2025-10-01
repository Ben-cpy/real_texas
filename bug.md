# Logout Button
Add a button at the top right corner of the main interface. Clicking it will log out the current account, allowing login with another account.

# Single Player Game Re-entry Failure
The issue still exists. When I log in for the first time and start a single player game, I can only complete a relatively complete process on the first run. However, there is still a problem during settlement, and the two AI players do not finish the game. After finishing a round, the game should automatically start the next round, and the previous state needs to be cleared.
When I exit and re-enter, there are many notification sounds and a message saying "Unable to join room." I don't know the cause. Logically, clicking "Leave" should destroy the room, since this is a single player game with only me and some AI.

# Restart Button Not Working
During the unready phase, there shouldn't be a restart button. Currently, if I click the restart button during the unready phase, my table moves downward. I don't know why this happens.

# Hand Display Error
After starting the game, I can't see my own two cards; they are all shown as gray. I can't see the AI players' cards either, but I should be able to see my own. Also, the table is too crowded, and the players and my table are not aligned. ![alt text](image.png) Some cards are blocked by other players. The card backs are also too ugly; please use a fresher style.

# State Management Error
After playing a round, when I exit and re-enter the game, ![alt text](image-1.png) a bunch of errors are displayed. There is a problem with your state management. Every time I enter a room, the state should be reset.

# Incorrect Display
Currently, even when the game hasn't started, it shows "My Turn" and the buttons can be clicked. These actions should only be available when it's actually my turn.

# Overall Flow
Currently, it's not possible to play a complete Texas Hold'em game with AI players. You should make sure the entire process can be completed.
