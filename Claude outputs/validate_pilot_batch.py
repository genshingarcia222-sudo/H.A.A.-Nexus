#!/usr/bin/env python3
"""Structural + bias checks for a Nexus candidate batch (pilot format).

This checks the batch file's own invariants. It is NOT the repository schema
validator and it says nothing about medical truth or source accuracy.
Usage: python3 validate_pilot_batch.py <batch.json> [--today YYYY-MM-DD]
Exit code 1 if any ERROR is found.
"""
import json, re, sys, datetime, collections

ERR, WARN = [], []
def err(i, m): ERR.append(f"{i}: {m}")
def warn(i, m): WARN.append(f"{i}: {m}")

path = sys.argv[1]
today = datetime.date.today()
if "--today" in sys.argv:
    today = datetime.date.fromisoformat(sys.argv[sys.argv.index("--today") + 1])

d = json.load(open(path, encoding="utf-8"))
items = d.get("items", [])
sources = d.get("sources", {})
REQ = ["id","domain","skillArea","difficultyLevel","questionType","learningObjective",
       "question","choices","correctChoiceId","rationale","source","variantGroup",
       "contentStatus","reviewStatus"]
ICD_LIKE = re.compile(r"\b[A-TV-Z]\d{2}(\.\w{1,4})?\b")

seen_ids = set()
groups = collections.Counter()
positions = collections.Counter()
unique_longest = 0

for it in items:
    iid = it.get("id", "<no id>")
    for f in REQ:
        if f not in it or it[f] in (None, "", []):
            err(iid, f"missing/empty field '{f}'")
    if iid in seen_ids: err(iid, "duplicate id")
    seen_ids.add(iid)
    if it.get("contentStatus") != "candidate": err(iid, "contentStatus must be 'candidate' in a pilot batch")
    if it.get("reviewStatus") != "pending": err(iid, "reviewStatus must be 'pending' in a pilot batch")
    if not isinstance(it.get("difficultyLevel"), int) or not 1 <= it["difficultyLevel"] <= 6:
        err(iid, "difficultyLevel must be an integer 1-6")
    ch = it.get("choices", [])
    ids = [c.get("id") for c in ch]
    if len(ch) < 2: err(iid, "fewer than 2 choices")
    if len(set(ids)) != len(ids): err(iid, "duplicate choice ids")
    if it.get("correctChoiceId") not in ids: err(iid, "correctChoiceId not among choices")
    texts = [c.get("text", "") for c in ch]
    if len(set(t.strip().lower() for t in texts)) != len(texts): err(iid, "duplicate choice text")
    for c in ch:
        if not c.get("why"): err(iid, f"choice {c.get('id')} has no explanation")
    ref = it.get("source", {}).get("ref")
    if ref not in sources: err(iid, f"source ref '{ref}' not defined in sources")
    if not it.get("source", {}).get("locator"): err(iid, "source locator missing")
    v = it.get("verification", {})
    if not v.get("humanVerificationRequired"): warn(iid, "humanVerificationRequired not set")
    if v.get("humanVerifiedBy") is None: warn(iid, "no human verification recorded yet")
    # ICD safety: no specific codes unless codingReference lists them
    listed = set((it.get("codingReference") or {}).get("codes", []))
    blob = it.get("question","") + " " + " ".join(texts) + " " + it.get("rationale","")
    for m in ICD_LIKE.finditer(blob):
        if m.group(0) not in listed:
            warn(iid, f"text contains code-like token '{m.group(0)}' not listed in codingReference.codes")
    if it.get("domain") == "ICD" and not it.get("codingReference"):
        err(iid, "ICD item without codingReference (system/jurisdiction/release)")
    vu = it.get("validUntil")
    if vu and datetime.date.fromisoformat(vu) < today: err(iid, f"expired on {vu}")
    # answer-length bias
    lens = {c["id"]: len(c.get("text","")) for c in ch if "id" in c}
    if lens and it.get("correctChoiceId") in lens:
        cl = lens[it["correctChoiceId"]]
        others = [l for k,l in lens.items() if k != it["correctChoiceId"]]
        if others and cl > max(others):
            unique_longest += 1
            err(iid, "correct choice is the longest option")
        if others and cl < min(others) * 0.5:
            warn(iid, "correct choice is much shorter than every distractor")
    positions[it.get("correctChoiceId")] += 1
    groups[it.get("variantGroup")] += 1

n = len(items)
if n:
    cap = -(-n // 4) + 1  # ceil(n/4)+1
    for k, c in positions.items():
        if c > cap: err("batch", f"correct answer is '{k}' in {c} of {n} items (max {cap})")
for g, c in groups.items():
    if c > 1: warn("batch", f"variantGroup '{g}' used by {c} items (fine only if intentional)")

print(f"items={n} positions={dict(positions)} correct_is_longest={unique_longest}")
for w in WARN: print("WARN ", w)
for e in ERR: print("ERROR", e)
print("RESULT:", "FAIL" if ERR else "PASS (structure/bias only; not a source or truth check)")
sys.exit(1 if ERR else 0)
