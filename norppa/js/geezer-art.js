/* Pikku Norppa: the "geezer" home prototype art (developer mode only).
   A bloke in his armchair in a messy lounge, drawn as one SVG. Original art,
   inspired by the owner's reference picture; every brand on it is made up.
   The scene is drawn on a big canvas (about -700 to 1700 wide) so it always fills
   the screen; geezer.js picks which part of it must stay in view. Kept in its own
   file so other art work on the repo does not collide with it. */
(function (PN) {
  'use strict';

  const OUT = 'stroke="#2a1a14" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';

  /* A drink can of made-up fizzy pop: blue "Gaffer" or red "Bulldog". */
  function can(x, y, s, kind, tilt) {
    const body = kind === 'red' ? '#c8282e' : '#1f4fa8', band = kind === 'red' ? '#f3d9a0' : '#f2c230';
    const word = kind === 'red' ? 'BULLDOG' : 'GAFFER';
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (tilt || 0) + ') scale(' + s + ')">'
      + '<rect x="-20" y="-56" width="40" height="66" rx="6" fill="' + body + '" ' + OUT + '/>'
      + '<rect x="-20" y="-60" width="40" height="8" rx="3" fill="#c9cdd4" ' + OUT + '/>'
      + '<circle cx="0" cy="-26" r="12" fill="' + band + '"/>'
      + '<text x="0" y="-21" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="15" fill="' + body + '">' + word[0] + '</text>'
      + '<text x="0" y="0" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="8.5" fill="#fff">' + word + '</text>'
      + '<rect x="-14" y="-52" width="5" height="54" rx="2" fill="#fff" opacity=".22"/></g>';
  }
  function canDown(x, y, kind, rot) { return can(x, y, 0.9, kind, rot); }

  /* A sock hanging on the radiator. */
  function sock(x, y, c) {
    return '<path d="M' + x + ' ' + y + ' l26 0 l0 70 q0 22 -22 22 l-22 0 q-12 0 -12 -12 q0 -12 14 -12 l16 0 z" fill="' + c + '" ' + OUT + '/>';
  }

  function wall() {
    return '<defs>'
      + '<pattern id="gzPaper" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#c9b08f"/><path d="M30 8 q8 10 0 20 q-8 -10 0 -20z M0 38 q8 10 0 20 M60 38 q-8 10 0 20" fill="#b89c7a" opacity=".55"/></pattern>'
      + '<pattern id="gzRug" width="44" height="44" patternUnits="userSpaceOnUse"><rect width="44" height="44" fill="#7a2e3c"/><path d="M22 4 l18 18 l-18 18 l-18 -18z" fill="#933a48"/><circle cx="22" cy="22" r="4" fill="#d9b58a"/></pattern>'
      + '<pattern id="gzCurtain" width="50" height="60" patternUnits="userSpaceOnUse"><rect width="50" height="60" fill="#e9e1cf"/><path d="M25 10 q12 10 0 26 q-12 -16 0 -26z" fill="#6f8fb8"/><path d="M0 40 q10 6 0 18 M50 40 q-10 6 0 18" fill="#6f8fb8"/></pattern>'
      + '<radialGradient id="gzTelly" gradientUnits="userSpaceOnUse" cx="900" cy="560" r="900"><stop offset="0" stop-color="#9fd0ff" stop-opacity=".5"/><stop offset=".5" stop-color="#7fb4ff" stop-opacity=".14"/><stop offset="1" stop-color="#7fb4ff" stop-opacity="0"/></radialGradient>'
      + '<radialGradient id="gzLamp" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#ffe2a6" stop-opacity=".45"/><stop offset="1" stop-color="#ffe2a6" stop-opacity="0"/></radialGradient>'
      + '</defs>'
      + '<rect x="-1800" y="-700" width="4600" height="1352" fill="url(#gzPaper)"/>'
      + '<rect x="-1800" y="-700" width="4600" height="1352" fill="url(#gzLamp)"/>'
      + '<path d="M640 -700 V-150" stroke="#2a1a14" stroke-width="4"/><path d="M590 -90 l20 -60 h60 l20 60z" fill="#d98c3a" ' + OUT + '/><circle cx="640" cy="-80" r="12" fill="#fff3c4"/>'
      + '<rect x="-1800" y="626" width="4600" height="30" fill="#efe6d6" ' + OUT + '/>'
      + '<rect x="-1800" y="652" width="4600" height="1100" fill="#5e4a3c"/>'
      + '<ellipse cx="500" cy="900" rx="760" ry="250" fill="url(#gzRug)" ' + OUT + '/>'
      + '<ellipse cx="500" cy="900" rx="700" ry="220" fill="none" stroke="#d9b58a" stroke-width="6" stroke-dasharray="14 10"/>';
  }

  /* A national flag pinned to the wall (no brands), slightly saggy. */
  function flag() {
    return '<g transform="translate(250 70) rotate(-2)">'
      + '<rect x="0" y="0" width="280" height="168" fill="#1f3c88" ' + OUT + '/>'
      + '<path d="M0 0 L280 168 M280 0 L0 168" stroke="#fff" stroke-width="34"/>'
      + '<path d="M0 0 L280 168 M280 0 L0 168" stroke="#c8202e" stroke-width="11"/>'
      + '<path d="M140 0 V168 M0 84 H280" stroke="#fff" stroke-width="54"/>'
      + '<path d="M140 0 V168 M0 84 H280" stroke="#c8202e" stroke-width="30"/>'
      + '<rect x="0" y="0" width="280" height="168" fill="none" ' + OUT + '/>'
      + '<circle cx="8" cy="8" r="5" fill="#e3c04a" ' + OUT + '/><circle cx="272" cy="8" r="5" fill="#e3c04a" ' + OUT + '/></g>';
  }

  /* A framed picture of a red double-decker bus by a clock tower. */
  function picture() {
    return '<g transform="translate(590 70)"><rect x="0" y="0" width="150" height="112" fill="#6b4226" ' + OUT + '/>'
      + '<rect x="10" y="10" width="130" height="92" fill="#9cc3e8"/>'
      + '<rect x="96" y="22" width="18" height="70" fill="#c8a46a"/><path d="M96 22 l9 -14 l9 14z" fill="#7a5a32"/><circle cx="105" cy="38" r="6" fill="#f4ecd0"/>'
      + '<rect x="10" y="84" width="130" height="18" fill="#8a8a8a"/>'
      + '<rect x="22" y="54" width="60" height="40" rx="5" fill="#d42a2a" ' + OUT.replace('4"', '2"') + '/>'
      + '<rect x="28" y="60" width="48" height="9" fill="#e9f2ff"/><rect x="28" y="74" width="48" height="9" fill="#e9f2ff"/>'
      + '<circle cx="34" cy="95" r="5" fill="#222"/><circle cx="70" cy="95" r="5" fill="#222"/></g>';
  }

  /* Window with a row of houses outside, curtains, and the radiator under it. */
  function windowAndRadiator() {
    return '<g>'
      + '<rect x="800" y="70" width="320" height="300" fill="#f2efe8" ' + OUT + '/>'
      + '<rect x="816" y="86" width="288" height="268" fill="#86a9cf"/>'
      + '<path d="M816 250 l40 -40 l40 40 l30 -30 l40 30 l40 -44 l40 44 l52 -20 v124 h-282z" fill="#8a5446"/>'
      + '<g fill="#e9e0c0"><rect x="836" y="270" width="18" height="18"/><rect x="884" y="268" width="18" height="18"/><rect x="960" y="272" width="18" height="18"/><rect x="1030" y="262" width="18" height="18"/></g>'
      + '<path d="M960 86 V354 M816 220 H1104" stroke="#f2efe8" stroke-width="12"/>'
      + '<rect x="790" y="362" width="340" height="18" fill="#efe6d6" ' + OUT + '/>'
      + '<path d="M780 50 q30 160 0 330 l70 0 q-30 -170 -10 -330z" fill="url(#gzCurtain)" ' + OUT + '/>'
      + '<path d="M1140 50 q-30 160 0 330 l-70 0 q30 -170 10 -330z" fill="url(#gzCurtain)" ' + OUT + '/>'
      + '<rect x="770" y="40" width="390" height="14" rx="7" fill="#7a5a32" ' + OUT + '/>'
      + '<rect x="830" y="420" width="260" height="150" rx="10" fill="#f1efe9" ' + OUT + '/>'
      + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path d="M' + (856 + i * 30) + ' 430 V560" stroke="#cfcac0" stroke-width="10" stroke-linecap="round"/>').join('')
      + sock(880, 412, '#4a4a52') + sock(1010, 412, '#5b5e6b')
      + '</g>';
  }

  /* Shelf of mugs and a rubber duck on the left wall. */
  function shelf() {
    const mug = (x, c) => '<g transform="translate(' + x + ' 0)"><rect x="0" y="-38" width="32" height="38" rx="4" fill="' + c + '" ' + OUT + '/><path d="M32 -30 q14 0 14 12 q0 12 -14 12" fill="none" ' + OUT + '/></g>';
    return '<g transform="translate(-40 210)">'
      + '<rect x="0" y="0" width="230" height="14" fill="#8a5a34" ' + OUT + '/>'
      + mug(16, '#f4f1ea') + mug(70, '#c8282e') + mug(124, '#f4f1ea')
      + '<g transform="translate(186 -2)"><ellipse cx="0" cy="-16" rx="22" ry="16" fill="#f4cf2a" ' + OUT + '/><circle cx="8" cy="-38" r="12" fill="#f4cf2a" ' + OUT + '/><path d="M18 -38 l12 3 l-12 4z" fill="#f08a1a" ' + OUT.replace('4"', '2"') + '/><circle cx="10" cy="-41" r="2.2" fill="#222"/></g>'
      + '<rect x="0" y="150" width="230" height="14" fill="#8a5a34" ' + OUT + '/>'
      + can(40, 146, 0.75, 'blue') + can(84, 146, 0.75, 'red') + mug(130, '#2d6bb5')
      + '<path d="M18 14 v300 M212 14 v300" stroke="#6b4226" stroke-width="12"/>'
      + '</g>';
  }

  /* Laundry basket overflowing behind the chair, and a chippy bag. */
  function laundry() {
    return '<g>'
      + '<path d="M650 470 q40 -60 120 -40 q60 -40 110 20 q30 20 10 50 l-250 10z" fill="#2f3550" ' + OUT + '/>'
      + '<path d="M672 470 q40 -36 90 -20 l20 22z" fill="#e8e3d6" ' + OUT + '/>'
      + '<path d="M780 446 q30 -10 60 14 l-12 40 q-26 -8 -50 -6z" fill="#a8232f" ' + OUT + '/>'
      + '<path d="M660 480 h240 l-20 160 h-200z" fill="#f2f2f0" ' + OUT + '/>'
      + [0, 1, 2, 3, 4, 5].map((i) => '<path d="M' + (690 + i * 36) + ' 492 l-4 136" stroke="#c9ccd2" stroke-width="7"/>').join('')
      + '<path d="M668 540 h224 M676 590 h210" stroke="#c9ccd2" stroke-width="7"/>'
      + '<path d="M880 640 q30 -20 60 6 q40 -10 50 20 q-60 20 -110 0z" fill="#3d4466" ' + OUT + '/>'
      + '<g transform="translate(930 520)"><path d="M0 0 h80 l10 120 h-100z" fill="#c79a5a" ' + OUT + '/><path d="M24 0 q16 -26 32 0" fill="none" ' + OUT + '/><text x="40" y="70" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="15" font-weight="900" fill="#7a3e12">CHIPPY</text></g>'
      + '</g>';
  }

  /* The armchair, back part (behind the bloke). */
  function chairBack() {
    return '<g>'
      + '<path d="M330 640 q-30 -170 10 -300 q30 -60 170 -60 q140 0 170 60 q40 130 10 300z" fill="#7b3f2e" ' + OUT + '/>'
      + '<path d="M380 360 q10 -40 130 -44 q120 4 130 44 q10 100 -6 200 h-248 q-16 -100 -6 -200z" fill="#6a3424"/>'
      + '<path d="M356 440 q-6 40 8 70" stroke="#e7c58a" stroke-width="10" fill="none" stroke-linecap="round"/>'
      + '<path d="M560 330 q50 -6 80 30 q-20 40 -60 10z" fill="#ece3cf" ' + OUT + '/>'
      + '</g>';
  }
  /* Arms of the chair, in front of the bloke's sides. */
  function chairFront() {
    return '<g>'
      + '<path d="M290 520 q-10 -60 50 -70 q50 0 60 50 l10 190 h-110 q-20 -80 -10 -170z" fill="#8a4834" ' + OUT + '/>'
      + '<path d="M730 520 q10 -60 -50 -70 q-50 0 -60 50 l-10 190 h110 q20 -80 10 -170z" fill="#8a4834" ' + OUT + '/>'
      + '<path d="M312 520 q16 -30 50 -26 l-4 30 q-20 4 -30 24z" fill="#e3c08a" opacity=".85"/>'
      + '<path d="M690 560 q-10 30 4 60" stroke="#c99a66" stroke-width="8" fill="none" stroke-linecap="round"/>'
      + '<path d="M300 690 h420 v30 h-420z" fill="#5a2c1e" ' + OUT + '/>'
      + '<rect x="320" y="718" width="24" height="26" fill="#3a2016"/><rect x="676" y="718" width="24" height="26" fill="#3a2016"/>'
      + '</g>';
  }

  /* The bloke: legs, belly, vest, arms, head. Parts that move have their own class. */
  function bloke() {
    return '<g class="gz-man">'
      // legs in grey trackies, spread forward
      + '<path d="M410 600 q-20 120 -40 200 q-6 40 40 44 q40 2 50 -40 l40 -190z" fill="#7d7f86" ' + OUT + '/>'
      + '<path d="M560 600 q60 80 120 170 q26 40 64 18 q30 -24 6 -60 l-110 -150z" fill="#7d7f86" ' + OUT + '/>'
      + '<path d="M420 700 l12 -18 l8 22z" fill="#f2b48c" ' + OUT.replace('4"', '2.5"') + '/>'
      + '<g fill="#b8892e" opacity=".55"><ellipse cx="440" cy="650" rx="14" ry="9"/><ellipse cx="640" cy="700" rx="10" ry="7"/></g>'
      // white sport socks and dark socks (feet)
      + '<path d="M368 808 q-6 30 4 46 l60 0 q8 -20 2 -42z" fill="#f2f2ef" ' + OUT + '/>'
      + '<path d="M372 850 q-40 10 -40 40 q0 22 34 22 q56 0 66 -26 l0 -36z" fill="#34363f" ' + OUT + '/>'
      + '<path d="M714 772 q30 -14 50 4 l-20 40 q-24 -2 -38 -16z" fill="#f2f2ef" ' + OUT + '/>'
      + '<path d="M744 812 q30 30 60 26 q34 -6 26 -36 q-10 -34 -54 -40z" fill="#34363f" ' + OUT + '/>'
      // waistband with drawstrings
      + '<path d="M392 570 q118 50 236 0 l10 50 q-128 44 -256 0z" fill="#8a8c93" ' + OUT + '/>'
      + '<path d="M500 596 q-8 30 -16 44 M512 596 q8 30 14 46" stroke="#eee" stroke-width="5" fill="none" stroke-linecap="round"/>'
      // torso: shoulders and chest skin
      + '<g class="gz-belly">'
      + '<path d="M380 330 q130 -40 260 0 q60 30 50 140 q-10 130 -180 150 q-170 -20 -180 -150 q-10 -110 50 -140z" fill="#f2b48c" ' + OUT + '/>'
      + '<path d="M410 330 q20 70 40 70 h120 q20 0 40 -70 q40 20 50 70 q20 70 -10 120 q-60 50 -150 50 q-90 0 -140 -50 q-26 -50 -6 -120 q10 -50 56 -70z" fill="#efece4" ' + OUT + '/>'
      + '<path d="M402 520 q108 70 216 0 q16 50 -20 80 q-88 40 -176 0 q-36 -30 -20 -80z" fill="#f2b48c" ' + OUT + '/>'
      + '<path d="M500 568 q6 6 0 12" stroke="#b5714a" stroke-width="4" fill="none"/>'
      + '<g fill="#c99a3e" opacity=".6"><ellipse cx="530" cy="440" rx="20" ry="12"/><ellipse cx="560" cy="456" rx="8" ry="6"/><ellipse cx="460" cy="480" rx="10" ry="7"/><ellipse cx="590" cy="490" rx="12" ry="7"/></g>'
      + '<path d="M470 360 q30 10 80 0" stroke="#b5714a" stroke-width="3" fill="none" opacity=".6"/>'
      + '</g>'
      // left arm (his right), holding the remote, resting on the chair arm
      + '<path d="M640 350 q70 20 70 120 q0 30 -10 40 l-60 6 q10 -40 0 -110z" fill="#f2b48c" ' + OUT + '/>'
      + '<path d="M650 500 q50 -10 80 0 q20 20 -6 30 l-80 6z" fill="#f2b48c" ' + OUT + '/>'
      + '<rect x="690" y="488" width="70" height="22" rx="7" fill="#2b2d33" ' + OUT + '/><circle cx="745" cy="499" r="4" fill="#d43030"/>'
      // right arm with the can, its own group so it can lift for a sip
      + '<g class="gz-arm">'
      + '<path d="M380 350 q-70 20 -70 120 q0 40 30 50 q40 6 70 -16 l-20 -40 q-20 10 -30 6 q-6 -60 20 -96z" fill="#f2b48c" ' + OUT + '/>'
      + can(410, 500, 1.05, 'blue', 0)
      + '<path d="M376 478 q24 -10 48 -4 q12 10 0 22 q-26 6 -48 0z" fill="#f2b48c" ' + OUT + '/>'
      + '</g>'
      // head
      + '<g class="gz-head">'
      + '<path d="M470 330 q40 16 80 0 l-4 -30 h-72z" fill="#e8a47c" ' + OUT + '/>'
      + '<ellipse cx="430" cy="230" rx="18" ry="26" fill="#f2b48c" ' + OUT + '/><ellipse cx="590" cy="230" rx="18" ry="26" fill="#f2b48c" ' + OUT + '/>'
      + '<path d="M432 180 q0 -110 78 -110 q78 0 78 110 q0 80 -30 112 q-20 24 -48 24 q-28 0 -48 -24 q-30 -32 -30 -112z" fill="#f2b48c" ' + OUT + '/>'
      + '<ellipse cx="485" cy="104" rx="26" ry="12" fill="#fff" opacity=".35"/>'
      + '<path d="M446 238 q4 70 64 76 q60 -6 64 -76 q-20 40 -64 42 q-44 -2 -64 -42z" fill="#8a6a5a" opacity=".28"/>'
      + '<path d="M462 172 q20 -12 38 -2 M522 170 q20 -10 38 4" stroke="#5a3a2a" stroke-width="7" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="482" cy="196" rx="15" ry="11" fill="#fff" ' + OUT.replace('4"', '3"') + '/><ellipse cx="540" cy="196" rx="15" ry="11" fill="#fff" ' + OUT.replace('4"', '3"') + '/>'
      + '<circle cx="486" cy="199" r="5" fill="#2a1a14"/><circle cx="544" cy="199" r="5" fill="#2a1a14"/>'
      + '<g class="gz-lids"><path d="M466 196 q16 -18 32 0z" fill="#e8a47c" ' + OUT.replace('4"', '3"') + '/><path d="M524 196 q16 -18 32 0z" fill="#e8a47c" ' + OUT.replace('4"', '3"') + '/></g>'
      + '<path d="M508 206 q-18 30 -6 44 q10 8 26 0 q10 -16 -6 -44" fill="#ee9a82" ' + OUT.replace('4"', '3"') + '/>'
      + '<path d="M482 268 q30 22 60 -2" stroke="#7a3a2a" stroke-width="5" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="458" cy="244" rx="12" ry="7" fill="#e8806a" opacity=".45"/><ellipse cx="564" cy="244" rx="12" ry="7" fill="#e8806a" opacity=".45"/>'
      + '</g>'
      + '</g>';
  }

  /* Coffee table with the pizza box, cans and a game pad; floor junk; the telly. */
  function front() {
    return '<g>'
      + canDown(900, 800, 'blue', 92) + canDown(560, 960, 'red', -84) + canDown(120, 1060, 'blue', 70)
      + '<g transform="translate(-60 880)">'
      + '<path d="M0 0 h340 v26 h-340z" fill="#9a6a3c" ' + OUT + '/><rect x="16" y="26" width="22" height="80" fill="#7a4e28" ' + OUT + '/><rect x="302" y="26" width="22" height="80" fill="#7a4e28" ' + OUT + '/>'
      + '<path d="M20 -6 l110 -34 l130 24 l-110 40z" fill="#e7cf9e" ' + OUT + '/>'
      + '<path d="M20 -6 l130 30 l0 -10 l-130 -30z" fill="#c9ad78" ' + OUT + '/>'
      + '<path d="M70 -14 l40 -10 l24 14 z" fill="#e8a33a" ' + OUT.replace('4"', '3"') + '/><circle cx="96" cy="-16" r="4" fill="#c8402c"/><circle cx="110" cy="-12" r="3.5" fill="#c8402c"/>'
      + '<text x="150" y="-14" font-family="Arial Black,Arial,sans-serif" font-size="13" font-weight="900" fill="#a3402c" transform="rotate(10 150 -14)">PIZZA</text>'
      + '</g>'
      + can(210, 880, 0.95, 'blue', 0) + can(252, 880, 0.95, 'red', 0)
      + '<g transform="translate(60 868) rotate(-8) scale(.85)"><path d="M0 0 q10 -16 30 -14 h40 q20 -2 30 14 q8 22 -8 26 q-14 2 -22 -12 h-40 q-8 14 -22 12 q-16 -4 -8 -26z" fill="#2b2d33" ' + OUT + '/><circle cx="76" cy="0" r="4" fill="#4caf50"/><circle cx="24" cy="0" r="4" fill="#9aa0aa"/></g>'
      + '<path d="M20 950 q14 -10 30 0 q6 12 -8 16 q-20 2 -22 -16z" fill="#f2f2ef" ' + OUT.replace('4"', '3"') + '/>'
      // the telly, seen from the side and behind, bottom right, with its glow
      + '<rect x="0" y="-340" width="1800" height="1800" fill="url(#gzTelly)" class="gz-glow" pointer-events="none"/>'
      + '<g transform="translate(900 600) scale(1.25)">'
      + '<rect x="-30" y="190" width="300" height="230" fill="#6b4226" ' + OUT + '/>'
      + '<path d="M0 -10 l40 -20 h200 v240 h-240z" fill="#22252c" ' + OUT + '/>'
      + '<path d="M0 -10 v220" stroke="#8fc4ff" stroke-width="7" class="gz-screen"/>'
      + '</g>'
      + '</g>';
  }

  PN.GeezerArt = {
    /* The whole lounge as one SVG string. */
    svg() {
      return '<svg class="gz-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="280 60 460 900" aria-hidden="true">'
        + wall() + flag() + picture() + windowAndRadiator() + shelf() + laundry() + chairBack() + chairFront() + bloke() + front()
        + '</svg>';
    },
  };
})(window.PN = window.PN || {});
