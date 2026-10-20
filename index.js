#!/usr/bin/env node
"use strict";

const https = require("https");

const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const KNOWN_TOKENS = { usdt: USDT_TRC20_CONTRACT };

function fetchTransfers(address, contract, limit) {
  return new Promise((resolve, reject) => {
    const path =
      `/v1/accounts/${encodeURIComponent(address)}/transactions/trc20` +
      `?limit=${limit}&contract_address=${encodeURIComponent(contract)}&only_to=true`;
    const req = https.get(
      { hostname: "api.trongrid.io", path, timeout: 15000 },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let data;
          try {
            data = JSON.parse(body);
          } catch (e) {
            reject(new Error("could not parse response"));
            return;
          }
          const out = (data.data || []).map((tx) => {
            const decimals = parseInt(tx.token_info.decimals, 10);
            const amount = Number(tx.value) / 10 ** decimals;
            return {
              amount,
              token: tx.token_info.symbol,
              from: tx.from,
              to: tx.to,
              txid: tx.transaction_id,
              timestamp: tx.block_timestamp / 1000,
            };
          });
          resolve(out);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

function resolveContract(args) {
  if (args.contract) return args.contract;
  const t = KNOWN_TOKENS[args.token.toLowerCase()];
  if (!t) {
    console.error(`unknown token '${args.token}'`);
    process.exit(1);
  }
  return t;
}

// Mirrors Python's repr() of a float inside json.dumps: integers keep a
// trailing ".0", everything else prints as the shortest round-trip decimal
// (same convention as freelance-tax-js/freelance-currency-js's asFloat()).
function asFloat(n) {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

// Mirrors Python's json.dumps(list_of_dicts, indent=2) exactly, including
// key order and float formatting -- JSON.stringify would drop "amount": 338
// instead of 338.0 and can't control key order the same way portably.
function dumpTransfers(transfers) {
  if (!transfers.length) return "[]";
  const items = transfers.map((t) => {
    const lines = [
      `    "amount": ${asFloat(t.amount)}`,
      `    "token": ${JSON.stringify(t.token)}`,
      `    "from": ${JSON.stringify(t.from)}`,
      `    "to": ${JSON.stringify(t.to)}`,
      `    "txid": ${JSON.stringify(t.txid)}`,
      `    "timestamp": ${asFloat(t.timestamp)}`,
    ];
    return "  {\n" + lines.join(",\n") + "\n  }";
  });
  return "[\n" + items.join(",\n") + "\n]";
}

function fmtWhen(ts) {
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

async function cmdCheck(args) {
  const contract = resolveContract(args);
  let transfers;
  try {
    transfers = await fetchTransfers(args.address, contract, args.limit);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }

  if (args.min !== null) transfers = transfers.filter((t) => t.amount >= args.min);
  if (args.since) {
    const sinceTs = Date.parse(args.since + "T00:00:00Z") / 1000;
    transfers = transfers.filter((t) => t.timestamp >= sinceTs);
  }

  if (args.json) {
    console.log(dumpTransfers(transfers));
    return;
  }

  if (!transfers.length) {
    console.log("No matching incoming transfers found.");
    return;
  }
  for (const t of transfers) {
    const amountStr = t.amount.toFixed(2).padStart(12, " ");
    console.log(`${amountStr} ${t.token}  ${fmtWhen(t.timestamp)}  from ${t.from}  tx=${t.txid}`);
  }
}

function cmdQr(args) {
  let payload = args.address;
  if (args.amount) payload += `?amount=${args.amount}`;
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?" +
    new URLSearchParams({ size: "300x300", data: payload }).toString();
  console.log(qrUrl);
}

function printHelp() {
  console.log(`crypto-pay-js - check crypto payments and generate receive QR codes for freelancers

Usage:
  crypto-pay check <address> [--token usdt] [--contract C] [--min N] [--since DATE] [--limit N] [--json]
  crypto-pay qr <address> [--amount N]

Run without installing:
  npx github:kleogeos/crypto-pay-js check TAddress... --json
`);
}

function parseArgs(argv) {
  const out = {
    address: null,
    token: "usdt",
    contract: null,
    min: null,
    since: null,
    limit: 20,
    json: false,
    amount: null,
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--token") out.token = argv[++i];
    else if (a === "--contract") out.contract = argv[++i];
    else if (a === "--min") out.min = Number(argv[++i]);
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--json") out.json = true;
    else if (a === "--amount") out.amount = argv[++i];
    else if (a === "--open") out.open = true;
    else positionals.push(a);
  }
  if (positionals.length) out.address = positionals[0];
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  const args = parseArgs(argv.slice(1));
  if (!args.address) {
    printHelp();
    process.exit(1);
  }

  if (command === "check") {
    await cmdCheck(args);
    return;
  }
  if (command === "qr") {
    cmdQr(args);
    return;
  }

  printHelp();
  process.exit(1);
}

module.exports = { fetchTransfers, dumpTransfers, asFloat, fmtWhen };

if (require.main === module) {
  main();
}
