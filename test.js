const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { dumpTransfers, asFloat, fmtWhen, parseSince } = require("./index.js");

const SCRIPT = path.join(__dirname, "index.js");

function run(args) {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], { encoding: "utf8" });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ? e.stdout.toString() : "", stderr: e.stderr ? e.stderr.toString() : "" };
  }
}

// Parity checks cross-referenced against the Python implementation
// (kleogeos/crypto-pay-cli, pay.py) run side by side against the live
// TronGrid API with the same real wallet address.

function test_asFloat_matches_python_repr() {
  assert.strictEqual(asFloat(338), "338.0");
  assert.strictEqual(asFloat(276.6), "276.6");
  assert.strictEqual(asFloat(0), "0.0");
}

function test_dumpTransfers_empty() {
  assert.strictEqual(dumpTransfers([]), "[]");
}

function test_dumpTransfers_matches_python_json_dumps_indent2() {
  const out = dumpTransfers([
    { amount: 338, token: "USDT", from: "TLY8", to: "TSDq", txid: "abc", timestamp: 1786394616 },
  ]);
  const expected =
    '[\n  {\n    "amount": 338.0,\n    "token": "USDT",\n    "from": "TLY8",\n' +
    '    "to": "TSDq",\n    "txid": "abc",\n    "timestamp": 1786394616.0\n  }\n]';
  assert.strictEqual(out, expected);
}

function test_fmtWhen() {
  // cross-checked against Python: datetime.fromtimestamp(1786233816, tz=utc)
  assert.strictEqual(fmtWhen(1786233816), "2026-08-09 00:03 UTC");
}

function test_qr_no_network() {
  const r = run(["qr", "TSDqzM1aAc5FKWUnmZQBtajLzgW7uneYhh"]);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(r.stdout.startsWith("https://api.qrserver.com/v1/create-qr-code/?"));
  assert.ok(r.stdout.includes("data=TSDqzM1aAc5FKWUnmZQBtajLzgW7uneYhh"));
}

function test_qr_with_amount() {
  const r = run(["qr", "TAddress", "--amount", "100"]);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(r.stdout.includes("data=TAddress%3Famount%3D100"));
}

function test_missing_address_fails() {
  const r = run(["check"]);
  assert.notStrictEqual(r.code, 0);
}

function test_parseSince_valid_date() {
  // 2026-01-01T00:00:00Z
  assert.strictEqual(parseSince("2026-01-01"), 1767225600);
}

function test_parseSince_garbage_throws_instead_of_silently_matching_nothing() {
  // Regression: Date.parse('not-a-date...') returns NaN, and `x >= NaN` is
  // always false, so without this check a malformed --since used to silently
  // filter out every real transfer instead of erroring — see index.js.
  assert.throws(() => parseSince("not-a-date"), /invalid --since/);
}

function test_check_with_bad_since_fails_before_any_network_call() {
  // No network/wallet needed: parseSince() runs before fetchTransfers(), so a
  // bogus address plus a bogus --since should still fail on the --since
  // message, not a network error, proving the validation really runs first.
  const r = run(["check", "not-a-real-address", "--since", "nonsense"]);
  assert.notStrictEqual(r.code, 0);
  assert.ok(r.stderr.includes("invalid --since"), r.stderr);
}

function test_check_with_non_numeric_min_fails_before_any_network_call() {
  // Same bug class as --since: Number("abc") is NaN, and `x >= NaN` is always
  // false, which used to silently match zero transfers instead of erroring.
  const r = run(["check", "not-a-real-address", "--min", "abc"]);
  assert.notStrictEqual(r.code, 0);
  assert.ok(r.stderr.includes("--min must be a number"), r.stderr);
}

const tests = {
  test_asFloat_matches_python_repr,
  test_dumpTransfers_empty,
  test_dumpTransfers_matches_python_json_dumps_indent2,
  test_fmtWhen,
  test_qr_no_network,
  test_qr_with_amount,
  test_missing_address_fails,
  test_parseSince_valid_date,
  test_parseSince_garbage_throws_instead_of_silently_matching_nothing,
  test_check_with_bad_since_fails_before_any_network_call,
  test_check_with_non_numeric_min_fails_before_any_network_call,
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL: ${name}: ${e.message}`);
  }
}
console.log(`\n${Object.keys(tests).length - failed}/${Object.keys(tests).length} passed`);
process.exit(failed ? 1 : 0);
