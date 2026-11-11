# Pikku Norppa

A little ringed seal to look after, on a frozen lake in Finnish Lapland. A 3D virtual pet that runs in the browser and works well on a phone.

**Play:** https://detailedfoil.github.io/Wife-/

On a phone, open the link and choose "Add to Home Screen" to get it as an app with its own icon. After the first visit it also opens with no signal.

## What is in it

- **A seal that grows.** A white pup (kuutti) becomes a silver youngster and then a ringed grown-up, as days of good care and friendship add up.
- **Looking after it.** Feed, stroke, wash, tuck in, clear up after it. Four needs: tummy, happiness, energy, cleanliness.
- **Time passes while you are away.** The game saves when you leave and works out what happened when you come back, so a seal left alone for a day really has had a day alone. It sleeps at night by your own clock.
- **Neglect has a price, but the seal never dies.** Leave it at rock bottom and it sulks, loses friendship points, withholds the daily gift and can fall poorly. A grown seal can have pups, and a pup whose mother goes hungry for days can be lost.
- **A real sky.** Sun, moon, seasons and weather follow your date and time as they would at 69 degrees north: polar night in midwinter, midnight sun in midsummer, northern lights on clear dark nights.
- **Things to do.** Three mini-games (Fish Rain, Nose Ball, Fish Pairs), dives through the ice hole for fish and treasures, a daily gift and visit streak.
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
