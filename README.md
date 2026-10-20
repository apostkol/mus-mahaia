# Mus Mahaia

Play Mus, the Basque card game, in the browser with three friends, with a chat beside the table.

- Four seats, two teams (Gorriak and Berdeak), partners sit opposite each other
- Full Mus round (Mus / No hay mus, discards), then Grande, Chica, Pares, Juego or Punto
- Envido, raises, Quiero / No quiero and Órdago; games to 40, 8 reyes (threes are kings, twos are aces)
- Each player's browser only ever receives their own cards; the server deals and checks every move
- Tables are rooms: start one, send the link (`yoursite.com/?t=AB12CD`), and friends join
- Matches: best of 1, 3, 5 … 21 games, each to 40 points
- Scoring: counted automatically, or by the players at the end of each hand
- Points shown as coins: one partner holds the blue 1s, the other the red 5s
- Everyone can rename their team, and set their own text size, table colour or image, deck images and card back (Settings)

## Run it on your computer

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000, start a table, and open the same link in other browser windows to try it. One person can sit in several seats for testing; a "Playing as" switcher appears.

## Put it online

The app is a single Node.js process (`npm start`) serving the page and a WebSocket on the same port. It reads the port from the `PORT` environment variable, so any host that runs Node and supports WebSockets works.

**Render** (has a free tier):

1. Put this folder in a GitHub repository.
2. On render.com, create a **Web Service** from that repository.
3. Build command: `npm install`. Start command: `npm start`.
4. Deploy, then share the `onrender.com` address with your friends.

Railway, Fly.io, a small VPS, or a Raspberry Pi at home work the same way.

## Good to know

- Game state and chat live in the server's memory. Restarting or redeploying clears all tables. Free hosting plans often put the app to sleep after a while without visitors, which also clears them, and the first visit after that takes a few seconds to wake it up.
- Players are recognised by a random id saved in their browser. Switching browser or device means sitting down again; use **free seat** to clear an old one.
- There is no login: anyone with a table link can watch it or take an empty seat. Use a fresh table code for each group.

## Files

- `server.js` – web server, rooms, chat, and what each player is allowed to see
- `engine.js` – the Mus rules (dealing, lances, betting, scoring), shared by server and browser
- `index.html` – the table, chat and settings in the browser
- `cards/` – one picture per card (`oros_1.jpg` … `bastos_12.jpg`) and the card back (`backside.jpg`). Replace any of them with your own picture under the same name.
