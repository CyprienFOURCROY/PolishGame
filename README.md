# PolishGame
This repository is for educational purpose

## Run
Put your keys in `.env` (git-ignored):
```
ELEVEN_LABS_API_KEY = ...
OPEN_AI_API_KEY = ...
OPEN_AI_BUDGET_USD = 5      # optional: shows what is left in the credits panel
```
Then `npm start` and open http://localhost:8000.

Arrows move · Space jumps (also in the air) · Click turns the camera, Esc locks it · E talks · U opens the panel (credits, OpenAI model, volumes) · S opens it on the sound settings.
Conversations are saved in `Audio/<Character>/Conversation_<n>/`. Characters live in `characters.json`, voices in `Audio/voices.json`.
