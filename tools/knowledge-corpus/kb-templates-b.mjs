// Template families, part B: extraction, documentation, referral and error work.
// See kb-templates-a.mjs for the contract each template satisfies.

const SELF = "SELF_CONTAINED";

export const TEMPLATES_B = [
  {
    templateId: "KB-VART-KB001-000006",
    taskType: "CHART_EXTRACTION",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M02", "M04"],
    competencies: ["KB-D04"],
    evidenceBasis: SELF,
    packetKind: "CHART_EXCERPT",
    domain: "Pertinent chart extraction",
    scenarioType: "PERTINENCE",
    baseDifficulty: "MODERATE",
    ownerRole: "scribe",
    errorTargets: ["KB-ERR-OMISSION"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "F2",
    secondaryRef: "F1",
    ask: (ctx) => `${ctx.provider.label} is seeing ${ctx.patient.label} (MRN ${ctx.patient.mrn}) about worsening leg swelling. Extract what is pertinent for this visit.`,
    lines: (ctx) => [
      { ref: "F1", section: "Problem list", text: `Hypertension, managed. Osteoarthritis of both knees. Seasonal rhinitis. Appendicectomy 1998.`, decisive: false },
      { ref: "F2", section: "Medications", text: `A calcium-channel blocker was started six weeks ago and is the only change to the medication list in the past year.`, decisive: true },
      { ref: "F3", section: "Recent notes", text: `Two visits in the past year, both for knee pain. No swelling recorded at either.`, decisive: false },
      { ref: "F4", section: "Social", text: `Works standing; recently began a longer commute.`, decisive: false }
    ],
    gold: (ctx) => `Pertinence is decided by the presenting problem, not by what is interesting. Carry forward the six-week-old medication change as the only recent change in the list, the absence of swelling at either prior visit, the hypertension, and the standing work and longer commute. Leave the 1998 appendicectomy and the rhinitis out. Present the medication change as a documented sequence of events, not as a cause.`,
    acceptance: (ctx) => [
      { requirement: `Carries the recent medication change forward as the single recent change.`, evidenceRef: "F2" },
      { requirement: `Carries the documented absence of prior swelling, which is pertinent negative evidence.`, evidenceRef: "F3" },
      { requirement: `Omits the 1998 appendicectomy and the rhinitis.` },
      { requirement: `States the sequence without asserting a cause.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Carry the recent medication change, the absence of prior swelling, the hypertension and the standing work; omit the 1998 surgery and rhinitis; assert no cause.`, why: `Correct: pertinence follows the presenting problem, and sequence is not causation.` }),
      wrong: (ctx) => [
        { text: `Carry the same items and note that the swelling is a side effect of the new medication.`, why: `The extraction is right and the conclusion is not yours to draw. A documented sequence is not a documented cause.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Carry the full problem list so the clinician has the complete picture.`, why: `Carrying everything is not extraction, and it buries the one recent change that matters.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Carry the medication change only; the rest is background.`, why: `The documented absence of prior swelling is pertinent negative evidence and dropping it loses the timeline.`, trapType: "TRAP_QUEUE_ORDER" }
      ]
    },
    missingFact: "when the calcium-channel blocker was started relative to the onset of swelling",
    contradiction: "the medication list has been unchanged for two years",
    redFlag: "One leg swelled up overnight and the calf is hot and tender to touch.",
    prerequisite: "The medication reconciliation performed at the last visit",
    consequence: "The extraction was used as the referral summary without the medication timeline."
  },
  {
    templateId: "KB-VART-KB001-000007",
    taskType: "SOAP_TRANSFORMATION",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M04", "M05"],
    competencies: ["KB-D05"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "SOAP transformation",
    scenarioType: "TRANSCRIPT_TO_NOTE",
    baseDifficulty: "MODERATE",
    ownerRole: "scribe",
    errorTargets: ["KB-ERR-DOCUMENTATION-CONTAMINATION", "KB-ERR-UNSUPPORTED-INFERENCE"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "G3",
    secondaryRef: "G1",
    ask: (ctx) => `Turn the ${ctx.encounterDate} encounter between ${ctx.provider.label} and ${ctx.patient.label} into a SOAP note.`,
    lines: (ctx) => [
      { ref: "G1", section: "Transcript", text: `Patient: "The cough's been three weeks. Dry. Worse at night. No fever that I've measured."`, decisive: false },
      { ref: "G2", section: "Transcript", text: `Clinician, on examination: "Chest is clear. Throat a little red. Temp 36.9."`, decisive: false },
      { ref: "G3", section: "Transcript", text: `Clinician: "I think this is post-viral. Let's give it two more weeks; come back sooner if you get a fever or start bringing anything up." No diagnosis was stated as confirmed and no test was ordered.`, decisive: true },
      { ref: "G4", section: "Transcript", text: `Patient: "Fine. And can I get the sick note extended?" Clinician: "Yes, two weeks."`, decisive: false }
    ],
    gold: (ctx) => `Subjective: three-week dry cough, worse at night, no measured fever, as reported. Objective: chest clear, mild pharyngeal erythema, temperature 36.9. Assessment: post-viral cough, recorded as the clinician's impression and not as a confirmed diagnosis, since none was stated and no test was ordered. Plan: observe two weeks, return sooner if fever or productive cough develops, sick note extended two weeks. Keep the return criteria in the Plan — they are the safety net and they are the first thing lost when a note is compressed.`,
    acceptance: (ctx) => [
      { requirement: `Records the impression as an impression, not a confirmed diagnosis.`, evidenceRef: "G3" },
      { requirement: `Keeps the return criteria — fever, productive cough — in the Plan verbatim in substance.` },
      { requirement: `Puts the reported absence of measured fever in Subjective and the measured temperature in Objective.`, evidenceRef: "G1" },
      { requirement: `Records the sick note extension as a plan item.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Four sections with the impression kept as an impression and the return criteria preserved in the Plan.`, why: `Correct: the return criteria are the safety net, and an impression stays an impression.` }),
      wrong: (ctx) => [
        { text: `Record the assessment as "post-viral cough" and summarise the plan as "review in two weeks".`, why: `The return criteria are gone. The patient's instruction to come back sooner for fever or sputum was the safety-relevant part of the plan.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Record "afebrile" in Objective on the strength of the patient saying they had no fever.`, why: `That converts a patient report into a measurement. The measured temperature exists and belongs there instead.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Add "chest infection ruled out" to the Assessment, since the chest was clear.`, why: `Nothing was ruled out on the record. A clear chest on one examination is a finding, not an exclusion.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" }
      ]
    },
    missingFact: "whether the clinician intended the impression as a working impression or a confirmed diagnosis",
    contradiction: "the clinician recorded post-viral cough as a confirmed diagnosis",
    redFlag: "I coughed up blood twice this morning and I've lost about six kilos.",
    prerequisite: "The clinician's sign-off on the drafted note",
    consequence: "The note went to the insurer supporting the sick-note extension with the return criteria omitted."
  },
  {
    templateId: "KB-VART-KB001-000008",
    taskType: "WORKFLOW_DECISION",
    recordType: "QUESTION",
    modules: ["M06", "M11"],
    competencies: ["KB-D06"],
    evidenceBasis: SELF,
    packetKind: "REFERRAL_PACKET",
    domain: "Referral workflow",
    scenarioType: "PACKET_READINESS",
    baseDifficulty: "MODERATE",
    ownerRole: "referral coordinator",
    errorTargets: ["KB-ERR-OMISSION"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "H2",
    secondaryRef: "H1",
    ask: (ctx) => `A referral for ${ctx.patient.label} to ${ctx.provider.label} is queued to send today. Decide whether it goes.`,
    lines: (ctx) => [
      { ref: "H1", section: "Packet", text: `Cover sheet, demographics, problem list and the referring clinician's letter are attached and current.`, decisive: false },
      { ref: "H2", section: "Packet", text: `The receiving service's stated requirement for this scenario is that the referral include the imaging report it is based on. The packet contains the imaging request, not the report.`, decisive: true },
      { ref: "H3", section: "Queue", text: `The referral has been in the queue nine days. The patient has called twice asking whether it has been sent.`, decisive: false }
    ],
    gold: (ctx) => `Do not send an incomplete packet to stop the clock. The imaging request is not the imaging report, and the receiving service has stated it needs the report. Obtain the report, attach it, and send a complete packet. Meanwhile close the loop with ${ctx.patient.label}: tell them what is outstanding, who is obtaining it and when they will next hear — the nine days and two calls are a communication failure that needs answering in its own right.`,
    acceptance: (ctx) => [
      { requirement: `Identifies the request-versus-report distinction as the blocking gap.`, evidenceRef: "H2" },
      { requirement: `Holds the send and obtains the report rather than sending what is to hand.` },
      { requirement: `Addresses the nine-day delay with the patient directly.`, evidenceRef: "H3" },
      { requirement: `Names who is obtaining the report and by when.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold the send, obtain and attach the imaging report, and tell the patient what is outstanding and when they will hear.`, why: `Correct: a packet that will be rejected has not been sent, and the patient is owed an answer now.` }),
      wrong: (ctx) => [
        { text: `Send today with the imaging request attached and forward the report when it arrives.`, why: `The service has said it needs the report. Sending an incomplete packet restarts the clock rather than advancing it.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Hold the referral until the report arrives and update the patient once it has been sent.`, why: `Holding is right; leaving the patient unanswered after nine days and two calls is not.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Send today and note on the cover sheet that the report is available on request.`, why: `Shifting the work to the receiving service does not make the packet complete, and the requirement is stated.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" }
      ]
    },
    missingFact: "whether the imaging report has been issued and is retrievable",
    contradiction: "the receiving service accepts the imaging request in place of the report",
    redFlag: "The pain is much worse than when this was ordered and now I can't weight-bear at all.",
    prerequisite: "The receiving service's acceptance criteria for this referral",
    consequence: "The packet was sent incomplete, rejected after eleven days, and re-queued from the start."
  },
  {
    templateId: "KB-VART-KB001-000009",
    taskType: "ERROR_HUNT",
    recordType: "QUESTION",
    modules: ["M14", "M04"],
    competencies: ["KB-D12", "KB-D05"],
    evidenceBasis: SELF,
    packetKind: "SOAP_NOTE",
    domain: "Error taxonomy",
    scenarioType: "SEEDED_DEFECT",
    baseDifficulty: "MODERATE",
    ownerRole: "quality reviewer",
    errorTargets: ["KB-ERR-UNSUPPORTED-INFERENCE", "KB-ERR-DOCUMENTATION-CONTAMINATION"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "J2",
    secondaryRef: "J1",
    ask: (ctx) => `Find the defects in this note for ${ctx.patient.label}, ${ctx.encounterDate}, and name each one.`,
    lines: (ctx) => [
      { ref: "J1", section: "Note — Subjective", text: `"Two days of burning on urination. Denies fever, denies flank pain."`, decisive: false },
      { ref: "J2", section: "Note — Assessment", text: `"Uncomplicated urinary tract infection." No urinalysis, dipstick or culture appears anywhere in the encounter record, and nothing states the diagnosis was made clinically.`, decisive: true },
      { ref: "J3", section: "Note — Objective", text: `"Patient appears comfortable. Reports the burning is worse in the mornings."`, decisive: false },
      { ref: "J4", section: "Note — Plan", text: `"Treat as discussed. Follow up if no better." The treatment discussed is not recorded.`, decisive: false }
    ],
    gold: (ctx) => `Three defects, named separately. First, the Assessment states a diagnosis with no test result in the record and no statement that it was a clinical diagnosis — the basis is missing, which is unsupported specificity, not a wrong diagnosis. Second, a patient report sits in Objective, which is contamination. Third, "treat as discussed" records no plan: a reader cannot tell what was prescribed, and neither can an auditor. Report all three and refer them to ${ctx.provider.label}; do not repair the note by inferring the missing test or the missing drug.`,
    acceptance: (ctx) => [
      { requirement: `Names the unsupported diagnostic basis without asserting the diagnosis is wrong.`, evidenceRef: "J2" },
      { requirement: `Names the patient report misfiled in Objective.`, evidenceRef: "J3" },
      { requirement: `Names "treat as discussed" as an unrecorded plan.` },
      { requirement: `Refers the defects rather than inferring the missing test or medication.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Report all three defects — unsupported diagnostic basis, contaminated Objective, unrecorded plan — and refer them to ${ctx.provider.label}.`, why: `Correct: each defect is named for what it is, and none is repaired by inference.` }),
      wrong: (ctx) => [
        { text: `Report that the diagnosis is wrong, since no test supports it.`, why: `The defect is a missing basis, not a wrong diagnosis. A clinical diagnosis can be legitimate; what is missing is the record of it.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Report the two documentation defects and add the likely antibiotic to the Plan for completeness.`, why: `Writing a medication nobody prescribed into a chart is fabrication, whatever the intent.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Report the contaminated Objective; the rest is clinical territory and not a reviewer's concern.`, why: `A missing diagnostic basis and an unrecorded plan are documentation defects, which is exactly a reviewer's concern.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "whether any urinalysis or culture was performed, and what the treatment discussed was",
    contradiction: "a dipstick result was recorded elsewhere in the encounter",
    redFlag: "Since that visit I've had a fever of 39 and pain in my back on one side.",
    prerequisite: "The clinician's amendment of the note",
    consequence: "The note was released to the patient portal and to a payer review in this form."
  },
  {
    templateId: "KB-VART-KB001-000010",
    taskType: "CONTRADICTION_DETECTION",
    recordType: "QUESTION",
    modules: ["M14", "M10"],
    competencies: ["KB-D12"],
    evidenceBasis: SELF,
    packetKind: "CHART_EXCERPT",
    domain: "Contradiction detection",
    scenarioType: "CROSS_RECORD_CONFLICT",
    baseDifficulty: "MODERATE",
    ownerRole: "documentation support specialist",
    errorTargets: ["KB-ERR-CONTRADICTION-BLINDNESS"],
    trapTypes: ["TRAP_SILENT_RECONCILIATION"],
    decisiveRef: "K2",
    secondaryRef: "K1",
    ask: (ctx) => `Reconcile the allergy information for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) before the referral goes out.`,
    lines: (ctx) => [
      { ref: "K1", section: "Allergy list", text: `Structured allergy field: "No known drug allergies." Last updated ${ctx.encounterDate} by ${ctx.staff.label}.`, decisive: false },
      { ref: "K2", section: "Clinic note", text: `Free-text note from an earlier visit, signed by ${ctx.provider.label}: "Patient reports a rash with penicillin as a child; avoided since." The structured field was not updated.`, decisive: true },
      { ref: "K3", section: "Referral draft", text: `The referral pulls the structured field automatically and will state "No known drug allergies".`, decisive: false }
    ],
    gold: (ctx) => `Stop the referral before it carries the structured field. The signed note and the structured field disagree on a drug allergy, and an automated pull will propagate the version that omits it. Surface both entries, state that the structured field was updated later but the note is clinician-signed, and route the reconciliation to ${ctx.provider.label} — not to whoever last touched the field. Do not edit the allergy list yourself, and do not let the referral go out on the unreconciled field.`,
    acceptance: (ctx) => [
      { requirement: `Holds the referral rather than letting the automated pull proceed.`, evidenceRef: "K3" },
      { requirement: `Quotes both the structured field and the signed note.`, evidenceRef: "K2" },
      { requirement: `Routes reconciliation to the clinician rather than editing the allergy list.` },
      { requirement: `Does not treat the more recent update as automatically correct.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold the referral, surface both entries, and route the allergy reconciliation to ${ctx.provider.label}.`, why: `Correct: a drug-allergy conflict is escalated with both sides visible, and never resolved by recency.` }),
      wrong: (ctx) => [
        { text: `Trust the structured field: it was updated more recently and is the system of record for allergies.`, why: `Recency is not authority, and the omission being propagated concerns a drug allergy.`, trapType: "TRAP_LATEST_NOTE_WINS" },
        { text: `Add the penicillin allergy to the structured field so the referral is correct, and note the source.`, why: `The correction is probably right and it is still not yours to make. An allergy entry is a clinical record.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" },
        { text: `Send the referral and flag the discrepancy to the clinician afterwards.`, why: `The referral will state that there is no known drug allergy. Flagging afterwards does not recall it.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "whether the reported childhood penicillin rash was ever confirmed or excluded",
    contradiction: "the structured field was reviewed against the note and confirmed as accurate",
    redFlag: "Last time I had an antibiotic my lips swelled and I had trouble breathing.",
    prerequisite: "The clinician's reconciliation of the allergy record",
    consequence: "The referral was sent stating no known drug allergies and the receiving service prescribed from it."
  },
  {
    templateId: "KB-VART-KB001-000011",
    taskType: "DOCUMENTATION_CORRECTION",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M04", "M15"],
    competencies: ["KB-D05", "KB-D12"],
    evidenceBasis: SELF,
    packetKind: "SOAP_NOTE",
    domain: "Documentation correction",
    scenarioType: "AMENDMENT_DISCIPLINE",
    baseDifficulty: "MODERATE",
    ownerRole: "scribe",
    errorTargets: ["KB-ERR-PROVENANCE-LOSS"],
    trapTypes: ["TRAP_SILENT_RECONCILIATION"],
    decisiveRef: "L2",
    secondaryRef: "L1",
    ask: (ctx) => `A signed note for ${ctx.patient.label} contains an error. State how the correction is made.`,
    lines: (ctx) => [
      { ref: "L1", section: "Note", text: `Signed by ${ctx.provider.label} on ${ctx.encounterDate}. Records the affected side as left.`, decisive: false },
      { ref: "L2", section: "Discovery", text: `The examination findings, the imaging request and the patient's own account all say right. The side is wrong in one place: the signed note. The note has already been released to the patient portal.`, decisive: true },
      { ref: "L3", section: "System", text: `The editor permits in-place edits to signed notes without a visible amendment trail.`, decisive: false }
    ],
    gold: (ctx) => `Correct it as an amendment, not an edit. The system will let the text be changed silently and that is exactly what must not happen: the original entry stays, the amendment is added with author, date and the reason for the change, and the amendment is attributed to ${ctx.provider.label}, who signed the note — a scribe does not amend a signed note in a clinician's name. Because the note was already released, the correction is also communicated: the patient saw the wrong side, and anything downstream built on the note needs re-checking.`,
    acceptance: (ctx) => [
      { requirement: `Makes an amendment with author, date and reason rather than an in-place edit.`, evidenceRef: "L3" },
      { requirement: `Preserves the original entry.` },
      { requirement: `Routes the amendment to the signing clinician instead of amending in their name.`, evidenceRef: "L1" },
      { requirement: `Addresses the already-released copy and the downstream records built on it.`, evidenceRef: "L2" }
    ],
    answer: {
      correct: (ctx) => ({ text: `Raise an amendment with author, date and reason through ${ctx.provider.label}, keep the original, and address the released copy.`, why: `Correct: a signed note is amended, never quietly edited, and a released error has to be chased downstream.` }),
      wrong: (ctx) => [
        { text: `Correct the side in place; the note will then be accurate and the error had no clinical effect yet.`, why: `A silent edit to a signed, released note destroys the record that the error existed and was corrected.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Add an amendment in the scribe's own name explaining the side was wrong.`, why: `Closer, but a scribe cannot amend a clinician's signed clinical content; the signer amends it.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" },
        { text: `Raise the amendment and leave the released copy alone, since the corrected note supersedes it.`, why: `The patient read the wrong side and downstream records were built on it. Supersession is not notification.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ]
    },
    missingFact: "who is authorised to amend this signed note, and whether anything downstream has already used it",
    contradiction: "the imaging request also records the left side",
    redFlag: "They've booked me for an injection and nobody has asked me which side it is.",
    prerequisite: "The signing clinician's availability to amend",
    consequence: "A procedure was scheduled from the uncorrected note."
  },
  {
    templateId: "KB-VART-KB001-000012",
    taskType: "INFORMATION_GAP",
    recordType: "QUESTION",
    modules: ["M03", "M02"],
    competencies: ["KB-D02", "KB-D01"],
    evidenceBasis: SELF,
    packetKind: "INBOX_QUEUE",
    domain: "Information-gap identification",
    scenarioType: "INCOMPLETE_REQUEST",
    baseDifficulty: "EASY",
    ownerRole: "medical assistant",
    errorTargets: ["KB-ERR-PREMATURE-CLOSURE"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "M2",
    secondaryRef: "M1",
    ask: (ctx) => `An inbox item about ${ctx.patient.label} asks for "the usual form". Name what has to be established before it can be actioned.`,
    lines: (ctx) => [
      { ref: "M1", section: "Inbox", text: `Message from an outside office: "Please send the usual form for ${ctx.patient.label}. Needed today." No sender name, no form named, no purpose stated.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "M2", section: "Chart", text: `Three different forms have been sent to outside offices for this patient in the past year, each to a different recipient and each for a different purpose.`, decisive: true },
      { ref: "M3", section: "Queue", text: `The item is marked urgent by the sender.`, decisive: false }
    ],
    gold: (ctx) => `Do not infer "the usual". Four things are unestablished and each is required: which form, who is requesting it and on what authority, for what purpose, and whether the patient has authorised disclosure to that recipient. The history of three different forms to three different recipients is precisely why a guess here is a disclosure risk. Reply to the sender requesting the four items, and record that the request is held pending them. The sender's urgency flag does not substitute for any of them.`,
    acceptance: (ctx) => [
      { requirement: `Names all four unestablished items rather than describing the request as vague.`, evidenceRef: "M1" },
      { requirement: `Cites the history of differing forms and recipients as why inference is unsafe.`, evidenceRef: "M2" },
      { requirement: `Holds the request and records it as held.` },
      { requirement: `Declines to let the urgency flag substitute for the missing items.`, evidenceRef: "M3" }
    ],
    answer: {
      correct: (ctx) => ({ text: `Request the form, the requester's identity and authority, the purpose, and the disclosure authorisation; hold the item until they arrive.`, why: `Correct: four gaps, each required, and none of them supplied by the urgency flag.` }),
      wrong: (ctx) => [
        { text: `Send the form most recently sent for this patient, since that is most likely "the usual".`, why: `Most likely is not established, and the three prior forms went to three different recipients for three different purposes.`, trapType: "TRAP_NEAREST_NAME_MATCH" },
        { text: `Ask which form is needed and send it once the sender replies.`, why: `One gap of four. Requester authority, purpose and disclosure authorisation are still missing.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Escalate the item to the clinician because it is marked urgent.`, why: `Nothing here is clinical. The gaps are administrative and identifying them is this role's work.`, trapType: "TRAP_QUEUE_ORDER" }
      ]
    },
    missingFact: "which form is being requested, by whom, for what purpose, and under what authorisation",
    contradiction: "the sender named the form and their authority in the original message",
    redFlag: "Tell them it's for the hospital — she was admitted overnight with chest pain.",
    prerequisite: "The patient's recorded authorisation for disclosure to this recipient",
    consequence: "A form was sent on the assumption it was the usual one, to a recipient the patient had not authorised."
  },
  {
    templateId: "KB-VART-KB001-000013",
    taskType: "CALL_PROBING",
    recordType: "QUESTION",
    modules: ["M03"],
    competencies: ["KB-D11", "KB-D03"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "Call probing",
    scenarioType: "UNDERSPECIFIED_SYMPTOM_REPORT",
    baseDifficulty: "MODERATE",
    ownerRole: "triage-support coordinator",
    errorTargets: ["KB-ERR-FAILURE-TO-PROBE"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "N2",
    secondaryRef: "N1",
    ask: (ctx) => `${ctx.patient.label} calls ${ctx.practice} asking for "an appointment sometime next week". What do you probe before booking?`,
    lines: (ctx) => [
      { ref: "N1", section: "Call", text: `${ctx.patient.label}: "Can I get something next week? It's my chest again, same as before."`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "N2", section: "Call", text: `"Same as before" is not defined. Nothing has been established about what the sensation is, when it happens, whether it is changing, or what the previous episode was. The caller has offered a routine-sounding timeframe.`, decisive: true },
      { ref: "N3", section: "Chart", text: `A prior encounter exists for chest discomfort. Its content has not been opened.`, decisive: false }
    ],
    gold: (ctx) => `The caller's proposed timeframe is not a triage finding, and a chest complaint is not booked on it. Probe what the sensation is now, when it occurs and what brings it on, whether it is worse, longer or more frequent than the previous episode, and whether anything accompanies it. Ask the question whose answer would change the action — what has changed since last time — and take the answer in the patient's words. If any answer indicates escalation, route to a clinician rather than booking, and record what you asked as well as what you were told.`,
    acceptance: (ctx) => [
      { requirement: `Declines to treat the caller's timeframe as a triage outcome.`, evidenceRef: "N2" },
      { requirement: `Probes current character, timing, trigger and change since the prior episode.` },
      { requirement: `Asks explicitly what has changed, and takes the answer in the patient's words.` },
      { requirement: `Routes to a clinician instead of booking if an answer indicates escalation, and records the questions asked.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Probe character, timing, trigger and change since the last episode, and route to a clinician rather than booking if any answer escalates it.`, why: `Correct: probing establishes what the caller could not know mattered, and the caller's timeframe is not triage.` }),
      wrong: (ctx) => [
        { text: `Book next week as asked and open the prior encounter to match the reason for visit.`, why: `"Same as before" against an unopened prior note is an assumption, and the timeframe came from the patient, not from triage.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Ask whether the pain is severe, and book next week if the patient says it is not.`, why: `A single severity question, answered by a patient who cannot know the criteria, is not a probe.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Tell the patient that chest symptoms need urgent assessment and to attend an emergency department.`, why: `That is a clinical disposition from an unprobed report. Probe, then route to a clinician who decides.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "what the current sensation is and how it differs from the previous episode",
    contradiction: "the caller described the episode in full and said it was unchanged",
    redFlag: "It's heavier than last time and it goes into my jaw now.",
    prerequisite: "The clinician's triage protocol for chest symptom calls",
    consequence: "The appointment was booked for the following week with no probe recorded."
  },
  {
    templateId: "KB-VART-KB001-000014",
    taskType: "CLOSED_LOOP_COMMUNICATION",
    recordType: "COMMUNICATION_EVENT",
    modules: ["M13", "M10"],
    competencies: ["KB-D11"],
    evidenceBasis: SELF,
    packetKind: "MESSAGE_THREAD",
    domain: "Closed-loop communication",
    scenarioType: "UNACKNOWLEDGED_CRITICAL_MESSAGE",
    baseDifficulty: "MODERATE",
    ownerRole: "results coordinator",
    errorTargets: ["KB-ERR-OPEN-LOOP"],
    trapTypes: ["TRAP_SEND_AND_ASSUME"],
    decisiveRef: "P2",
    secondaryRef: "P1",
    ask: (ctx) => `A result for ${ctx.patient.label} was sent onward three days ago. Establish whether the loop is closed.`,
    lines: (ctx) => [
      { ref: "P1", section: "Thread", text: `${ctx.staff.label} sent the result to ${ctx.provider.label} on ${ctx.encounterDate} with the subject "please review".`, decisive: false },
      { ref: "P2", section: "Thread", text: `The message shows as delivered. There is no reply, no acknowledgement, and no record that ${ctx.provider.label} opened it. ${ctx.provider.label} has been out of the office since the day it was sent.`, decisive: true },
      { ref: "P3", section: "Chart", text: `No action has been recorded on the result. The patient has not been contacted.`, decisive: false }
    ],
    gold: (ctx) => `Delivered is not acknowledged, and the loop is open. State that there is no acknowledgement and that the named recipient has been absent since the message was sent — so the delivery receipt evidences nothing about review. Re-route to the covering clinician rather than resending to the same absent inbox, obtain an explicit acknowledgement from a named person, record who accepted it and when, and close the loop with the patient once a clinician has acted. Escalate if no acknowledgement is obtained promptly.`,
    acceptance: (ctx) => [
      { requirement: `Distinguishes delivery from acknowledgement.`, evidenceRef: "P2" },
      { requirement: `Re-routes to the covering clinician rather than resending to the absent inbox.` },
      { requirement: `Obtains and records an explicit acknowledgement from a named person.` },
      { requirement: `Closes the loop with the patient once a clinician has acted.`, evidenceRef: "P3" }
    ],
    answer: {
      correct: (ctx) => ({ text: `Re-route to the covering clinician, obtain a named acknowledgement, record it, and then close the loop with the patient.`, why: `Correct: a loop closes on a named person's acceptance, not on a delivery receipt.` }),
      wrong: (ctx) => [
        { text: `Treat the loop as closed: the message was delivered and the recipient is responsible for their own inbox.`, why: `Delivery to an inbox nobody is reading is the condition this case describes, not a defence against it.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Resend the message to ${ctx.provider.label} marked urgent.`, why: `The recipient is out of the office. A second copy in the same unread inbox changes nothing.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Contact the patient now with the result so they are not left waiting.`, why: `No clinician has reviewed it. Releasing an unreviewed result is both outside scope and premature.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "who is covering for the absent clinician and has accepted the result",
    contradiction: "the clinician acknowledged the message on the day it was sent",
    redFlag: "I've been feeling much worse since that test and nobody has called me.",
    prerequisite: "The covering clinician's assignment for this absence",
    consequence: "The result sat unreviewed for three days while the patient was told it was in hand."
  }
];
