// Counterfactual mutation operators.
//
// An operator is not a paraphrase. Each one changes the packet so that the
// defensible behaviour changes with it, which is the whole point: the option
// that is correct in the base becomes a trap in the mutation, so a learner who
// memorised the wording fails and a learner who read the evidence does not.
//
// Every operator declares the mutation dimensions it uses (they must resolve in
// registries/mutation-dimensions.json), what it does to the difficulty band, and
// which error patterns the mutated record now teaches.

const BANDS = ["EASY", "MODERATE", "HARD", "VERY_HARD", "REALISTIC_PREMIUM"];

export function raiseBand(band, steps) {
  const index = BANDS.indexOf(band);
  return BANDS[Math.min(BANDS.length - 2, Math.max(0, index + steps))];
}

export function atLeast(band, floor) {
  return BANDS.indexOf(band) >= BANDS.indexOf(floor) ? band : floor;
}

/**
 * Padding lines. They are plausible chart noise, never decisive, and they exist
 * so that "the clue is late" and "the clue is buried" are different problems
 * from "the packet is short".
 */
function noise(ctx, count) {
  const pool = [
    { section: "Administrative", text: `Insurance card image on file, captured ${ctx.encounterDate}; no change since prior visit.` },
    { section: "Administrative", text: `Preferred contact on file: ${ctx.channel}. Interpreter not required.` },
    { section: "Vitals", text: `BP 128/78, HR 74, temp 36.8 C, weight stable since last visit.` },
    { section: "History", text: `Patient reports no new allergies; allergy list reviewed and unchanged.` },
    { section: "Administrative", text: `Copay collected at check-in by ${ctx.staff.label}; receipt printed.` },
    { section: "History", text: `Prior visit summary printed and given to the patient at discharge.` },
    { section: "Administrative", text: `Pharmacy of record unchanged: Willowbrook Pharmacy, synthetic account SYN-PH-2231.` }
  ];
  return pool.slice(0, count).map((entry, index) => ({ ref: `PAD${index + 1}`, ...entry, decisive: false }));
}

function withoutDecisive(lines, decisiveRef) {
  return lines.filter((line) => line.ref !== decisiveRef);
}

function decisiveLine(lines, decisiveRef) {
  return lines.find((line) => line.ref === decisiveRef);
}

/**
 * Each operator returns a patch over the base spec. `lines` is rebuilt rather
 * than appended to, so the evidence layout fingerprint genuinely moves and the
 * novelty check has something real to measure.
 */
