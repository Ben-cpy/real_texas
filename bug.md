# Registration Interface Display Error
When registering a new user, the username field appears completely white, and the password input is also white. You can only perceive the input when the field is selected.

# Single Player Game Default Player Count
+ On the main interface, currently there is only one player (me). When entering single player mode, the default configuration should be a 6-player game. During the game preparation phase, I should be able to increase or decrease the number of players (minimum is 3 players).

# Single Player Game Re-entry Failure
When I exit and re-enter, there are many notification sounds and a message saying "Unable to join room." I don't know the cause of the issue. Logically, clicking "Leave" should destroy the room, since this is a single player game with only me and some AI.

# Single Player Game Cannot Start
After clicking "Start Game," there is a display error on the frontend. ![alt text](image.png) It shows "Your Turn," but when I perform actions, my table keeps moving down and displays "Invalid Player." I can repeatedly click these actions, which does not follow the real rules. Since I only have one action, it should proceed to the next round.

# Adding AI After Game Start
Why does the option to add AI only appear after the game has started? Once the game officially begins, the number of players should not be modified.

# Issues with the Entire Game Flow
Currently, the entire game flow is not working correctly. After seeing the initial cards, there should be big blind/small blind, actions, etc. You need to ensure the whole process is correct and that the frontend supports complete interactive gameplay.
