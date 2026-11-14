/* Pikku Norppa: the rules behind Coffee Memory. No drawing here, only the order and the checking, so it can be tested on its own.
   Customers keep coming for as long as every drink is right. An order is shown, then hidden, and the drink is built step by step from
   memory. The steps always come in the same order: size, base, temperature, milk, syrup, extras. Every drink served adds one more item to
   remember: the first order is size and base, then temperature, milk and syrup come in, then extras one at a time up to all four.
   The first wrong choice ends the game; the score is the drinks served. There is no clock. */
(function (PN) {
  'use strict';

  /* Every step and what can be chosen at it: [id, English label, little picture]. Extras are the one step where you can choose several. */
  const STEPS = [
    { id: 'size', title: 'Size', ask: 'Choose the size', opts: [['small', 'Small', '🥛'], ['medium', 'Medium', '☕'], ['large', 'Large', '🍵']] },
    { id: 'base', title: 'Base', ask: 'Choose the base', opts: [['dark', 'Dark roast', '🟤'], ['light', 'Light roast', '🟡'], ['decaf', 'Decaf', '🌙'], ['matcha', 'Matcha', '🍃']] },
    { id: 'temp', title: 'Temperature', ask: 'Hot or iced?', opts: [['hot', 'Hot', '🔥'], ['iced', 'Iced', '🧊']] },
    { id: 'milk', title: 'Milk', ask: 'Choose the milk', opts: [['black', 'Black', '⚫'], ['milk', 'Milk', '🥛'], ['oat', 'Oat', '🌾'], ['coconut', 'Coconut', '🥥'], ['almond', 'Almond', '🌰']] },
    { id: 'syrup', title: 'Syrup', ask: 'Choose a syrup', opts: [['none', 'No syrup', '🚫'], ['vanilla', 'Vanilla', '🌼'], ['caramel', 'Caramel', '🍯'], ['hazelnut', 'Hazelnut', '🌰'], ['mint', 'Mint', '🌿']] },
    { id: 'extras', title: 'Extras', ask: 'Add the extras, then tap Done', multi: true, opts: [['shot', 'Extra shot', '⚡'], ['cinnamon', 'Cinnamon', '🧂'], ['sprinkles', 'Choc sprinkles', '🍫'], ['cream', 'Whipped cream', '🍦']] },
  ];
  const byId = {}; STEPS.forEach((s) => { byId[s.id] = s; });
  const FIRST = 2, SINGLES = 5;   // the first order has two items, and every drink served adds one; the first five items are one choice each, the rest are extras

  const label = (stepId, optId) => { const o = byId[stepId].opts.find((x) => x[0] === optId); return o ? o[1] : optId; };
  const icon = (stepId, optId) => { const o = byId[stepId].opts.find((x) => x[0] === optId); return o ? o[2] : ''; };

  /* How many items the next customer's order has, given the drinks served so far: two at the start, one more with every drink. */
  const itemCount = (served) => FIRST + served;
  /* How many steps that order has: the single-choice ones, then the extras step once there are more than five items. */
  const stepCount = (served) => (itemCount(served) > SINGLES ? STEPS.length : itemCount(served));
  /* How many extras it asks for: one for the sixth item, one more for each item after, up to every extra there is. */
  const extraCount = (served) => Math.min(byId.extras.opts.length, Math.max(0, itemCount(served) - SINGLES));

  function pickOne(list, rng) { return list[Math.floor(rng() * list.length) % list.length]; }
  function pickSome(list, n, rng) {
    const pool = list.slice(), out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0]);
    return out;
  }

  /* A fresh order for the next customer, given the drinks served so far. Returns { steps: [ids in play], picks: { stepId: optionId }, extras: [optionIds] }. */
  function makeOrder(served, rng) {
    rng = rng || Math.random;
    const n = stepCount(served), steps = STEPS.slice(0, n).map((s) => s.id), picks = {};
    let extras = [];
    steps.forEach((id) => {
      if (id === 'extras') extras = pickSome(byId.extras.opts.map((o) => o[0]), extraCount(served), rng).sort();
      else picks[id] = pickOne(byId[id].opts.map((o) => o[0]), rng);
    });
    return { steps, picks, extras };
  }

  /* The order as lines to show on the ticket: [{ step, title, text, icon }]. */
  function lines(order) {
    return order.steps.map((id) => {
      if (id === 'extras') return { step: id, title: byId[id].title, text: order.extras.map((x) => label(id, x)).join(', '), icon: order.extras.map((x) => icon(id, x)).join('') };
      return { step: id, title: byId[id].title, text: label(id, order.picks[id]), icon: icon(id, order.picks[id]) };
    });
  }

  /* One game: customers in turn for as long as every drink is right. The state it is in: 'order' (the ticket is being shown), 'build' (making
     the drink), 'served' (that customer is happy), 'over' (a wrong choice: the game has ended). */
  function run(rng) {
    rng = rng || Math.random;
    const r = {
      served: 0, order: null, step: 0, got: {}, extras: [], state: 'order', fail: null,
      /* Deal the next customer's order and show its ticket. False once the game is over. */
      next() {
        if (r.state === 'over') return false;
        r.order = makeOrder(r.served, rng); r.step = 0; r.got = {}; r.extras = []; r.fail = null; r.state = 'order';
        return true;
      },
      finished() { return r.state === 'over'; },
      /* The ticket has been read: hide it and begin the drink. */
      begin() { if (r.state === 'order') r.state = 'build'; },
      /* The step being made now, or null when the drink is finished. */
      current() { return r.state === 'build' ? byId[r.order.steps[r.step]] : null; },
      /* Choose an option on a one-choice step. Returns 'right' (go on to the next step), 'served' (that was the last step) or 'wrong'. */
      pick(optId) {
        const st = r.current();
        if (!st || st.multi) return null;
        if (optId !== r.order.picks[st.id]) return r.slip(st.id, [optId]);
        r.got[st.id] = optId; r.step++;
        return r.step >= r.order.steps.length ? r.serve() : 'right';
      },
      /* On the extras step, add or take away an extra. Returns what is chosen so far. */
      toggle(optId) {
        const st = r.current();
        if (!st || !st.multi) return r.extras;
        const at = r.extras.indexOf(optId);
        if (at >= 0) r.extras.splice(at, 1); else r.extras.push(optId);
        return r.extras;
      },
      /* Done with the extras: right only if exactly the ordered ones were chosen. */
      confirm() {
        const st = r.current();
        if (!st || !st.multi) return null;
        const want = r.order.extras.slice().sort(), got = r.extras.slice().sort();
        if (want.length !== got.length || want.some((x, i) => x !== got[i])) return r.slip(st.id, got);
        r.got.extras = got; r.step++;
        return r.serve();
      },
      serve() { r.served++; r.state = 'served'; return 'served'; },
      /* A wrong choice ends the game. What was wanted and what was chosen are kept to show. */
      slip(stepId, chose) {
        r.fail = { step: stepId, want: stepId === 'extras' ? r.order.extras.slice() : [r.order.picks[stepId]], chose: chose.slice() };
        r.state = 'over';
        return 'wrong';
      },
    };
    return r;
  }

  PN.Coffee = { STEPS, byId, label, icon, itemCount, stepCount, extraCount, makeOrder, lines, run };
})(window.PN = window.PN || {});
