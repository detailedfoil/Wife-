# Pikku Norppa

A little ringed seal to look after, on a frozen lake in Finnish Lapland. A 3D virtual pet that runs in the browser and works well on a phone.

**Play:** https://detailedfoil.github.io/Wife-/

On a phone, open the link and choose "Add to Home Screen" to get it as an app with its own icon. After the first visit it also opens with no signal.

## What is in it

- **A seal that grows.** A white pup (kuutti) becomes a silver youngster and then a ringed grown-up, as days of good care and friendship add up.
- **Looking after it.** Feed, stroke, wash, tuck in, clear up after it. Four needs: tummy, happiness, energy, cleanliness.
- **Time passes while you are away.** The game saves when you leave and works out what happened when you come back, so a seal left alone for a day really has had a day alone. It sleeps at night by your own clock.
- **It needs looking after about five or six times a day, but the seal never dies.** Hunger drops to a quarter in about six hours and hits empty in about eight. Needs run at the same pace whether the game is open or closed. A seal left hungry, grubby or glum gets Angy (a four hour nap clears a full Angy spell; each of the three treats she asks for takes a fifth off it, and so do three head pats together and a bath), loses friendship points and stops growing, then slips back, and after a while falls poorly. Once a day keeps it alive but it will not grow up; five or six visits a day keeps it thriving, like an old-style Tamagotchi. The mini-games get quicker the longer you last, and feeding is always allowed. A grown seal can have pups (two at most), each born wearing a little thing of its own (one in ten gets two) so the family can be told apart, and a pup whose mother goes hungry for a couple of days can be lost. The Family album shows a little portrait of every pup in its own outfit, and a pup that has grown up can be called home from there: it arrives an hour later (bringing 100 coins), stays on the shore until you send it home or 8 hours are up, and can be called again 12 hours after the call; two visitors at a time at most. Pop-ups ignore taps for the first half second so a double tap cannot choose Close by accident. Waving a grown pup goodbye pays 200 coins. Developer mode has pup tools in Settings: a new pup now, pups ready to leave, farewell now, new outfits, poorly pups and feeding them back to health. When money runs out, the neighbours spare fish, and juice for a poorly seal.
- **A live sky.** The sun and moon are worked out for Inari in Finnish Lapland (69 degrees north) at this very moment, wherever you are, so it gets dark when it gets dark there: polar night in midwinter, midnight sun in midsummer. The temperature, cloud, wind and snowfall are the real ones over Inari, fetched from [Open-Meteo](https://open-meteo.com/) every quarter of an hour, with a made-up forecast as the fallback when there is no signal. Northern lights show on clear dark nights.
- **Daily medicine.** She needs her medicine each day. From 6am she is Anxi (anxious, wide-eyed and trembling) until she has had it, and nothing else calms her down. Tap Medicine and either take a photo of the pill with the phone's camera for 100 bonus coins (the check for a small round white tablet runs on the phone; the photo is not kept or sent) or tap I took it (which skips the bonus for that day). The day starts afresh at midnight.
- **Things to do.** Eleven mini-games, unlocked with coins: Nose Ball (free), Fish Rain (200), Swimmy Seal (450, three goes and the best one counts), Ice Stack (575, a Stack-style tower of sliding ice floes: tap to set each down, the overhang breaks off, one floe that misses the tower ends it), Puffer Sweeper (650, minesweeper with pufferfish: one 9 by 9 board with ten of them, the first tap is always safe, every board can be cleared without guessing, one pufferfish ends it, and the coins go by how fast it was cleared), Snowball Toss (700, a Paper Toss-style flick into a bucket until the third miss), Ice Piano (775, piano tiles: tap the tiles of a tune in order as they slide down four lanes, each tap plays its note, the tune starts at 78 beats a minute, loops and steps up by 7.5 at every half loop to 134, one slip ends it, and it pays 0.2 coins a tile; the first tune is Ievan polkka, a traditional Finnish polka, and tunes are plain note lists in `PN.SONGS` in data.js), Löyly (850, a sauna game played like Stardew fishing: hold to keep the heat needle in the green; unlocking it builds the sauna on the shore), Curling Seal (1,000), Sled Run (1,250) and Blackjack (1,500, choose your bet from 5 sardines up to all in with a slider, a win pays back 3.5 times the bet, cash out for coins at 0.7 a sardine, and the table closes once you have won 50 sardines; the dealer plays fast and the next bet is ready as soon as a hand ends). Every game was simulated at four skill levels and pays about the same per minute whichever you pick: roughly 16 coins a minute for a beginner, 24 casual, 31 good and 37 expert. Puffer Sweeper is the exception, because it pays by the clock: 60.5 × seconds^-0.3 coins for a cleared board (30 for ten seconds or less, 25 for 20 seconds, 22 for 30, 18 for a minute, 14 for two) and nothing for a lost one, so quick players earn more a minute there and slow ones less. Playing tires her by how long the game lasted (about 12 energy for a 40 second game), not a flat amount per game. Also dives through the ice hole for fish and treasures, a daily gift and visit streak.
- **Things to collect.** 14 fish, 12 treasures, 42 Finnish words, 37 awards, hats, scarves and things for the shore, up to a sauna. A Cosy den shelf makes her hut snug: cushions, candlelight, a door curtain, a reindeer hide and a rya rug at the door, and a knitted snuggle blanket she sleeps tucked under at night (folded by the door by day). On a hide or under the blanket she curls up sideways across the doorway.
- **Sound.** Every squeak and splash is made on the spot with Web Audio, and a kantele plays now and then. Both can be turned off in Settings.
- **English or Finnish.** Switch on the first screen or in Settings. Everything is translated: menus, messages, item notes, awards and the mini-games.

## Saving

The seal is kept in the browser's own storage on the device, so there is no account and nothing is sent anywhere. Clearing the browser's site data clears the seal. Settings has a save code for moving a seal to another phone or browser.

## How it is built

Plain HTML, CSS and JavaScript with [three.js](https://threejs.org) for the 3D. No build step: the files in this repository are exactly what runs. Every model is made from code, so there are no model, image or sound files to load.

```
index.html              sends visitors to norppa/
norppa/
  index.html            the page
  css/style.css         the interface
  js/data.js            fish, food, clothes, decorations, words, awards
  js/lang.js            the Finnish text
  js/sim.js             the rules: needs, time away, growing, pups, rewards, saving
  js/astro.js           sun, moon, season and weather for the date and time
  js/audio.js           sound effects and music
  js/props.js           every small 3D object
  js/seal.js            the seal: body, face, moods, moves
  js/fx.js              hearts, sparkles, bubbles, splashes
  js/world.js           the shore, lake, sky, lights and camera
  js/ui.js              bars, menus, messages
  js/games.js           Fish Rain, Nose Ball and the shared game screen
  js/main.js            ties it all together
  sw.js                 offline support
  vendor/three.min.js   three.js r160 (MIT licence)
  fonts/                DynaPuff and Nunito (SIL Open Font Licence)
```

## Hosting

This is a GitHub Pages site served from the `main` branch, root folder (Settings, Pages, Deploy from a branch). Any push to `main` updates the live game within a minute or two.
