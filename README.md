# Mus Mahaia

Play Mus, the Basque card game, in the browser with friends or against bots, with a chat beside the table.

- Four seats, two teams (Gorriak and Berdeak), partners sit opposite each other
- Full Mus round (Mus / No hay mus, discards), then Grande, Chica, Pares, Juego or Punto
- Envido, raises, Quiero / No quiero and Órdago; games to 40, 8 reyes (threes are kings, twos are aces)
- Each player's browser only ever receives their own cards; the server deals and checks every move
- Tables are rooms: start one, send the link (`yoursite.com/?t=AB12CD`), and friends join
- Matches: best of 1, 3, 5 … 21 games, each to 40 points
- Scoring: counted automatically, or by the players at the end of each hand
- Points shown as coins: one partner holds the blue 1s, the other the red 5s
- Bots: add up to 3 to any table (when creating it, or with **Add bot** on an empty seat)
- Avatars: everyone has the same face and chooses their hair, shirt, glasses and facial hair (Settings)
- Signs (keinuak): tap your own avatar to make a sign about your hand; the avatar makes it for half a second (two kings, three kings, two aces, three aces, three of a kind, two pairs, 31, la bonita, 30, 29, nothing)
- Every finished hand is saved for statistics (see below)
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

## Hand data for statistics

Every hand is saved once it is over (hands that are abandoned or reset halfway are not saved):

- `data/deal_0_first_hand.csv` – the cards each player was first dealt
- `data/deal_1_after_1_mus.csv` – the cards after the first mus, `deal_2_after_2_mus.csv` after the second, and so on
- `data/hands.jsonl` – everything about each hand (all deals, what was discarded, lance results, score), one hand per line

Each CSV row is one player's four cards, sorted high to low, with: hand id, date, table, mus round, seat, position (1 = mano … 4 = postre), human or bot, the cards, their game values, number of kings and aces, pares, points, juego, how many cards the player threw away after this deal, and whether these were the cards the hand was played with.

On the website, open `/data` (for example `https://mus-mahaia.onrender.com/data`) to download the files. **Download them regularly:** on Render's free plan the files are deleted whenever the app restarts, goes to sleep or is updated.

To collect a lot of data quickly, let four bots play on your own computer:

```bash
npm run simulate -- 100000
```

This plays 100,000 hands in under a minute and adds them to the `data` folder. The `data` folder is not uploaded to GitHub.

## Good to know

- Game state and chat live in the server's memory. Restarting or redeploying clears all tables. Free hosting plans often put the app to sleep after a while without visitors, which also clears them, and the first visit after that takes a few seconds to wake it up.
- Players are recognised by a random id saved in their browser. Switching browser or device means sitting down again; use **free seat** to clear an old one.
- There is no login: anyone with a table link can watch it or take an empty seat. Use a fresh table code for each group.

## Files

- `server.js` – web server, rooms, chat, and what each player is allowed to see
- `engine.js` – the Mus rules (dealing, lances, betting, scoring), shared by server and browser
- `index.html` – the table, chat and settings in the browser
- `bot.js` – how the bots play
- `recorder.js` – saves finished hands to the data files
- `simulate.js` – lets bots play many hands to collect data
- `deck.js` – the playing cards: a Spanish-style deck drawn in code, with big corner numbers
- `cards/` – photos of a real deck, kept for reference (the game doesn't use them)
