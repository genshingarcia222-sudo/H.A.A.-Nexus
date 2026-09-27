// Template families for Knowledgebase batch KB-002 — the EASY-based half.
//
// Why this file exists. KB-001 measured 59.3% HARD and 2.8% EASY
// (GAP_ANALYSIS.md section 3.1). The cause was structural, not editorial: six of
// the eleven mutation operators add a contradiction or a competing priority, and
// each fires once per family, so every family KB-001 defined contributed six HARD
// records whatever its base band. The fix is not relabelling — it is families
// whose base band is EASY, built with the operators that leave the band alone.
//
// Each family here therefore declares:
//   operatorIds: ["BASE", "LATE_CLUE", "BURIED_CLUE", "CLUE_REMOVED"]
// BASE, LATE_CLUE and BURIED_CLUE preserve baseDifficulty — moving or hiding a
// clue changes what must be read, not how many things interact — and CLUE_REMOVED
// raises it one band, so an EASY family yields three EASY records and one
// MODERATE. That is the whole mechanism.
//
// Every family is SELF_CONTAINED. Nothing here asserts a coding rule, a payer
// requirement or a privacy law: expanding KB-D07 and KB-D10 on authority is
// blocked on source verification (STOP GATE 4) and is not attempted. Where a
// scenario needs a policy, the policy is stated as a given of that synthetic
// scenario and the record carries SYNTHETIC-GIVEN-POLICY, the same honest device
// KB-001 used for payer rules.
//
// All patients, providers, staff, practices and payers are invented.

const SELF = "SELF_CONTAINED";

/** The band-preserving operator set, plus the one that raises it a single band. */
const EASY_OPS = ["BASE", "LATE_CLUE", "BURIED_CLUE", "CLUE_REMOVED"];

