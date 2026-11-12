// Run: node test.js   (no dependencies). Extracts the inline <script id="calc">
// from index.html and runs it in a sandbox, so the page and the tests share code.
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const m = html.match(/<script id="calc">([\s\S]*?)<\/script>/);
assert(m, "inline script not found");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[1], ctx);
const { estimate, defaults, lessons, billedSeconds, llmCall } = ctx;

let n = 0;
function test(name, fn) { fn(); n++; console.log("ok -", name); }
const near = (a, b, eps = 1e-9) => assert(Math.abs(a - b) < eps, `${a} != ${b}`);
const zero = () => Object.assign(defaults(), {
  n_dialed: 1000, answer_rate: 1, machine_share: 0, tel_per_min: 0, tel_per_call: 0, amd_fee: 0,
  tts_price_per_1k: 0, stt_per_min: 0, price_in: 0, price_cached: 0, price_out: 0, amd_on: 0, tel_increment_s: 60,
});

test("billing increment rounds up", () => {
  assert.strictEqual(billedSeconds(61, 60), 120);
  assert.strictEqual(billedSeconds(60, 60), 60);
  assert.strictEqual(billedSeconds(6, 1), 6);
  assert.strictEqual(billedSeconds(0, 60), 0);
});

test("telephony only: 90 s call, 60 s increment, 0.02/min -> 2 minutes billed", () => {
  const p = Object.assign(zero(), { tel_per_min: 0.02, human_call_s: 90 });
  near(estimate(p).perDialed.total, 0.04);
});

test("unanswered calls are free unless billed", () => {
  const p = Object.assign(zero(), { answer_rate: 0, tel_per_min: 0.02, ring_s: 20 });
  near(estimate(p).perDialed.total, 0);
  near(estimate(Object.assign({}, p, { bill_unanswered: 1 })).perDialed.total, 0.02);
});

test("components sum to the total and segments sum to the total", () => {
  const e = estimate(defaults());
  const c = e.perDialed;
  near(c.telephony + c.amd + c.tts + c.stt + c.llm, c.total);
  const s = e.segments;
  near(s.human.perDialed + s.machine.perDialed + s.unanswered.perDialed, c.total);
  near(s.human.share + s.machine.share + s.unanswered.share, 1);
});

test("LLM, no cache, 1 turn: (prompt+user) * in + out * out", () => {
  const p = Object.assign(defaults(), { cache_on: 0, prompt_tokens: 1000, user_tokens: 100, out_tokens: 50,
    price_in: 2, price_cached: 0.2, price_out: 8 });
  near(llmCall(p, 1, false), (1100 * 2 + 50 * 8) / 1e6);
});

test("LLM, cache on, warm start, 2 turns", () => {
  const p = Object.assign(defaults(), { cache_on: 1, prompt_tokens: 1000, user_tokens: 100, out_tokens: 50,
    price_in: 2, price_cached: 0.2, price_out: 8, cache_write_mult: 1.25 });
  const t1 = (100 * 2 + 1000 * 0.2 + 50 * 8) / 1e6;
  const t2 = (100 * 2 + (1000 + 150) * 0.2 + 50 * 8) / 1e6;
  near(llmCall(p, 2, true), t1 + t2);
});

test("cold start pays the write premium once", () => {
  const p = Object.assign(defaults(), { cache_on: 1, prompt_tokens: 1000, user_tokens: 0, out_tokens: 0,
    price_in: 2, price_cached: 0.2, price_out: 0, cache_write_mult: 1.25 });
  near(llmCall(p, 1, false), 1000 * 2 * 1.25 / 1e6);
  near(llmCall(p, 1, true), 1000 * 0.2 / 1e6);
});

test("caching on is cheaper than off with the example defaults", () => {
  const p = defaults();
  assert(estimate(p).perDialed.llm < estimate(Object.assign({}, p, { cache_on: 0 })).perDialed.llm);
});

test("lesson: with example defaults the cache matters more than a 50% longer call", () => {
  const L = lessons(defaults());
  assert(L.cacheOffDelta > L.longerDelta, `${L.cacheOffDelta} vs ${L.longerDelta}`);
  assert(L.cacheOffDelta > 0);
});

test("lesson holds even more with a bigger prompt, and fades with a tiny one", () => {
  const big = lessons(Object.assign(defaults(), { prompt_tokens: 12000 }));
  const tiny = lessons(Object.assign(defaults(), { prompt_tokens: 200 }));
  assert(big.cacheOffDelta > tiny.cacheOffDelta);
  assert(big.cacheOffDelta > big.longerDelta);
  assert(tiny.cacheOffDelta < tiny.longerDelta);
});

test("cost per appointment = per human conversation / booking rate", () => {
  const p = defaults();
  const e = estimate(p);
  near(e.perAppointment, e.perHumanConversation / p.booking_rate);
});

test("no humans reached -> per-human metrics are null, no NaN", () => {
  const e = estimate(Object.assign(defaults(), { answer_rate: 0 }));
  assert.strictEqual(e.perHumanConversation, null);
  assert.strictEqual(e.perAppointment, null);
  assert(Number.isFinite(e.perDialed.total));
});

test("page is offline and labels prices as examples", () => {
  assert(!/<(script|link|img)[^>]+(src|href)=["']https?:/i.test(html), "external resource found");
  assert(/EXAMPLE values, not any vendor's current prices/.test(html));
  assert(/Check your provider's pricing page/i.test(html));
});

console.log(`\n${n} tests passed`);
