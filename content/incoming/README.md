# Scenario intake

Drafts land here on their way to becoming released content. Nothing in this
folder is shipped: the app loads scenarios from `content/scenarios/`, and this
folder is not on that path.

## Authoring a scenario

1. Copy `_TEMPLATE.scenario.json` to `SCRIBE-<SPECIALTY>-<NNN>-v1.0.json`.
2. Replace every `REPLACE:` marker. A draft that still contains one is a draft,
   not a submission.
3. Run `pnpm -r test`. The intake checks report, per file, exactly which fields
   are missing or malformed — you do not need to read the schema to find out.
4. Keep every `sourceFact` traceable to text that actually appears in
   `encounter`. The evaluator only ever compares a learner's note against a
   `sourceFact`; a requirement that traces to nothing cannot be scored, and a
   number that appears nowhere in the encounter is what the fabrication rule
   exists to catch.

## What intake checks

- the draft satisfies the **real** scenario schema (the same `validateScenario`
  the application uses — there is no second definition here);
- no draft reuses the `scenarioId@version` of released content, which would
  break the content-hash gate and make a stored attempt ambiguous about what it
  was scored against;
- no two drafts share an id and version;
- the template itself still validates, so an author starts from something that
  passes.

## What intake does not check

**Clinical truth.** Whether a finding is correct, safe, internally consistent,
or appropriate for its stated difficulty is a human judgement, and no schema
can make it. Passing intake means a draft is *structurally reviewable* — it
says nothing about whether the medicine is right.

Clinical authoring and review remain owner-controlled work (decision **A12** in
`docs/DECISION_REGISTER.md`). Current released inventory is 2 scenarios, at
difficulty 1 and 3; difficulty 2, 4, 5 and 6 have no content at all, which is
why three of the four subscription tiers currently unlock the same material.

## Releasing an approved draft

Once a draft is clinically approved, move it to
`content/scenarios/live-scribing/` and record its hash in
`content/content-hashes.json`. The content-QA suite then holds it immutable:
editing a released scenario without bumping its version fails the drift gate.
