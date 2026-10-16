// Template families for Knowledgebase batch KB-002 — the MODERATE-based half.
//
// These families carry the band the charter describes as two to three logical
// steps over interacting facts, with one element missing or in tension and a
// prioritisation to make. They are built with the three band-preserving operators
// only — BASE, LATE_CLUE, BURIED_CLUE — so each family yields three MODERATE
// records and adds nothing to the HARD mass that KB-001 already over-supplies
// (GAP_ANALYSIS.md section 3.1).
//
// CLUE_REMOVED is deliberately not used here: it raises the band, and a MODERATE
// family under it would land back in HARD. The EASY families in kb-templates-d.mjs
// carry it instead, which is where its one-band rise is wanted.
//
// Every family is SELF_CONTAINED, for the same reason as in kb-templates-d.mjs:
// KB-D07 coding and authority-bearing KB-D10 privacy expansion are blocked on
// source verification and are not attempted here. Policies appear only as stated
// givens of a synthetic scenario.

const SELF = "SELF_CONTAINED";

/** Band-preserving operators only. See the file header. */
const MODERATE_OPS = ["BASE", "LATE_CLUE", "BURIED_CLUE"];

export const TEMPLATES_E = [
  {
    templateId: "KB-VART-KB002-000019",
    operatorIds: MODERATE_OPS,
    taskType: "CONTRADICTION_DETECTION",
    recordType: "QUESTION",
    modules: ["M14", "M15"],
    competencies: ["KB-D12"],
    evidenceBasis: SELF,
    packetKind: "CHART_EXCERPT",
    domain: "Contradiction detection",
    scenarioType: "TWO_ENTRIES_DISAGREE",
    baseDifficulty: "MODERATE",
    ownerRole: "quality reviewer",
    errorTargets: ["KB-ERR-CONTRADICTION-BLINDNESS"],
    trapTypes: ["TRAP_LATEST_NOTE_WINS", "TRAP_SILENT_RECONCILIATION"],
    decisiveRef: "K3",
    secondaryRef: "K1",
    ask: (ctx) => `Two entries in ${ctx.patient.label}'s chart (MRN ${ctx.patient.mrn}) disagree. What is the defensible response?`,
    lines: (ctx) => [
      { ref: "K1", section: "Allergies", text: `Allergy list records a penicillin allergy with the reaction noted as rash, entered ${ctx.encounterDate}.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "K2", section: "Encounter note", text: `The ${ctx.scheduledDate} note's history states the patient reports no known drug allergies.`, recordedBy: ctx.provider.label, recordedOn: ctx.scheduledDate, decisive: false },
      { ref: "K3", section: "Review rule", text: `the rule stated for this scenario is that a contradiction between a structured list and narrative text is surfaced to the clinician who can resolve it, and that neither recency nor the structured field wins by default`, decisive: true },
      { ref: "K4", section: "Medications", text: `No antibiotic is currently prescribed and none is pending.`, decisive: false }
    ],
    gold: (ctx) => `Surface the contradiction rather than resolving it. State both entries precisely — a penicillin allergy with rash on the structured list, no known drug allergies in the later narrative — and that the stated rule gives neither precedence. Refer it to ${ctx.provider.label} for resolution, record that it is open, and note that no antibiotic is prescribed or pending so nothing is immediately at risk while it is resolved. Do not delete either entry, and do not let the later note overwrite the list.`,
    acceptance: (ctx) => [
      { requirement: `States both entries precisely and that neither takes precedence under the stated rule.`, evidenceRef: "K3" },
      { requirement: `Refers the contradiction to the clinician and records it as open.` },
      { requirement: `Notes that no antibiotic is prescribed or pending, bounding the immediate risk without dismissing the defect.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Surface both entries to ${ctx.provider.label} unresolved, record the contradiction as open, and note nothing is currently at risk.`, why: `Correct: the stated rule reserves resolution to the clinician, and the record is left showing the conflict.` }),
      wrong: (ctx) => [
        { text: `Update the allergy list to no known allergies, since the later note is the more recent account.`, why: `Recency is explicitly not decisive here, and clearing an allergy on a narrative line is the higher-consequence direction.`, trapType: "TRAP_LATEST_NOTE_WINS" },
        { text: `Correct the note to match the allergy list, since structured fields are the authoritative record.`, why: `The stated rule gives the structured field no default authority either, and editing a clinician's narrative is not a clerical correction.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Leave both as they are: no antibiotic is prescribed, so the disagreement has no consequence.`, why: `Nothing pending today bounds the risk; it does not close a contradiction that will be read later.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" }
      ]
    },
    missingFact: "which of the two allergy accounts the clinician considers current",
    contradiction: "a third entry records the penicillin reaction as anaphylaxis rather than rash",
    redFlag: "Last time I had an antibiotic my throat swelled and I couldn't breathe properly.",
    prerequisite: "The clinician's resolution of the allergy record",
    consequence: "An antibiotic was later prescribed from the cleared list and the reaction recurred."
  },
  {
    templateId: "KB-VART-KB002-000020",
    operatorIds: MODERATE_OPS,
    taskType: "INFORMATION_GAP",
    recordType: "WORKFLOW",
    modules: ["M06"],
    competencies: ["KB-D06", "KB-D04"],
    evidenceBasis: SELF,
    packetKind: "REFERRAL_PACKET",
    domain: "Referral completeness",
    scenarioType: "GAP_WITH_COMPETING_PRESSURE",
    baseDifficulty: "MODERATE",
    ownerRole: "referral coordinator",
    errorTargets: ["KB-ERR-PREMATURE-CLOSURE", "KB-ERR-OMISSION"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "W3",
    secondaryRef: "W1",
    ask: (ctx) => `${ctx.staff.label} must decide what to do with a referral for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) today. What is missing, and what follows from that?`,
    lines: (ctx) => [
      { ref: "W1", section: "Packet", text: `Referral reason, the ${ctx.encounterDate} note and the medication list are attached and current.`, decisive: false },
      { ref: "W2", section: "Receiving office", text: `The receiving office holds one slot this week and has asked for the packet by end of day to hold it.`, decisive: false },
      { ref: "W3", section: "Packet", text: `the note's plan depends on a specialist opinion the packet does not contain, and the receiving office's stated intake rule for this scenario rejects a packet whose referral reason cites a document that is absent`, decisive: true },
      { ref: "W4", section: "Chart", text: `${ctx.provider.label} is in clinic today and can be reached.`, decisive: false }
    ],
    gold: (ctx) => `Name the gap — the specialist opinion the referral reason depends on is not in the packet — and recognise that the deadline does not change the intake rule: a packet sent incomplete will be rejected, which loses the slot rather than securing it. Ask ${ctx.provider.label} for the missing document today, while the slot is still open, and tell the receiving office the packet is coming with a named outstanding item. Do not send the packet incomplete to meet the deadline, and do not let the slot lapse without telling anyone.`,
    acceptance: (ctx) => [
      { requirement: `Names the missing specialist opinion and the intake rule that makes its absence fatal.`, evidenceRef: "W3" },
      { requirement: `Reasons that sending incomplete loses the slot rather than securing it.` },
      { requirement: `Acts on both fronts today: requests the document and tells the receiving office where things stand.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Request the missing opinion from ${ctx.provider.label} today and tell the receiving office the packet follows with that item named.`, why: `Correct: it treats the deadline as real without pretending the intake rule is negotiable.` }),
      wrong: (ctx) => [
        { text: `Send the packet now to hold the slot and forward the specialist opinion when it arrives.`, why: `The stated intake rule rejects exactly this packet, so the slot is lost anyway and a day is wasted.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Hold the packet until the opinion arrives and re-request a slot when it is complete.`, why: `It gives up a slot that is still open today without attempting the one action that could keep it.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `Send the packet with the referral reason rewritten so it no longer cites the absent document.`, why: `That edits the clinical reason for the referral to defeat an intake check. The dependency is real.`, trapType: "TRAP_SILENT_RECONCILIATION" }
      ]
    },
    missingFact: "the specialist opinion the referral reason depends on",
    contradiction: "the packet index lists the specialist opinion as attached",
    redFlag: "The swelling has spread up the leg since that appointment and it's hot to touch.",
    prerequisite: "The specialist opinion cited in the referral reason",
    consequence: "The packet was sent incomplete, rejected at intake, and the slot went to another patient."
  },
  {
    templateId: "KB-VART-KB002-000021",
    operatorIds: MODERATE_OPS,
    taskType: "WORKFLOW_DECISION",
    recordType: "WORKFLOW",
    modules: ["M01", "M13"],
    competencies: ["KB-D02", "KB-D11"],
    evidenceBasis: SELF,
    packetKind: "INBOX_QUEUE",
    domain: "Prioritisation under competing demands",
    scenarioType: "COMPETING_QUEUE_PRIORITIES",
    baseDifficulty: "MODERATE",
    ownerRole: "results coordinator",
    errorTargets: ["KB-ERR-INCORRECT-PRIORITIZATION", "KB-ERR-OPEN-LOOP"],
    trapTypes: ["TRAP_QUEUE_ORDER"],
    decisiveRef: "J3",
    secondaryRef: "J1",
    ask: (ctx) => `${ctx.staff.label} has four items and time for two before the clinic closes. Which two, and why?`,
    lines: (ctx) => [
      { ref: "J1", section: "Queue", text: `Item 1: a card update. Item 2: a result awaiting routing to ${ctx.provider.label}. Item 3: a callback promised to ${ctx.patient.label} today. Item 4: filing last week's correspondence.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "J2", section: "Queue detail", text: `The result in item 2 is marked by the laboratory as requiring clinician review the same day.`, decisive: false },
      { ref: "J3", section: "Priority rule", text: `the stated rule for this scenario orders work by consequence of delay rather than by arrival, and an item with a named external commitment outranks one with none`, decisive: true },
      { ref: "J4", section: "Staffing", text: `${ctx.provider.label} leaves in an hour; the incoming coordinator can take unfinished items with a named handoff.`, decisive: false }
    ],
    gold: (ctx) => `Do the same-day result and the promised callback. The result carries the largest consequence of delay and a clinician who leaves in an hour, so it goes first; the callback is a commitment made to a named person for today. Then hand the card update and the filing to the incoming coordinator by name rather than leaving them in the queue, because neither has a same-day consequence but both still need an owner. Do not work the queue in arrival order, and do not leave the unfinished items unassigned.`,
    acceptance: (ctx) => [
      { requirement: `Selects the same-day result and the promised callback, reasoning from consequence of delay.`, evidenceRef: "J3" },
      { requirement: `Puts the result first because the reviewing clinician leaves within the hour.` },
      { requirement: `Hands the two deferred items to a named person rather than leaving them in the queue.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `The same-day result first, then the promised callback; hand the card update and filing to the incoming coordinator by name.`, why: `Correct: it orders by consequence, uses the clinician's remaining hour, and leaves no item without an owner.` }),
      wrong: (ctx) => [
        { text: `Items 1 and 2 in arrival order, leaving the callback and filing for tomorrow.`, why: `Arrival order is what the stated rule replaces, and it drops a commitment made for today.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `The result and the card update, since both can be finished quickly and cleared.`, why: `Speed is not consequence, and it abandons a promise made to a named patient.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `The result and the callback, leaving the other two in the shared queue overnight.`, why: `The selection is right and the handoff is missing: an item in a shared queue has no owner.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ]
    },
    missingFact: "which of the four items carries a same-day consequence",
    contradiction: "the laboratory marking and the clinic's own triage list disagree on the result's urgency",
    redFlag: "When you ring back — I've started feeling faint when I stand.",
    prerequisite: "The reviewing clinician's availability before they leave",
    consequence: "The result waited overnight and the clinician reviewed it a day late."
  },

  {
    templateId: "KB-VART-KB002-000022",
    operatorIds: MODERATE_OPS,
    taskType: "AUDIT_RECONSTRUCTION",
    recordType: "QUESTION",
    modules: ["M15"],
    competencies: ["KB-D12"],
    evidenceBasis: SELF,
    packetKind: "AUDIT_TRAIL",
    domain: "Audit reconstruction",
    scenarioType: "PARTIAL_TRAIL",
    baseDifficulty: "MODERATE",
    ownerRole: "quality reviewer",
    errorTargets: ["KB-ERR-PROVENANCE-LOSS", "KB-ERR-UNSUPPORTED-INFERENCE"],
    trapTypes: ["TRAP_CARRY_FORWARD_UNATTRIBUTED"],
    decisiveRef: "U3",
    secondaryRef: "U1",
    ask: (ctx) => `Reconstruct what the trail for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) does and does not establish about who changed the plan.`,
    lines: (ctx) => [
      { ref: "U1", section: "Trail", text: `Entry 1, ${ctx.encounterDate} 09:14, note created by ${ctx.staff.label}. Entry 2, ${ctx.encounterDate} 11:02, plan section modified, author recorded as "system".`, decisive: false },
      { ref: "U2", section: "Trail", text: `Entry 3, ${ctx.scheduledDate} 08:30, note signed by ${ctx.provider.label}.`, decisive: false },
      { ref: "U3", section: "System note", text: `the stated behaviour of this system for the scenario is that it records "system" as the author whenever a change arrives through the bulk-update interface, and it does not retain which user session initiated that update`, decisive: true },
      { ref: "U4", section: "Access log", text: `Three user sessions were open at 11:02: ${ctx.staff.label}, ${ctx.provider.label} and a third account not otherwise referenced.`, decisive: false }
    ],
    gold: (ctx) => `State what the trail establishes: the plan was modified at 11:02 on ${ctx.encounterDate} through the bulk-update interface, and the signature at entry 3 covers that modified text. State what it cannot establish: which person made the change, because the system does not retain the initiating session. Name the three concurrent sessions as concurrent only, not as candidates, and record the defect as an unresolvable provenance gap for the records owner. Do not narrow it to the likeliest of the three.`,
    acceptance: (ctx) => [
      { requirement: `Separates what the trail establishes from what it cannot, citing the system's stated behaviour.`, evidenceRef: "U3" },
      { requirement: `Notes that the later signature covers text of unknown authorship.` },
      { requirement: `Treats the three open sessions as concurrent rather than as candidate authors, and records the gap.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `The change is established, its author is not; record an unresolvable provenance gap and refer it, naming the sessions only as concurrent.`, why: `Correct: it reports the limit of the evidence instead of closing it by inference.` }),
      wrong: (ctx) => [
        { text: `Attribute the change to ${ctx.staff.label}, who created the note and had a session open at 11:02.`, why: `Two facts that co-occur are not authorship, and this writes a guess into an audit finding.`, trapType: "TRAP_CARRY_FORWARD_UNATTRIBUTED" },
        { text: `Attribute it to the third account, since the other two sessions belong to people with legitimate reasons to be in the chart.`, why: `Legitimacy of access is not evidence of who acted, and the reasoning would equally indict anyone unfamiliar.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Accept the trail as complete: the note is signed and the signature covers the plan as it stands.`, why: `A signature attests to content, not to the provenance of an intervening change.`, trapType: "TRAP_LATEST_NOTE_WINS" }
      ]
    },
    missingFact: "which user session initiated the 11:02 bulk update",
    contradiction: "the access log shows no session open at 11:02",
    redFlag: "The plan I was given at that visit is not the one written down now, and my breathing is worse.",
    prerequisite: "The records owner's investigation of the bulk-update interface",
    consequence: "The unattributed plan change was cited in a complaint and no author could be identified."
  },
  {
    templateId: "KB-VART-KB002-000023",
    operatorIds: MODERATE_OPS,
    taskType: "SCENARIO_CONTINUATION",
    recordType: "SCENARIO",
    modules: ["M03", "M19"],
    competencies: ["KB-D11", "KB-D02"],
    evidenceBasis: SELF,
    packetKind: "MESSAGE_THREAD",
    domain: "Scenario continuation",
    scenarioType: "PATIENT_CALLS_BACK",
    baseDifficulty: "MODERATE",
    ownerRole: "front-desk coordinator",
    errorTargets: ["KB-ERR-OPEN-LOOP", "KB-ERR-FAILURE-TO-PROBE"],
    trapTypes: ["TRAP_SEND_AND_ASSUME"],
    decisiveRef: "Y3",
    secondaryRef: "Y1",
    ask: (ctx) => `${ctx.patient.label} (MRN ${ctx.patient.mrn}) is calling back about an unresolved request. What does ${ctx.staff.label} do?`,
    lines: (ctx) => [
      { ref: "Y1", section: "Thread", text: `${ctx.encounterDate}: patient asked for a copy of a report; coordinator recorded the request and said it would be sent within three days.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "Y2", section: "Thread", text: `No further entry appears, and the patient says nothing has arrived.`, decisive: false },
      { ref: "Y3", section: "Thread", text: `the thread holds no record of the report being sent and no record of anyone being assigned to send it, so the commitment was made and never given an owner`, decisive: true },
      { ref: "Y4", section: "Chart", text: `The report exists and is releasable to the patient under the practice's stated rules for this scenario.`, decisive: false }
    ],
    gold: (ctx) => `Tell ${ctx.patient.label} plainly that the request was recorded, never assigned and never sent — do not imply it is in progress. Take ownership of it on this call, send the releasable report or start the release now, and give a specific commitment you can keep. Probe whether anything else was expected from the ${ctx.encounterDate} call, since a commitment that lost its owner may not have been the only one. Record the failure as well as the fix, so the gap is visible rather than quietly closed.`,
    acceptance: (ctx) => [
      { requirement: `Tells the patient accurately that the request was never assigned or sent.`, evidenceRef: "Y3" },
      { requirement: `Takes named ownership on this call and acts on the releasable report.` },
      { requirement: `Probes for other commitments from the same call.` },
      { requirement: `Records the failure alongside the correction.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Say it was never assigned or sent, take ownership now, act on the report, probe for other commitments, and record the failure.`, why: `Correct: it is accurate to the patient, closes the loop with a named owner, and leaves the defect visible.` }),
      wrong: (ctx) => [
        { text: `Apologise for the delay, say the report is in progress, and promise it within three days.`, why: `Nothing is in progress. It repeats an unowned commitment and misstates the position to the patient.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Send the report now and close the item without recording why it was late.`, why: `The fix is right and the defect disappears, so the same loss of ownership recurs unexamined.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Explain that the original request was not logged correctly and ask the patient to submit it again.`, why: `The request was logged; only the assignment was missing, and re-submitting moves the practice's failure onto the patient.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "who was assigned to send the report after the original request",
    contradiction: "the thread records the report as sent on the day of the request",
    redFlag: "I wanted the report because the pain has got worse and I'm seeing someone privately next week.",
    prerequisite: "An owner assigned to the original request",
    consequence: "The patient attended a private appointment without the report and the consultation was wasted."
  },
  {
    templateId: "KB-VART-KB002-000024",
    operatorIds: MODERATE_OPS,
    taskType: "REMEDIATION",
    recordType: "REMEDIATION",
    modules: ["M19", "M14"],
    competencies: ["KB-D08", "KB-D12"],
    evidenceBasis: SELF,
    packetKind: "RESULT_PACKET",
    domain: "Feedback and remediation",
    scenarioType: "TARGETED_REMEDIATION",
    baseDifficulty: "MODERATE",
    ownerRole: "instructor",
    errorTargets: ["KB-ERR-WRONG-DESTINATION"],
    trapTypes: ["TRAP_SEND_AND_ASSUME"],
    decisiveRef: "Z3",
    secondaryRef: "Z1",
    ask: (ctx) => `A learner routed a result for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) to the wrong destination. What remediation does this failure call for?`,
    lines: (ctx) => [
      { ref: "Z1", section: "Learner action", text: `The learner sent the result to the general clinical inbox and marked the item closed.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "Z2", section: "Correct action", text: `The stated workflow routes results to the ordering clinician, ${ctx.provider.label}, and closes the item only on confirmed receipt.`, decisive: false },
      { ref: "Z3", section: "Learner reasoning", text: `asked why, the learner said the general inbox is monitored and someone would pick it up, which locates the failure in what counts as a destination rather than in carelessness about the workflow`, decisive: true },
      { ref: "Z4", section: "History", text: `The same learner routed two earlier results correctly to named clinicians.`, decisive: false }
    ],
    gold: (ctx) => `Target the belief, not the behaviour. The learner can follow the workflow — two earlier results went to named clinicians — so the remediation addresses the idea that a monitored queue is an owner. Show that closure requires a confirmed recipient, have them re-work this item to ${ctx.provider.label} with confirmation, and retry on a variant where the ordering clinician is absent, so the answer is a named cover rather than a queue. Do not re-teach the routing workflow they already apply, and do not treat it as inattention.`,
    acceptance: (ctx) => [
      { requirement: `Locates the failure in the learner's stated reasoning rather than in workflow ignorance.`, evidenceRef: "Z3" },
      { requirement: `Cites the two correct earlier routings as evidence against a knowledge gap.` },
      { requirement: `Specifies a retry variant that tests the same belief under a harder condition.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Address the belief that a monitored queue is an owner, re-work this item with confirmation, and retry where the clinician is absent.`, why: `Correct: the remediation targets the reasoning the learner actually used.` }),
      wrong: (ctx) => [
        { text: `Re-teach the results routing workflow and re-test on the same scenario.`, why: `The learner already applies that workflow, so this targets a gap the evidence contradicts.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Record it as a lapse of attention and monitor the next five routings.`, why: `The learner gave a reason, which makes this a belief rather than a lapse. Monitoring detects recurrence without correcting it.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Have the learner re-send the result to ${ctx.provider.label} and close the remediation there.`, why: `Fixing the instance leaves the belief untouched, so it recurs whenever a named clinician is inconvenient.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ]
    },
    missingFact: "the reason the learner gave for choosing the general inbox",
    contradiction: "the learner's account and the audit log disagree on where the result was sent",
    redFlag: "I never heard about that result and my symptoms have got worse since.",
    prerequisite: "The learner's stated reasoning for the destination chosen",
    consequence: "The learner continued routing to shared queues whenever a named clinician was unavailable."
  },

  {
    templateId: "KB-VART-KB002-000025",
    operatorIds: MODERATE_OPS,
    taskType: "STRUCTURED_SHORT_ANSWER",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M11"],
    competencies: ["KB-D09", "KB-D05"],
    evidenceBasis: SELF,
    packetKind: "AUTHORIZATION_ARTIFACT",
    domain: "Authorisation evidence packets",
    scenarioType: "EVIDENCE_PACKET_ASSEMBLY",
    baseDifficulty: "MODERATE",
    ownerRole: "prior-authorisation specialist",
    payerSpecific: true,
    errorTargets: ["KB-ERR-OMISSION", "KB-ERR-UNSUPPORTED-INFERENCE"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "B3",
    secondaryRef: "B1",
    ask: (ctx) => `Assemble the authorisation evidence packet for ${ctx.patient.label} (MRN ${ctx.patient.mrn}). State what goes in, what does not, and what is missing.`,
    lines: (ctx) => [
      { ref: "B1", section: "Chart", text: `The ${ctx.encounterDate} note records the indication and the treatments already tried, with dates.`, recordedBy: ctx.provider.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "B2", section: "Chart", text: `An imaging report and a medication history are on file; a physiotherapy discharge summary is referenced in the note but not present.`, decisive: false },
      { ref: "B3", section: "Payer requirement", text: `the requirement stated for this scenario asks for the indication, documented prior treatments with dates, the relevant imaging, and evidence of a completed conservative-therapy course, and it accepts no substitute for the last of these`, decisive: true },
      { ref: "B4", section: "Note", text: `The note states physiotherapy was completed but does not give the dates or the outcome.`, decisive: false }
    ],
    gold: (ctx) => `Include the indication, the dated prior treatments and the imaging report. Exclude the medication history: the stated requirement does not ask for it, and padding a packet with unrequested records invites a broader review. Name the gap precisely — the physiotherapy discharge summary evidencing a completed conservative course is absent, and the note's bare statement that physiotherapy was completed is not the evidence the requirement asks for, since it carries neither dates nor outcome. Request the summary before submitting. Do not submit with the note standing in for it.`,
    acceptance: (ctx) => [
      { requirement: `Includes exactly the indication, dated prior treatments and imaging, and excludes the medication history as unrequested.`, evidenceRef: "B3" },
      { requirement: `Identifies the absent physiotherapy discharge summary as the missing evidence.` },
      { requirement: `States why the note's own sentence does not substitute for it.` },
      { requirement: `Holds submission until the summary is obtained.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Indication, dated prior treatments and imaging; exclude the medication history; obtain the physiotherapy summary before submitting.`, why: `Correct: it matches the requirement exactly and names the one piece of evidence that is genuinely absent.` }),
      wrong: (ctx) => [
        { text: `Submit with the note's statement that physiotherapy was completed standing as the conservative-therapy evidence.`, why: `The requirement accepts no substitute, and the note gives neither dates nor outcome.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Include everything on file, so the payer has the full picture and cannot ask for more.`, why: `Unrequested records widen the review and are not what the requirement asks for; completeness is defined by the requirement.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Submit the three available items now and send the physiotherapy summary as an addendum.`, why: `The requirement is not met at submission, and an incomplete submission is decided on what it contains.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "the physiotherapy discharge summary evidencing a completed conservative course",
    contradiction: "the note records physiotherapy as both completed and declined",
    redFlag: "I stopped physiotherapy because the leg started giving way underneath me.",
    prerequisite: "The physiotherapy discharge summary",
    consequence: "The authorisation was denied for want of conservative-therapy evidence and the appeal took six weeks."
  },
  {
    templateId: "KB-VART-KB002-000026",
    operatorIds: MODERATE_OPS,
    taskType: "MULTI_SELECT",
    recordType: "QUESTION",
    modules: ["M04", "M15"],
    competencies: ["KB-D05", "KB-D04"],
    evidenceBasis: SELF,
    packetKind: "SOAP_NOTE",
    domain: "Documentation support for an assessment",
    scenarioType: "WHICH_ENTRIES_SUPPORT",
    baseDifficulty: "MODERATE",
    ownerRole: "clinical documentation assistant",
    errorTargets: ["KB-ERR-UNSUPPORTED-INFERENCE"],
    trapTypes: ["TRAP_MOST_SPECIFIC_SOUNDING"],
    decisiveRef: "O3",
    secondaryRef: "O1",
    secondCorrect: (ctx) => ({ text: `The recorded absence of the finding the assessment would predict, since it bears on the assessment as much as a positive entry.`, why: `Correct: a documented negative is evidence, and omitting it distorts the picture.` }),
    ask: (ctx) => `Which entries in ${ctx.patient.label}'s ${ctx.encounterDate} note bear on the recorded assessment? Select all that apply.`,
    lines: (ctx) => [
      { ref: "O1", section: "Note", text: `Subjective: ankle pain after twisting it on a step, unable to bear weight for the first hour, now weight-bearing with a limp.`, recordedBy: ctx.provider.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "O2", section: "Note", text: `Objective: swelling over the lateral malleolus, tender there, no bony tenderness at the posterior malleolus, able to take four steps.`, decisive: false },
      { ref: "O3", section: "Assessment rule", text: `the rule stated for this scenario is that an entry bears on an assessment only if it makes it more or less likely, and that a documented absence counts as much as a documented presence`, decisive: true },
      { ref: "O4", section: "Note", text: `Administrative: insurance card image captured; interpreter not required.`, decisive: false }
    ],
    gold: (ctx) => `Select the entries that move the assessment: the mechanism and weight-bearing history, the localised swelling and tenderness, the four steps taken, and the explicitly recorded absence of posterior malleolar bony tenderness. Say why the recorded absence belongs — under the stated rule a documented negative bears on the assessment as much as a positive finding. Exclude the administrative entry: it identifies the encounter and bears on nothing clinical. Do not select every clinical-sounding line simply because it sits in the note.`,
    acceptance: (ctx) => [
      { requirement: `Selects the mechanism, the localised findings, the steps taken and the documented absence.`, evidenceRef: "O3" },
      { requirement: `Justifies the documented absence explicitly under the stated rule.` },
      { requirement: `Excludes the administrative entry and says why.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `The mechanism and weight-bearing history together with the localised swelling, tenderness and the steps taken.`, why: `Correct: each of these makes the assessment more or less likely.` }),
      wrong: (ctx) => [
        { text: `The administrative entry, since it establishes the encounter the assessment belongs to.`, why: `Anchoring an encounter is not bearing on an assessment. Under the stated rule it moves nothing.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Only the objective findings, since an assessment must rest on what was examined.`, why: `It discards the mechanism and the weight-bearing history, which are among the most informative entries here.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Every entry in the note, so the clinician can weigh them all.`, why: `That returns the task unperformed; selecting what bears on the assessment is the task.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "whether the absence of posterior malleolar tenderness was examined and recorded",
    contradiction: "the note records the posterior malleolus as both tender and not tender",
    redFlag: "The foot has gone cold and I can't feel my toes properly now.",
    prerequisite: "The clinician's recorded examination findings",
    consequence: "The documented negative was left out of the summary and the assessment read as unsupported."
  },
  {
    templateId: "KB-VART-KB002-000027",
    operatorIds: MODERATE_OPS,
    taskType: "DELAYED_CLUE_REASONING",
    recordType: "SCENARIO",
    modules: ["M03", "M18"],
    competencies: ["KB-D02", "KB-D04"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "Delayed-clue reasoning",
    scenarioType: "MEANING_CHANGES_LATE",
    baseDifficulty: "MODERATE",
    ownerRole: "triage nurse",
    errorTargets: ["KB-ERR-PREMATURE-CLOSURE", "KB-ERR-FAILURE-TO-PROBE"],
    trapTypes: ["TRAP_QUEUE_ORDER"],
    decisiveRef: "AA3",
    secondaryRef: "AA1",
    ask: (ctx) => `Work through this call with ${ctx.patient.label} (MRN ${ctx.patient.mrn}) in order. What does the last statement change?`,
    lines: (ctx) => [
      { ref: "AA1", section: "Call", text: `Patient rings asking for a repeat of an anti-inflammatory for a long-standing shoulder problem.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "AA2", section: "Call", text: `They confirm the shoulder is no worse than usual and they are not asking to be seen.`, decisive: false },
      { ref: "AA3", section: "Call", text: `at the end they mention in passing that they have been taking the same medication from a second source for a fortnight because the first prescription ran out, which turns a repeat request into a question about how much they have actually been taking`, decisive: true },
      { ref: "AA4", section: "Chart", text: `The medication list shows one active anti-inflammatory and no second supply.`, decisive: false }
    ],
    gold: (ctx) => `Re-read the request in light of the final statement. It is no longer a repeat: the patient may have been taking more than the record shows, from a source the chart does not know about. Probe for what the second supply is, its strength and how much has been taken, then route it to ${ctx.provider.label} as a medication reconciliation rather than issuing a repeat. Update nothing on the list from the patient's account alone. Do not process the repeat because the first two statements supported it, and do not dismiss the second supply as duplication of a known medication.`,
    acceptance: (ctx) => [
      { requirement: `Recognises that the final statement changes the nature of the request.`, evidenceRef: "AA3" },
      { requirement: `Probes for the second supply's identity, strength and quantity taken.` },
      { requirement: `Routes it as a reconciliation to the clinician rather than issuing a repeat.` },
      { requirement: `Does not amend the medication list from the patient's account alone.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Treat it as a reconciliation: probe the second supply, then route to ${ctx.provider.label} rather than issuing a repeat.`, why: `Correct: the late statement makes total intake unknown, which is a clinical question, not an administrative one.` }),
      wrong: (ctx) => [
        { text: `Process the repeat: the patient confirmed the shoulder is stable and is not asking to be seen.`, why: `Those statements were true before the last one, which is exactly why reading to the end matters.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `Add the second supply to the medication list from what the patient described, then process the repeat.`, why: `It writes an unverified account into the record and still issues a repeat on unknown total intake.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Note the second supply as a duplicate of the medication already listed and continue.`, why: `Calling it a duplicate assumes the strength and quantity, which is the unknown the call turns on.`, trapType: "TRAP_SILENT_RECONCILIATION" }
      ]
    },
    missingFact: "what the second supply is, at what strength, and how much has been taken",
    contradiction: "the patient describes the second supply as both the same medication and a different one",
    redFlag: "I've had black stools for a few days as well, since I started the second lot.",
    prerequisite: "A reconciliation of what the patient has actually been taking",
    consequence: "A repeat was issued on top of an unrecorded second supply."
  },
  {
    templateId: "KB-VART-KB002-000028",
    operatorIds: MODERATE_OPS,
    taskType: "MEDICATION_WORKFLOW_REVIEW",
    recordType: "WORKFLOW",
    modules: ["M09", "M14"],
    competencies: ["KB-D08", "KB-D03"],
    evidenceBasis: SELF,
    packetKind: "MEDICATION_LIST",
    domain: "Medication safety workflow",
    scenarioType: "ALLERGY_CONFLICT_ON_NEW_ORDER",
    baseDifficulty: "MODERATE",
    ownerRole: "pharmacy technician",
    safetyBaseline: true,
    errorTargets: ["KB-ERR-CONTRADICTION-BLINDNESS", "KB-ERR-INCORRECT-ESCALATION"],
    trapTypes: ["TRAP_SILENT_RECONCILIATION"],
    decisiveRef: "AB3",
    secondaryRef: "AB1",
    ask: (ctx) => `A new prescription for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) has arrived for processing. What must happen before it is dispensed?`,
    lines: (ctx) => [
      { ref: "AB1", section: "Order", text: `New prescription from ${ctx.provider.label}, dated ${ctx.encounterDate}, for an antibiotic in a class the patient's allergy entry names.`, decisive: false },
      { ref: "AB2", section: "Allergy list", text: `Allergy entry: reaction to this antibiotic class recorded as facial swelling and difficulty breathing.`, decisive: false },
      { ref: "AB3", section: "Workflow", text: `the stated workflow for this scenario stops dispensing when an order conflicts with a recorded allergy, and requires the conflict to be put to the prescriber before anything is supplied or the allergy entry is altered`, decisive: true },
      { ref: "AB4", section: "Order note", text: `The prescription carries no comment on the allergy.`, decisive: false }
    ],
    gold: (ctx) => `Stop. Do not dispense. Put the conflict to ${ctx.provider.label} directly, stating the ordered drug, the allergy entry and the recorded reaction, and get an explicit decision before anything is supplied. Do not assume the prescriber saw the allergy because it is on the list, and do not edit or downgrade the allergy entry to let the order through. Record that dispensing was held, what was communicated and to whom, and treat the recorded reaction as the reason this cannot wait in a queue.`,
    acceptance: (ctx) => [
      { requirement: `Holds dispensing and cites the workflow that requires the conflict to go to the prescriber first.`, evidenceRef: "AB3" },
      { requirement: `Communicates the drug, the allergy entry and the recorded reaction, and seeks an explicit decision.` },
      { requirement: `Does not alter the allergy entry, and records the hold and the communication.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold dispensing and put the conflict to ${ctx.provider.label} with the recorded reaction, seeking an explicit decision.`, why: `Correct: the workflow reserves this decision to the prescriber, and the recorded reaction makes it urgent.` }),
      wrong: (ctx) => [
        { text: `Dispense: the prescriber can see the allergy list and has evidently judged the medication appropriate.`, why: `Nothing shows the allergy was considered, and the order carries no comment. This is the assumption the workflow forbids.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Amend the allergy entry to an intolerance, which is consistent with the prescriber ordering the drug.`, why: `It edits a safety record to remove an obstacle, inferring the prescriber's reasoning from the order itself.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Flag the conflict in the pharmacy queue for review at the next batch check.`, why: `A queue is not the prescriber, and a recorded reaction of this kind does not wait for a batch.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ]
    },
    missingFact: "whether the prescriber considered the recorded allergy when writing the order",
    contradiction: "a second allergy entry records the same class as tolerated",
    redFlag: "Last time I took one of those my face swelled up and I could not breathe.",
    prerequisite: "The prescriber's explicit decision on the allergy conflict",
    consequence: "The antibiotic was dispensed and the patient had the reaction recorded on the allergy list."
  },
  {
    templateId: "KB-VART-KB002-000029",
    operatorIds: MODERATE_OPS,
    taskType: "RESULT_ROUTING",
    recordType: "WORKFLOW",
    modules: ["M10", "M13"],
    competencies: ["KB-D11", "KB-D08"],
    evidenceBasis: SELF,
    packetKind: "RESULT_PACKET",
    domain: "Result routing under absent ownership",
    scenarioType: "ORDERING_CLINICIAN_UNAVAILABLE",
    baseDifficulty: "MODERATE",
    ownerRole: "results coordinator",
    errorTargets: ["KB-ERR-WRONG-DESTINATION", "KB-ERR-OPEN-LOOP"],
    trapTypes: ["TRAP_SEND_AND_ASSUME"],
    decisiveRef: "AC3",
    secondaryRef: "AC1",
    ask: (ctx) => `A result for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) needs review today, and the ordering clinician is away. Where does it go?`,
    lines: (ctx) => [
      { ref: "AC1", section: "Result", text: `Result flagged by the laboratory for same-day clinician review, ordered by ${ctx.provider.label}.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "AC2", section: "Staffing", text: `${ctx.provider.label} is away until after ${ctx.scheduledDate}; a duty clinician is named on the rota for today.`, decisive: false },
      { ref: "AC3", section: "Workflow", text: `the stated workflow for this scenario routes a same-day result to the named duty clinician when the ordering clinician is unavailable, and requires the ordering clinician to be copied for continuity rather than skipped`, decisive: true },
      { ref: "AC4", section: "Queue", text: `The ordering clinician's own queue is not monitored while they are away.`, decisive: false }
    ],
    gold: (ctx) => `Route it to the named duty clinician for today's review, and copy ${ctx.provider.label} so the ordering clinician still sees it on return. Confirm the duty clinician has it rather than assuming, and record who holds it and when it was accepted. Say why the ordering clinician's own queue is the wrong destination: it is unmonitored, so a same-day result sent there is a same-day result nobody reads. Do not hold it until they return, and do not send it to a general inbox.`,
    acceptance: (ctx) => [
      { requirement: `Routes to the named duty clinician and copies the ordering clinician, per the stated workflow.`, evidenceRef: "AC3" },
      { requirement: `Explains that the ordering clinician's queue is unmonitored and therefore unsafe for a same-day item.` },
      { requirement: `Confirms acceptance and records who holds it.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Send it to today's named duty clinician, copy ${ctx.provider.label}, and confirm acceptance.`, why: `Correct: it meets the same-day requirement and preserves continuity for the ordering clinician.` }),
      wrong: (ctx) => [
        { text: `Send it to ${ctx.provider.label}'s queue, since they ordered it and own the result.`, why: `That queue is unmonitored while they are away, so a same-day result would sit unread.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Hold it until ${ctx.provider.label} returns after ${ctx.scheduledDate}, then route it as normal.`, why: `It discards the same-day requirement entirely in favour of preserving ownership.`, trapType: "TRAP_STALE_AUTHORITY" },
        { text: `Send it to the duty clinician only, leaving ${ctx.provider.label} to find it on return.`, why: `The review happens but continuity is broken, and the workflow requires the ordering clinician be copied.`, trapType: "TRAP_SILENT_RECONCILIATION" }
      ]
    },
    missingFact: "who is named as duty clinician on today's rota",
    contradiction: "the rota names two different duty clinicians for the same day",
    redFlag: "I've been getting worse since the test — short of breath just getting dressed.",
    prerequisite: "A named duty clinician on today's rota",
    consequence: "The result sat in an unmonitored queue for five days."
  },
  {
    templateId: "KB-VART-KB002-000030",
    operatorIds: MODERATE_OPS,
    taskType: "MCQ",
    recordType: "QUESTION",
    modules: ["M12"],
    competencies: ["KB-D10"],
    evidenceBasis: SELF,
    packetKind: "MESSAGE_THREAD",
    domain: "Disclosure scope",
    scenarioType: "SCOPE_OF_A_PERMITTED_DISCLOSURE",
    baseDifficulty: "MODERATE",
    ownerRole: "records clerk",
    privacyBaseline: true,
    errorTargets: ["KB-ERR-PRIVACY-FAILURE", "KB-ERR-OMISSION"],
    trapTypes: ["TRAP_HELPFUL_OVERDISCLOSURE"],
    decisiveRef: "AD3",
    secondaryRef: "AD1",
    ask: (ctx) => `An authorised request for ${ctx.patient.label}'s records (MRN ${ctx.patient.mrn}) has arrived. What is released?`,
    lines: (ctx) => [
      { ref: "AD1", section: "Request", text: `A valid authorisation, signed by the patient, requests the records relating to the ${ctx.encounterDate} knee injury for an insurance claim.`, decisive: false },
      { ref: "AD2", section: "Chart", text: `The chart holds the ${ctx.encounterDate} encounter, an unrelated mental-health episode from two years earlier, and a full problem list.`, decisive: false },
      { ref: "AD3", section: "Release rule", text: `the rule stated for this scenario releases only the records the authorisation identifies, and treats sending more than was asked for as a disclosure failure even when the authorisation is valid`, decisive: true },
      { ref: "AD4", section: "Request", text: `The authorisation names no date range beyond the ${ctx.encounterDate} injury.`, decisive: false }
    ],
    gold: (ctx) => `Release the ${ctx.encounterDate} knee-injury records only. Exclude the earlier mental-health episode and the full problem list: the authorisation identifies neither, and under the stated rule sending them is a disclosure failure even though the authorisation is valid. Record precisely what was released and what was withheld, so the scope of the disclosure is auditable. If the requester needs more, they obtain a further authorisation; do not broaden the release to save them a second request.`,
    acceptance: (ctx) => [
      { requirement: `Releases only the identified encounter records, citing the stated scope rule.`, evidenceRef: "AD3" },
      { requirement: `Withholds the unrelated episode and the full problem list.` },
      { requirement: `Records what was released and what was withheld.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Only the ${ctx.encounterDate} knee-injury records, with the release and the withholdings recorded.`, why: `Correct: a valid authorisation still bounds the disclosure to what it identifies.` }),
      wrong: (ctx) => [
        { text: `The knee-injury records plus the full problem list, so the insurer can see the clinical context.`, why: `The problem list is not identified by the authorisation, and context is not a ground for widening a disclosure.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" },
        { text: `The complete chart, since the patient signed a valid authorisation for their records.`, why: `Validity and scope are different questions. The authorisation names the knee injury.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" },
        { text: `Nothing, until the requester confirms a date range in writing.`, why: `The authorisation identifies the injury, which bounds the release. Refusing a proper request is its own failure.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "which records the authorisation identifies",
    contradiction: "the authorisation names the knee injury in one place and all records in another",
    redFlag: "The knee has locked completely and I can't straighten it since yesterday.",
    prerequisite: "An authorisation identifying the records sought",
    consequence: "An unrelated mental-health episode was disclosed to an insurer and the patient complained."
  }

];