export const OPERATORS = [
  {
    id: "BASE",
    mutationTypes: [],
    label: "the decisive evidence is present and plainly placed",
    apply: (base, ctx) => ({
      lines: base.lines,
      prompt: base.ask,
      gold: base.gold,
      acceptance: base.acceptance,
      correct: base.answer.correct,
      extraWrong: [],
      difficulty: base.baseDifficulty,
      errorTargets: base.errorTargets,
      trapTypes: base.trapTypes,
      auditTags: ["EVIDENCE-PRESENT"]
    })
  },
  {
    id: "LATE_CLUE",
    mutationTypes: ["EVIDENCE_PLACEMENT", "EVIDENCE_ORDER"],
    label: "the decisive evidence arrives last, after routine material",
    apply: (base, ctx) => {
      const decisive = decisiveLine(base.lines, base.decisiveRef);
      return {
        lines: [...withoutDecisive(base.lines, base.decisiveRef), ...noise(ctx, 3), decisive],
        prompt: `${base.ask} Read to the end of the record before answering: the material is not in the order you need it.`,
        gold: base.gold,
        acceptance: base.acceptance,
        correct: base.answer.correct,
        extraWrong: [
          { text: `Act on the first two entries in the record, which are routine and complete on their face.`, why: `Acting on the opening entries skips the entry that changes the answer. Position in a record carries no authority.`, trapType: "TRAP_QUEUE_ORDER" }
        ],
        // Placement changes what must be read, not how many things interact, so the
        // band does not move: difficulty measures reasoning complexity.
        difficulty: base.baseDifficulty,
        errorTargets: [...base.errorTargets, "KB-ERR-OMISSION"],
        trapTypes: [...base.trapTypes, "TRAP_QUEUE_ORDER"],
        auditTags: ["EVIDENCE-LATE"]
      };
    }
  },
  {
    id: "BURIED_CLUE",
    mutationTypes: ["EVIDENCE_CONCEALMENT"],
    label: "the decisive evidence sits inside an otherwise routine entry",
    apply: (base, ctx) => {
      const decisive = decisiveLine(base.lines, base.decisiveRef);
      const buried = {
        ref: base.decisiveRef,
        section: "Administrative",
        text: `Routine reconciliation note from ${ctx.staff.label}: demographics confirmed, card image legible, and — ${decisive.text.charAt(0).toLowerCase()}${decisive.text.slice(1)} — remainder of the checklist unchanged.`,
        recordedBy: ctx.staff.label,
        recordedOn: ctx.encounterDate,
        decisive: true
      };
      return {
        lines: [...noise(ctx, 2), buried, ...withoutDecisive(base.lines, base.decisiveRef)],
        prompt: `${base.ask} Nothing in this record is labelled as important.`,
        gold: base.gold,
        acceptance: base.acceptance,
        correct: base.answer.correct,
        extraWrong: [
          { text: `Treat the reconciliation note as administrative housekeeping and proceed from the clinical entries only.`, why: `The deciding fact is inside that note. A heading does not determine whether an entry matters.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" }
        ],
        difficulty: base.baseDifficulty,
        errorTargets: [...base.errorTargets, "KB-ERR-OMISSION"],
        trapTypes: [...base.trapTypes, "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
        auditTags: ["EVIDENCE-CONCEALED"]
      };
    }
  },
  {
    id: "CLUE_REMOVED",
    mutationTypes: ["EVIDENCE_REMOVAL", "MISSING_FIELD"],
    label: "the decisive evidence is absent, so the defensible answer is to name the gap",
    apply: (base, ctx) => ({
      // The remaining entry that a reader would expect to carry the fact becomes
      // the decisive one: establishing that it does not supply it is the task.
      lines: [
        ...withoutDecisive(base.lines, base.decisiveRef).map((line) =>
          line.ref === base.secondaryRef ? { ...line, decisive: true } : line
        ),
        ...noise(ctx, 2)
      ],
      prompt: `${base.ask} If the record does not settle it, say so rather than choosing the likeliest answer.`,
      gold: `The record no longer contains the fact this task turns on. State precisely which fact is missing (${base.missingFact}), name ${ctx.provider.label} as the person who can supply it, and hold the task open. Do not infer it from the surrounding entries and do not complete the task on the balance of probability.`,
      acceptance: [
        { requirement: `Names the missing fact explicitly as "${base.missingFact}" rather than describing the record as unclear.` },
        { requirement: `Establishes that the remaining entries do not supply it, and states what they do establish.`, evidenceRef: base.secondaryRef },
        { requirement: `Identifies who can supply it and how it will be requested.` },
        { requirement: `Leaves the task open and records that it is blocked, rather than completing it or guessing.` }
      ],
      correct: { text: `State that ${base.missingFact} is not in the record, request it from ${ctx.provider.label}, and hold the task.`, why: `Correct: the fact the task turns on is absent, so naming the gap and holding is the only defensible action.` },
      extraWrong: [
        { text: `Infer the missing detail from the surrounding entries, which point consistently in one direction.`, why: `Consistent surrounding entries are not the missing fact. Filling a gap by inference is unsupported inference, and it becomes indistinguishable from documented fact once written down.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" }
      ],
      difficulty: atLeast(raiseBand(base.baseDifficulty, 1), "MODERATE"),
      errorTargets: [...base.errorTargets, "KB-ERR-PREMATURE-CLOSURE", "KB-ERR-UNSUPPORTED-INFERENCE"],
      trapTypes: [...base.trapTypes, "TRAP_COMPLETE_THE_TASK_ANYWAY", "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
      auditTags: ["EVIDENCE-REMOVED", "INFORMATION-GAP"],
      replacesBaseAnswer: true
    })
  },
  {
    id: "CONTRADICTION",
    mutationTypes: ["CONTRADICTION_INJECTION", "SOURCE_AUTHORITY"],
    label: "a second entry contradicts the decisive one and neither is plainly authoritative",
    apply: (base, ctx) => {
      const decisive = decisiveLine(base.lines, base.decisiveRef);
      return {
        lines: [
          ...base.lines,
          { ref: "OP-X1", section: "Conflicting entry", text: `Later entry by ${ctx.staff.label} (${ctx.staff.role}), recorded ${ctx.encounterDate}: states the opposite of the entry at ${base.decisiveRef} — "${base.contradiction}". No amendment, addendum or reason for the change is attached, and neither entry is signed as the correction of the other.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: true },
          ...noise(ctx, 1)
        ],
        prompt: `${base.ask} Two entries in this record disagree, and nothing in it says which one supersedes the other.`,
        gold: `Do not reconcile the conflict silently and do not prefer the later entry merely because it is later. Quote both entries (${base.decisiveRef} and OP-X1), state that neither is marked as an amendment of the other, name ${ctx.provider.label} as the person authorised to resolve which stands, and hold the dependent action until it is resolved. Record the conflict so the next reader sees it too.`,
        acceptance: [
          { requirement: `Quotes both conflicting entries rather than summarising the record as inconsistent.`, evidenceRef: base.decisiveRef },
          { requirement: `States explicitly that neither entry is marked as superseding the other.` },
          { requirement: `Routes the resolution to ${ctx.provider.label} instead of choosing between the entries.` },
          { requirement: `Leaves a durable record of the conflict for the next reader.` }
        ],
        correct: { text: `Surface both entries, state that neither is marked as an amendment, and route the resolution to ${ctx.provider.label}.`, why: `Correct: an unexplained contradiction is escalated with both sides named, never resolved by whoever noticed it.` },
        extraWrong: [
          { text: `Take the later entry, since the most recent documentation reflects the current state of the chart.`, why: `Recency is not authority. Without an amendment or a stated reason, a later entry may be the error rather than the correction.`, trapType: "TRAP_LATEST_NOTE_WINS" },
          { text: `Reconcile the two entries into one consistent summary so downstream readers are not confused.`, why: `That deletes the conflict instead of resolving it, and the reader who most needs to see it never will.`, trapType: "TRAP_SILENT_RECONCILIATION" }
        ],
        difficulty: atLeast(base.baseDifficulty, "HARD"),
        errorTargets: [...base.errorTargets, "KB-ERR-CONTRADICTION-BLINDNESS"],
        trapTypes: [...base.trapTypes, "TRAP_SILENT_RECONCILIATION", "TRAP_LATEST_NOTE_WINS"],
        auditTags: ["UNRESOLVED-CONTRADICTION"],
        replacesBaseAnswer: true
      };
    }
  },
  {
    id: "SAFETY_CLUE",
    mutationTypes: ["URGENCY", "TIME_PRESSURE", "DOWNSTREAM_CONSEQUENCE"],
    label: "a red flag appears alongside the administrative task",
    apply: (base, ctx) => ({
      lines: [
        ...base.lines,
        { ref: "OP-S1", section: "Reported now", text: `While the above was being handled, the patient volunteered: "${base.redFlag}" This was said in passing and is not in any clinical note.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: true },
        ...noise(ctx, 1)
      ],
      prompt: `${base.ask} Something the patient said while this was being handled has not been written down anywhere.`,
      gold: `Stop and route the volunteered statement to a clinician before finishing the administrative task. Repeat it back to confirm you heard it correctly, document it verbatim as reported by the patient, hand it to ${ctx.provider.label} or the covering clinician now rather than into a queue, and confirm a named clinician has accepted it. Do not evaluate or grade the symptom, and do not reassure the patient. The administrative task resumes only after the handover is acknowledged.`,
      acceptance: [
        { requirement: `Interrupts the administrative task rather than completing it first.` },
        { requirement: `Repeats the statement back and documents it verbatim as reported, without interpreting it.`, evidenceRef: "OP-S1" },
        { requirement: `Routes it to a named clinician now, not to an unattended queue, and confirms acceptance.` },
        { requirement: `Stays inside scope: offers no assessment, threshold or reassurance.` }
      ],
      correct: { text: `Hand the volunteered statement to a clinician now, confirm acceptance, then resume the administrative task.`, why: `Correct: recognition, documentation, routing and closing the loop come before routine completion.` },
      extraWrong: [
        { text: `Finish the administrative task first so the record is complete, then add a note about what the patient said.`, why: `Ordering the routine task ahead of a volunteered red flag is the failure this case exists to teach. The note may sit unread.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Reassure the patient that the symptom is common and unlikely to be serious, and offer the next routine appointment.`, why: `That is a clinical judgment, and it is outside a support role's authorised scope however reasonable it sounds.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ],
      difficulty: atLeast(base.baseDifficulty, "HARD"),
      errorTargets: [...base.errorTargets, "KB-ERR-INCORRECT-ESCALATION", "KB-ERR-SCOPE-VIOLATION"],
      trapTypes: [...base.trapTypes, "TRAP_COMPLETE_THE_TASK_ANYWAY", "TRAP_ANSWER_OUTSIDE_SCOPE"],
      safety: true,
      auditTags: ["SAFETY-PRECEDENCE"],
      replacesBaseAnswer: true
    })
  },
  {
    id: "WRONG_RECIPIENT",
    mutationTypes: ["DESTINATION", "PRIVACY_CONSTRAINT", "COMMUNICATION_CHANNEL"],
    label: "the destination on the request does not match the destination in the chart",
    apply: (base, ctx) => ({
      lines: [
        ...base.lines,
        { ref: "OP-R1", section: "Destination", text: `The request names a destination that does not match the record: the cover sheet reads "${ctx.practice} — Suite 300, fax SYN-555-0142", while the chart's authorised destination for this patient is "${ctx.practice} — Records, fax SYN-555-0198". Both are on practice letterhead.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: true },
        ...noise(ctx, 1)
      ],
      prompt: `${base.ask} The destination on the request and the destination in the chart are not the same.`,
      gold: `Do not transmit. Treat the mismatch as a wrong-recipient risk rather than a typo: read the recipient, channel and address back against the authorised entry in the chart, resolve which destination is authorised with ${ctx.provider.label} or the patient as policy requires, and send only the minimum necessary once the destination is confirmed. Letterhead is not authorisation.`,
      acceptance: [
        { requirement: `Holds transmission rather than sending to either destination.`, evidenceRef: "OP-R1" },
        { requirement: `Names the mismatch as a wrong-recipient and disclosure risk, not a clerical detail.` },
        { requirement: `Confirms the authorised destination against the chart before sending.` },
        { requirement: `Limits what is sent to the minimum necessary for the stated purpose.` }
      ],
      correct: { text: `Hold the transmission, confirm the authorised destination against the chart, then send only the minimum necessary.`, why: `Correct: an unconfirmed destination is a disclosure risk, and a disclosure cannot be recalled.` },
      extraWrong: [
        { text: `Send to the destination on the cover sheet, since the requester knows where the material should go.`, why: `The requester's cover sheet is not the authorised destination, and material sent to the wrong recipient cannot be unsent.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" },
        { text: `Send to both destinations so the material certainly reaches the right one.`, why: `Sending twice doubles the disclosure and guarantees one of them is unauthorised.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" }
      ],
      difficulty: atLeast(base.baseDifficulty, "HARD"),
      errorTargets: [...base.errorTargets, "KB-ERR-WRONG-DESTINATION", "KB-ERR-PRIVACY-FAILURE"],
      trapTypes: [...base.trapTypes, "TRAP_HELPFUL_OVERDISCLOSURE"],
      privacy: true,
      auditTags: ["DESTINATION-UNCONFIRMED"],
      replacesBaseAnswer: true
    })
  },
  {
    id: "IDENTITY_NEAR_MATCH",
    mutationTypes: ["PATIENT_IDENTITY", "ENCOUNTER_CONTEXT"],
    label: "two records match on name and differ on identifier",
    apply: (base, ctx) => ({
      lines: [
        { ref: "OP-I1", section: "Identity", text: `Search on the name returns two active records: ${ctx.patient.label}, MRN ${ctx.patient.mrn}, DOB ${ctx.patient.dob}; and ${ctx.nearMatch.label}, MRN ${ctx.nearMatch.mrn}, DOB ${ctx.nearMatch.dob}. Both are established at ${ctx.practice}.`, decisive: true },
        { ref: "OP-I2", section: "Identity", text: `The request itself carries the name only. No MRN, no date of birth, and no encounter reference.`, decisive: true },
        ...base.lines,
        ...noise(ctx, 1)
      ],
      prompt: `${base.ask} The name on the request matches two different patients.`,
      gold: `Do not proceed on the name. Confirm two independent identifiers — MRN and date of birth — against the request before anything attaches to a patient, and obtain them from the requester or the patient rather than choosing the nearer match. If two identifiers cannot be confirmed, hold the task and say why. Anything filed under the wrong record is a wrong-patient event even if the content is correct.`,
      acceptance: [
        { requirement: `Refuses to act on a name alone.`, evidenceRef: "OP-I2" },
        { requirement: `Requires two independent identifiers and names which two.` },
        { requirement: `Obtains the identifiers rather than selecting the closer-looking record.`, evidenceRef: "OP-I1" },
        { requirement: `Holds the task if two identifiers cannot be confirmed.` }
      ],
      correct: { text: `Hold the task and confirm MRN and date of birth against the request before anything attaches to a patient.`, why: `Correct: two independent identifiers precede any action, and a near match is not a match.` },
      extraWrong: [
        { text: `Use the record whose demographics are the closest fit to the request.`, why: `Closeness is exactly what produces wrong-patient events. A near match is the hazard, not the resolution.`, trapType: "TRAP_NEAREST_NAME_MATCH" },
        { text: `Use the more recently active record, since that is the one the request most likely concerns.`, why: `Recent activity is not identification, and a wrong-patient filing is a hard failure however likely the guess was.`, trapType: "TRAP_LATEST_NOTE_WINS" }
      ],
      difficulty: atLeast(base.baseDifficulty, "HARD"),
      errorTargets: [...base.errorTargets, "KB-ERR-WRONG-PATIENT"],
      trapTypes: [...base.trapTypes, "TRAP_NEAREST_NAME_MATCH", "TRAP_LATEST_NOTE_WINS"],
      privacy: true,
      auditTags: ["IDENTITY-UNRESOLVED"],
      replacesBaseAnswer: true
    })
  },
  {
    id: "OWNERSHIP_AMBIGUOUS",
    mutationTypes: ["OWNERSHIP_STATE", "HANDOFF_STATE"],
    label: "two people each recorded that the other would take it",
    apply: (base, ctx) => ({
      lines: [
        ...base.lines,
        { ref: "OP-O1", section: "Handoff", text: `${ctx.staff.label} (${ctx.staff.role}) noted at end of shift: "left for the incoming coordinator to action."`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: true },
        { ref: "OP-O2", section: "Handoff", text: `The incoming coordinator noted the next morning: "understood ${ctx.staff.label} was completing this before leaving." No one has acted since, and the item is four days old.`, recordedOn: ctx.encounterDate, decisive: true }
      ],
      prompt: `${base.ask} Two handoff notes each assume the other person did it, and nobody has.`,
      gold: `Treat this as an open loop, not a completed handoff. Take ownership explicitly or name the person who will, state the action and the deadline, obtain that person's acknowledgement rather than assuming it, and record the acceptance so the next reader sees a named owner. A handoff is complete when someone accepts it, not when it is written down.`,
      acceptance: [
        { requirement: `Identifies that no one owns the item, citing both handoff notes.`, evidenceRef: "OP-O1" },
        { requirement: `Names a single owner and the action with a deadline.` },
        { requirement: `Obtains and records explicit acknowledgement instead of assuming receipt.`, evidenceRef: "OP-O2" },
        { requirement: `Accounts for the four days already lost in how the item is prioritised.` }
      ],
      correct: { text: `Name a single owner, get explicit acknowledgement, and record the acceptance with a deadline.`, why: `Correct: a handoff closes on acknowledgement by a named owner, not on a note being written.` },
      extraWrong: [
        { text: `Re-send the item to the shared queue so whoever picks it up next can action it.`, why: `A shared queue has no owner, which is the condition that produced the four-day gap.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Note in the chart that the handoff was documented by both parties and move on.`, why: `Both notes exist and the work is still undone. Documentation of a handoff is not completion of one.`, trapType: "TRAP_CARRY_FORWARD_UNATTRIBUTED" }
      ],
      difficulty: atLeast(base.baseDifficulty, "HARD"),
      errorTargets: [...base.errorTargets, "KB-ERR-OPEN-LOOP"],
      trapTypes: [...base.trapTypes, "TRAP_SEND_AND_ASSUME"],
      auditTags: ["OWNERSHIP-UNRESOLVED"],
      replacesBaseAnswer: true
    })
  },
  {
    id: "STALE_PREREQUISITE",
    mutationTypes: ["MISSING_PREREQUISITE", "AUTHORIZATION_STATE", "TIMING"],
    label: "a prerequisite the task depends on expired before the scheduled date",
    apply: (base, ctx) => ({
      lines: [
        ...base.lines,
        { ref: "OP-P1", section: "Prerequisite", text: `${base.prerequisite} is recorded as valid through ${ctx.expiryDate}. The action this task sets up is scheduled for ${ctx.scheduledDate}, which is after that date. Nothing in the record flags the gap, and the scheduling screen shows the item as ready.`, recordedOn: ctx.encounterDate, decisive: true },
        ...noise(ctx, 2)
      ],
      prompt: `${base.ask} The system shows this as ready to proceed.`,
      gold: `Do not rely on the ready indicator. Compare the prerequisite's validity window against the scheduled date, state that ${base.prerequisite} expires on ${ctx.expiryDate} and the action falls on ${ctx.scheduledDate}, and resolve the prerequisite before the action proceeds. Tell the patient what is outstanding rather than letting them arrive to a cancellation, and record who is renewing it and by when.`,
      acceptance: [
        { requirement: `Compares the prerequisite window against the scheduled date rather than trusting the ready state.`, evidenceRef: "OP-P1" },
        { requirement: `States both dates explicitly.` },
        { requirement: `Resolves or escalates the prerequisite before the action, naming who renews it.` },
        { requirement: `Informs the patient of the outstanding item before the scheduled date.` }
      ],
      correct: { text: `Hold the action, state that the prerequisite expires before the scheduled date, and get it renewed first.`, why: `Correct: a ready indicator is not a check that the prerequisite still covers the date.` },
      extraWrong: [
        { text: `Proceed, since the system shows the item as ready and the prerequisite was valid when it was obtained.`, why: `It was valid when obtained and is not valid on the date that matters. A ready flag is a display, not a date comparison.`, trapType: "TRAP_STALE_AUTHORITY" },
        { text: `Proceed and renew the prerequisite retroactively afterwards if anyone asks.`, why: `Retroactive cover is not cover, and it puts the patient at the front of a cancellation.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ],
      difficulty: atLeast(base.baseDifficulty, "VERY_HARD"),
      errorTargets: [...base.errorTargets, "KB-ERR-INCORRECT-PRIORITIZATION", "KB-ERR-CODING-VERSION-MISMATCH"],
      trapTypes: [...base.trapTypes, "TRAP_STALE_AUTHORITY"],
      auditTags: ["PREREQUISITE-EXPIRED"],
      replacesBaseAnswer: true
    })
  },
  {
    id: "PROVENANCE_STRIPPED",
    mutationTypes: ["SOURCE_AUTHORITY", "DOCUMENTATION_STATE"],
    label: "the deciding fact is present but nobody is recorded as having said it",
    apply: (base, ctx) => {
      const decisive = decisiveLine(base.lines, base.decisiveRef);
      return {
        lines: [
          ...withoutDecisive(base.lines, base.decisiveRef),
          { ref: base.decisiveRef, section: "Carried forward", text: `${decisive.text} — carried forward from an earlier note. No author, no date and no originating record are attached, and it has been copied into three later notes in the same form.`, decisive: true },
          ...noise(ctx, 2)
        ],
        prompt: `${base.ask} The fact you need is in the record three times and attributed nowhere.`,
        gold: `Do not treat repetition as corroboration. Trace the fact to its originating note and author before relying on it, state that it is currently unattributed, and either reattach its origin or mark it as unverified in anything you produce. Three copies of one unattributed claim are one unattributed claim.`,
        acceptance: [
          { requirement: `States that the fact is unattributed rather than treating it as established.`, evidenceRef: base.decisiveRef },
          { requirement: `Recognises that repetition across notes is not independent corroboration.` },
          { requirement: `Traces it to an origin, or carries it forward explicitly marked as unverified.` }
        ],
        correct: { text: `Trace the fact to its originating author and note before relying on it, and mark it unverified until then.`, why: `Correct: provenance is what makes a carried-forward fact usable, and repetition is not provenance.` },
        extraWrong: [
          { text: `Rely on it: it appears consistently in three separate notes, which is stronger than a single entry.`, why: `The three notes are copies of each other, not three observations. Consistency between copies says nothing.`, trapType: "TRAP_CARRY_FORWARD_UNATTRIBUTED" }
        ],
        difficulty: atLeast(base.baseDifficulty, "HARD"),
        errorTargets: [...base.errorTargets, "KB-ERR-PROVENANCE-LOSS", "KB-ERR-UNSUPPORTED-INFERENCE"],
        trapTypes: [...base.trapTypes, "TRAP_CARRY_FORWARD_UNATTRIBUTED"],
        auditTags: ["PROVENANCE-MISSING"],
        replacesBaseAnswer: true
      };
    }
  },
  {
    id: "MULTI_STAGE",
    mutationTypes: ["EVIDENCE_PLACEMENT", "OWNERSHIP_STATE", "DOWNSTREAM_CONSEQUENCE", "TIME_PRESSURE", "HISTORY"],
    label: "a multi-stage encounter where the deciding clue arrives after ownership has moved",
    apply: (base, ctx) => ({
      lines: [
        { ref: "OP-T1", section: "Stage 1", text: `${ctx.encounterDate}, ${ctx.channel}: the task opens as described — ${base.ask} ${ctx.staff.label} begins it and records the routine details.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
        ...noise(ctx, 2),
        { ref: "OP-T2", section: "Stage 2", text: `Later the same day, ownership moves to the incoming coordinator at shift change. The handoff note carries the task but not the reason it was opened.`, recordedOn: ctx.encounterDate, decisive: false },
        { ref: base.decisiveRef, section: "Stage 3", text: `Two days later, a returned message adds the fact that changes the answer: ${decisiveLine(base.lines, base.decisiveRef).text} It arrives in the original opener's inbox, who is now off rota for the week.`, recordedOn: ctx.scheduledDate, decisive: true },
        { ref: "OP-T4", section: "Stage 4", text: `${base.consequence} The patient has meanwhile been told the item is in hand.`, recordedOn: ctx.scheduledDate, decisive: true }
      ],
      prompt: `${base.ask} Work the encounter as it actually ran: the fact that settles it arrived two days late, in the inbox of someone who had already handed the task over, and the patient has been told it is in hand.`,
      gold: `Reconstruct the encounter before acting. Establish in order what was known at each stage, who owned the task at each stage, and when the deciding fact arrived; state that it landed with someone no longer holding the task and was therefore never applied. Then correct the current position: apply the late fact, name the present owner, close the loop with the patient whose expectation is now wrong, and record the sequence so the gap is auditable. Do not present the outcome as though the information had been available from the start.`,
      acceptance: [
        { requirement: `Separates what was known at each stage from what is known now.`, evidenceRef: "OP-T1" },
        { requirement: `Identifies that the deciding fact arrived after ownership moved, and to the wrong inbox.`, evidenceRef: base.decisiveRef },
        { requirement: `Applies the late fact and names the current owner.` },
        { requirement: `Closes the loop with the patient, whose expectation no longer matches the position.`, evidenceRef: "OP-T4" },
        { requirement: `Leaves an auditable sequence rather than a corrected end state with no history.` }
      ],
      correct: { text: `Reconstruct the stages, apply the late fact, name the current owner, and correct the patient's expectation.`, why: `Correct: a late fact delivered to a former owner is a routing failure, and the audit trail has to show it.` },
      extraWrong: [
        { text: `Apply the new fact and update the record to the correct end state, without reciting the intermediate stages.`, why: `The end state is right and the history is gone. Audit reconstruction is the point: the routing failure becomes invisible and repeats.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Return the item to the original opener's inbox, since the deciding message went to them.`, why: `They are off rota for the week. Routing to an unattended inbox is what already delayed this by two days.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ],
      difficulty: "REALISTIC_PREMIUM",
      errorTargets: [...base.errorTargets, "KB-ERR-OPEN-LOOP", "KB-ERR-PROVENANCE-LOSS", "KB-ERR-INCORRECT-PRIORITIZATION"],
      trapTypes: [...base.trapTypes, "TRAP_SILENT_RECONCILIATION", "TRAP_SEND_AND_ASSUME"],
      auditTags: ["MULTI-STAGE", "DELAYED-CLUE", "OWNERSHIP-TRANSITION", "AUDIT-RECONSTRUCTION"],
      premium: true,
      replacesBaseAnswer: true
    })
  }
];