export const TEMPLATES_D = [
  {
    templateId: "KB-VART-KB002-000001",
    operatorIds: EASY_OPS,
    taskType: "CHART_EXTRACTION",
    recordType: "QUESTION",
    modules: ["M02"],
    competencies: ["KB-D01"],
    evidenceBasis: SELF,
    packetKind: "CHART_EXCERPT",
    domain: "Patient identity and encounter context",
    scenarioType: "TWO_IDENTIFIER_CONFIRMATION",
    baseDifficulty: "EASY",
    ownerRole: "patient access representative",
    errorTargets: ["KB-ERR-WRONG-PATIENT"],
    trapTypes: ["TRAP_NEAREST_NAME_MATCH"],
    decisiveRef: "C2",
    secondaryRef: "C1",
    ask: (ctx) => `${ctx.staff.label} is opening the chart for a scheduled visit at ${ctx.practice}. Which identifiers confirm that this is the right record, and what remains unconfirmed?`,
    lines: (ctx) => [
      { ref: "C1", section: "Front desk", text: `The person at the desk gives their name as ${ctx.patient.label} and a date of birth of ${ctx.patient.dob}.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "C2", section: "Chart header", text: `the open chart is MRN ${ctx.patient.mrn}, ${ctx.patient.label}, date of birth ${ctx.patient.dob}, and it is the only record in the system matching both that name and that date of birth`, decisive: true },
      { ref: "C3", section: "Schedule", text: `The ${ctx.encounterDate} slot with ${ctx.provider.label} is booked under MRN ${ctx.patient.mrn}.`, decisive: false }
    ],
    gold: (ctx) => `State that name and date of birth both match, and that the chart header is the only record matching both, so the record is confirmed on two identifiers. Name the identifier that has not been checked — the MRN was read off the chart rather than confirmed with the patient — and say that the booked slot in C3 agrees with the same MRN. Do not treat the name match alone as confirmation.`,
    acceptance: (ctx) => [
      { requirement: `Names both matching identifiers and states that the chart header is the sole match on both.`, evidenceRef: "C2" },
      { requirement: `States that the MRN was taken from the chart, not confirmed against the patient.` },
      { requirement: `Notes that the scheduled slot is booked under the same MRN.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Name and date of birth match and the chart header is the only record matching both, so identity is confirmed on two identifiers; the MRN itself was read from the chart rather than confirmed with the patient.`, why: `Correct: it reports what the two identifiers establish and is precise about the one that was not independently checked.` }),
      wrong: (ctx) => [
        { text: `The name matches the chart header, which is sufficient to proceed with the visit.`, why: `A single identifier is not confirmation, and a name is the identifier most likely to be shared by two records.`, trapType: "TRAP_NEAREST_NAME_MATCH" },
        { text: `Identity cannot be confirmed because the patient did not state their MRN.`, why: `Two identifiers are confirmed. Demanding a third that patients rarely know blocks a visit the record already supports.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Identity is confirmed because the ${ctx.encounterDate} slot is booked under this MRN.`, why: `A booking confirms who was expected, not who is standing at the desk. It is corroboration, not identification.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" }
      ]
    },
    missingFact: "whether any second record in the system shares this patient's name and date of birth",
    contradiction: "a second record shares this name and date of birth under a different MRN",
    redFlag: "Before we start — I've been getting short of breath just walking to the car since Tuesday.",
    prerequisite: "The front-desk identity check for this encounter",
    consequence: "A note from this visit was later found filed under a different MRN with the same patient name."
  },
  {
    templateId: "KB-VART-KB002-000002",
    operatorIds: EASY_OPS,
    taskType: "CALL_PROBING",
    recordType: "COMMUNICATION_EVENT",
    modules: ["M03", "M13"],
    competencies: ["KB-D03", "KB-D11"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "Call handling and escalation",
    scenarioType: "RED_FLAG_DURING_SCHEDULING",
    baseDifficulty: "EASY",
    ownerRole: "scheduling coordinator",
    safetyBaseline: true,
    errorTargets: ["KB-ERR-INCORRECT-ESCALATION", "KB-ERR-SCOPE-VIOLATION"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY", "TRAP_ANSWER_OUTSIDE_SCOPE"],
    decisiveRef: "S2",
    secondaryRef: "S1",
    ask: (ctx) => `${ctx.staff.label} is taking a routine rescheduling call from ${ctx.patient.label} (MRN ${ctx.patient.mrn}). What must happen before the call ends?`,
    lines: (ctx) => [
      { ref: "S1", section: "Call", text: `Caller asks to move the ${ctx.scheduledDate} appointment with ${ctx.provider.label} to a later week because of a work conflict.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "S2", section: "Call", text: `mid-call the patient adds, unprompted, that they have had a squeezing pressure across the chest for two days that comes on when they climb stairs and eases when they stop`, recordedOn: ctx.encounterDate, decisive: true },
      { ref: "S3", section: "Role", text: `This queue is a scheduling role. It may not assess a symptom, offer reassurance about one, or decide how urgent it is.`, decisive: false }
    ],
    gold: (ctx) => `Stop treating this as a scheduling call. Keep ${ctx.patient.label} on the line, tell them plainly that what they have described needs a clinician now rather than at a future appointment, and get it to a named clinician — ${ctx.provider.label} or whoever is covering — before the call ends. Do not reschedule first and escalate afterwards, and do not characterise the symptom, rate its urgency, or reassure them that it can wait. Record what was said in the patient's own words, who it was handed to, and when.`,
    acceptance: (ctx) => [
      { requirement: `Recognises the volunteered statement as the reason the call changes, not an aside.`, evidenceRef: "S2" },
      { requirement: `Gets it to a named clinician before the call ends, rather than completing the reschedule first.` },
      { requirement: `Records the patient's own words, the recipient and the time, closing the loop.` },
      { requirement: `Offers no assessment, threshold or reassurance about the symptom.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold the call, tell the patient this needs a clinician now, hand it to ${ctx.provider.label} or the covering clinician before ending, and record the words used and the handoff.`, why: `Correct: escalation precedes the administrative task, and the handoff is named and recorded.` }),
      wrong: (ctx) => [
        { text: `Complete the reschedule the patient asked for, then send a message to ${ctx.provider.label} noting what was mentioned.`, why: `It puts the administrative task ahead of the escalation and leaves the symptom sitting in a queue. The patient is also off the line by then.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Tell the patient that stair-related chest pressure is usually muscular and to raise it at the rescheduled visit.`, why: `That is a clinical assessment and a reassurance, both outside a scheduling role, and it converts an escalation into a delay.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" },
        { text: `Advise the patient to hang up and call emergency services, then close the call.`, why: `Deciding the level of urgency is itself a clinical judgement this role may not make, and closing the call ends the loop with no named owner.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ]
    },
    missingFact: "which clinician is available now to receive the escalation",
    contradiction: "the patient states the chest pressure was already assessed and cleared at a prior visit",
    redFlag: "It's a squeezing pressure across the chest when I climb the stairs, and it's been two days.",
    prerequisite: "The covering clinician's availability for an unscheduled escalation",
    consequence: "The reschedule was completed and the patient presented to an emergency department that evening."
  },
  {
    templateId: "KB-VART-KB002-000003",
    operatorIds: EASY_OPS,
    taskType: "RESULT_ROUTING",
    recordType: "WORKFLOW",
    modules: ["M10"],
    competencies: ["KB-D08", "KB-D11"],
    evidenceBasis: SELF,
    packetKind: "RESULT_PACKET",
    domain: "Laboratory and imaging results workflow",
    scenarioType: "RESULT_DESTINATION",
    baseDifficulty: "EASY",
    ownerRole: "results coordinator",
    errorTargets: ["KB-ERR-WRONG-DESTINATION", "KB-ERR-OPEN-LOOP"],
    trapTypes: ["TRAP_SEND_AND_ASSUME", "TRAP_QUEUE_ORDER"],
    decisiveRef: "R3",
    secondaryRef: "R1",
    ask: (ctx) => `A result has landed in the shared results queue for ${ctx.patient.label} (MRN ${ctx.patient.mrn}), behind two older items for other patients. Where does it go, and what closes the loop?`,
    lines: (ctx) => [
      { ref: "R1", section: "Result", text: `Basic metabolic panel, collected ${ctx.encounterDate}, all values inside the reporting range with no flags.`, decisive: false },
      { ref: "R2", section: "Result", text: `Report header names the ordering clinician as ${ctx.provider.label} (${ctx.provider.role}).`, decisive: false },
      // third line is R3 below; the packet is deliberately held to three entries
      // so the LATE_CLUE variant stays inside the EASY band's six-line ceiling.
      { ref: "R3", section: "Practice workflow", text: `the workflow stated for this scenario routes every result, flagged or not, to the ordering clinician's own queue for review before any patient is told anything, and the coordinator's task is delivery and confirmation rather than interpretation`, decisive: true }
    ],
    gold: (ctx) => `Route the result to ${ctx.provider.label}'s own review queue, because that is where the stated workflow sends every result regardless of whether anything is flagged. Confirm it arrived rather than assuming the send succeeded, and record the delivery and the confirmation against the ${ctx.encounterDate} encounter. Do not tell ${ctx.patient.label} the panel is normal, and do not close the item on the strength of the values looking unremarkable — reviewing them is not this role's task.`,
    acceptance: (ctx) => [
      { requirement: `Routes to the ordering clinician's queue and cites the workflow that requires it for every result.`, evidenceRef: "R3" },
      { requirement: `Confirms arrival rather than assuming the send completed, and records the confirmation.` },
      { requirement: `Withholds any statement to the patient about what the values mean.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Send it to ${ctx.provider.label}'s review queue, confirm receipt, and record the delivery against the ${ctx.encounterDate} encounter without messaging the patient.`, why: `Correct: the stated workflow makes no exception for unflagged results, and confirmation is what closes the loop.` }),
      wrong: (ctx) => [
        { text: `Release the result to the patient portal with a note that everything is within range, and copy ${ctx.provider.label}.`, why: `"Within range" is an interpretation, and the workflow requires clinician review before the patient is told anything.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" },
        { text: `Send it to the general clinical inbox so whoever is on next can action it.`, why: `A general inbox names no owner, and the workflow names the ordering clinician specifically.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Work the two older items ahead of this one, since the queue is ordered by arrival.`, why: `Queue position is not a priority signal, and nothing here says the older items outrank this one.`, trapType: "TRAP_QUEUE_ORDER" }
      ]
    },
    missingFact: "which clinician ordered the panel and therefore owns its review",
    contradiction: "the report names a different ordering clinician from the one in the encounter record",
    redFlag: "I've been getting dizzy standing up since the blood test and it's getting worse.",
    prerequisite: "The ordering clinician's review of the panel",
    consequence: "The patient was told the panel was normal and later learned the clinician had wanted to discuss one value."
  },

  {
    templateId: "KB-VART-KB002-000004",
    operatorIds: EASY_OPS,
    taskType: "REFERRAL_PACKET_REVIEW",
    recordType: "WORKFLOW",
    modules: ["M06"],
    competencies: ["KB-D06"],
    evidenceBasis: SELF,
    packetKind: "REFERRAL_PACKET",
    domain: "Referral and fax packets",
    scenarioType: "PACKET_COMPLETENESS",
    baseDifficulty: "EASY",
    ownerRole: "referral coordinator",
    errorTargets: ["KB-ERR-OMISSION"],
    trapTypes: ["TRAP_SEND_AND_ASSUME"],
    decisiveRef: "F2",
    secondaryRef: "F1",
    ask: (ctx) => `${ctx.staff.label} is preparing a referral packet for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) to ${ctx.provider.label}. Is the packet ready to send?`,
    lines: (ctx) => [
      { ref: "F1", section: "Packet", text: `Cover sheet, referral reason, the ${ctx.encounterDate} office note and the current medication list are attached and legible.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "F2", section: "Packet checklist", text: `the receiving office's stated intake checklist for this scenario requires the referral reason, the relevant note, the medication list and the imaging report referenced in that note, and the imaging report is the one item not attached`, decisive: true },
      { ref: "F3", section: "Note", text: `The ${ctx.encounterDate} note's plan section refers the reader to the imaging report for the finding that prompted the referral.`, decisive: false }
    ],
    gold: (ctx) => `The packet is not ready. Name the single missing item — the imaging report the note's plan depends on — and say why its absence matters: without it the receiving office has the referral's reason but not the finding behind it. Attach it, then send. Do not send the packet with a note that the report will follow, and do not treat the note's own summary of the finding as a substitute for the report.`,
    acceptance: (ctx) => [
      { requirement: `Identifies the imaging report as the one missing checklist item.`, evidenceRef: "F2" },
      { requirement: `Explains that the note depends on it for the finding that prompted the referral.` },
      { requirement: `Completes the packet before sending rather than sending and following up.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Attach the imaging report the note relies on, then send the completed packet to ${ctx.provider.label}'s office.`, why: `Correct: the checklist names it, the note depends on it, and the packet is complete once it is attached.` }),
      wrong: (ctx) => [
        { text: `Send the packet now and fax the imaging report separately once it is located.`, why: `A split packet is how an item goes missing, and the receiving office's intake needs it together.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Send the packet as it stands: the note already describes the finding in its plan section.`, why: `The note points to the report rather than reproducing it. A reference is not the document.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Hold the referral and ask the patient to bring the imaging report to their next visit.`, why: `It moves a task the practice can complete onto the patient and delays a referral for no reason.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "which imaging report the note's plan section refers to",
    contradiction: "the checklist states the imaging report is not required for this referral type",
    redFlag: "The pain the scan was for has got much worse since that visit.",
    prerequisite: "The imaging report referenced in the encounter note",
    consequence: "The receiving office returned the referral as incomplete and the appointment slipped three weeks."
  },
  {
    templateId: "KB-VART-KB002-000005",
    operatorIds: EASY_OPS,
    taskType: "INSURANCE_VERIFICATION",
    recordType: "WORKFLOW",
    modules: ["M11"],
    competencies: ["KB-D09"],
    evidenceBasis: SELF,
    packetKind: "INSURANCE_ARTIFACT",
    domain: "Insurance and administrative workflow",
    scenarioType: "ELIGIBILITY_FIELD_MISSING",
    baseDifficulty: "EASY",
    ownerRole: "patient access representative",
    payerSpecific: true,
    errorTargets: ["KB-ERR-PREMATURE-CLOSURE"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "I2",
    secondaryRef: "I1",
    ask: (ctx) => `${ctx.staff.label} is verifying coverage for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) ahead of the ${ctx.scheduledDate} visit. Can verification be recorded as complete?`,
    lines: (ctx) => [
      { ref: "I1", section: "Coverage", text: `${ctx.payer.label}, plan ${ctx.payer.planId}, subscriber name and date of birth match the chart, and the card image on file is current.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "I2", section: "Coverage", text: `the group number field on the eligibility response is blank, and the plan's stated verification requirement for this scenario treats a coverage check without a group number as unverified`, decisive: true },
      { ref: "I3", section: "Schedule", text: `The ${ctx.scheduledDate} visit with ${ctx.provider.label} is already booked.`, decisive: false }
    ],
    gold: (ctx) => `Do not record verification as complete. State that the group number is blank and that the plan's stated requirement for this scenario makes the check unverified without it. Obtain the group number from the patient or the payer, re-run the check, and record verification only once it returns populated. Say that the booked visit does not change the answer. Do not infer the group number from a prior encounter, and do not record verification as complete with a note that one field is outstanding.`,
    acceptance: (ctx) => [
      { requirement: `Names the blank group number and the stated requirement that makes the check unverified.`, evidenceRef: "I2" },
      { requirement: `Holds verification open rather than recording it complete with a caveat.` },
      { requirement: `Names how the missing field will be obtained and that the check will be re-run.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Obtain the group number, re-run the check, and record verification only once it returns populated.`, why: `Correct: the stated requirement is explicit, and a re-run is what makes the record true.` }),
      wrong: (ctx) => [
        { text: `Record verification complete and note that the group number is outstanding.`, why: `That records a status the check does not support. A caveat in a comment field does not change a verified flag.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Copy the group number from the patient's prior encounter, where the same plan is on file.`, why: `A prior group number is not this response's group number; plans re-issue them, which is why the field is checked.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Cancel the ${ctx.scheduledDate} visit until coverage is verified.`, why: `Nothing here requires cancelling a booked visit; the task is to complete a verification, not to withdraw care.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "the group number on the current eligibility response",
    contradiction: "the eligibility response returns a group number that differs from the card image",
    redFlag: "I've been putting off coming in because of the cost, and the chest tightness is worse.",
    prerequisite: "A populated group number on the eligibility response",
    consequence: "The claim was denied for an invalid group number and the balance fell to the patient."
  },
  {
    templateId: "KB-VART-KB002-000006",
    operatorIds: EASY_OPS,
    taskType: "MEDICATION_WORKFLOW_REVIEW",
    recordType: "WORKFLOW",
    modules: ["M09"],
    competencies: ["KB-D08"],
    evidenceBasis: SELF,
    packetKind: "MEDICATION_LIST",
    domain: "Medication and refill workflow",
    scenarioType: "REFILL_ROUTING",
    baseDifficulty: "EASY",
    ownerRole: "pharmacy technician",
    errorTargets: ["KB-ERR-SCOPE-VIOLATION"],
    trapTypes: ["TRAP_ANSWER_OUTSIDE_SCOPE"],
    decisiveRef: "M2",
    secondaryRef: "M1",
    ask: (ctx) => `A refill request for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) has arrived from the pharmacy. What does ${ctx.staff.label} do with it?`,
    lines: (ctx) => [
      { ref: "M1", section: "Request", text: `Pharmacy requests a refill of a maintenance medication on the active list; the last fill was 30 days ago and the quantity requested matches the prescription on file.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "M2", section: "Prescription", text: `the prescription on file shows zero refills remaining, and the stated workflow for this scenario is that a request with no refills left is a new prescribing decision for the prescriber rather than an administrative renewal`, decisive: true },
      { ref: "M3", section: "Chart", text: `${ctx.provider.label} is the prescriber of record and the patient's next visit is ${ctx.scheduledDate}.`, decisive: false }
    ],
    gold: (ctx) => `Route the request to ${ctx.provider.label} as a prescribing decision, because the prescription has no refills remaining. Give the prescriber what they need to decide — the medication, the last fill date, the requested quantity and the fact that refills are exhausted — and tell the pharmacy the request is with the prescriber. Do not approve the refill because the request matches the prescription on file, and do not tell the patient the refill is on its way.`,
    acceptance: (ctx) => [
      { requirement: `Identifies that zero refills remaining makes this a prescribing decision, not a renewal.`, evidenceRef: "M2" },
      { requirement: `Routes to the named prescriber with the facts needed to decide.` },
      { requirement: `Tells the pharmacy where the request now sits, rather than leaving it unanswered.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Route it to ${ctx.provider.label} as a prescribing decision, and tell the pharmacy where it sits.`, why: `Correct: the refill count is exhausted, so the decision is the prescriber's, and the loop back to the pharmacy is closed.` }),
      wrong: (ctx) => [
        { text: `Approve the refill: the quantity matches the prescription on file and the timing is right.`, why: `Matching an exhausted prescription is not authority to refill it. This is the scope boundary the record turns on.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" },
        { text: `Tell the pharmacy to hold the request until the ${ctx.scheduledDate} visit.`, why: `It defers a prescribing decision the prescriber has not seen and may leave the patient without a maintenance medication.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Deny the request and tell the patient to ask at their next appointment.`, why: `Denial is also a prescribing decision, and it is made here without the prescriber.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "how many refills remain on the prescription on file",
    contradiction: "the prescription record shows refills remaining while the pharmacy states there are none",
    redFlag: "I ran out four days ago and my blood pressure readings at home have been very high since.",
    prerequisite: "The prescriber's decision on a prescription with no refills left",
    consequence: "The refill was approved administratively and the patient continued a medication the prescriber had intended to stop."
  },
  {
    templateId: "KB-VART-KB002-000007",
    operatorIds: EASY_OPS,
    taskType: "SOAP_TRANSFORMATION",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M04"],
    competencies: ["KB-D05"],
    evidenceBasis: SELF,
    packetKind: "SOAP_NOTE",
    domain: "SOAP and clinical documentation",
    scenarioType: "SECTION_PLACEMENT",
    baseDifficulty: "EASY",
    ownerRole: "clinical documentation assistant",
    errorTargets: ["KB-ERR-DOCUMENTATION-CONTAMINATION"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "P2",
    secondaryRef: "P1",
    ask: (ctx) => `${ctx.staff.label} is structuring the ${ctx.encounterDate} encounter for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) into SOAP sections. Where does each statement belong?`,
    lines: (ctx) => [
      { ref: "P1", section: "Dictation", text: `"Patient says the cough has been going three weeks and is worse at night. Chest clear on auscultation, temp 36.9. Likely post-viral cough. Reassess in two weeks if not settling."`, recordedBy: ctx.provider.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "P2", section: "Section rules", text: `the sections stated for this scenario are strict: Subjective holds only what the patient reports, Objective only what the clinician measured or observed, Assessment the clinician's interpretation, and Plan the intended next step, and nothing may appear in two sections`, decisive: true },
      { ref: "P3", section: "Chart", text: `${ctx.provider.label} (${ctx.provider.role}) is the author and will sign the note.`, decisive: false }
    ],
    gold: (ctx) => `Place the three-week night-worse cough in Subjective because the patient reported it; the clear chest and the temperature in Objective because the clinician measured them; "likely post-viral cough" in Assessment because it is the clinician's interpretation; and the two-week reassessment in Plan. Do not repeat the cough in Objective, and do not move the assessment upward into Objective — an interpretation is not an observation.`,
    acceptance: (ctx) => [
      { requirement: `Assigns each of the four statements to exactly one section, citing the stated rules.`, evidenceRef: "P2" },
      { requirement: `Keeps the reported cough out of Objective and the interpretation out of Objective.` },
      { requirement: `Attributes the assessment and plan to the clinician rather than to the assistant.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Cough to Subjective; clear chest and temperature to Objective; "likely post-viral cough" to Assessment; two-week reassessment to Plan, with nothing duplicated.`, why: `Correct: each statement lands in the one section its origin supports.` }),
      wrong: (ctx) => [
        { text: `Put the cough in both Subjective and Objective so the note reads completely in either section.`, why: `The rules forbid duplication, and a reported symptom in Objective reads as an examination finding.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Put "likely post-viral cough" in Objective, since the clear chest supports it.`, why: `Support is not observation. Moving an interpretation into Objective makes a judgement look like a measurement.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Leave the dictation as one paragraph and let ${ctx.provider.label} divide it at signing.`, why: `The task is the structuring, and an unsectioned note is what the rules exist to prevent.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "which of the four statements the clinician measured rather than was told",
    contradiction: "the dictation attributes the temperature to the patient's home thermometer",
    redFlag: "I've been coughing up blood the last two mornings as well.",
    prerequisite: "The clinician's signature on the structured note",
    consequence: "A later reader treated the reported cough as an examination finding and cited it as objective evidence."
  },
  {
    templateId: "KB-VART-KB002-000008",
    operatorIds: EASY_OPS,
    taskType: "PRIVACY_JUDGMENT",
    recordType: "COMMUNICATION_EVENT",
    modules: ["M12"],
    competencies: ["KB-D10"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "Privacy and disclosure boundaries",
    scenarioType: "CALLER_AUTHORITY_UNESTABLISHED",
    baseDifficulty: "EASY",
    ownerRole: "front-desk coordinator",
    privacyBaseline: true,
    errorTargets: ["KB-ERR-PRIVACY-FAILURE"],
    trapTypes: ["TRAP_HELPFUL_OVERDISCLOSURE"],
    decisiveRef: "V2",
    secondaryRef: "V1",
    ask: (ctx) => `A caller asks ${ctx.staff.label} for the result of ${ctx.patient.label}'s recent test. What may be disclosed on this call?`,
    lines: (ctx) => [
      { ref: "V1", section: "Call", text: `Caller states they are ${ctx.patient.label}'s adult child, gives the patient's name and date of birth correctly, and says the patient asked them to ring.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "V2", section: "Chart", text: `the chart holds no authorisation naming this caller, and the practice's stated rule for this scenario is that knowing a patient's details identifies a caller but never establishes their authority to receive information`, decisive: true },
      { ref: "V3", section: "Chart", text: `A result from ${ctx.encounterDate} is on file and has been reviewed by ${ctx.provider.label}.`, decisive: false }
    ],
    gold: (ctx) => `Disclose nothing about the result, including whether one exists. Explain that no authorisation naming the caller is on file and that correct patient details do not establish authority. Offer the routes that do: the patient calling themselves, or an authorisation being added to the chart. Record the request, what was withheld and why. Do not confirm that a result is available, and do not disclose on the strength of the caller's relationship or the patient's reported request.`,
    acceptance: (ctx) => [
      { requirement: `Withholds the result and the existence of a result, citing the absent authorisation.`, evidenceRef: "V2" },
      { requirement: `Distinguishes identifying the caller from establishing their authority.` },
      { requirement: `Offers a route that would make disclosure proper, and records the request and the refusal.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Withhold everything about the result, explain that no authorisation names this caller, and offer the routes that would make disclosure proper.`, why: `Correct: identity was established, authority was not, and a disclosure cannot be recalled.` }),
      wrong: (ctx) => [
        { text: `Confirm a result is on file and say ${ctx.provider.label} has reviewed it, without giving the value.`, why: `That the test happened and has been reviewed is itself information about the patient, and no authority exists to give it.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" },
        { text: `Disclose the result: the caller answered both identifiers correctly and says the patient asked them to call.`, why: `Correct identifiers identify the caller; they are not an authorisation. The patient's reported request is unverified.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" },
        { text: `Tell the caller the practice never discusses results by telephone and end the call.`, why: `The channel is not the obstacle, and a false general rule strands a request that a proper authorisation would answer.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "whether any authorisation on file names this caller",
    contradiction: "an authorisation exists naming a different relative with the same surname",
    redFlag: "They told me they've been too dizzy to stand today, which is why I'm calling.",
    prerequisite: "An authorisation on file naming the caller",
    consequence: "The result was discussed with a relative the patient had not authorised, and the patient complained."
  },

  {
    templateId: "KB-VART-KB002-000009",
    operatorIds: EASY_OPS,
    taskType: "CLOSED_LOOP_COMMUNICATION",
    recordType: "COMMUNICATION_EVENT",
    modules: ["M06", "M13"],
    competencies: ["KB-D11"],
    evidenceBasis: SELF,
    packetKind: "MESSAGE_THREAD",
    domain: "Closed-loop coordination",
    scenarioType: "TRANSMISSION_UNCONFIRMED",
    baseDifficulty: "EASY",
    ownerRole: "referral coordinator",
    errorTargets: ["KB-ERR-OPEN-LOOP"],
    trapTypes: ["TRAP_SEND_AND_ASSUME"],
    decisiveRef: "T2",
    secondaryRef: "T1",
    ask: (ctx) => `${ctx.staff.label} faxed a referral for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) two days ago. Is the task finished?`,
    lines: (ctx) => [
      { ref: "T1", section: "Send log", text: `Fax transmitted ${ctx.encounterDate} to ${ctx.provider.label}'s office; the machine log records the send as successful.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "T2", section: "Workflow", text: `the loop stated for this scenario closes only when the receiving office confirms it holds the packet, and a successful transmission log records that a machine accepted the pages rather than that anyone received them`, decisive: true },
      { ref: "T3", section: "Thread", text: `No acknowledgement from the receiving office appears in the thread.`, decisive: false }
    ],
    gold: (ctx) => `The task is not finished. Distinguish a successful transmission from a confirmed receipt: the log shows the pages were accepted by a machine, and nothing shows a person holds them. Contact the receiving office for confirmation, record who confirmed and when, and keep the item open until then. Do not close it on the transmission log, and do not wait indefinitely for an acknowledgement that may never come.`,
    acceptance: (ctx) => [
      { requirement: `Separates a successful send from a confirmed receipt, citing the stated definition.`, evidenceRef: "T2" },
      { requirement: `Names the action that closes the loop and who will confirm it.` },
      { requirement: `Keeps the item open, rather than closing it or leaving it unattended.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Contact the office for confirmation, record who confirmed and when, and keep the item open until then.`, why: `Correct: confirmation of receipt is what closes the loop, and it must be attributed.` }),
      wrong: (ctx) => [
        { text: `Close the item: the fax log records a successful transmission.`, why: `A transmission log reports what the machine did. It is the exact evidence the stated definition rules insufficient.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Re-send the fax now, since no acknowledgement has arrived.`, why: `Re-sending duplicates the packet without establishing whether the first arrived, and the office still confirms nothing.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Leave the item open and wait for the office to acknowledge in the thread.`, why: `Waiting is not closing. Nothing here obliges the office to acknowledge unprompted.`, trapType: "TRAP_QUEUE_ORDER" }
      ]
    },
    missingFact: "whether the receiving office has confirmed it holds the packet",
    contradiction: "the receiving office states it never received a fax on that date",
    redFlag: "The symptom that referral is for has got a lot worse while I've been waiting.",
    prerequisite: "The receiving office's confirmation of receipt",
    consequence: "The packet was never received and the referral sat unbooked for a month."
  },
  {
    templateId: "KB-VART-KB002-000010",
    operatorIds: EASY_OPS,
    taskType: "IMAGING_ORDER_VALIDATION",
    recordType: "WORKFLOW",
    modules: ["M07"],
    competencies: ["KB-D06"],
    evidenceBasis: SELF,
    packetKind: "IMAGING_ORDER",
    domain: "Radiology and diagnostic orders",
    scenarioType: "ORDER_FIELD_INCOMPLETE",
    baseDifficulty: "EASY",
    ownerRole: "scheduling coordinator",
    errorTargets: ["KB-ERR-OMISSION"],
    trapTypes: ["TRAP_MOST_SPECIFIC_SOUNDING"],
    decisiveRef: "G2",
    secondaryRef: "G1",
    ask: (ctx) => `${ctx.staff.label} is booking an imaging study for ${ctx.patient.label} (MRN ${ctx.patient.mrn}). Can the order be scheduled as written?`,
    lines: (ctx) => [
      { ref: "G1", section: "Order", text: `${ctx.provider.label} orders a knee radiograph with the indication "persistent pain after a fall", and the order is signed and dated ${ctx.encounterDate}.`, decisive: false },
      { ref: "G2", section: "Order", text: `the laterality field is blank, and the imaging department's stated intake rule for this scenario will not schedule a limb study without a side`, decisive: true },
      { ref: "G3", section: "Note", text: `The ${ctx.encounterDate} note's history mentions a fall onto the left side; its examination section records findings for the right knee.`, decisive: false }
    ],
    gold: (ctx) => `Do not schedule. State that laterality is blank and that the department will not accept a limb study without it. Note that the record points both ways — the history mentions a left-sided fall, the examination records the right knee — so the chart cannot settle it either. Return the order to ${ctx.provider.label} for the side to be specified. Do not choose the side the examination suggests, and do not book both knees to cover the ambiguity.`,
    acceptance: (ctx) => [
      { requirement: `Names the blank laterality field and the intake rule that blocks scheduling.`, evidenceRef: "G2" },
      { requirement: `States that the note points both ways and therefore cannot supply the side.` },
      { requirement: `Returns the order to the ordering clinician rather than resolving the side locally.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Return the order to ${ctx.provider.label} for the side to be specified, noting that the note points both ways.`, why: `Correct: only the ordering clinician can supply laterality, and the chart is genuinely ambiguous.` }),
      wrong: (ctx) => [
        { text: `Book the right knee, since the examination section records findings there.`, why: `An examination finding is not the ordered side, and the history points the other way. This is the trap.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Book the left knee, since the history describes a fall onto the left side.`, why: `A mechanism of injury is not an order. Choosing either side here is the same error.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Book both knees so the study covers whichever side was intended.`, why: `It orders imaging nobody requested and substitutes the coordinator's judgement for the clinician's.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "which knee the study is for",
    contradiction: "the order form and the note name different sides",
    redFlag: "The knee has gone numb below it since yesterday and I can't put weight on it.",
    prerequisite: "The ordering clinician's specification of laterality",
    consequence: "The wrong knee was imaged and the patient returned for a second study."
  },
  {
    templateId: "KB-VART-KB002-000011",
    operatorIds: EASY_OPS,
    taskType: "CHART_EXTRACTION",
    recordType: "QUESTION",
    modules: ["M02", "M04"],
    competencies: ["KB-D04"],
    evidenceBasis: SELF,
    packetKind: "CHART_EXCERPT",
    domain: "Pertinent chart extraction",
    scenarioType: "PERTINENCE_TO_A_QUESTION",
    baseDifficulty: "EASY",
    ownerRole: "clinical documentation assistant",
    errorTargets: ["KB-ERR-OMISSION", "KB-ERR-INCORRECT-PRIORITIZATION"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "X2",
    secondaryRef: "X1",
    ask: (ctx) => `${ctx.provider.label} has asked for the chart entries pertinent to a swallowing complaint for ${ctx.patient.label} (MRN ${ctx.patient.mrn}). Which entries are pertinent?`,
    lines: (ctx) => [
      { ref: "X1", section: "Problem list", text: `Active problems: hypertension, osteoarthritis of the hands, seasonal rhinitis.`, decisive: false },
      { ref: "X2", section: "History", text: `an entry dated ${ctx.encounterDate} records difficulty swallowing solids for six weeks with unintended weight loss, and no other entry in the record mentions swallowing at all`, decisive: true },
      { ref: "X3", section: "Medications", text: `Three active medications, none started in the last year.`, decisive: false }
    ],
    gold: (ctx) => `Extract the ${ctx.encounterDate} history entry: it is the only entry that addresses swallowing, and it carries both the duration and the unintended weight loss. State explicitly that the problem list and the medication list contain nothing pertinent to the question, rather than omitting them silently. Do not pad the extraction with the active problems because they are the most prominent entries, and do not drop the weight loss: it travels with the complaint.`,
    acceptance: (ctx) => [
      { requirement: `Extracts the swallowing entry with both its duration and the unintended weight loss.`, evidenceRef: "X2" },
      { requirement: `States that the problem list and medications hold nothing pertinent, rather than omitting that finding.` },
      { requirement: `Does not include unrelated active problems as though they were pertinent.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `The ${ctx.encounterDate} swallowing entry with its duration and weight loss; nothing on the problem or medication list is pertinent.`, why: `Correct: pertinence is set by the question asked, and the absence of other entries is itself a finding.` }),
      wrong: (ctx) => [
        { text: `The three active problems, since they are the chart's standing clinical summary.`, why: `Prominence is not pertinence. None of the three addresses swallowing.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `The swallowing entry, trimmed to the complaint so the extraction stays focused.`, why: `Trimming drops the unintended weight loss, which is part of the same entry and changes how it reads.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `The whole record, so the clinician can judge pertinence themselves.`, why: `That returns the task unperformed, and extraction exists precisely to spare the clinician that.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "whether any entry other than the history note mentions swallowing",
    contradiction: "a second entry records swallowing as resolved at an earlier visit",
    redFlag: "Food has started sticking and I've lost about a stone without trying.",
    prerequisite: "The clinician's review of the extracted entries",
    consequence: "The weight loss was left out of the extraction and the referral was booked as routine."
  },
  {
    templateId: "KB-VART-KB002-000012",
    operatorIds: EASY_OPS,
    taskType: "ERROR_HUNT",
    recordType: "QUESTION",
    modules: ["M14", "M02"],
    competencies: ["KB-D01"],
    evidenceBasis: SELF,
    packetKind: "CHART_EXCERPT",
    domain: "Error taxonomy",
    scenarioType: "WRONG_ENCOUNTER_FILING",
    baseDifficulty: "EASY",
    ownerRole: "records clerk",
    errorTargets: ["KB-ERR-WRONG-ENCOUNTER"],
    trapTypes: ["TRAP_LATEST_NOTE_WINS"],
    decisiveRef: "E2",
    secondaryRef: "E1",
    ask: (ctx) => `${ctx.staff.label} is checking a filing for ${ctx.patient.label} (MRN ${ctx.patient.mrn}). What is wrong, and what is the defensible correction?`,
    lines: (ctx) => [
      { ref: "E1", section: "Encounters", text: `Two encounters exist for this patient: ${ctx.encounterDate} with ${ctx.provider.label}, and ${ctx.scheduledDate} with the same clinician.`, decisive: false },
      { ref: "E2", section: "Document", text: `a wound-check note describing a dressing change is filed against the ${ctx.encounterDate} encounter, and the note's own body states the dressing was changed on ${ctx.scheduledDate}`, decisive: true },
      { ref: "E3", section: "Policy", text: `${ctx.practice}'s stated records policy for this scenario permits a mis-filing to be corrected only by the records owner, with the original filing retained in the audit trail.`, decisive: false }
    ],
    gold: (ctx) => `Report a wrong-encounter filing: the note's own body dates the dressing change to ${ctx.scheduledDate} while it sits against the ${ctx.encounterDate} encounter. Refer it to the records owner for correction under the stated policy, with the original filing retained in the trail. Do not move the note yourself, and do not change the date inside the note so it matches the encounter it is filed against — that would make the document agree with the error.`,
    acceptance: (ctx) => [
      { requirement: `Names the mismatch between the note's internal date and the encounter it is filed against.`, evidenceRef: "E2" },
      { requirement: `Refers the correction to the records owner, retaining the original filing.` },
      { requirement: `Does not alter the note's content to resolve the mismatch.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Report it as a wrong-encounter filing and refer it to the records owner, retaining the original filing in the trail.`, why: `Correct: the defect is the filing, and the stated policy reserves the correction to the owner.` }),
      wrong: (ctx) => [
        { text: `Edit the date inside the note to ${ctx.encounterDate} so it matches the encounter it is filed against.`, why: `That edits clinical content to fit a filing error, which destroys the evidence of the error.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Re-file the note against the ${ctx.scheduledDate} encounter now, since that is plainly where it belongs.`, why: `The destination is right and the authority is not: the policy reserves the correction to the records owner.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Accept the filing: the most recent entry against an encounter governs what it contains.`, why: `No such rule is stated, and it would make any mis-filing self-justifying.`, trapType: "TRAP_LATEST_NOTE_WINS" }
      ]
    },
    missingFact: "which encounter the dressing change actually belongs to",
    contradiction: "the note's body carries two different dates for the dressing change",
    redFlag: "The wound has started smelling and I've been feverish since the dressing change.",
    prerequisite: "The records owner's authority to re-file the note",
    consequence: "The note stayed on the wrong encounter and a payer review found the visit undocumented."
  },
  {
    templateId: "KB-VART-KB002-000013",
    operatorIds: EASY_OPS,
    taskType: "HANDOFF",
    recordType: "COMMUNICATION_EVENT",
    modules: ["M13"],
    competencies: ["KB-D11"],
    evidenceBasis: SELF,
    packetKind: "HANDOFF_STATE",
    domain: "Handoffs and team coordination",
    scenarioType: "SHIFT_CHANGE_OPEN_ITEM",
    baseDifficulty: "EASY",
    ownerRole: "front-desk coordinator",
    errorTargets: ["KB-ERR-OPEN-LOOP", "KB-ERR-OMISSION"],
    trapTypes: ["TRAP_SEND_AND_ASSUME"],
    decisiveRef: "H2",
    secondaryRef: "H1",
    ask: (ctx) => `${ctx.staff.label}'s shift ends in ten minutes. What must the handoff for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) contain?`,
    lines: (ctx) => [
      { ref: "H1", section: "Open items", text: `One open item: a callback promised to the patient today about the ${ctx.encounterDate} referral, not yet made.`, recordedBy: ctx.staff.label, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "H2", section: "Handoff rule", text: `the handoff format stated for this scenario requires each open item to name what was promised, to whom, by when, what has been done, and the person accepting it, and an item with no named acceptor is not handed off`, decisive: true },
      { ref: "H3", section: "Staffing", text: `${ctx.provider.label} is in clinic; the incoming coordinator starts in fifteen minutes.`, decisive: false }
    ],
    gold: (ctx) => `Write the item out in full: the callback promised to ${ctx.patient.label} today about the ${ctx.encounterDate} referral, that it has not been made, and what remains to be said. Then get the incoming coordinator to accept it by name, because the stated format treats an unaccepted item as not handed off. If the shift ends before they arrive, the item goes to a named person who is present, not into a shared list. Do not leave it in a queue and do not mark it handed off without an acceptor.`,
    acceptance: (ctx) => [
      { requirement: `States the promise, the recipient, the deadline and what has been done so far.`, evidenceRef: "H2" },
      { requirement: `Names the person accepting the item, rather than leaving it in a shared queue.` },
      { requirement: `Provides for the case where the incoming coordinator has not yet arrived.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Write the item out in full and have a named person accept it before the shift ends.`, why: `Correct: the stated format makes acceptance by a named person the thing that completes a handoff.` }),
      wrong: (ctx) => [
        { text: `Add the callback to the shared open-items list for the incoming shift to pick up.`, why: `A shared list names no acceptor, which the stated format treats as not handed off.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Leave a note on the incoming coordinator's desk with the patient's name and number.`, why: `A note is not an acceptance, and it omits what was promised and by when.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Make the callback now, whatever else is outstanding, so nothing needs handing off.`, why: `It may not be possible in ten minutes, and it treats the handoff rule as avoidable rather than as the safeguard.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "who is accepting the open item at the shift change",
    contradiction: "the open-items list records the callback as already made",
    redFlag: "When you call back — the pain has spread into my jaw since this morning.",
    prerequisite: "A named incoming coordinator to accept the item",
    consequence: "The callback was never made and the patient learned of the referral delay a fortnight later."
  },

  {
    templateId: "KB-VART-KB002-000014",
    operatorIds: EASY_OPS,
    taskType: "DOCUMENTATION_CORRECTION",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M04", "M14"],
    competencies: ["KB-D05", "KB-D12"],
    evidenceBasis: SELF,
    packetKind: "SOAP_NOTE",
    domain: "Documentation correction",
    scenarioType: "COPY_FORWARD_CONTAMINATION",
    baseDifficulty: "EASY",
    ownerRole: "clinical documentation assistant",
    errorTargets: ["KB-ERR-DOCUMENTATION-CONTAMINATION", "KB-ERR-PROVENANCE-LOSS"],
    trapTypes: ["TRAP_CARRY_FORWARD_UNATTRIBUTED"],
    decisiveRef: "D2",
    secondaryRef: "D1",
    ask: (ctx) => `A draft note for ${ctx.patient.label}'s ${ctx.encounterDate} visit is ready for ${ctx.staff.label} to check. What needs correcting?`,
    lines: (ctx) => [
      { ref: "D1", section: "Draft note", text: `The objective section reads "ankle swelling improved, dressing dry" and the plan reads "continue current dressing, review in one week".`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "D2", section: "Encounter", text: `this encounter was a telephone review with no examination, and the objective wording was carried forward unchanged from the previous in-person visit`, decisive: true },
      { ref: "D3", section: "Prior note", text: `The previous in-person note carries the identical objective sentence.`, decisive: false }
    ],
    gold: (ctx) => `Remove the carried-forward objective findings. State that no examination took place on this telephone encounter, so "swelling improved, dressing dry" cannot be recorded as observed here, and that the identical sentence in the prior note shows where it came from. Replace the section with what the encounter actually establishes — what the patient reported by telephone, marked as reported — and refer the plan to ${ctx.provider.label} for confirmation. Do not keep the wording because it is probably still accurate, and do not simply add a note that the visit was by telephone while leaving the findings in place.`,
    acceptance: (ctx) => [
      { requirement: `Identifies the objective findings as carried forward from a visit with no examination on this encounter.`, evidenceRef: "D2" },
      { requirement: `Removes them rather than annotating around them, and records what the encounter does establish.` },
      { requirement: `Refers the plan to the clinician rather than confirming it.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Remove the carried-forward findings, record only what the patient reported by telephone, and refer the plan to ${ctx.provider.label}.`, why: `Correct: an unexamined encounter cannot carry examination findings, whatever their likely accuracy.` }),
      wrong: (ctx) => [
        { text: `Keep the wording and add a line noting the encounter was by telephone.`, why: `The findings still read as observed. A disclaimer elsewhere in the note does not un-record them.`, trapType: "TRAP_CARRY_FORWARD_UNATTRIBUTED" },
        { text: `Keep the wording: the previous visit was recent and the findings are very likely unchanged.`, why: `Likelihood is not observation, and this is the definition of documentation contamination.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Delete the whole objective section and leave it empty without comment.`, why: `An unexplained empty section loses the fact that something was removed and why.`, trapType: "TRAP_SILENT_RECONCILIATION" }
      ]
    },
    missingFact: "whether any examination took place at this encounter",
    contradiction: "the encounter record shows both a telephone review and an in-person examination on the same date",
    redFlag: "The ankle is hot and I've been shivery since yesterday.",
    prerequisite: "The clinician's confirmation of the plan",
    consequence: "The telephone note was cited as evidence the wound had been examined that week."
  },
  {
    templateId: "KB-VART-KB002-000015",
    operatorIds: EASY_OPS,
    taskType: "SHORT_ANSWER",
    recordType: "QUESTION",
    modules: ["M05"],
    competencies: ["KB-D02"],
    evidenceBasis: SELF,
    packetKind: "CALL_TRANSCRIPT",
    domain: "Clinical terminology in context",
    scenarioType: "LAY_DESCRIPTION_TO_RECORD",
    baseDifficulty: "EASY",
    ownerRole: "triage nurse",
    errorTargets: ["KB-ERR-UNSUPPORTED-INFERENCE"],
    trapTypes: ["TRAP_MOST_SPECIFIC_SOUNDING"],
    decisiveRef: "L2",
    secondaryRef: "L1",
    ask: (ctx) => `${ctx.patient.label} (MRN ${ctx.patient.mrn}) describes a symptom by telephone. How should it be recorded?`,
    lines: (ctx) => [
      { ref: "L1", section: "Call", text: `The patient says: "My hands go dead white and then bright red when I come in from the cold, and they ache while they change."`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "L2", section: "Recording rule", text: `the rule stated for this scenario is that a lay description is recorded in the patient's own words with a neutral clinical summary of what was described, and that naming a condition is a clinical determination this role may not make`, decisive: true },
      { ref: "L3", section: "Chart", text: `No prior entry records any colour change in the hands.`, decisive: false }
    ],
    gold: (ctx) => `Record the patient's own words, then a neutral summary: colour change in both hands on cold exposure, white then red, with aching during the change, and no prior entry on record. Route it to ${ctx.provider.label} for interpretation. Do not name a condition that fits the description, and do not compress the account into a single clinical term that discards the sequence and the aching.`,
    acceptance: (ctx) => [
      { requirement: `Keeps the patient's own words and adds a neutral summary that preserves the sequence and the ache.`, evidenceRef: "L2" },
      { requirement: `Names no condition and records that no prior entry exists.` },
      { requirement: `Routes it to the clinician for interpretation.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `The patient's words plus a neutral summary of the colour change, sequence and ache, routed to ${ctx.provider.label}; no condition named.`, why: `Correct: it records what was described without converting a description into a diagnosis.` }),
      wrong: (ctx) => [
        { text: `Record the described colour change under the condition it most closely matches, so the clinician can see the likely cause.`, why: `Naming the condition is the determination this role may not make, however good the match looks.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Record "colour change in hands" alone, since the detail belongs in the clinician's own history.`, why: `Compressing it discards the sequence and the ache, which is the part that makes the account informative.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Record the words verbatim only, with no summary, so nothing is interpreted.`, why: `The stated rule asks for both. A neutral summary is not an interpretation of cause.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "whether any prior entry records a colour change in the hands",
    contradiction: "a prior entry records the colour change as investigated and explained",
    redFlag: "One fingertip has gone black at the end and it's not coming back.",
    prerequisite: "The clinician's interpretation of the described symptom",
    consequence: "A named condition was recorded from the description and carried forward as an established diagnosis."
  },
  {
    templateId: "KB-VART-KB002-000016",
    operatorIds: EASY_OPS,
    taskType: "SEQUENCING",
    recordType: "WORKFLOW",
    modules: ["M02", "M03"],
    competencies: ["KB-D01", "KB-D11"],
    evidenceBasis: SELF,
    packetKind: "CHART_EXCERPT",
    domain: "Intake sequencing",
    scenarioType: "INTAKE_ORDER",
    baseDifficulty: "EASY",
    ownerRole: "patient access representative",
    errorTargets: ["KB-ERR-WRONG-PATIENT", "KB-ERR-INCORRECT-PRIORITIZATION"],
    trapTypes: ["TRAP_QUEUE_ORDER"],
    decisiveRef: "Q2",
    secondaryRef: "Q1",
    steps: (ctx) => [
      `Confirm the patient's identity on two identifiers against the chart header.`,
      `Confirm the encounter being opened is the ${ctx.encounterDate} slot with ${ctx.provider.label}.`,
      `Check that coverage on file is current for this encounter.`,
      `Record the reason the patient gives for the visit, in their words.`,
      `Hand the encounter to the clinical team with the open items named.`
    ],
    ask: (ctx) => `Put ${ctx.practice}'s intake steps for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) into the order the stated workflow requires.`,
    lines: (ctx) => [
      { ref: "Q1", section: "Workflow", text: `Intake covers identity, encounter selection, coverage, the reason for the visit, and the handoff to the clinical team.`, decisive: false },
      { ref: "Q2", section: "Workflow", text: `the order stated for this scenario is fixed: identity is confirmed before any encounter is opened, the encounter before coverage is checked against it, coverage before the visit reason is recorded into it, and the handoff last`, decisive: true },
      { ref: "Q3", section: "Front desk", text: `The waiting room is full and the clinical team has asked for the handoff as early as possible.`, decisive: false }
    ],
    gold: (ctx) => `Identity first, then the encounter, then coverage against that encounter, then the visit reason recorded into it, then the handoff. Each step depends on the one before: coverage cannot be checked against an encounter that has not been selected, and a reason recorded before identity is confirmed may land in the wrong chart. State that the clinical team's request for an early handoff does not reorder the sequence, because the handoff is what the earlier steps make safe.`,
    acceptance: (ctx) => [
      { requirement: `Produces the stated order and explains the dependency behind at least two adjacent steps.`, evidenceRef: "Q2" },
      { requirement: `States that identity precedes opening any encounter.` },
      { requirement: `Declines to move the handoff earlier despite the request to do so.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Identity, encounter, coverage, visit reason, handoff — in that order, with the handoff last.`, why: `Correct: it is the stated order, and each step supplies what the next one needs.` }),
      wrong: (ctx) => [
        { text: `Hand off to the clinical team first, then complete identity, encounter, coverage and the reason.`, why: `It hands over an encounter that has not been identified, which is how work lands in the wrong chart.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `Check coverage first, since a coverage problem would stop the visit anyway.`, why: `Coverage is checked against an encounter that has not yet been selected, so the check has no anchor.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Record the visit reason first while the patient is still describing it, then confirm identity.`, why: `A reason recorded before identity is confirmed may be written into the wrong chart.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "the order the stated workflow requires the intake steps to run in",
    contradiction: "the workflow states coverage is checked before the encounter is selected",
    redFlag: "I'm only here because the chest pain came back in the car park.",
    prerequisite: "Confirmed identity before an encounter is opened",
    consequence: "An intake completed out of order recorded a visit reason against another patient's encounter."
  },
  {
    templateId: "KB-VART-KB002-000017",
    operatorIds: EASY_OPS,
    taskType: "PRIOR_AUTHORIZATION",
    recordType: "WORKFLOW",
    modules: ["M11"],
    competencies: ["KB-D09"],
    evidenceBasis: SELF,
    packetKind: "AUTHORIZATION_ARTIFACT",
    domain: "Prior authorisation workflow",
    scenarioType: "AUTHORIZATION_VALIDITY_WINDOW",
    baseDifficulty: "EASY",
    ownerRole: "prior-authorisation specialist",
    payerSpecific: true,
    errorTargets: ["KB-ERR-PREMATURE-CLOSURE"],
    trapTypes: ["TRAP_STALE_AUTHORITY"],
    decisiveRef: "A2",
    secondaryRef: "A1",
    ask: (ctx) => `${ctx.staff.label} is checking authorisation before booking a procedure for ${ctx.patient.label} (MRN ${ctx.patient.mrn}). Can it be booked for ${ctx.scheduledDate}?`,
    lines: (ctx) => [
      { ref: "A1", section: "Authorisation", text: `${ctx.payer.label} authorisation on file for the requested procedure, approved and recorded as active, reference SYN-AUTH-4471.`, decisive: false },
      { ref: "A2", section: "Authorisation", text: `the authorisation's stated validity window for this scenario ends ${ctx.expiryDate}, and the requested date of ${ctx.scheduledDate} falls after it`, decisive: true },
      { ref: "A3", section: "Schedule", text: `${ctx.scheduledDate} is the first date the proceduralist has available.`, decisive: false }
    ],
    gold: (ctx) => `It cannot be booked for ${ctx.scheduledDate} on this authorisation. State that the authorisation, though marked active, expires ${ctx.expiryDate}, and the requested date falls outside the window. Either secure an extension or a new authorisation from ${ctx.payer.label} before booking, or find a date inside the window. Do not book on the strength of the active status, and do not book and pursue the authorisation afterwards.`,
    acceptance: (ctx) => [
      { requirement: `Identifies that the requested date falls outside the authorisation's validity window.`, evidenceRef: "A2" },
      { requirement: `Distinguishes an active status from cover for the requested date.` },
      { requirement: `Names the two defensible routes: a new or extended authorisation, or a date inside the window.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Do not book ${ctx.scheduledDate}: secure a new or extended authorisation, or use a date inside the window.`, why: `Correct: an active authorisation still only covers dates inside its window.` }),
      wrong: (ctx) => [
        { text: `Book it: the authorisation is on file and recorded as active.`, why: `Active status is not date cover. This is precisely the stale-authority trap.`, trapType: "TRAP_STALE_AUTHORITY" },
        { text: `Book ${ctx.scheduledDate} and request an extension from ${ctx.payer.label} in parallel.`, why: `It commits the patient to a date with no authorisation in force and shifts the risk onto them.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Book ${ctx.scheduledDate} under the existing reference, noting the window in the comments.`, why: `A comment does not extend a window, and the reference does not cover the date.`, trapType: "TRAP_STALE_AUTHORITY" }
      ]
    },
    missingFact: "the date the authorisation's validity window ends",
    contradiction: "the authorisation record shows two different expiry dates",
    redFlag: "The pain the procedure is for has got much worse and I'm not sleeping.",
    prerequisite: "An authorisation in force on the date of service",
    consequence: "The procedure went ahead outside the window and the authorisation was denied on review."
  },
  {
    templateId: "KB-VART-KB002-000018",
    operatorIds: EASY_OPS,
    taskType: "MCQ",
    recordType: "QUESTION",
    modules: ["M03", "M14"],
    competencies: ["KB-D03"],
    evidenceBasis: SELF,
    packetKind: "INBOX_QUEUE",
    domain: "Safety recognition in administrative material",
    scenarioType: "RED_FLAG_IN_ROUTINE_QUEUE",
    baseDifficulty: "EASY",
    ownerRole: "records clerk",
    safetyBaseline: true,
    errorTargets: ["KB-ERR-INCORRECT-ESCALATION", "KB-ERR-INCORRECT-PRIORITIZATION"],
    trapTypes: ["TRAP_QUEUE_ORDER"],
    decisiveRef: "N2",
    secondaryRef: "N1",
    ask: (ctx) => `${ctx.staff.label} is working an administrative inbox at ${ctx.practice}. What happens next?`,
    lines: (ctx) => [
      { ref: "N1", section: "Inbox", text: `Four items: two insurance card updates, one address change, and one inbound fax cover sheet from a pharmacy.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "N2", section: "Fax cover", text: `the pharmacy's cover sheet carries a handwritten line that the patient collecting a prescription said their face had drooped on one side that morning and their speech had gone slurred`, decisive: true },
      { ref: "N3", section: "Role", text: `This is an administrative queue. The role may not assess a symptom or decide how urgent it is.`, decisive: false }
    ],
    gold: (ctx) => `Stop working the queue and get the handwritten line to a named clinician immediately, ahead of every administrative item. Pass it on as written, with the patient's name, the time it was reported and the source, so the clinician has the words rather than a summary. Then record what was escalated, to whom and when. Do not finish the administrative items first, do not judge how urgent it is, and do not file the cover sheet as a pharmacy document.`,
    acceptance: (ctx) => [
      { requirement: `Escalates the handwritten line to a named clinician ahead of the administrative items.`, evidenceRef: "N2" },
      { requirement: `Passes the report on as written, with the source and time, rather than summarising it.` },
      { requirement: `Records the escalation and offers no assessment of urgency.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Escalate the handwritten line to a named clinician at once, as written and with its source, and record the escalation.`, why: `Correct: a volunteered report of new one-sided facial droop and slurred speech outranks every administrative item, and the role's task is to route it, not to rate it.` }),
      wrong: (ctx) => [
        { text: `Finish the three administrative items, which take a minute each, then escalate the fax.`, why: `It puts routine filing ahead of a volunteered account of new neurological symptoms.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `File the cover sheet with the pharmacy correspondence and flag it for the next clinical review.`, why: `Filing it defers the escalation into a queue with no named owner or time.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Telephone the patient to ask whether the symptoms are still present before escalating.`, why: `Triaging the report is a clinical judgement this role may not make, and it delays the escalation.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "which clinician is available to receive the escalation now",
    contradiction: "the cover sheet records the symptoms as having resolved before collection",
    redFlag: "Her face had drooped on one side and her speech had gone slurred that morning.",
    prerequisite: "A named clinician available to receive an urgent escalation",
    consequence: "The queue was finished first and the report reached a clinician the following morning."
  }

];
