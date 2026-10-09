// Template families, part C: handoff, orders, administrative, source-dependent
// and simulation families. See kb-templates-a.mjs for the contract.
//
// Two families here are EXTERNAL_AUTHORITY (privacy judgment and coding
// support). They assert something about the world, so they carry citations into
// the source registry and are generated at
// candidate_needs_source_verification. Nothing in this workstream opened those
// sources, and the records say so.
//
// The administrative families state payer and plan requirements as givens of a
// synthetic scenario. They carry the audit tag SYNTHETIC-GIVEN-POLICY and
// payerSpecific, and they test whether the responder reasons correctly from a
// stated rule — never whether they recall a real payer's policy.

const SELF = "SELF_CONTAINED";
const EXT = "EXTERNAL_AUTHORITY";

export const TEMPLATES_C = [
  {
    templateId: "KB-VART-KB001-000015",
    taskType: "HANDOFF",
    recordType: "COMMUNICATION_EVENT",
    modules: ["M13"],
    competencies: ["KB-D11", "KB-D02"],
    evidenceBasis: SELF,
    packetKind: "HANDOFF_STATE",
    domain: "Handoffs",
    scenarioType: "SHIFT_CHANGE",
    baseDifficulty: "MODERATE",
    ownerRole: "outgoing coordinator",
    errorTargets: ["KB-ERR-OMISSION", "KB-ERR-OPEN-LOOP"],
    trapTypes: ["TRAP_CARRY_FORWARD_UNATTRIBUTED"],
    decisiveRef: "Q2",
    secondaryRef: "Q1",
    ask: (ctx) => `${ctx.staff.label} is handing over at shift change at ${ctx.practice}. Compose the handoff for ${ctx.patient.label}'s open item.`,
    lines: (ctx) => [
      { ref: "Q1", section: "Open item", text: `A prior-authorisation request for ${ctx.patient.label} was submitted ${ctx.encounterDate}. The plan's stated turnaround for this scenario is three working days.`, decisive: false },
      { ref: "Q2", section: "Open item", text: `The item has a dependency the outgoing coordinator has not written down: the procedure is booked for ${ctx.scheduledDate}, and if the authorisation is not through by then the booking must be released rather than allowed to lapse silently.`, decisive: true },
      { ref: "Q3", section: "Handoff draft", text: `The draft handoff reads: "PA submitted, awaiting response."`, decisive: false }
    ],
    gold: (ctx) => `"Awaiting response" hands over a status, not a task. The handoff must carry what is outstanding, the date it is outstanding against (${ctx.scheduledDate}), what happens if it is not resolved by then — the booking is released, not left to lapse — who owns it now, and what the incoming coordinator should do next and when. Get an explicit acknowledgement from the incoming person rather than leaving the note and going. A handoff that omits the deadline and the consequence has handed over nothing that can be acted on.`,
    acceptance: (ctx) => [
      { requirement: `Carries the deadline date and the consequence of missing it.`, evidenceRef: "Q2" },
      { requirement: `Names the owner after the handoff and the specific next action.` },
      { requirement: `Obtains an explicit acknowledgement rather than leaving a note.`, evidenceRef: "Q3" },
      { requirement: `States the plan's stated turnaround against the elapsed time.`, evidenceRef: "Q1" }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hand over the outstanding item with its deadline, the release consequence, the named owner and the next action, and get an acknowledgement.`, why: `Correct: a handoff transfers a task with its deadline and consequence, and closes on acknowledgement.` }),
      wrong: (ctx) => [
        { text: `Hand over as drafted; the incoming coordinator can see the booking date in the system.`, why: `The dependency and the release rule are in nobody's note. Available in a system is not handed over.`, trapType: "TRAP_CARRY_FORWARD_UNATTRIBUTED" },
        { text: `Add the booking date to the note and leave it for the incoming coordinator to pick up.`, why: `Better, but the consequence and the owner are still missing and nobody has accepted it.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Chase the plan before leaving so the item can be handed over resolved.`, why: `The plan's turnaround has not elapsed and the item cannot be resolved now. It still needs handing over properly.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "the date the authorisation must be through by, and what happens if it is not",
    contradiction: "the booking date is after the authorisation's expiry, not before it",
    redFlag: "The pain has got a lot worse while I've been waiting for this approval.",
    prerequisite: "The plan's authorisation decision",
    consequence: "The authorisation did not arrive, the booking lapsed unreleased, and the slot was lost."
  },
  {
    templateId: "KB-VART-KB001-000016",
    taskType: "REFERRAL_PACKET_REVIEW",
    recordType: "DOCUMENTATION_TASK",
    modules: ["M06", "M04"],
    competencies: ["KB-D06", "KB-D04"],
    evidenceBasis: SELF,
    packetKind: "REFERRAL_PACKET",
    domain: "Referral packet review",
    scenarioType: "PACKET_QUALITY",
    baseDifficulty: "MODERATE",
    ownerRole: "referral coordinator",
    errorTargets: ["KB-ERR-OMISSION", "KB-ERR-PROVENANCE-LOSS"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "R2",
    secondaryRef: "R1",
    ask: (ctx) => `Review the outgoing referral packet for ${ctx.patient.label} before it leaves ${ctx.practice}.`,
    lines: (ctx) => [
      { ref: "R1", section: "Packet", text: `Cover sheet names the receiving service and the reason for referral. Demographics and insurance pages are current.`, decisive: false },
      { ref: "R2", section: "Packet", text: `The clinical summary is a copy-paste of the last three progress notes with no indication of which findings are current. Two of the three notes predate the change that prompted the referral, and nothing in the packet says which is the most recent.`, decisive: true },
      { ref: "R3", section: "Packet", text: `The referral question itself — what the referring clinician wants answered — is not stated anywhere.`, decisive: false }
    ],
    gold: (ctx) => `Two defects, both blocking. The clinical summary carries three undated-in-effect notes, so the receiving clinician cannot tell what is current — order it, date it, and mark which findings are current and which are historical. And the referral question is absent: a packet that does not say what is being asked invites the wrong assessment. Return the packet to ${ctx.provider.label} for the referral question, restructure the summary chronologically with provenance intact, and do not compress the three notes into a single undated paragraph.`,
    acceptance: (ctx) => [
      { requirement: `Identifies that the summary does not distinguish current from historical findings.`, evidenceRef: "R2" },
      { requirement: `Identifies the missing referral question as blocking.`, evidenceRef: "R3" },
      { requirement: `Restructures with dates and provenance rather than compressing.` },
      { requirement: `Returns the referral question to the referring clinician rather than composing one.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold the packet, restructure the summary chronologically with provenance, and obtain the referral question from ${ctx.provider.label}.`, why: `Correct: the receiving clinician needs to know what is current and what is being asked.` }),
      wrong: (ctx) => [
        { text: `Compress the three notes into one clean current-state paragraph and send.`, why: `That produces a tidy summary whose provenance is gone and whose currency cannot be checked.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Send as is; the receiving clinician can read the notes and form their own view.`, why: `They cannot tell which findings are current, and the referral question is still missing.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Write the referral question yourself from the reason on the cover sheet.`, why: `The referral question is the referring clinician's, and inferring it invites the wrong assessment.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "what the referring clinician wants the receiving service to answer",
    contradiction: "the cover sheet states the referral question in full",
    redFlag: "It's changed a lot since those notes — the numbness is in both hands now.",
    prerequisite: "The referring clinician's statement of the referral question",
    consequence: "The packet was sent and the receiving service assessed the historical problem."
  },
  {
    templateId: "KB-VART-KB001-000017",
    taskType: "MEDICATION_WORKFLOW_REVIEW",
    recordType: "WORKFLOW",
    modules: ["M09"],
    competencies: ["KB-D08", "KB-D12"],
    evidenceBasis: SELF,
    packetKind: "MEDICATION_LIST",
    domain: "Medication and refill workflow",
    scenarioType: "REFILL_AGAINST_STOPPED_DRUG",
    baseDifficulty: "MODERATE",
    ownerRole: "medication-refill coordinator",
    errorTargets: ["KB-ERR-CONTRADICTION-BLINDNESS", "KB-ERR-SCOPE-VIOLATION"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "S2",
    secondaryRef: "S1",
    ask: (ctx) => `A refill request for ${ctx.patient.label} (MRN ${ctx.patient.mrn}) is in the queue. Work the request.`,
    lines: (ctx) => [
      { ref: "S1", section: "Request", text: `Pharmacy fax requests a routine refill, quantity as before, for a medication on the patient's active list.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "S2", section: "Chart", text: `The most recent clinic note, signed by ${ctx.provider.label}, records that this medication was stopped at the last visit. The active medication list still shows it, and nobody removed it.`, decisive: true },
      { ref: "S3", section: "Chart", text: `A different medication was started at the same visit. The pharmacy's request does not mention it.`, decisive: false }
    ],
    gold: (ctx) => `Do not refill from the active list. The signed note says the medication was stopped and the list is stale, so the list and the note disagree about what the patient is taking. Hold the refill, surface both entries to ${ctx.provider.label}, and flag the second issue too: a medication was started that the pharmacy does not appear to know about. Do not remove the drug from the list yourself and do not tell the patient to stop taking it — both are clinical actions. Close the loop with the pharmacy once the clinician has decided.`,
    acceptance: (ctx) => [
      { requirement: `Refuses to refill on the active list where a signed note contradicts it.`, evidenceRef: "S2" },
      { requirement: `Routes the discrepancy to the prescriber rather than editing the list.` },
      { requirement: `Raises the newly started medication the pharmacy has not referenced.`, evidenceRef: "S3" },
      { requirement: `Closes the loop with the pharmacy after the clinical decision, not before.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold the refill, surface the stopped-versus-active conflict and the new medication to ${ctx.provider.label}, then close the loop with the pharmacy.`, why: `Correct: a stale list is not authority to dispense, and reconciliation is the prescriber's.` }),
      wrong: (ctx) => [
        { text: `Refill it: the medication is on the active list and the request is routine.`, why: `The active list is contradicted by a signed note. Refilling a stopped medication is the failure here.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Decline the refill and remove the medication from the active list so this cannot recur.`, why: `Declining is right; editing the medication list is a clinical action outside this role.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" },
        { text: `Decline the refill and tell the patient the medication was stopped and not to take it.`, why: `Relaying a stop instruction to a patient is clinical communication, and it has not been confirmed by the prescriber.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "whether the prescriber intends the medication to be stopped or continued",
    contradiction: "the clinic note records the medication as continued at the last visit",
    redFlag: "I stopped the old one and started the new one and now my heart's racing all the time.",
    prerequisite: "The prescriber's medication reconciliation",
    consequence: "The refill was dispensed and the patient took both the stopped and the new medication."
  },
  {
    templateId: "KB-VART-KB001-000018",
    taskType: "RESULT_ROUTING",
    recordType: "WORKFLOW",
    modules: ["M10", "M13"],
    competencies: ["KB-D08", "KB-D03"],
    evidenceBasis: SELF,
    packetKind: "RESULT_PACKET",
    domain: "Lab and imaging results workflow",
    scenarioType: "ROUTING_WITH_ABSENT_ORDERER",
    baseDifficulty: "MODERATE",
    ownerRole: "results coordinator",
    errorTargets: ["KB-ERR-INCORRECT-PRIORITIZATION", "KB-ERR-WRONG-DESTINATION"],
    trapTypes: ["TRAP_QUEUE_ORDER"],
    decisiveRef: "T2",
    secondaryRef: "T1",
    ask: (ctx) => `Route the results that arrived overnight for ${ctx.practice}.`,
    lines: (ctx) => [
      { ref: "T1", section: "Queue", text: `Eleven results arrived overnight. Nine are routine and flagged normal by the laboratory.`, decisive: false },
      { ref: "T2", section: "Queue", text: `Two carry a laboratory annotation that the ordering clinician should be notified promptly. One of those two is for ${ctx.patient.label}, ordered by a clinician who is on leave for two weeks. The other's orderer is in clinic today.`, decisive: true },
      { ref: "T3", section: "Queue", text: `The queue is sorted by arrival time, and the two annotated results are eighth and eleventh in that order.`, decisive: false }
    ],
    gold: (ctx) => `Do not work the queue in arrival order. Take the two annotated results first: route the one whose orderer is in clinic directly to them, and route the other to the named covering clinician rather than to the inbox of someone on leave for two weeks. Obtain an acknowledgement for both. Then work the nine routine results. Do not open, interpret or grade any result, and do not decide that an annotation is unimportant — the annotation is the laboratory's, not yours to overrule.`,
    acceptance: (ctx) => [
      { requirement: `Reorders the queue by the annotation rather than by arrival time.`, evidenceRef: "T3" },
      { requirement: `Routes the absent clinician's result to a named coverer, not to their inbox.`, evidenceRef: "T2" },
      { requirement: `Obtains acknowledgement for both annotated results.` },
      { requirement: `Interprets nothing and does not overrule the laboratory's annotation.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Take the two annotated results first, route the absent orderer's to a named coverer, get acknowledgements, then work the routine nine.`, why: `Correct: consequence sets the order, and an absent orderer needs a named coverer.` }),
      wrong: (ctx) => [
        { text: `Work the queue in arrival order so nothing is skipped, and flag the two annotated results as you reach them.`, why: `Arrival order is the wrong order. The two that need prompt notification sit eighth and eleventh.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `Route both annotated results to their ordering clinicians and move on.`, why: `One orderer is on leave for two weeks. Routing to that inbox is routing to nobody.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Open the two annotated results to judge which is genuinely urgent before routing.`, why: `Interpreting a result to triage it is outside scope, and the laboratory's annotation already settled the priority.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "who is covering for the clinician on leave",
    contradiction: "the laboratory annotation applies to only one of the two results",
    redFlag: "I've been getting worse since that blood test and now I'm passing almost no urine.",
    prerequisite: "The covering clinician's assignment for the two-week absence",
    consequence: "Both annotated results were routed in arrival order and one sat in an unattended inbox."
  },
  {
    templateId: "KB-VART-KB001-000019",
    taskType: "IMAGING_ORDER_VALIDATION",
    recordType: "QUESTION",
    modules: ["M07"],
    competencies: ["KB-D08", "KB-D01"],
    evidenceBasis: SELF,
    packetKind: "IMAGING_ORDER",
    domain: "Radiology and diagnostic orders",
    scenarioType: "ORDER_COMPLETENESS",
    baseDifficulty: "MODERATE",
    ownerRole: "imaging coordinator",
    errorTargets: ["KB-ERR-WRONG-ENCOUNTER", "KB-ERR-OMISSION"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "U2",
    secondaryRef: "U1",
    ask: (ctx) => `An imaging order for ${ctx.patient.label} is ready to transmit. What does the coordinator do?`,
    lines: (ctx) => [
      { ref: "U1", section: "Order", text: `Modality, region, patient identifiers and ordering clinician are all present and consistent with the chart.`, decisive: false },
      { ref: "U2", section: "Order", text: `The clinical indication field reads "as discussed". The imaging service's stated requirement for this scenario is a specific clinical indication, and the protocol chosen depends on it.`, decisive: true },
      { ref: "U3", section: "Chart", text: `Two encounters this month could be the one referred to. The order is not linked to either.`, decisive: false }
    ],
    gold: (ctx) => `Do not transmit. "As discussed" is not a clinical indication, the protocol depends on the indication, and the order is not linked to an encounter — so the reader cannot even establish which discussion is meant. Return the order to ${ctx.provider.label} for a specific indication and an encounter link. Do not infer the indication from either candidate encounter, and do not let the order go on the assumption the imaging service will call if it matters.`,
    acceptance: (ctx) => [
      { requirement: `Holds transmission on the indication, not on the identifiers.`, evidenceRef: "U2" },
      { requirement: `Names the unlinked encounter as a second defect.`, evidenceRef: "U3" },
      { requirement: `Returns it to the ordering clinician rather than inferring the indication.` },
      { requirement: `Notes that the protocol selection depends on the indication.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold the order and return it to ${ctx.provider.label} for a specific indication and an encounter link.`, why: `Correct: the protocol depends on the indication, and the encounter it refers to is ambiguous.` }),
      wrong: (ctx) => [
        { text: `Transmit it: identifiers and modality are correct, and the imaging service will call if the indication is insufficient.`, why: `The requirement is stated and the protocol depends on it. Relying on the receiver to catch it is not a check.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Fill the indication from the more recent of the two encounters and transmit.`, why: `That is inventing a clinical indication, and recency does not identify which discussion was meant.`, trapType: "TRAP_LATEST_NOTE_WINS" },
        { text: `Link the order to both encounters so the imaging service can see the full context.`, why: `Two encounters linked is not one encounter identified, and it leaves the indication still absent.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" }
      ]
    },
    missingFact: "the specific clinical indication, and which encounter the order belongs to",
    contradiction: "the indication field was completed in full at the time of ordering",
    redFlag: "The headaches are much worse and now my vision goes blurry with them.",
    prerequisite: "The ordering clinician's statement of the clinical indication",
    consequence: "The order was transmitted with no indication and the wrong protocol was performed."
  },
  {
    templateId: "KB-VART-KB001-000020",
    taskType: "INSURANCE_VERIFICATION",
    recordType: "WORKFLOW",
    modules: ["M11"],
    competencies: ["KB-D09", "KB-D01"],
    evidenceBasis: SELF,
    packetKind: "INSURANCE_ARTIFACT",
    domain: "Insurance and administrative workflow",
    scenarioType: "ELIGIBILITY_MISMATCH",
    baseDifficulty: "MODERATE",
    ownerRole: "billing specialist",
    payerSpecific: true,
    errorTargets: ["KB-ERR-WRONG-ENCOUNTER", "KB-ERR-OMISSION"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "V2",
    secondaryRef: "V1",
    ask: (ctx) => `Verify coverage for ${ctx.patient.label}'s appointment on ${ctx.scheduledDate}.`,
    lines: (ctx) => [
      { ref: "V1", section: "Card on file", text: `Card image shows ${ctx.payer.label}, plan ${ctx.payer.planId}, subscriber name matching the patient. Captured ${ctx.encounterDate}.`, decisive: false },
      { ref: "V2", section: "Eligibility response", text: `The eligibility response for ${ctx.scheduledDate} returns the patient as active under a different plan with the same payer, with a different cost-sharing structure. In this scenario the plan change is stated as effective before the appointment date.`, decisive: true },
      { ref: "V3", section: "Scheduling", text: `The patient was quoted a cost at booking, based on the card on file.`, decisive: false }
    ],
    gold: (ctx) => `The card on file is not the coverage in force on the appointment date. Verify against the eligibility response for ${ctx.scheduledDate}, not against the card image: the plan has changed and the cost-sharing with it. Update the coverage record, re-derive the estimate under the plan actually in force, and tell the patient before the appointment that the quote has changed and why. Do not bill under the card on file, and do not treat the quoted figure as committed because it was given first.`,
    acceptance: (ctx) => [
      { requirement: `Verifies against the eligibility response for the appointment date rather than the card image.`, evidenceRef: "V2" },
      { requirement: `Re-derives the estimate under the plan actually in force.` },
      { requirement: `Informs the patient before the appointment that the quote has changed.`, evidenceRef: "V3" },
      { requirement: `Does not bill under the superseded card on file.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Verify against the eligibility response for the appointment date, update coverage, re-quote, and tell the patient before the visit.`, why: `Correct: coverage is what is in force on the date of service, and a changed quote is the patient's to hear early.` }),
      wrong: (ctx) => [
        { text: `Use the card on file: it is the patient's own document and the payer is the same.`, why: `Same payer, different plan and different cost-sharing. The card records what was true when it was captured.`, trapType: "TRAP_STALE_AUTHORITY" },
        { text: `Update the coverage record and let the patient find out at check-in.`, why: `The update is right and the silence is not. The patient was quoted a figure that no longer holds.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Honour the quoted figure, since the patient was told it at booking.`, why: `The quote is not yours to guarantee against a plan you have now confirmed is different.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "which plan is in force on the date of service and what its cost-sharing is",
    contradiction: "the eligibility response confirms the plan on the card on file",
    redFlag: "I've been putting off coming in because of the cost and the chest pain is worse.",
    prerequisite: "The plan's eligibility confirmation for the date of service",
    consequence: "The visit was billed under the superseded plan and the patient received an unexpected balance."
  },
  {
    templateId: "KB-VART-KB001-000021",
    taskType: "PRIOR_AUTHORIZATION",
    recordType: "WORKFLOW",
    modules: ["M11", "M06"],
    competencies: ["KB-D09"],
    evidenceBasis: SELF,
    packetKind: "AUTHORIZATION_ARTIFACT",
    domain: "Prior authorization workflow",
    scenarioType: "AUTHORIZATION_SCOPE",
    baseDifficulty: "MODERATE",
    ownerRole: "authorization coordinator",
    payerSpecific: true,
    errorTargets: ["KB-ERR-UNSUPPORTED-INFERENCE", "KB-ERR-INCORRECT-PRIORITIZATION"],
    trapTypes: ["TRAP_MOST_SPECIFIC_SOUNDING"],
    decisiveRef: "W2",
    secondaryRef: "W1",
    ask: (ctx) => `An authorisation is on file for ${ctx.patient.label}. Decide whether the booked procedure is covered by it.`,
    lines: (ctx) => [
      { ref: "W1", section: "Authorisation", text: `${ctx.payer.label} authorisation on file, reference SYN-AUTH-8841, valid ${ctx.encounterDate} to ${ctx.expiryDate}, for a named procedure at a named facility.`, decisive: false },
      { ref: "W2", section: "Booking", text: `The procedure booked is a different procedure at the same facility. It is clinically adjacent and the authorisation does not name it. In this scenario the plan's stated rule is that an authorisation covers only the procedure named on it.`, decisive: true },
      { ref: "W3", section: "Booking", text: `The booking is in four days. The plan's stated turnaround for a new request is five working days.`, decisive: false }
    ],
    gold: (ctx) => `The authorisation does not cover the booked procedure, and clinical adjacency is not coverage. State that the authorisation names a different procedure, that the plan's stated rule limits it to the procedure named, and that a new request is needed. Then deal with the timing rather than hoping: the turnaround exceeds the time to the booking, so raise the new request now, tell the scheduler and the patient the booking is at risk, and ask the plan about expedited handling. Do not proceed on the existing authorisation and do not let the patient arrive unwarned.`,
    acceptance: (ctx) => [
      { requirement: `States that the authorisation does not cover the booked procedure, citing the stated rule.`, evidenceRef: "W2" },
      { requirement: `Raises a new request rather than proceeding on adjacency.` },
      { requirement: `Compares the turnaround against the days to the booking and acts on the gap.`, evidenceRef: "W3" },
      { requirement: `Warns the scheduler and the patient that the booking is at risk.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Raise a new request now, ask about expedited handling, and warn the scheduler and patient that the booking is at risk.`, why: `Correct: an authorisation covers what it names, and four days against a five-day turnaround is a risk to state, not to absorb.` }),
      wrong: (ctx) => [
        { text: `Proceed on the existing authorisation: same facility, same payer, clinically adjacent procedure.`, why: `The stated rule limits the authorisation to the procedure named. Adjacency is the trap.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Raise the new request and wait for the decision before telling anyone the booking is at risk.`, why: `The turnaround already exceeds the time available. Waiting to mention it removes everyone's chance to act.`, trapType: "TRAP_SEND_AND_ASSUME" },
        { text: `Move the booking out by two weeks so the standard turnaround fits.`, why: `Rescheduling a clinical procedure to suit an administrative timeline is not this role's decision to take alone.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "whether the plan will authorise the booked procedure, and in what timeframe",
    contradiction: "the authorisation names the booked procedure as well",
    redFlag: "I can't manage at home any more while I wait for this to be approved.",
    prerequisite: "The plan's authorisation for the procedure actually booked",
    consequence: "The procedure went ahead on the wrong authorisation and the claim was denied."
  },
  {
    templateId: "KB-VART-KB001-000022",
    taskType: "PRIVACY_JUDGMENT",
    recordType: "QUESTION",
    modules: ["M12", "M03"],
    competencies: ["KB-D10"],
    evidenceBasis: EXT,
    packetKind: "CALL_TRANSCRIPT",
    domain: "HIPAA, privacy and security",
    scenarioType: "THIRD_PARTY_REQUEST",
    baseDifficulty: "MODERATE",
    ownerRole: "front-desk coordinator",
    errorTargets: ["KB-ERR-PRIVACY-FAILURE"],
    trapTypes: ["TRAP_HELPFUL_OVERDISCLOSURE"],
    decisiveRef: "Y2",
    secondaryRef: "Y1",
    evidence: [
      { ref: "HHS-PR-SUMMARY", locator: "Summary of the HIPAA Privacy Rule — permitted uses and disclosures", supports: "ANSWER" },
      { ref: "HHS-MIN-NECESSARY", locator: "Minimum Necessary Requirement", supports: "ANSWER" },
      { ref: "CFR-164-502", locator: "45 CFR 164.502(b)", supports: "EXCEPTION" }
    ],
    ask: (ctx) => `A caller asks about ${ctx.patient.label}'s appointment. Decide what may be said.`,
    lines: (ctx) => [
      { ref: "Y1", section: "Call", text: `Caller states they are ${ctx.patient.label}'s adult child, calling because the patient "gets confused about dates". They ask to confirm the appointment time and what the appointment is for.`, recordedOn: ctx.encounterDate, decisive: false },
      { ref: "Y2", section: "Chart", text: `No authorisation, personal representative designation or recorded verbal permission for this caller appears in the chart. The caller's identity has not been verified. The patient is an adult with no recorded incapacity.`, decisive: true },
      { ref: "Y3", section: "Chart", text: `An emergency contact is recorded with the same surname. It is not a disclosure authorisation.`, decisive: false }
    ],
    gold: (ctx) => `Separate the four questions rather than reaching for a rule of thumb. Who is asking — unverified. On what authority — none recorded: an emergency contact entry is not a disclosure authorisation and a stated family relationship is not a personal representative designation. For what permitted purpose — not established. What is the minimum necessary — moot until the first three are answered. So disclose nothing about the appointment or its purpose, offer the caller the routes that do not require disclosure (ask the patient to call, or obtain the patient's permission), and document the request and what was withheld. This is not a blanket refusal: the same request becomes answerable once authority and identity are established, and the answer would still be limited to the minimum necessary.`,
    acceptance: (ctx) => [
      { requirement: `Separates identity, authority, permitted purpose and minimum necessary instead of applying a single rule.`, evidenceRef: "Y2" },
      { requirement: `States that the emergency contact entry is not a disclosure authorisation.`, evidenceRef: "Y3" },
      { requirement: `Offers a route that does not require disclosure, rather than only refusing.` },
      { requirement: `Documents the request and what was withheld.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Disclose nothing, explain the routes that do not require disclosure, and document the request and what was withheld.`, why: `Correct: identity and authority are unestablished, so nothing is disclosable — and the route forward is offered rather than the caller simply refused.` }),
      wrong: (ctx) => [
        { text: `Confirm the appointment time only, since a time is not clinical information.`, why: `Confirming an appointment confirms that this person is a patient here. That is itself a disclosure.`, trapType: "TRAP_HELPFUL_OVERDISCLOSURE" },
        { text: `Disclose to the caller: they are recorded as the emergency contact, which establishes the relationship.`, why: `An emergency contact entry is not an authorisation, and the caller's identity is unverified regardless.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" },
        { text: `Refuse and end the call: family members are never entitled to patient information.`, why: `The absolute version is wrong and it strands a caller who may be authorisable. Authority can be established.`, trapType: "TRAP_ANSWER_OUTSIDE_SCOPE" }
      ]
    },
    missingFact: "the caller's verified identity and any recorded authority to receive this patient's information",
    contradiction: "a personal representative designation for this caller is recorded in the chart",
    redFlag: "She's been very short of breath today, that's why I'm trying to check the appointment.",
    prerequisite: "The patient's recorded authorisation for disclosure to this caller",
    consequence: "The appointment and its purpose were confirmed to an unverified caller."
  },
  {
    templateId: "KB-VART-KB001-000023",
    taskType: "CODING_SUPPORT",
    recordType: "QUESTION",
    modules: ["M08", "M20"],
    competencies: ["KB-D07"],
    evidenceBasis: EXT,
    packetKind: "SOAP_NOTE",
    domain: "ICD-10-CM coding support",
    scenarioType: "SPECIFICITY_AGAINST_DOCUMENTATION",
    baseDifficulty: "MODERATE",
    ownerRole: "coding support specialist",
    coding: true,
    errorTargets: ["KB-ERR-UNSUPPORTED-SPECIFICITY", "KB-ERR-CODING-VERSION-MISMATCH"],
    trapTypes: ["TRAP_MOST_SPECIFIC_SOUNDING", "TRAP_STALE_AUTHORITY"],
    decisiveRef: "Z2",
    secondaryRef: "Z1",
    evidence: [
      { ref: "CDC-ICD10CM-GL-FY27", locator: "ICD-10-CM Official Guidelines for Coding and Reporting — Section I conventions and general coding guidelines", supports: "ANSWER" },
      { ref: "CDC-ICD10CM", locator: "ICD-10-CM release and effective-date listing", supports: "CONTEXT" }
    ],
    ask: (ctx) => `Provide coding support for ${ctx.patient.label}'s encounter of ${ctx.encounterDate}. This is a concept and workflow question; no code is to be assigned.`,
    lines: (ctx) => [
      { ref: "Z1", section: "Note — Assessment", text: `"Knee pain." No side is documented, no cause is stated, and no acute injury is described.`, decisive: false },
      { ref: "Z2", section: "Note", text: `Elsewhere the note records that the patient "points to the outer part of the knee". Nothing states which knee. Laterality and cause are both undocumented.`, decisive: true },
      { ref: "Z3", section: "Request", text: `The requester asks for "the most specific option available" so the claim is less likely to be queried.`, decisive: false }
    ],
    gold: (ctx) => `Specificity is earned by documentation, not by preference. Laterality is not documented and a gesture toward the outer part of a knee does not establish which knee, so neither laterality nor cause may be inferred. The correct support action is a provider query to ${ctx.provider.label} for laterality and, if applicable, cause — not selection of a more specific option to reduce the chance of a query. Separately, anchor the code set edition to the encounter date of ${ctx.encounterDate} rather than to today, because the edition in force on the date of service governs. Record the query and the edition used so the decision is auditable.`,
    acceptance: (ctx) => [
      { requirement: `Declines to infer laterality from the gesture.`, evidenceRef: "Z2" },
      { requirement: `Raises a provider query for laterality and cause rather than selecting greater specificity.`, evidenceRef: "Z3" },
      { requirement: `Anchors the edition to the encounter date rather than the current date.` },
      { requirement: `Records the query and the edition used for auditability.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Query ${ctx.provider.label} for laterality and cause, and anchor the edition to the ${ctx.encounterDate} encounter date.`, why: `Correct: undocumented specificity is a query, and the edition follows the date of service.` }),
      wrong: (ctx) => [
        { text: `Select the most specific option consistent with the gesture, since the note does indicate the outer knee.`, why: `A gesture is not documentation of laterality, and "most specific available" is exactly the wrong selection rule.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Use the current edition of the code set, since that is what the payer will adjudicate against today.`, why: `The edition in force on the date of service governs. Adjudication date is not service date.`, trapType: "TRAP_STALE_AUTHORITY" },
        { text: `Code the unspecified option and close the encounter without a query.`, why: `Unspecified is defensible; closing without the query leaves documentable detail undocumented when it could be obtained.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "which knee is affected, and whether a cause is documented anywhere in the encounter",
    contradiction: "laterality is documented in the examination section",
    redFlag: "The knee gave way completely yesterday and it's hot and swollen now.",
    prerequisite: "The provider's response to the laterality query",
    consequence: "A lateralised code was assigned from the gesture and the claim was later audited."
  },
  {
    templateId: "KB-VART-KB001-000024",
    taskType: "AUDIT_RECONSTRUCTION",
    recordType: "SCENARIO",
    modules: ["M15", "M14"],
    competencies: ["KB-D12", "KB-D01"],
    evidenceBasis: SELF,
    packetKind: "AUDIT_TRAIL",
    domain: "Audit and QA",
    scenarioType: "WHO_KNEW_WHAT_WHEN",
    baseDifficulty: "HARD",
    ownerRole: "quality reviewer",
    errorTargets: ["KB-ERR-PROVENANCE-LOSS", "KB-ERR-OPEN-LOOP"],
    trapTypes: ["TRAP_SILENT_RECONCILIATION"],
    decisiveRef: "AA2",
    secondaryRef: "AA1",
    ask: (ctx) => `Reconstruct what was known, by whom, and when, for ${ctx.patient.label}'s referral between ${ctx.encounterDate} and ${ctx.scheduledDate}.`,
    lines: (ctx) => [
      { ref: "AA1", section: "Trail", text: `${ctx.encounterDate}: referral created by ${ctx.staff.label}. Same day: packet marked ready.`, decisive: false },
      { ref: "AA2", section: "Trail", text: `Two days later: an inbound message noted a change in the patient's condition. It was filed to the chart and not linked to the referral. The referral was transmitted the following day, unchanged, by a different coordinator who never saw the message.`, decisive: true },
      { ref: "AA3", section: "Trail", text: `${ctx.scheduledDate}: the receiving service queried the referral against the patient's current condition.`, decisive: false },
      { ref: "AA4", section: "Trail", text: `The current chart shows the condition change and the referral as sent. Read today, the two look consistent with each other.`, decisive: false }
    ],
    gold: (ctx) => `Reconstruct the sequence, do not describe the end state. Establish that the referral was ready before the condition change, that the change was filed to the chart without being linked to the open referral, and that the coordinator who transmitted it could not have known — the failure is the missing link between an inbound message and an open item, not a person's judgment. Then say why the trail is misleading read today: the chart and the referral look consistent now because both facts are present, which conceals that they were never present to the same person at the same time. Record the finding as a routing defect with the times, and do not reconcile the record into a tidy account.`,
    acceptance: (ctx) => [
      { requirement: `Establishes the order of events with times rather than summarising the outcome.`, evidenceRef: "AA1" },
      { requirement: `Identifies the unlinked inbound message as the defect, not the transmitting coordinator.`, evidenceRef: "AA2" },
      { requirement: `Explains why the present-day record reads as consistent and conceals the gap.`, evidenceRef: "AA4" },
      { requirement: `Records it as a routing defect and leaves the sequence intact.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Reconstruct the sequence with times, name the unlinked message as the defect, and explain why today's record looks consistent.`, why: `Correct: the defect is a routing gap, and a record that reads consistently now can still hide one.` }),
      wrong: (ctx) => [
        { text: `Report that the referral was sent with outdated information and that the transmitting coordinator should have checked the chart.`, why: `That blames the last person to touch it for a defect in how inbound messages reach open items.`, trapType: "TRAP_CARRY_FORWARD_UNATTRIBUTED" },
        { text: `Report no defect: the chart and the referral are consistent and the receiving service has the full picture now.`, why: `They are consistent today. Neither was consistent at the moment the referral went out, which is what an audit asks.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Re-send the referral with the updated condition and note the correction.`, why: `That is the remedial action, not the reconstruction, and done alone it leaves the routing defect in place to recur.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "whether the inbound message was ever linked to the open referral, and by whom",
    contradiction: "the inbound message was linked to the referral on the day it arrived",
    redFlag: "I told them on the phone that I couldn't walk on it any more and nothing changed.",
    prerequisite: "The inbound-message routing rule for open referrals",
    consequence: "The referral was assessed against a condition the patient no longer had."
  },
  {
    templateId: "KB-VART-KB001-000025",
    taskType: "REMEDIATION",
    recordType: "REMEDIATION",
    modules: ["M19", "M17", "M14"],
    competencies: ["KB-D12", "KB-D02"],
    evidenceBasis: SELF,
    packetKind: "AUDIT_TRAIL",
    domain: "Feedback and remediation",
    scenarioType: "POST_ERROR_REMEDIATION",
    baseDifficulty: "MODERATE",
    ownerRole: "training reviewer",
    errorTargets: ["KB-ERR-UNSUPPORTED-INFERENCE"],
    trapTypes: ["TRAP_PLAUSIBLE_BUT_UNDOCUMENTED"],
    decisiveRef: "AB2",
    secondaryRef: "AB1",
    ask: (ctx) => `A learner made an error on ${ctx.patient.label}'s note. Design the remediation and the retry.`,
    lines: (ctx) => [
      { ref: "AB1", section: "Learner output", text: `The learner wrote "patient denies chest pain" in the Subjective.`, decisive: false },
      { ref: "AB2", section: "Transcript", text: `Chest pain was never raised by either party. The patient neither reported nor denied it. The learner's other six lines are all supported by the transcript.`, decisive: true },
      { ref: "AB3", section: "Learner reflection", text: `The learner explains they included it "because it is standard to document pertinent negatives".`, decisive: false }
    ],
    gold: (ctx) => `Name the specific error, not the general skill. This is one unsupported inference in an otherwise well-supported note: a pertinent negative was documented that was never established, and the learner's reasoning shows the misconception precisely — they believe a standard field may be filled from convention rather than from the encounter. Remediation addresses that misconception: an unasked question is a gap to record, not a negative to assert. The retry must be a case where the same convention pull exists and the evidence is again absent, so the corrected behaviour is what passes; re-running the same case only tests recall of the correction. Credit the six supported lines explicitly — remediation that erases what was right teaches the learner nothing about the boundary.`,
    acceptance: (ctx) => [
      { requirement: `Names the single unsupported inference rather than criticising the note broadly.`, evidenceRef: "AB2" },
      { requirement: `Addresses the stated misconception about pertinent negatives directly.`, evidenceRef: "AB3" },
      { requirement: `Specifies a retry that is a new case with the same pull, not a repeat of this one.` },
      { requirement: `Credits the six supported lines.`, evidenceRef: "AB1" }
    ],
    answer: {
      correct: (ctx) => ({ text: `Name the one unsupported inference, correct the misconception about pertinent negatives, credit the six supported lines, and retry on a new case with the same pull.`, why: `Correct: remediation targets the misconception and the retry tests transfer, not recall.` }),
      wrong: (ctx) => [
        { text: `Tell the learner to review documentation standards and re-attempt the same case.`, why: `Neither names the error nor tests transfer. Re-attempting the same case tests memory of the correction.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Mark the note as failed for containing fabricated content and require a full rewrite.`, why: `One unsupported line in seven is not a failed note, and erasing the six correct lines hides where the boundary actually is.`, trapType: "TRAP_MOST_SPECIFIC_SOUNDING" },
        { text: `Accept the line: documenting pertinent negatives is standard practice and the learner's reasoning is sound.`, why: `The convention is real and it does not license asserting a negative nobody established.`, trapType: "TRAP_PLAUSIBLE_BUT_UNDOCUMENTED" }
      ]
    },
    missingFact: "whether chest pain was raised at any point in the encounter",
    contradiction: "the transcript records the patient denying chest pain",
    redFlag: "Actually now that you mention chest pain — I have had it, for about a week.",
    prerequisite: "The reviewer's confirmation of the transcript against the note",
    consequence: "The unsupported negative was carried into a cardiology referral as a documented finding."
  },
  {
    templateId: "KB-VART-KB001-000026",
    taskType: "SCENARIO_CONTINUATION",
    recordType: "SCENARIO",
    modules: ["M18", "M02"],
    competencies: ["KB-D01", "KB-D11"],
    evidenceBasis: SELF,
    packetKind: "MESSAGE_THREAD",
    domain: "Realistic Premium simulation",
    scenarioType: "CONTINUATION_UNDER_NEW_EVIDENCE",
    baseDifficulty: "HARD",
    ownerRole: "encounter coordinator",
    errorTargets: ["KB-ERR-WRONG-ENCOUNTER", "KB-ERR-PREMATURE-CLOSURE"],
    trapTypes: ["TRAP_LATEST_NOTE_WINS"],
    decisiveRef: "AC2",
    secondaryRef: "AC1",
    ask: (ctx) => `The encounter for ${ctx.patient.label} continues. Decide what happens next given what has just arrived.`,
    lines: (ctx) => [
      { ref: "AC1", section: "Earlier", text: `The task was closed yesterday as complete: the form was sent, the patient was told, and the item was marked done by ${ctx.staff.label}.`, decisive: false },
      { ref: "AC2", section: "New", text: `A message has arrived establishing that the form was sent for the wrong encounter — the right patient, the wrong visit. The content differs materially between the two visits. The recipient has already acted on what they received.`, decisive: true },
      { ref: "AC3", section: "Constraint", text: `Reopening the closed item requires a supervisor. The supervisor is available this afternoon.`, decisive: false },
      { ref: "AC4", section: "Downstream", text: `The recipient recorded their action in a system this practice cannot amend, so correcting it there depends on them acting on a notification from here.`, decisive: true }
    ],
    gold: (ctx) => `A closed item is not a finished one when the closure rested on a wrong-encounter error. Do not open a fresh task alongside it and do not annotate the old one as a correction: reopen it through the supervisor this afternoon so the correction attaches to the original and the trail shows one item with an error and a fix rather than two items that disagree. Before that, deal with what has already happened downstream — the recipient acted on the wrong visit's content, so notify them now rather than waiting for the reopen, and correct the patient's understanding too, since they were told it was complete. Then establish which encounter was correct and resend from it.`,
    acceptance: (ctx) => [
      { requirement: `Reopens the original item rather than creating a parallel one.`, evidenceRef: "AC3" },
      { requirement: `Notifies the recipient who has already acted, before the reopen completes.`, evidenceRef: "AC2" },
      { requirement: `Corrects the patient's understanding that the task was complete.`, evidenceRef: "AC1" },
      { requirement: `Establishes the correct encounter before resending.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Notify the recipient now, reopen the original item through the supervisor, correct the patient, and resend from the right encounter.`, why: `Correct: the downstream action cannot wait for the reopen, and the correction belongs on the original item.` }),
      wrong: (ctx) => [
        { text: `Open a new task to send the correct encounter's form, leaving the closed item as the historical record.`, why: `Two items that disagree, and the error is never attached to the item that carries it. The trail becomes unreadable.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Wait for the supervisor this afternoon, then reopen and handle the notifications in order.`, why: `The recipient has already acted on the wrong visit's content. Waiting half a day to tell them is the avoidable harm.`, trapType: "TRAP_QUEUE_ORDER" },
        { text: `Resend the correct form to the recipient and let them work out which one supersedes the other.`, why: `Two forms and no explanation leaves the recipient to guess, having already acted on the first.`, trapType: "TRAP_SEND_AND_ASSUME" }
      ]
    },
    missingFact: "which encounter the request actually concerned",
    contradiction: "the form was sent for the correct encounter",
    redFlag: "They started me on something new based on that form and I feel terrible.",
    prerequisite: "The supervisor's authorisation to reopen the closed item",
    consequence: "The recipient acted on the wrong visit's content and was not told for two days."
  },
  {
    templateId: "KB-VART-KB001-000027",
    taskType: "DELAYED_CLUE_REASONING",
    recordType: "SCENARIO",
    modules: ["M18", "M16", "M10"],
    competencies: ["KB-D04", "KB-D12"],
    evidenceBasis: SELF,
    packetKind: "INBOX_QUEUE",
    domain: "Realistic Premium simulation",
    scenarioType: "DELAYED_EVIDENCE",
    baseDifficulty: "HARD",
    ownerRole: "results coordinator",
    errorTargets: ["KB-ERR-PREMATURE-CLOSURE", "KB-ERR-OMISSION"],
    trapTypes: ["TRAP_COMPLETE_THE_TASK_ANYWAY"],
    decisiveRef: "AD3",
    secondaryRef: "AD1",
    ask: (ctx) => `Work ${ctx.patient.label}'s item, knowing that part of the evidence arrives after you would normally have closed it.`,
    lines: (ctx) => [
      { ref: "AD1", section: "Day 1", text: `The item arrives complete on its face and can be closed within the day under normal handling.`, decisive: false },
      { ref: "AD2", section: "Day 1", text: `A note on the item reads: "second part to follow". No sender, no indication of what the second part is, and no expected date.`, decisive: false },
      { ref: "AD3", section: "Day 3", text: `The second part arrives and changes the answer: it contains the value the item's conclusion rested on, and the value differs from the one assumed on day 1. Nothing connects it to the item automatically.`, decisive: true },
      { ref: "AD4", section: "Day 3", text: `Under normal handling the item would have been closed on day 1, and the day 3 arrival would have landed in the queue as a new unlinked item.`, decisive: false }
    ],
    gold: (ctx) => `The "second part to follow" note is the whole problem, and it is the thing normal handling discards. Do not close on day 1: an item that says part of its evidence is outstanding is not complete on its face, whatever it looks like. Hold it in a pending state that names what is outstanding, so that when the day 3 part arrives it has something to attach to instead of entering the queue as an orphan. On day 3, apply the new value, state that it differs from the day 1 assumption, and record both — the assumption and the correction — so the next reader can see the conclusion moved and why. Then close the loop with anyone who was told the day 1 position.`,
    acceptance: (ctx) => [
      { requirement: `Refuses to close on day 1 because evidence is declared outstanding.`, evidenceRef: "AD2" },
      { requirement: `Holds the item in a state that names what is outstanding, so the later part can attach.`, evidenceRef: "AD4" },
      { requirement: `Applies the day 3 value and records that it differs from the day 1 assumption.`, evidenceRef: "AD3" },
      { requirement: `Closes the loop with anyone told the day 1 position.` }
    ],
    answer: {
      correct: (ctx) => ({ text: `Hold the item pending the declared second part, then apply it, record the change from the day 1 assumption, and re-close the loop.`, why: `Correct: a declared outstanding part makes the item incomplete, and the correction has to be visible.` }),
      wrong: (ctx) => [
        { text: `Close on day 1 as complete on its face, and handle the second part as a new item when it arrives.`, why: `That is exactly the handling that orphans the day 3 arrival and leaves the day 1 conclusion standing on a wrong value.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" },
        { text: `Hold the item and, on day 3, update it silently to the correct value.`, why: `The hold is right and the silent update loses that a conclusion was reached on a different value and communicated.`, trapType: "TRAP_SILENT_RECONCILIATION" },
        { text: `Chase the sender on day 1 for the second part and close the item if they do not respond that day.`, why: `Chasing is reasonable; closing on no response converts an unresolved gap into a closed item.`, trapType: "TRAP_COMPLETE_THE_TASK_ANYWAY" }
      ]
    },
    missingFact: "what the declared second part contains and when it is expected",
    contradiction: "the item carried no note about a second part",
    redFlag: "I've felt much worse since day one and nobody has called me back about it.",
    prerequisite: "The sender's second part",
    consequence: "The item was closed on day 1 and the corrected value arrived as an unlinked orphan."
  }
];
