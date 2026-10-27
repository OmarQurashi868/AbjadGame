# أبجد — Abjad Game

A real-time multiplayer Arabic letter game (similar to "Stop" / البلد والحيوان), built with Node.js and WebSockets.

## How to Play

1. A host creates a lobby and shares the link
2. Players join and the host configures rounds, timer, letters, and categories
3. Each round, a random Arabic letter is picked — players fill in a word per category starting with that letter
4. Any player who fills all categories can hit **STOP** to end the round early
5. Players vote on each other's answers, then scores are tallied
6. Unique correct answers → 10 pts · Shared correct answers → 5 pts · Wrong → 0 pts

## Run Locally

```bash
npm install
npm start
# → http://localhost:3000
```

## Run with Docker Compose

Run the game using Docker Compose with detached mode (`-d`) to keep it running in the background:

```bash
# Start container in detached mode (background)
docker compose up -d --build

# View container logs
docker compose logs -f

# Stop container
docker compose down
```

> [!NOTE]
> The `-d` (or `--detach`) flag runs the container in the background and frees up your terminal prompt.

## Run with Docker

```bash
docker build -t abjad-game .
docker run -d -p 3000:3000 --name abjad-game abjad-game
# → http://localhost:3000
```

## Run from GHCR

```bash
docker pull ghcr.io/omarqurashi868/abjadgame:latest
docker run -d -p 3000:3000 --name abjad-game ghcr.io/omarqurashi868/abjadgame:latest
```
