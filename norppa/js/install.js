/* Pikku Norppa: "Add to Home Screen".
   Chrome, Edge, Samsung Internet and Opera hand the page a real install prompt, so the button opens that.
   iPhones, iPads, Firefox and the rest give a page no prompt to open, so the button shows the steps for that browser instead.
   The button disappears once the game is running as an installed app. */
(function (PN) {
  'use strict';
  const tr = (s) => (PN.L ? PN.L(s) : s);
  const on = (type, fn) => { try { window.addEventListener(type, fn); } catch (e) { /* no events here (the tests) */ } };

  let prompt = null;            // the browser's install prompt, kept until the button is tapped (it can only be opened once)
  let installedNow = false;     // the browser said it was installed during this visit
  const listeners = [];
  const tell = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* one listener must not stop the others */ } });

  /* Which kind of device is this? iPads ask for the desktop site and say "Macintosh", so their touch screen gives them away. */
  function kind(ua, platform, touchPoints) {
    ua = String(ua || '');
    if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  /* Is the game already running as an installed app (a home screen icon, or its own window on a computer)? */
  function installed() {
    try {
      if (navigator.standalone === true) return true;
      return ['standalone', 'minimal-ui', 'window-controls-overlay'].some((m) => window.matchMedia && matchMedia('(display-mode: ' + m + ')').matches);
    } catch (e) { return false; }
  }

  const SHARE = '<svg class="inst-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M7 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1"/></svg>';
  const DOTS = '<svg class="inst-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

  /* The steps to show when the browser has no install prompt of its own. */
  function stepsFor(k) {
    const li = (t) => '<li><span>' + t + '</span></li>';
    let list, note = '';
    if (k === 'ios') {
      list = [SHARE + ' ' + tr('Tap the Share button (the square with an arrow pointing up) in the browser toolbar.'), tr('Scroll down and tap Add to Home Screen.'), tr('Tap Add. Pikku Norppa then opens like an app.')];
      note = tr('Opened this link inside another app, like Reddit? Open it in Safari first.');
    } else if (k === 'android') {
      list = [DOTS + ' ' + tr('Open your browser menu (the three dots).'), tr('Tap Install app or Add to Home screen.')];
      note = tr('Opened this link inside another app, like Reddit? Open it in your browser first.');
    } else {
      list = [tr('In Chrome or Edge, click the install icon at the right end of the address bar.'), tr('In Safari, choose File, then Add to Dock.'), tr('No install option? Bookmark this page instead (Ctrl+D, or Cmd+D on a Mac).')];
    }
    return '<p>' + tr('Pikku Norppa then opens full screen with its own icon, and works with no signal.') + '</p>'
      + '<ol class="steps">' + list.map(li).join('') + '</ol>' + (note ? '<p class="small">' + note + '</p>' : '');
  }

  on('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; });          // keep it for the button instead of letting the browser show its own banner
  on('appinstalled', () => { installedNow = true; prompt = null; tell(); });

  PN.Install = {
    kind,
    installed,
    /* Should the button be on the first screen? Not once the game is installed. */
    visible() { return !installed() && !installedNow; },
    /* Is the browser's own install prompt ready? */
    canPrompt() { return !!prompt; },
    /* Called when the button may need to appear or go away. */
    onChange(fn) { listeners.push(fn); },
    /* The button: the browser's own prompt if it gave us one, otherwise the steps for this device. */
    async start() {
      if (prompt) {
        const ev = prompt; prompt = null;
        try {
          await ev.prompt();
          const choice = await ev.userChoice;
          const outcome = (choice && choice.outcome) || 'dismissed';
          if (outcome === 'accepted') { installedNow = true; tell(); }
          return outcome;
        } catch (e) { /* the prompt could not open: show the steps instead */ }
      }
      let k = 'desktop';
      try { k = kind(navigator.userAgent, navigator.platform, navigator.maxTouchPoints); } catch (e) { /* unknown device */ }
      if (PN.UI && PN.UI.modal) await PN.UI.modal({ title: tr('Add to Home Screen'), html: stepsFor(k), over: true, actions: [{ label: tr('Got it'), value: 1 }] });
      return 'steps';
    },
  };
})(window.PN = window.PN || {});
