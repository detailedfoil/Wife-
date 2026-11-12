/* Pikku Norppa: content tables.
   Fish, food, things to wear, things for the shore, finds, Finnish words, awards. */
(function (PN) {
  /* When the game was last changed. Stamped by hand each time the game is updated. */
  PN.UPDATED = '2026-11-12T16:39:24Z';
  'use strict';

  /* Fish. rarity: 1 common, 2 uncommon, 3 rare, 4 epic, 5 legendary.
     look feeds the 3D fish builder in props.js. */
  const FISH = [
    { id: 'muikku', fi: 'Muikku', en: 'Vendace', rarity: 1, food: 12, price: 3,
      note: "Small, silvery, and a ringed seal's favourite snack.",
      look: { len: 0.85, tall: 0.30, back: 0x5f86b0, belly: 0xf2f6fa, fin: 0x9fb4c9, pattern: 'plain' } },
    { id: 'kuore', fi: 'Kuore', en: 'Smelt', rarity: 1, food: 10,
      note: 'Fresh from the water it smells of cucumber. Really.',
      look: { len: 0.8, tall: 0.24, back: 0x9fbfae, belly: 0xf4f7f2, fin: 0xcfdcd3, pattern: 'plain' } },
    { id: 'ahven', fi: 'Ahven', en: 'Perch', rarity: 1, food: 15, price: 5,
      note: "Finland's national fish, striped like a little tiger.",
      look: { len: 0.95, tall: 0.42, back: 0x6f8f3a, belly: 0xf3ead0, fin: 0xe2582e, pattern: 'stripes', mark: 0x2f4420, dorsal: 1.5 } },
    { id: 'sarki', fi: 'Särki', en: 'Roach', rarity: 1, food: 13,
      note: 'Red eyes, red fins, found in nearly every lake.',
      look: { len: 0.9, tall: 0.40, back: 0x7c8fa3, belly: 0xeef1f4, fin: 0xd9533f, pattern: 'plain', eye: 0xd9533f } },
    { id: 'kiiski', fi: 'Kiiski', en: 'Ruffe', rarity: 1, food: 9,
      note: 'Small and spiky. Mind the fins.',
      look: { len: 0.7, tall: 0.38, back: 0x8a7a55, belly: 0xe9dfc3, fin: 0xa89466, pattern: 'spots', mark: 0x4f4430, dorsal: 1.7 } },
    { id: 'siika', fi: 'Siika', en: 'Whitefish', rarity: 2, food: 20, price: 9,
      note: 'Lovely smoked. Seals prefer it raw.',
      look: { len: 1.15, tall: 0.36, back: 0x8fa7b8, belly: 0xfafcfd, fin: 0x9aa9b6, pattern: 'plain' } },
    { id: 'harjus', fi: 'Harjus', en: 'Grayling', rarity: 2, food: 20,
      note: 'Wears a tall fin like a sail.',
      look: { len: 1.05, tall: 0.36, back: 0x7d7f9c, belly: 0xe8e6ee, fin: 0xb0527a, pattern: 'spots', mark: 0x444466, dorsal: 2.4 } },
    { id: 'made', fi: 'Made', en: 'Burbot', rarity: 2, food: 22,
      note: 'Lays its eggs in midwinter, under the ice.',
      look: { len: 1.25, tall: 0.30, back: 0x6b5a3c, belly: 0xe2d6b8, fin: 0x7a6947, pattern: 'marble', mark: 0x3d3221 } },
    { id: 'hauki', fi: 'Hauki', en: 'Pike', rarity: 3, food: 28,
      note: 'The long-nosed hunter of the reed beds.',
      look: { len: 1.5, tall: 0.30, back: 0x4f7a3f, belly: 0xeef0d8, fin: 0xb8793a, pattern: 'spots', mark: 0xd8e0a0, snout: 1.6 } },
    { id: 'kuha', fi: 'Kuha', en: 'Zander', rarity: 3, food: 26,
      note: 'Glassy eyes that see in murky water.',
      look: { len: 1.3, tall: 0.34, back: 0x7a7f5e, belly: 0xf1eedb, fin: 0x8d916f, pattern: 'stripes', mark: 0x3f4433, dorsal: 1.5 } },
    { id: 'taimen', fi: 'Taimen', en: 'Brown trout', rarity: 3, food: 30,
      note: 'Dotted with red, as if painted.',
      look: { len: 1.25, tall: 0.38, back: 0x7a6a45, belly: 0xf0e6c8, fin: 0xb98a4a, pattern: 'spots', mark: 0xb23a2a } },
    { id: 'nieria', fi: 'Nieriä', en: 'Arctic char', rarity: 4, food: 32,
      note: 'A fish of the coldest northern lakes, with a sunset belly.',
      look: { len: 1.2, tall: 0.38, back: 0x2f5a52, belly: 0xf0603a, fin: 0xf7f2e8, pattern: 'spots', mark: 0xf2c9b0 } },
    { id: 'lohi', fi: 'Lohi', en: 'Salmon', rarity: 4, food: 36,
      note: 'Swam all the way up from the sea.',
      look: { len: 1.6, tall: 0.40, back: 0x5a7896, belly: 0xf5f7f9, fin: 0x6f879c, pattern: 'spots', mark: 0x2b3c4d } },
    { id: 'kultamuikku', fi: 'Kultamuikku', en: 'Golden vendace', rarity: 5, food: 50, joy: 20,
      note: 'Fishermen swear it is only a story.',
      look: { len: 0.9, tall: 0.32, back: 0xf2b73a, belly: 0xfff1b8, fin: 0xffd866, pattern: 'gold' } },
  ];

  /* Shop food that is not a fish. */
  const FOODS = [
    { id: 'katkarapu', fi: 'Katkarapu', en: 'Shrimp', food: 8, joy: 14, price: 10,
      note: 'A little treat. Cheers anyone up.' },
    { id: 'kalakukko', fi: 'Kalakukko', en: 'Fish pie', food: 42, joy: 8, price: 18,
      note: 'Fish baked inside a rye loaf. Very filling.' },
    { id: 'lohikeitto', fi: 'Lohikeitto', en: 'Salmon soup', food: 48, joy: 14, price: 24,
      note: 'Creamy, warm, with plenty of dill.' },
    { id: 'sealsius', fi: 'Norpsius', en: 'Sealsius energy drink', food: 4, joy: 6, energy: 35, price: 20,
      note: 'Zero sugar, seven vitamins and a very high squeak content. A burst of energy, but only a sip of dinner.' },
    { id: 'lakkamehu', fi: 'Lakkamehu', en: 'Cloudberry juice', med: true, price: 25,
      note: 'Golden and full of vitamins. Makes a poorly seal better.' },
  ];

  /* Things to wear. slot: where it goes on the seal (head, neck, face or back; one thing per slot).
     cat: which shelf of the shop it sits on. Prices here are base prices; see ECON below. */
  const WEAR_CATS = [
    { id: 'pipot', t: 'Woolly hats' }, { id: 'hatut', t: 'Fancy hats' }, { id: 'korvat', t: 'Ears and flowers' },
    { id: 'kaula', t: 'Round the neck' }, { id: 'kasvot', t: 'On the face' }, { id: 'selka', t: 'On the back' },
  ];
  const WEAR = [
    { id: 'pipo_red', slot: 'head', cat: 'pipot', fi: 'Punainen pipo', en: 'Red bobble hat', price: 60 },
    { id: 'pipo_blue', slot: 'head', cat: 'pipot', fi: 'Sininen pipo', en: 'Blue bobble hat', price: 60 },
    { id: 'pipo_yellow', slot: 'head', cat: 'pipot', fi: 'Keltainen pipo', en: 'Yellow bobble hat', price: 60 },
    { id: 'pipo_pink', slot: 'head', cat: 'pipot', fi: 'Vaaleanpunainen pipo', en: 'Pink bobble hat', price: 60 },
    { id: 'pipo_green', slot: 'head', cat: 'pipot', fi: 'Vihreä pipo', en: 'Green bobble hat', price: 60 },
    { id: 'earmuffs', slot: 'head', cat: 'pipot', fi: 'Korvaläpät', en: 'Earmuffs', price: 90 },
    { id: 'tonttu', slot: 'head', cat: 'pipot', fi: 'Tonttulakki', en: 'Elf hat', price: 110 },
    { id: 'karvalakki', slot: 'head', cat: 'pipot', fi: 'Karvalakki', en: 'Fur hat', price: 140 },

    { id: 'juhlahattu', slot: 'head', cat: 'hatut', fi: 'Juhlahattu', en: 'Party hat', price: 80 },
    { id: 'baskeri', slot: 'head', cat: 'hatut', fi: 'Baskeri', en: 'Beret', price: 90 },
    { id: 'olkihattu', slot: 'head', cat: 'hatut', fi: 'Olkihattu', en: 'Straw hat', price: 100 },
    { id: 'kokinhattu', slot: 'head', cat: 'hatut', fi: 'Kokinhattu', en: "Chef's hat", price: 120 },
    { id: 'yolakki', slot: 'head', cat: 'hatut', fi: 'Ylioppilaslakki', en: 'Student cap', price: 150 },
    { id: 'silinteri', slot: 'head', cat: 'hatut', fi: 'Silinteri', en: 'Top hat', price: 180 },
    { id: 'velho', slot: 'head', cat: 'hatut', fi: 'Velhonhattu', en: 'Wizard hat', price: 200 },
    { id: 'viikinki', slot: 'head', cat: 'hatut', fi: 'Viikinkikypärä', en: 'Viking helmet', price: 220 },
    { id: 'crown', slot: 'head', cat: 'hatut', fi: 'Kruunu', en: 'Tiny crown', price: 300 },

    { id: 'kukka', slot: 'head', cat: 'korvat', fi: 'Päivänkakkara', en: 'Daisy', price: 70 },
    { id: 'bow', slot: 'head', cat: 'korvat', fi: 'Rusetti', en: 'Bow', price: 80 },
    { id: 'kissa', slot: 'head', cat: 'korvat', fi: 'Kissankorvat', en: 'Cat ears', price: 100 },
    { id: 'pupu', slot: 'head', cat: 'korvat', fi: 'Pupunkorvat', en: 'Bunny ears', price: 110 },
    { id: 'wreath', slot: 'head', cat: 'korvat', fi: 'Kukkaseppele', en: 'Flower crown', price: 120 },
    { id: 'sarvet', slot: 'head', cat: 'korvat', fi: 'Poronsarvet', en: 'Reindeer antlers', price: 130 },
    { id: 'kuulokkeet', slot: 'head', cat: 'korvat', fi: 'Kuulokkeet', en: 'Headphones', price: 140 },
    { id: 'sieni', slot: 'head', cat: 'korvat', fi: 'Kärpässienihattu', en: 'Toadstool hat', price: 150 },
    { id: 'sadekeha', slot: 'head', cat: 'korvat', fi: 'Sädekehä', en: 'Halo', price: 250 },

    { id: 'scarf_red', slot: 'neck', cat: 'kaula', fi: 'Raitakaulaliina', en: 'Striped scarf', price: 70 },
    { id: 'scarf_green', slot: 'neck', cat: 'kaula', fi: 'Vihreä kaulaliina', en: 'Green scarf', price: 70 },
    { id: 'scarf_blue', slot: 'neck', cat: 'kaula', fi: 'Sinivalkoinen kaulaliina', en: 'Blue and white scarf', price: 70 },
    { id: 'huivi', slot: 'neck', cat: 'kaula', fi: 'Huivi', en: 'Neckerchief', price: 80 },
    { id: 'scarf_rainbow', slot: 'neck', cat: 'kaula', fi: 'Sateenkaarikaulaliina', en: 'Rainbow scarf', price: 90 },
    { id: 'solmuke', slot: 'neck', cat: 'kaula', fi: 'Solmuke', en: 'Bow tie', price: 90 },
    { id: 'bell', slot: 'neck', cat: 'kaula', fi: 'Kulkunen', en: 'Jingle bell', price: 100 },
    { id: 'solmio', slot: 'neck', cat: 'kaula', fi: 'Solmio', en: 'Necktie', price: 100 },
    { id: 'kukkakaulus', slot: 'neck', cat: 'kaula', fi: 'Kukkaköynnös', en: 'Flower garland', price: 120 },
    { id: 'helmet', slot: 'neck', cat: 'kaula', fi: 'Helminauha', en: 'Pearl necklace', price: 180 },
    { id: 'mitali', slot: 'neck', cat: 'kaula', fi: 'Kultamitali', en: 'Gold medal', price: 200 },

    { id: 'punanena', slot: 'face', cat: 'kasvot', fi: 'Punainen nenä', en: 'Red nose', price: 60 },
    { id: 'viikset', slot: 'face', cat: 'kasvot', fi: 'Viikset', en: 'Moustache', price: 90 },
    { id: 'silmalappu', slot: 'face', cat: 'kasvot', fi: 'Silmälappu', en: 'Eye patch', price: 90 },
    { id: 'glasses', slot: 'face', cat: 'kasvot', fi: 'Silmälasit', en: 'Round glasses', price: 130 },
    { id: 'shades', slot: 'face', cat: 'kasvot', fi: 'Aurinkolasit', en: 'Sunglasses', price: 130 },
    { id: 'sydanlasit', slot: 'face', cat: 'kasvot', fi: 'Sydänlasit', en: 'Heart glasses', price: 150 },
    { id: 'monokkeli', slot: 'face', cat: 'kasvot', fi: 'Monokkeli', en: 'Monocle', price: 160 },
    { id: 'laskettelulasit', slot: 'face', cat: 'kasvot', fi: 'Laskettelulasit', en: 'Ski goggles', price: 170 },

    { id: 'ilmapallo', slot: 'back', cat: 'selka', fi: 'Ilmapallo', en: 'Balloon', price: 100 },
    { id: 'ankka', slot: 'back', cat: 'selka', fi: 'Kumiankka', en: 'Rubber duck', price: 110 },
    { id: 'reppu', slot: 'back', cat: 'selka', fi: 'Reppu', en: 'Backpack', price: 120 },
    { id: 'viitta', slot: 'back', cat: 'selka', fi: 'Viitta', en: 'Cape', price: 160 },
    { id: 'dinopiikit', slot: 'back', cat: 'selka', fi: 'Dinopiikit', en: 'Dino spikes', price: 170 },
    { id: 'haineva', slot: 'back', cat: 'selka', fi: 'Hainevä', en: 'Shark fin', price: 180 },
    { id: 'perhonen', slot: 'back', cat: 'selka', fi: 'Perhosensiivet', en: 'Butterfly wings', price: 200 },
    { id: 'enkeli', slot: 'back', cat: 'selka', fi: 'Enkelinsiivet', en: 'Angel wings', price: 260 },
  ];

  /* Things for the shore. Each has its own place to stand. swap: things that share one place,
     so putting one out tidies the other away. */
  const DECOR_CATS = [
    { id: 'valot', t: 'Lights' }, { id: 'leiri', t: 'Camp and comfort' }, { id: 'lumi', t: 'Snow and ice' },
    { id: 'juhla', t: 'Festive' }, { id: 'luonto', t: 'Nature and friends' },
  ];
  const DECOR = [
    { id: 'lantern', cat: 'valot', fi: 'Lyhty', en: 'Lantern', price: 0, note: 'Keeps the dark cosy.' },
    { id: 'lumilyhty', cat: 'valot', fi: 'Lumilyhty', en: 'Snowball lantern', price: 70, note: 'A little pyramid of snowballs with a candle glowing inside.' },
    { id: 'jaalyhty', cat: 'valot', fi: 'Jäälyhty', en: 'Ice lantern', price: 90, note: 'A candle in a shell of ice. In winter there is one on every Finnish doorstep.' },
    { id: 'ulkotulet', cat: 'valot', fi: 'Ulkotulet', en: 'Garden torches', price: 110, note: 'Two little flames to light the way home.' },
    { id: 'lights', cat: 'valot', swap: 'arch', fi: 'Valosarja', en: 'Fairy lights', price: 120, note: 'A string of little glows for long nights.' },
    { id: 'tahti', cat: 'valot', fi: 'Paperitähti', en: 'Paper star', price: 130, note: 'The kind that glows in windows all through the dark months.' },

    { id: 'matto', cat: 'leiri', fi: 'Räsymatto', en: 'Rag rug', price: 90, note: 'Woven from old clothes. Makes anywhere feel like home.' },
    { id: 'sled', cat: 'leiri', fi: 'Potkukelkka', en: 'Kicksled', price: 140, note: 'How you pop to the shops when the roads are ice.' },
    { id: 'campfire', cat: 'leiri', fi: 'Nuotio', en: 'Campfire', price: 150, note: 'Warm flippers, toasty nose.' },
    { id: 'pilkki', cat: 'leiri', fi: 'Pilkkipaikka', en: 'Ice-fishing spot', price: 160, note: 'A stool, a little rod and a lot of patience.' },
    { id: 'laituri', cat: 'leiri', fi: 'Laituri', en: 'Jetty', price: 180, note: 'For cooling your toes after the sauna.' },
    { id: 'teltta', cat: 'leiri', fi: 'Teltta', en: 'Tent', price: 200, note: 'For nights when the sky is too good to miss.' },
    { id: 'vene', cat: 'leiri', fi: 'Soutuvene', en: 'Rowing boat', price: 240, note: 'Every lakeside cabin has one.' },
    { id: 'palju', cat: 'leiri', fi: 'Palju', en: 'Hot tub', price: 320, note: 'A wooden tub of hot water under the open sky.' },
    { id: 'sauna', cat: 'leiri', fi: 'Sauna', en: 'Sauna', hidden: true, note: 'Comes with the Sauna game: warm, clean and happy in one go.' },

    { id: 'snowman', cat: 'lumi', fi: 'Lumiukko', en: 'Snowman', price: 80, note: 'Good company. Never complains about the cold.' },
    { id: 'luminorppa', cat: 'lumi', fi: 'Luminorppa', en: 'Snow seal', price: 100, note: 'A friend made of snow. It looks a bit familiar.' },
    { id: 'iceheart', cat: 'lumi', fi: 'Jääsydän', en: 'Ice heart', price: 160, note: 'Carved from lake ice. Catches the light.' },
    { id: 'lumilinna', cat: 'lumi', fi: 'Lumilinna', en: 'Snow castle', price: 280, note: 'With towers, a gate and a flag on top.' },

    { id: 'flag', cat: 'juhla', fi: 'Lipputanko', en: 'Flagpole', price: 100, note: 'Blue for the lakes, white for the snow.' },
    { id: 'kurpitsa', cat: 'juhla', fi: 'Kurpitsalyhty', en: 'Pumpkin lantern', price: 100, note: 'It grins in the dark.' },
    { id: 'viirit', cat: 'juhla', swap: 'arch', fi: 'Viirinauha', en: 'Bunting', price: 110, note: 'Little flags for any day worth celebrating. Hangs where the fairy lights go.' },
    { id: 'ilmapallot', cat: 'juhla', fi: 'Ilmapallot', en: 'Balloons', price: 120, note: 'A bunch tied to the den, as on Vappu, the May Day carnival.' },
    { id: 'lahjat', cat: 'juhla', fi: 'Lahjat', en: 'Presents', price: 130, note: 'No peeking before Christmas Eve.' },
    { id: 'xmastree', cat: 'juhla', fi: 'Joulukuusi', en: 'Christmas tree', price: 200, note: 'With a star on top, of course.' },

    { id: 'feeder', cat: 'luonto', fi: 'Lintulauta', en: 'Bird table', price: 180, note: 'A kuukkeli, the friendly Siberian jay, likes to visit.' },
    { id: 'joutsen', cat: 'luonto', fi: 'Laulujoutsen', en: 'Whooper swan', price: 220, note: "Finland's national bird, gliding by." },
    { id: 'poro', cat: 'luonto', fi: 'Poro', en: 'Reindeer', price: 260, note: 'Wanders over from the fells to say hello.' },
  ];

  /* Finds from the lake bottom. */
  const TRINKETS = [
    { id: 'kivi', fi: 'Sileä kivi', en: 'Smooth pebble', rarity: 1, note: 'Polished by the lake for a thousand years.' },
    { id: 'kapy', fi: 'Käpy', en: 'Pine cone', rarity: 1, note: 'Sank all the way from the shore.' },
    { id: 'lapanen', fi: 'Lapanen', en: 'Lost mitten', rarity: 1, note: "Somebody's hand got cold." },
    { id: 'uistin', fi: 'Uistin', en: 'Fishing lure', rarity: 2, note: 'The one that got away took this with it.' },
    { id: 'markka', fi: 'Vanha markka', en: 'Old markka coin', rarity: 2, note: "Finland's money before the euro." },
    { id: 'avain', fi: 'Vanha avain', en: 'Old key', rarity: 2, note: 'To a boathouse, maybe.' },
    { id: 'tuohivene', fi: 'Tuohivene', en: 'Birch-bark boat', rarity: 2, note: 'A toy boat folded from birch bark.' },
    { id: 'poronkello', fi: 'Poronkello', en: 'Reindeer bell', rarity: 3, note: 'It still rings under water.' },
    { id: 'kuksa', fi: 'Kuksa', en: 'Kuksa cup', rarity: 3, note: "A cup carved from birch. Lapland's travel mug." },
    { id: 'pulloposti', fi: 'Pulloposti', en: 'Message in a bottle', rarity: 3, note: 'The note inside says: hei!' },
    { id: 'meripihka', fi: 'Meripihka', en: 'Amber', rarity: 4, note: 'Ancient resin, warm as honey.' },
    { id: 'jokihelmi', fi: 'Jokihelmi', en: 'River pearl', rarity: 4, note: 'From a river mussel. Very rare, very shiny.' },
  ];

  /* Finnish words picked up along the way. */
  const WORDS = [
    { id: 'norppa', fi: 'norppa', en: 'ringed seal', note: 'The small seal of northern lakes and seas.' },
    { id: 'kuutti', fi: 'kuutti', en: 'seal pup' },
    { id: 'kala', fi: 'kala', en: 'fish' },
    { id: 'herkku', fi: 'herkku', en: 'treat' },
    { id: 'nalka', fi: 'nälkä', en: 'hunger' },
    { id: 'kylpy', fi: 'kylpy', en: 'bath' },
    { id: 'uni', fi: 'uni', en: 'sleep', note: 'Also the word for a dream.' },
    { id: 'hyvaa_yota', fi: 'hyvää yötä', en: 'good night' },
    { id: 'huomenta', fi: 'hyvää huomenta', en: 'good morning' },
    { id: 'kiitos', fi: 'kiitos', en: 'thank you' },
    { id: 'kakka', fi: 'kakka', en: 'poo' },
    { id: 'avanto', fi: 'avanto', en: 'hole in the ice', note: 'Finns swim in these. On purpose.' },
    { id: 'aarre', fi: 'aarre', en: 'treasure' },
    { id: 'pallo', fi: 'pallo', en: 'ball' },
    { id: 'leikki', fi: 'leikki', en: 'play' },
    { id: 'kauppa', fi: 'kauppa', en: 'shop' },
    { id: 'pipo', fi: 'pipo', en: 'woolly hat' },
    { id: 'kaulaliina', fi: 'kaulaliina', en: 'scarf' },
    { id: 'lyhty', fi: 'lyhty', en: 'lantern' },
    { id: 'pesa', fi: 'pesä', en: 'den', note: 'Ringed seals raise their pups in a snow den on the ice.' },
    { id: 'lumi', fi: 'lumi', en: 'snow' },
    { id: 'pakkanen', fi: 'pakkanen', en: 'hard frost', note: 'Proper cold, well below zero.' },
    { id: 'revontulet', fi: 'revontulet', en: 'northern lights',
      note: 'Literally fox fires. In the old story a fox sweeps sparks into the sky with its tail.' },
    { id: 'kaamos', fi: 'kaamos', en: 'polar night', note: 'Midwinter in Lapland, when the sun stays below the horizon.' },
    { id: 'yoton_yo', fi: 'yötön yö', en: 'nightless night', note: 'Midsummer, when the sun does not set.' },
    { id: 'sininen_hetki', fi: 'sininen hetki', en: 'the blue moment', note: 'Winter twilight, when the snow glows blue.' },
    { id: 'kuu', fi: 'kuu', en: 'moon' },
    { id: 'tahti', fi: 'tähti', en: 'star' },
    { id: 'aurinko', fi: 'aurinko', en: 'sun' },
    { id: 'talvi', fi: 'talvi', en: 'winter' },
    { id: 'kevat', fi: 'kevät', en: 'spring' },
    { id: 'kesa', fi: 'kesä', en: 'summer' },
    { id: 'syksy', fi: 'syksy', en: 'autumn' },
    { id: 'sauna', fi: 'sauna', en: 'sauna', note: 'The one Finnish word the whole world borrowed.' },
    { id: 'loyly', fi: 'löyly', en: 'sauna steam' },
    { id: 'ystava', fi: 'ystävä', en: 'friend' },
    { id: 'rakas', fi: 'rakas', en: 'dear one' },
    { id: 'perhe', fi: 'perhe', en: 'family' },
    { id: 'anteeksi', fi: 'anteeksi', en: 'sorry' },
    { id: 'sisu', fi: 'sisu', en: 'grit', note: 'Quiet determination. Getting through it anyway.' },
    { id: 'onnea', fi: 'onnea', en: 'congratulations' },
    { id: 'heihei', fi: 'hei hei', en: 'bye bye' },
  ];

  const kinds = (o) => Object.keys(o).filter((k) => o[k] > 0).length;
  const ownedOf = (s, list) => list.filter((it) => s.owned[it.id]).length;

  /* Awards. test(state) is checked after every action. */
  const AWARDS = [
    { id: 'first_bite', t: 'First bite', d: 'Feed your seal.', c: 10, test: (s) => s.counters.feeds >= 1 },
    { id: 'clean', t: 'Squeaky clean', d: 'Give your seal a wash.', c: 10, test: (s) => s.counters.washes >= 1 },
    { id: 'goodnight', t: 'Hyvää yötä', d: 'Tuck your seal in.', c: 10, test: (s) => s.counters.tucks >= 1 },
    { id: 'friend', t: 'Ystävä', d: 'Stroke your seal 100 times.', c: 25, test: (s) => s.counters.pets >= 100 },
    { id: 'bestfriend', t: 'Paras ystävä', d: 'Stroke your seal 1,000 times. It means best friend.', c: 80, test: (s) => s.counters.pets >= 1000 },
    { id: 'patrol', t: 'Poo patrol', d: 'Clear away 20 poos.', c: 25, test: (s) => s.counters.poops >= 20 },
    { id: 'avanto', t: 'Avanto!', d: 'Send your seal on a dive.', c: 10, test: (s) => s.counters.dives >= 1 },
    { id: 'deep', t: 'Deep diver', d: 'Dive 25 times.', c: 50, test: (s) => s.counters.dives >= 25 },
    { id: 'fish5', t: 'Fish spotter', d: 'Discover 5 kinds of fish.', c: 20, test: (s) => kinds(s.fish) >= 5 },
    { id: 'fish10', t: 'Fish scholar', d: 'Discover 10 kinds of fish.', c: 50, test: (s) => kinds(s.fish) >= 10 },
    { id: 'fishall', t: 'Kalakuningas', d: 'Discover every fish in the lake. It means fish king.', c: 150, test: (s) => kinds(s.fish) >= FISH.length },
    { id: 'finds5', t: 'Beachcomber', d: 'Find 5 different treasures.', c: 30, test: (s) => kinds(s.trinkets) >= 5 },
    { id: 'findsall', t: 'Aarteenetsijä', d: 'Find every treasure. It means treasure hunter.', c: 150, test: (s) => kinds(s.trinkets) >= TRINKETS.length },
    { id: 'words10', t: 'Ten words', d: 'Learn 10 Finnish words.', c: 20, test: (s) => Object.keys(s.words).length >= 10 },
    { id: 'words30', t: 'Sanaseppä', d: 'Learn 30 Finnish words. It means wordsmith.', c: 80, test: (s) => Object.keys(s.words).length >= 30 },
    { id: 'lvl5', t: 'Close friends', d: 'Reach friendship level 5.', c: 30, test: (s) => PN.Sim.level(s).level >= 5 },
    { id: 'lvl10', t: 'Inseparable', d: 'Reach friendship level 10.', c: 80, test: (s) => PN.Sim.level(s).level >= 10 },
    { id: 'lvl15', t: 'Sielunkumppani', d: 'Reach friendship level 15. It means soulmate.', c: 150, test: (s) => PN.Sim.level(s).level >= 15 },
    { id: 'young', t: 'Growing up', d: 'Your pup becomes a young seal.', c: 40, test: (s) => s.stage >= 1 },
    { id: 'adult', t: 'All grown up', d: 'Your seal is fully grown.', c: 80, test: (s) => s.stage >= 2 },
    { id: 'perhe', t: 'Perhe', d: 'Welcome a pup of your own.', c: 60, test: (s) => s.pups.length + s.family.length >= 1 },
    { id: 'proud', t: 'Proud parent', d: 'Raise a pup until it is ready for the lake.', c: 100, test: (s) => s.counters.pupsGrown >= 1 },
    { id: 'streak3', t: 'Three days running', d: 'Visit 3 days in a row.', c: 20, test: (s) => s.gift.streak >= 3 },
    { id: 'streak7', t: 'A whole week', d: 'Visit 7 days in a row.', c: 60, test: (s) => s.gift.streak >= 7 },
    { id: 'streak30', t: 'Kuukausi', d: 'Visit every day for a month.', c: 200, test: (s) => s.gift.streak >= 30 },
    { id: 'catch25', t: 'Quick flippers', d: 'Catch 25 fish in one Fish Rain.', c: 30, test: (s) => s.counters.bestCatch >= 25 },
    { id: 'ball20', t: 'Nose for it', d: 'Bounce the ball 20 times in one go.', c: 30, test: (s) => s.counters.bestBall >= 20 },
    { id: 'aurora', t: 'Revontulet', d: 'See the northern lights.', c: 30, test: (s) => !!s.seen.aurora },
    { id: 'kaamos', t: 'Kaamos', d: 'Visit during the polar night.', c: 30, test: (s) => !!s.seen.kaamos },
    { id: 'yoton', t: 'Yötön yö', d: 'Visit under the midnight sun.', c: 30, test: (s) => !!s.seen.midnightSun },
    { id: 'owl', t: 'Night owl', d: 'Visit between 1 and 4 in the morning.', c: 15, test: (s) => !!s.seen.owl },
    { id: 'early', t: 'Early bird', d: 'Visit between 5 and 7 in the morning.', c: 15, test: (s) => !!s.seen.early },
    { id: 'hats3', t: 'Hat stand', d: 'Own 3 things for the head.', c: 30, test: (s) => ownedOf(s, WEAR.filter((w) => w.slot === 'head')) >= 3 },
    { id: 'home5', t: 'Oma koti kullan kallis', d: 'Own 5 things for the shore. The saying goes: your own home is worth gold.', c: 60, test: (s) => ownedOf(s, DECOR) >= 5 },
    { id: 'wear10', t: 'Dressing-up box', d: 'Own 10 things to wear.', c: 60, test: (s) => ownedOf(s, WEAR) >= 10 },
    { id: 'wear25', t: 'Walk-in wardrobe', d: 'Own 25 things to wear.', c: 150, test: (s) => ownedOf(s, WEAR) >= 25 },
    { id: 'home12', t: 'Kylä', d: 'Own 12 things for the shore. It means village.', c: 150, test: (s) => ownedOf(s, DECOR) >= 12 },
    { id: 'loyly', t: 'Löyly', d: 'Take a sauna.', c: 30, test: (s) => s.counters.saunas >= 1 },
    { id: 'sorry', t: 'Anteeksi', d: 'Make up after an Angy spell.', c: 10, test: (s) => s.counters.forgiven >= 1 },
  ];

  /* Names to suggest, with what they mean. */
  const NAMES = [
    ['Pulla', 'sweet bun'], ['Lumi', 'snow'], ['Nuppu', 'bud'], ['Kuura', 'hoarfrost'], ['Helmi', 'pearl'],
    ['Taika', 'magic'], ['Pyry', 'snow flurry'], ['Tuisku', 'blizzard'], ['Muru', 'crumb, darling'],
    ['Hilla', 'cloudberry'], ['Sulo', 'charm'], ['Viima', 'icy wind'], ['Halla', 'night frost'],
    ['Pilvi', 'cloud'], ['Tähti', 'star'], ['Usva', 'mist'], ['Hippu', 'nugget'], ['Mustikka', 'bilberry'],
    ['Puolukka', 'lingonberry'], ['Sisu', 'grit'], ['Kide', 'crystal'], ['Routa', 'ground frost'],
    ['Sumu', 'fog'], ['Nietos', 'snowdrift'],
  ];

  const STAGES = [
    { fi: 'kuutti', en: 'pup' },
    { fi: 'nuori norppa', en: 'young seal' },
    { fi: 'norppa', en: 'grown seal' },
  ];

  /* Economy dial. Shop prices are doubled and earnings cut to two thirds. Cosmetics (wear and decor)
     cost 12x their base price at the top end, but are then spread on a curve so the cheapest sits near
     cosmeticFloor coins and the dearest stays put. Every fish fills a quarter less. Change these to retune. */
  /* Mini-games and what they cost to unlock. Nose Ball is free; the rest are bought with coins. */
  const GAMES = {
    ball: { price: 0, title: 'Nose Ball', icon: 'up', tint: 'warm', text: 'Keep the ball in the air for as long as you can.', best: 'bestBall', rate: 1.7 },
    catch: { price: 200, title: 'Fish Rain', icon: 'fish', tint: 'sea', text: 'Slide left and right to catch the fish. Now and then you get to keep one.', best: 'bestCatch', rate: 1.2 },
    swim: { price: 450, title: 'Swimmy Seal', icon: 'drop', tint: 'sea', text: 'Tap to swim up. Slip between the ice and the kelp.', best: 'best_swim', rate: 4.8, unit: 'gaps swum' },
    toss: { price: 700, title: 'Snowball Toss', icon: 'ball', tint: 'rose', text: 'Flick the snowball into the bucket. Check the wind first. A miss starts the streak again. Play until you press Back.', best: 'best_toss', rate: 5.3, unit: 'baskets in a row' },
    sauna: { price: 850, title: 'Löyly', icon: 'steam', tint: 'warm', text: 'Hold to throw water on the stones. Keep the heat just right. Unlocking it builds the sauna on the shore.', best: 'best_sauna', rate: 6.86, unit: 'rounds in a row' },
    curl: { price: 1000, title: 'Curling Seal', icon: 'dice', tint: 'leaf', text: 'Pull back and let go to slide. Stop as near the middle of the rings as you can.', best: 'best_curl', rate: 4, unit: 'points' },
    sled: { price: 1250, title: 'Sled Run', icon: 'bolt', tint: 'warm', text: 'Steer down the hill between the trees and rocks. Grab the fish, hit the ramps.', best: 'best_sled', rate: 0.096, unit: 'metres' },
    bj: { price: 1500, title: 'Blackjack', icon: 'dice', tint: 'leaf', text: 'Choose your bet, from 5 sardines up to all in. Beat the dealer without going over 21. Cash out when you like.', best: 'best_bj', rate: 0.5, unit: 'sardines won' },
  };
  /* rate: base coins per point, tuned so a run at the player's high score pays about 48 on every game (then the earnings cut applies). */
  PN.GAME_ORDER = ['ball', 'catch', 'swim', 'toss', 'sauna', 'curl', 'sled', 'bj'];
  PN.GAMES = GAMES;
  const ECON = { price: 2, cosmetic: 6, cosmeticFloor: 200, earn: 2 / 3, fishFood: 0.75 };
  PN.ECON = ECON;
  [FISH, FOODS].forEach((list) => list.forEach((x) => { if (x.price) x.price = Math.round(x.price * ECON.price); }));
  {
    const cos = WEAR.concat(DECOR).filter((x) => x.price);
    const old = (x) => x.price * ECON.price * ECON.cosmetic;
    const lo = Math.min.apply(null, cos.map(old)), hi = Math.max.apply(null, cos.map(old));
    const k = Math.log(hi / ECON.cosmeticFloor) / Math.log(hi / lo);
    cos.forEach((x) => {
      const v = ECON.cosmeticFloor * Math.pow(old(x) / lo, k);
      x.price = Math.round(v / 10) * 10;
    });
  }
  FISH.forEach((f) => { f.food = Math.max(3, Math.round(f.food * ECON.fishFood)); });
  AWARDS.forEach((a) => { a.c = Math.max(1, Math.round(a.c * ECON.earn)); });

  /* One lookup for everything that can be owned, eaten or found. */
  const items = {};
  FISH.forEach((f) => { items[f.id] = Object.assign({ kind: 'fish', joy: 2 }, f); });
  FOODS.forEach((f) => { items[f.id] = Object.assign({ kind: f.med ? 'med' : 'food' }, f); });
  WEAR.forEach((w) => { items[w.id] = Object.assign({ kind: 'wear' }, w); });
  DECOR.forEach((d) => { items[d.id] = Object.assign({ kind: 'decor' }, d); });
  TRINKETS.forEach((t) => { items[t.id] = Object.assign({ kind: 'trinket' }, t); });
  items.ball = { id: 'ball', kind: 'toy', fi: 'Pallo', en: 'Ball' };

  const byId = (list) => list.reduce((m, x) => { m[x.id] = x; return m; }, {});

  PN.DATA = { FISH, FOODS, WEAR, DECOR, WEAR_CATS, DECOR_CATS, TRINKETS, WORDS, AWARDS, NAMES, STAGES,
    words: byId(WORDS), awards: byId(AWARDS) };
  PN.items = items;
})(window.PN = window.PN || {});
