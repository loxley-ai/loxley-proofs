# LOXLEY Nightwatch Seals

Cryptographic commitments for the LOXLEY nightwatch dataset.

## What this is

Every day, the nightwatch records observations about tokenized stock markets:
prices, liquidity, flows, and scored calls. The raw records stay private until
they are revealed. What gets published here, daily, is a SHA-256 hash of each
finished day's complete data.

A hash proves two things once the data is revealed:

1. The data existed on the day its seal was committed (see the commit timestamp)
2. The data was not altered afterward. Change one byte and the hash breaks

We cannot fake a good track record retroactively. Neither can anyone else.

## Verifying a seal

When a day's raw data is published, verify it against its seal:

```
python3 verify.py <day-directory> seals/<YYYY-MM-DD>.txt
```

`verify.py` recomputes the SHA-256 over the day's files (sorted by name, each
hashed as `name \x00 content \x00`) and compares it with the sealed value.

## What this is not

Not financial advice. Not affiliated with Robinhood Markets, Inc.
Observations of public onchain data, sealed so the scoreboard can be trusted.

🏹
