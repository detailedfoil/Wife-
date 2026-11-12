# Pikku Norppa

A little ringed seal to look after, on a frozen lake in Finnish Lapland. A 3D virtual pet that runs in the browser and works well on a phone.

**Play:** https://detailedfoil.github.io/Wife-/

On a phone, open the link and choose "Add to Home Screen" to get it as an app with its own icon. After the first visit it also opens with no signal.

## What is in it

- **A seal that grows.** A white pup (kuutti) becomes a silver youngster and then a ringed grown-up, as days of good care and friendship add up.
- **Looking after it.** Feed, stroke, wash, tuck in, clear up after it. Four needs: tummy, happiness, energy, cleanliness.
- **Time passes while you are away.** The game saves when you leave and works out what happened when you come back, so a seal left alone for a day really has had a day alone. It sleeps at night by your own clock.
- **It needs looking after about five or six times a day, but the seal never dies.** Hunger drops to a quarter in about six hours and hits empty in about eight. Needs run at the same pace whether the game is open or closed. A seal left hungry, grubby or glum gets Angy (a four hour nap clears a full Angy spell; each of the five treats she asks for takes a sixth off it, and ten head pats take off another sixth), loses friendship points and stops growing, then slips back, and after a while falls poorly. Once a day keeps it alive but it will not grow up; five or six visits a day keeps it thriving, like an old-style Tamagotchi. The mini-games get quicker the longer you last, and feeding is always allowed. A grown seal can have pups, and a pup whose mother goes hungry for a couple of days can be lost. When money runs out, the neighbours spare fish, and juice for a poorly seal.
- **A live sky.** The sun and moon are worked out for Inari in Finnish Lapland (69 degrees north) at this very moment, wherever you are, so it gets dark when it gets dark there: polar night in midwinter, midnight sun in midsummer. The temperature, cloud, wind and snowfall are the real ones over Inari, fetched from [Open-Meteo](https://open-meteo.com/) every quarter of an hour, with a made-up forecast as the fallback when there is no signal. Northern lights show on clear dark nights.
- **Things to do.** Seven mini-games, unlocked with coins: Nose Ball (free), Fish Rain (200), Swimmy Seal (500), Snowball Toss (800, a Paper Toss-style flick into a bucket), Curling Seal (1,100), Sled Run (1,500) and Blackjack (1,800, bet 5 sardines a hand, a win pays five times the bet, cash out for coins), dives through the ice hole for fish and treasures, a daily gift and visit streak.
- **Things to collect.** 14 fish, 12 treasures, 42 Finnish words, 37 awards, hats, scarves and things for the shore, up to a sauna.
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
  js/games.js           the three mini-games
  js/main.js            ties it all together
  sw.js                 offline support
  vendor/three.min.js   three.js r160 (MIT licence)
  fonts/                DynaPuff and Nunito (SIL Open Font Licence)
```

## Hosting

This is a GitHub Pages site served from the `main` branch, root folder (Settings, Pages, Deploy from a branch). Any push to `main` updates the live game within a minute or two.
