# LOXLEY Nightwatch Seals

Anyone can post predictions. The internet forgets the wrong ones by lunchtime.
This repository is the receipt drawer: a track record kept here cannot be edited
after the fact, including by us. The wrong calls stay up. So do the corrections.

Stocks now trade onchain through the night on Robinhood Chain, hours before the
official market opens. LOXLEY writes down what the night says a stock is worth,
commits it here before the opening bell, and grades it against the price the
market actually opened at. When a number of ours turns out wrong, the correction
is filed in this repo too, with the reason. That record is the product.

## What is in here

**`seals/`** — one file per finished night: a SHA-256 hash of that night's
complete raw records (prices, liquidity, wallet flows). The raw data stays
private. The hash is published the next morning.

A hash proves two things once the data is revealed:

1. The data existed on the day its seal was committed (see the commit timestamp)
2. The data was not altered afterward. Change one byte and the hash breaks

We cannot fabricate a good track record retroactively. Neither can anyone else.

**`forecasts/`** — one file per morning since 2026-07-16: the calls themselves,
committed before the opening bell (see `committed_at`). **The season's first
three mornings, 2026-07-13 to 07-15 (36 graded calls), have no forecast file.**
The desk only started committing the calls as their own artifact on 07-16; those
first mornings are graded from the sealed night tape, and their seals prove the
tape existed, not that a direction was committed pre-open. We are not backfilling
them, because a pre-commitment written after the fact would be a fabricated
receipt, and this drawer holds no fabricated receipts. Claims of "committed
before the bell" therefore begin at 2026-07-16.

**`scores/`** — one file per graded day: every call the nightwatch made overnight,
and how the name actually opened. The misses stay up.

Each scorecard carries two verdicts on the same night:

- `call_summary` grades **direction**. The onchain price said the name would open
  higher, and it did, or it did not.
- `rel_summary` grades the same night **market-neutral**: the market's own
  overnight move is taken out of both sides first. A call that merely rode a
  rising tape scores nothing here.

The second number is the honest one, and it is the harsher one. A green week
flatters a direction score. It cannot flatter this.

## Verifying a seal

When a night's raw data is published, verify it against its seal:

```
python3 verify.py <day-directory> seals/<YYYY-MM-DD>.txt
```

`verify.py` recomputes the SHA-256 over the day's files (sorted by name, each
hashed as `name \x00 content \x00`) and compares it with the sealed value.

## The public number

**LOXLEY PREMIUM** is the median distance between a tokenized stock's onchain
price and its last official close, measured while the exchange is shut, printed
at 9:00 New York. Travelling with it: the dispersion, which is how far the names
pulled away from the market's own overnight move. A quiet night has them moving
together. A loud one has somebody working a single ticker.

Free to read, free to quote:

```
https://api.loxleyai.xyz/premium
```

## What is not in here

Per-wallet track records, and which individual names broke away overnight. That
is the work, not the receipt. It lives at [loxleyai.xyz](https://loxleyai.xyz).

## What this is not

Not financial advice. Not affiliated with Robinhood Markets, Inc. Observations of
public onchain data, sealed so that the scoreboard can be trusted.

🏹
