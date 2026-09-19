/**
 * Shared question-bank test fixtures.
 *
 * Kept out of the test files themselves so the schema tests and the validator
 * tests assert against exactly the same records — a "minimal" question that
 * drifted between two files would make one suite's pass meaningless.
 *
 * Not exported from the package index: these are fixtures, not content.
 */

/**
 * A question with nothing optional on it. Everything here is required because a
 * question missing any of it cannot be taught from, reviewed, or traced back to
 * a source.
 */
export const minimalQuestion = {
  questionId: "Q-MIN-0001",
  domain: "Medical Scribing",
  skillArea: "Privacy & Confidentiality",
  difficultyLevel: 1,
  questionType: "recognition",
  learningObjective: "Name the term for individually identifiable health information.",
  question: "What term does the HIPAA Privacy Rule use for individually identifiable health information?",
  choices: [
    { id: "a", text: "Protected health information (PHI)" },
    { id: "b", text: "A notice of privacy practices" }
  ],
  correctChoiceId: "a",
  rationale: "HHS's summary calls this information protected health information.",
  source: { ref: "HHS-PR-SUMMARY", locator: "Heading 'What Information is Protected'" },
  contentStatus: "candidate",
  reviewStatus: "pending"
};

/** The same question with every optional field populated, including ICD metadata. */
export const fullyPopulatedQuestion = {
  ...minimalQuestion,
  questionId: "Q-FULL-0001",
  domain: "ICD",
  skillArea: "Version Awareness",
  difficultyLevel: 3,
  questionType: "scenario",
  choices: [
    { id: "a", text: "Protected health information (PHI)", why: "Correct: that is the term HHS uses." },
    { id: "b", text: "A notice of privacy practices", why: "A document, not the name for the information." }
  ],
  source: {
    authority: "CDC / NCHS (with CMS)",
    title: "ICD-10-CM Official Guidelines for Coding and Reporting FY 2027",
    url: "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2027/ICD-10-CM-October-1-2026-FY27-Guidelines.pdf",
    dateOrVersion: "effective 2026-10-01 to 2027-09-30",
    jurisdiction: "US",
    locator: "Title page effective-period statement"
  },
  codingReference: {
    system: "ICD-10-CM",
    jurisdiction: "US",
    release: "FY2027",
    effectiveFrom: "2026-10-01",
    effectiveTo: "2027-09-30",
    codes: ["A00.0"]
  },
  variantGroup: "ICD-FY-EFFECTIVE-PERIOD",
  validUntil: "2027-09-30",
  flags: ["ICD-VERSION-REVIEW", "HUMAN-VERIFY-REQUIRED"],
  verification: {
    locatorConfidence: "TWO-EXTRACTS",
    humanVerificationRequired: true,
    humanVerifiedBy: null,
    humanVerifiedOn: null
  }
};
