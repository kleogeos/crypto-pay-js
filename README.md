# crypto-pay-js

![test](https://github.com/kleogeos/crypto-pay-js/actions/workflows/test.yml/badge.svg)

Check incoming USDT (TRC20) payments to a wallet, and generate a QR code so
a client can pay you. No API key, no sign-up, zero dependencies, Node.js —
the npx port of [crypto-pay-cli](https://github.com/kleogeos/crypto-pay-cli)
for anyone who'd rather not have Python installed.

```bash
npx github:kleogeos/crypto-pay-js check TSomeAddressHere
```

```
      338.00 USDT  2026-08-10 20:43 UTC  from TLY8r7...  tx=b4473970...
      118.00 USDT  2026-06-10 16:14 UTC  from TLY8r7...  tx=4d854802...
```

### Install (optional)

```bash
npm install -g github:kleogeos/crypto-pay-js
crypto-pay check TSomeAddressHere
```

### Check for a specific invoice

```bash
npx github:kleogeos/crypto-pay-js check TSomeAddressHere --min 15 --since 2026-10-14
```

Filters out everything smaller than the invoice amount and everything older
than the invoice date — the common case of "did my client's payment land yet."

### Generate a receive QR code

```bash
npx github:kleogeos/crypto-pay-js qr TSomeAddressHere --amount 15
```

Prints a URL to a QR code image your client can scan from a wallet app. Drop
it on an invoice page or in a chat.

### Options — `check`

| Flag | Default | Meaning |
|---|---|---|
| `address` | required | Wallet address to check |
| `--token` | `usdt` | Known token name |
| `--contract` | — | Override: raw TRC20 contract address, for other tokens |
| `--min` | — | Only show transfers at or above this amount |
| `--since` | — | Only show transfers after this ISO date |
| `--limit` | 20 | Max transfers to fetch |
| `--json` | off | Output as JSON instead of text |

### Options — `qr`

| Flag | Default | Meaning |
|---|---|---|
| `address` | required | Wallet address to receive payment |
| `--amount` | — | Optional amount hint embedded in the QR payload |

### Where this fits

Same output, same fields, as the Python original
[crypto-pay-cli](https://github.com/kleogeos/crypto-pay-cli) — this port is
for anyone whose toolchain is Node.js rather than Python.

More free tools: [Freelancer Toolbox](https://kleogeos.github.io/freelancer-tools/donate.html?src=cli-cryptopay-js).

## Tests

```bash
node test.js
```
