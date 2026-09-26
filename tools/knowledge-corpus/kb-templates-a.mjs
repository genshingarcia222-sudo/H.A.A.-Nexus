// Template families for Knowledgebase batch KB-001.
//
// A template is not a question. It is the reusable part of a family: the
// synthetic packet, the task, the decisive fact, the defensible behaviour and
// the trap that competes with it. The operators in kb-operators.mjs turn one
// template into a family of records whose correct answer moves with the
// evidence, which is what keeps the corpus from becoming a repetitive bank.
//
// Every template states its own evidenceBasis honestly:
//   SELF_CONTAINED    — the gold behaviour follows from the packet in the
//                       record. Nothing outside it is asserted.
//   EXTERNAL_AUTHORITY— the gold behaviour asserts something about the world.
//                       These carry citations and cannot rise above
//                       candidate_needs_source_verification here.
//
// Where a scenario states a payer requirement, a practice policy or a plan
// rule, it is a given of that synthetic scenario. It is never a claim about how
// any real payer or organisation behaves, and records that do it carry the
// audit tag SYNTHETIC-GIVEN-POLICY.

const SELF = "SELF_CONTAINED";
const EXT = "EXTERNAL_AUTHORITY";

export const TEMPLATES_A = [
  {
    templateId: "KB-VART-KB001-000001",
    taskType: "MCQ",
    recordType: "QUESTION",
    modules: ["M01", "M14"],
    competencies: ["KB-D02"],
    evidenceBasis: SELF,
    packetKind: "MESSAGE_THREAD",
    domain: "Nexus operating principles",
    scenarioType: "SCOPE_BOUNDARY",
    baseDifficulty: "EASY",
    ownerRole: "documentation support specialist",
    errorTargets: ["KB-ERR-SCOPE-VIOLATION"],
    trapTypes: ["TRAP_ANSWER_OUTSIDE_SCOPE"],
    decisiveRef: "A2",
    secondaryRef: "A1",
    ask: (ctx) => `${ctx.staff.label} is handling a portal message from ${ctx.patient.label} (MRN ${ctx.patient.mrn}). What is the defensible next action?`,
    lines: (ctx) => [
      { ref: "A1", section: "Message", text: `${ctx.patient.label} writes: "My results came through on the portal. Does the number mean my condition is getting worse? Should I change my dose before my ${ctx.scheduledDate} visit?"`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "A2", section: "Role", text: `The account handling this queue is a documentation support role. It has read access to the chart and no authority to interpret results, advise on dose, or answer clinical questions on a clinician's behalf.`, decisive: true },
      { ref: "A3", section: "Chart", text: `${ctx.provider.label} (${ctx.provider.role}) is the ordering clinician and is in clinic today.`, decisive: false }
    ],
    gold: (ctx) => `Answer only what the role is authorised to answer. Acknowledge the message, tell ${ctx.patient.label} the question needs ${ctx.provider.label}, route it to that clinician with the result attached, and give a realistic expectation of when they will hear back. Do not interpret the number, do not comment on whether the condition is worsening, and do not discuss the dose — not even to say the change is probably fine.`,
    acceptance: (ctx) => [
      { requirement: `Identifies that interpretation and dose advice sit outside the role.`, evidenceRef: "A2" },
      { requirement: `Routes the question to ${ctx.provider.label} with the result attached.` },
      { requirement: `Replies to the patient with an acknowledgement and a realistic expectation, without answering the clinical question.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Acknowledge the message, route the clinical question to ${ctx.provider.label} with the result attached, and tell the patient when to expect a reply.`, why: `Correct: the role may route and acknowledge; it may not interpret a result or advise on a dose.` }),
      wrong: (ctx) => [
        { text: `Explain what the number means in general terms, and tell the patient not to change the dose before the visit.`, why: `Both halves are clinical advice. "In general terms" does not move interpretation inside the role.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" },
        { text: `Reply that results cannot be discussed over the portal and close the message.`, why: `The channel is not the problem and closing it strands the patient's real question. Routing is the action, not refusal.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Forward the message to the general clinical inbox without a reply to the patient.`, why: `The patient is left with no acknowledgement and the loop is open. A general inbox names no owner.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ]
    },
    missingFact: "which clinician ordered the result and is therefore accountable for interpreting it",
    contradiction: "the role is authorised to answer routine result questions directly",
    redFlag: "I've had crushing chest pressure since last night and it's worse when I walk.",
    prerequisite: "The clinician's delegation of routine result replies",
    consequence: "The patient, having had no reply, changed the dose on their own and has now called back."
  },
  {
    templateId: "KB-VART-KB001-000002",
    taskType: "MULTI_SELECT",
    recordType: "QUESTION",
    modules: ["M15", "M14"],
    competencies: ["KB-D12"],
    evidenceBasis: SELF,
    packetKind: "AUDIT_TRAIL",
    domain: "Audit and QA",
    scenarioType: "AUDIT_COMPLETENESS",
    baseDifficulty: "MODERATE",
    ownerRole: "quality reviewer",
    errorTargets: ["KB-ERR-PROVENANCE-LOSS"],
    trapTypes: ["TRAP_CARRY_FORWARD_UNATTRIBUTED"],
    decisiveRef: "B2",
    secondaryRef: "B1",
    secondCorrect: (ctx) => ({ text: `Record the check that was performed and its outcome, so the next reader can see the review happened and what it found.`, why: `Correct: an unrecorded check is indistinguishable from no check.` }),
    ask: (ctx) => `A quality review of ${ctx.patient.label}'s ${ctx.encounterDate} encounter at ${ctx.practice} is under way. Which actions does the audit trail require?`,
    lines: (ctx) => [
      { ref: "B1", section: "Audit trail", text: `Entry 1, ${ctx.encounterDate}: note created by ${ctx.staff.label}. Entry 2, same day: note amended, amender not recorded. Entry 3, ${ctx.scheduledDate}: note signed by ${ctx.provider.label}.`, decisive: false },
      { ref: "B2", section: "Audit trail", text: `The amendment in entry 2 changed the assessment text. No author, no timestamp beyond the date, and no reason for the amendment are recorded against it.`, decisive: true },
      { ref: "B3", section: "Policy", text: `${ctx.practice}'s internal documentation policy, as stated for this scenario, requires every amendment to carry an author, a timestamp and a reason.`, decisive: false }
    ],
    gold: (ctx) => `Report the amendment as an auditability defect rather than a formatting issue. State that entry 2 changed clinical content with no author, timestamp or reason, that the signature in entry 3 therefore covers text whose provenance is unknown, and that the defect must be recorded and referred to ${ctx.provider.label} and the records owner. Do not repair the trail by inferring who made the change.`,
    acceptance: (ctx) => [
      { requirement: `Names the missing author, timestamp and reason on the amendment.`, evidenceRef: "B2" },
      { requirement: `Recognises that the later signature now covers content of unknown provenance.` },
      { requirement: `Records the defect and refers it, rather than inferring the amender.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Log the amendment as an auditability defect and refer it to ${ctx.provider.label} and the records owner.`, why: `Correct: a content change with no author breaks the trail, and only the owner can repair it.` }),
      wrong: (ctx) => [
        { text: `Attribute the amendment to ${ctx.staff.label}, who created the note and is the likeliest amender.`, why: `That is a guess written into an audit trail, which is worse than the gap it fills.`, trapType: "TRAP_CARRY_FORWARD_UNATTRIBUTED" },
        { text: `Accept the trail: the note is signed, and the signature covers everything in it.`, why: `A signature cannot vouch for provenance the record does not hold.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Remove the unattributed amendment so the trail is internally consistent.`, why: `Deleting the evidence of a defect is not resolving it, and it destroys the record of a clinical content change.`, trapType: "TRAP_SILENT_RECONCILIATION" }
      ]
    },
    missingFact: "who made the amendment in entry 2, when, and why",
    contradiction: "the amendment in entry 2 carries a full author and reason",
    redFlag: "I told someone about the chest tightness at that visit and I can't see it written anywhere.",
    prerequisite: "The records owner's sign-off on the amendment log",
    consequence: "The unattributed amendment has since been cited in a payer review of the encounter."
  },
  {
    templateId: "KB-VART-KB001-000003",
    taskType: "SHORT_ANSWER",
    recordType: "QUESTION",
    modules: ["M05", "M04"],
    competencies: ["KB-D02"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "Clinical terminology in context",
    scenarioType: "LAY_TO_CLINICAL",
    baseDifficulty: "EASY",
    ownerRole: "scribe",
    errorTargets: ["KB-ERR-UNSUPPORTED-INFERENCE"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "C2",
    secondaryRef: "C1",
    ask: (ctx) => `${ctx.patient.label} describes a symptom in their own words during a ${ctx.channel}. Write the Subjective line.`,
    lines: (ctx) => [
      { ref: "C1", section: "Transcript", text: `${ctx.patient.label}: "It's like my heart is doing a drum solo, on and off, mostly when I stand up fast. Started maybe three weeks ago."`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "C2", section: "Transcript", text: `The patient was not asked, and did not say, how long each episode lasts, whether anything else happens with it, or whether it has ever made them faint.`, decisive: true },
      { ref: "C3", section: "Chart", text: `No prior cardiac history is recorded for this patient.`, decisive: false }
    ],
    gold: (ctx) => `Record the patient's description in clinical language without adding what was not said. An acceptable line names the reported sensation, its intermittent pattern, its association with standing quickly, and the three-week onset — all attributed to the patient's report. Do not write a diagnosis, do not convert "drum solo" into a rate or rhythm term the patient did not describe, and note that duration, associated symptoms and syncope were not established.`,
    acceptance: (ctx) => [
      { requirement: `Renders the report in clinical language while keeping it attributed to the patient.`, evidenceRef: "C1" },
      { requirement: `Adds no rhythm, rate or diagnosis the patient did not describe.`, evidenceRef: "C2" },
      { requirement: `Records that duration, associated symptoms and syncope were not established.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Write the reported sensation, pattern, positional trigger and onset as the patient's report, and note what was not established.`, why: `Correct: the Subjective carries what the patient said, in clinical language, with the gaps visible.` }),
      wrong: (ctx) => [
        { text: `Write "patient reports intermittent palpitations with presyncope on standing".`, why: `Presyncope was never reported. One added word converts a gap into a documented symptom.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Write "patient reports episodes of tachycardia for three weeks".`, why: `Tachycardia is a measured finding, not a patient description, and nothing here measured a rate.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Quote the patient verbatim and add nothing further.`, why: `A verbatim quote alone leaves the note unusable and still hides that duration and syncope were never asked about.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "how long each episode lasts, and whether it has ever caused fainting",
    contradiction: "the patient described the episodes as lasting several minutes with near-fainting",
    redFlag: "Twice this week I nearly blacked out when it happened on the stairs.",
    prerequisite: "The clinician's review of the intake summary",
    consequence: "The note as written was carried into a cardiology referral as the reason for referral."
  },
  {
    templateId: "KB-VART-KB001-000004",
    taskType: "STRUCTURED_SHORT_ANSWER",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M04"],
    competencies: ["KB-D05"],
    evidenceBasis: SELF,
    packetKind: "SOAP_NOTE",
    domain: "SOAP and clinical documentation",
    scenarioType: "SECTION_DISCIPLINE",
    baseDifficulty: "MODERATE",
    ownerRole: "scribe",
    errorTargets: ["KB-ERR-DOCUMENTATION-CONTAMINATION"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "D2",
    secondaryRef: "D1",
    ask: (ctx) => `Re-segment the draft note for ${ctx.patient.label}'s ${ctx.encounterDate} visit with ${ctx.provider.label}. State which content belongs in which section and why.`,
    lines: (ctx) => [
      { ref: "D1", section: "Subjective (draft)", text: `"Sore right shoulder for two months, worse overhead. BP 138/86. Probably a rotator cuff problem. Will refer to physio."`, decisive: false },
      { ref: "D2", section: "Objective (draft)", text: `"Patient says it hurts most at night. Limited abduction to 90 degrees."`, decisive: true },
      { ref: "D3", section: "Plan (draft)", text: `"Tender over the greater tuberosity."`, decisive: false }
    ],
    gold: (ctx) => `Four sections, four kinds of content. Subjective keeps the reported soreness, its two-month course, the overhead aggravation and the night pain. Objective takes the blood pressure, the abduction limited to 90 degrees and the tenderness over the greater tuberosity. Assessment takes the suspected rotator cuff problem, stated as the clinician's impression rather than as a fact. Plan keeps the physiotherapy referral. Move the content; do not rewrite what it says, and do not promote the impression into a diagnosis while moving it.`,
    acceptance: (ctx) => [
      { requirement: `Moves the reported night pain out of Objective and into Subjective.`, evidenceRef: "D2" },
      { requirement: `Moves the measured findings — blood pressure, abduction, tenderness — into Objective.`, evidenceRef: "D3" },
      { requirement: `Places the suspected rotator cuff problem in Assessment as an impression, not a confirmed diagnosis.` },
      { requirement: `Leaves the referral in Plan and changes no clinical content while re-segmenting.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Re-segment all four sections, keeping the impression as an impression and changing no content.`, why: `Correct: section discipline moves content without upgrading or downgrading any of it.` }),
      wrong: (ctx) => [
        { text: `Move the misplaced items and restate "probably a rotator cuff problem" as the diagnosis, since that is what Assessment is for.`, why: `Assessment carries the impression as an impression. Promoting it invents a confirmed diagnosis nobody made.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Leave the note as drafted; the content is all present and a reader can follow it.`, why: `A reported symptom filed as a measured finding is contamination, and downstream readers treat it as objective.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Move the findings and delete the blood pressure, which is unrelated to the shoulder.`, why: `A recorded measurement is not yours to remove because it looks irrelevant to the presenting complaint.`, trapType: "TRAP_SILENT_RECONCILIATION" }
      ]
    },
    missingFact: "whether the night pain was reported by the patient or observed at the visit",
    contradiction: "the night pain was an examination finding, not a patient report",
    redFlag: "The shoulder pain wakes me and now my hand goes numb and cold with it.",
    prerequisite: "The clinician's attestation of the draft note",
    consequence: "The note was signed and released to the physiotherapy referral with the sections as drafted."
  },
  {
    templateId: "KB-VART-KB001-000005",
    taskType: "SEQUENCING",
    recordType: "WORKFLOW",
    modules: ["M03", "M02"],
    competencies: ["KB-D11", "KB-D01"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "Call handling",
    scenarioType: "INTAKE_ORDER",
    baseDifficulty: "MODERATE",
    ownerRole: "front-desk coordinator",
    errorTargets: ["KB-ERR-WRONG-PATIENT", "KB-ERR-FAILURE-TO-PROBE"],
    trapTypes: ["TRAP_NEAREST_NAME_MATCH"],
    decisiveRef: "E2",
    secondaryRef: "E1",
    steps: (ctx) => [
      `Confirm two independent identifiers for the patient the call concerns.`,
      `Establish who is calling and their relationship to the patient.`,
      `Establish the reason for the call in the caller's own words.`,
      `Screen for anything requiring clinical attention before administrative handling.`,
      `Determine what the caller needs and who owns it.`,
      `Read back the agreed action, owner and timeframe.`,
      `Document the call, the identifiers confirmed and the action, and route it to the named owner.`
    ],
    ask: (ctx) => `An inbound call about ${ctx.patient.label} arrives at ${ctx.practice}. Put the intake steps in the order that protects the patient.`,
    lines: (ctx) => [
      { ref: "E1", section: "Call", text: `Caller: "I'm ringing about ${ctx.patient.label}. I need the referral moved to a different clinic."`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "E2", section: "Call", text: `The caller has not been identified, their relationship to the patient is unknown, and no identifier for the patient has been confirmed. The coordinator's screen is already open on a referral record.`, decisive: true },
      { ref: "E3", section: "Chart", text: `Two patients at ${ctx.practice} share this name.`, decisive: false }
    ],
    gold: (ctx) => `Identity and caller authority come before the request, and screening comes before administrative handling. Confirm two independent identifiers for the patient, establish who is calling and on what basis, take the reason in the caller's words, screen for anything clinical, then determine the need and the owner, read back the action and timeframe, and document with the identifiers you confirmed. An open referral record on the screen is not the patient.`,
    acceptance: (ctx) => [
      { requirement: `Places identifier confirmation first, before any part of the request is acted on.`, evidenceRef: "E2" },
      { requirement: `Establishes caller identity and authority before discussing the referral.` },
      { requirement: `Screens for clinical content before administrative handling.` },
      { requirement: `Ends with read-back to a named owner and documentation of the identifiers confirmed.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Identifiers, then caller authority, then reason, then clinical screen, then need and owner, then read-back, then document and route.`, why: `Correct: the order is what prevents a wrong-patient action and an unauthorised disclosure.` }),
      wrong: (ctx) => [
        { text: `Take the request first so the call is short, then confirm identity before saving anything.`, why: `Discussing a referral before identity is established is already a disclosure, and it cannot be undone at save time.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Use the referral record already open, confirm the name against it, and proceed.`, why: `A record that happens to be open is not the patient, and two patients share this name.`, trapType: "TRAP_NEAREST_NAME_MATCH" },
        { text: `Screen for clinical content only if the caller raises something clinical.`, why: `Screening that depends on the caller knowing what is clinically significant is not screening.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "who the caller is and what authority they have to act for this patient",
    contradiction: "the caller was identified and verified at the start of the call",
    redFlag: "She's been really short of breath since yesterday, that's partly why I'm calling.",
    prerequisite: "The patient's recorded authorisation for this caller to act on their behalf",
    consequence: "The referral was moved on the unverified caller's instruction and the patient missed the appointment."
  }
];
