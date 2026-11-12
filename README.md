# voice-agent-cost-calculator

One static HTML page that estimates what an AI voice-agent call costs: per dialed number, per answered call, per human conversation and per booked appointment. No build step, no dependencies, works offline: open `index.html`.

Español: calculadora de costo por llamada de un agente de voz con IA (telefonía, detección de buzón, voz TTS, transcripción STT y LLM con y sin caché). Los precios por defecto son EJEMPLOS inventados; reemplázalos con los de tus proveedores.

## Why this exists

When I started pricing outbound voice agents I assumed cost followed call length. Measuring real calls said otherwise in two places: most dialed numbers are never answered (and many providers do not bill an unanswered ring), and the cost of an LLM turn is dominated by how much of the system prompt is served from cache, not by how many seconds the call lasts. In one comparison the same call cost about five times more or less depending only on cache state. This page lets you play with those variables with your own numbers before you commit to a provider or a prompt size.

## Use

```bash
open index.html            # macOS; or just double-click the file
node test.js               # 13 tests, no dependencies
```

Edit the inputs on the left; results and the "what this teaches" panel update live.

Example result with the built-in EXAMPLE values (1,000 dials, 30% answered, 65% of those machines):

```
Per dialed number        $0.019
Per human conversation   $0.185
Per booked appointment   $9.23   (assumes 2% of conversations book)
Segment   share  cost/call  share of spend
human     10.5%  $0.127     69%
machine   19.5%  $0.031     31%
unanswered 70.0% $0.00000   0%
```

## What the model does

- Dials split into unanswered, machine and human. Each segment has its own duration and cost.
- Telephony: per-minute price with a billing increment (60 s rounds every started minute up), a fixed fee per connected call, an optional answering-machine-detection fee, and a switch for whether unanswered rings are billed.
- Speech out: characters per minute of agent speech times a credit price. Speech in: price per minute of audio.
- LLM: per turn, input = system prompt + conversation so far + new user tokens, billed at the normal, cached or cache-write price, plus output tokens. A "warm share" says how many calls start with the prompt already cached (back-to-back calls in a batch) versus cold (first call after a quiet period). The history is treated as cached after its first turn.
- A lessons panel re-runs the model with one thing changed (cache off, calls 50% longer, rings billed) and shows the difference, so the claims are computed from your inputs, not asserted.

## Prices are examples

Every default price in the page is an invented EXAMPLE and is not the current price of any vendor. Replace all of them with numbers from your providers' pricing pages and, better, from a real invoice. Billing increments, machine-detection fees, media fees and the treatment of unanswered calls vary by provider and change over time.

## Limits

- Per-call averages, not a simulation: no variance, no retries, no concurrency or plan limits, no taxes, no phone-number rental.
- The cache model is a simplification (one prefix, one write premium, no expiry timers); real providers differ.
- STT is billed on the whole call duration; some providers bill only speech.
- With the example inputs the cache effect is larger than a 50% longer call, but the page says so only when your numbers do. Try a 200-token prompt and the conclusion flips.

## License

MIT, see `LICENSE`. Author: Ricardo Delgado ([auraliq.io/ricardo](https://www.auraliq.io/ricardo), [LinkedIn](https://www.linkedin.com/in/ricardo-delgado-0626642a7)).
