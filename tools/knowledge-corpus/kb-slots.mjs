// Synthetic slot pools for Knowledgebase generation.
//
// Every person, provider, practice, payer and identifier here is invented for
// training. None corresponds to a real patient, clinician, organisation or
// payer policy, and none may be presented as one. A scenario that states a
// payer requirement states it as a given of the scenario, never as a claim
// about how any real payer behaves.

export const PATIENTS = [
  { label: "Arden Kowalczyk-Reyes", mrn: "SYN-4418", dob: "1978-03-11", sex: "F" },
  { label: "Bassey Oduya", mrn: "SYN-7290", dob: "1961-11-02", sex: "M" },
  { label: "Corrin Vasquez-Lund", mrn: "SYN-3355", dob: "1994-07-24", sex: "F" },
  { label: "Delphine Achterberg", mrn: "SYN-8102", dob: "1955-01-19", sex: "F" },
  { label: "Emeka Solberg", mrn: "SYN-5647", dob: "1987-09-30", sex: "M" },
  { label: "Fenella Quintanilla", mrn: "SYN-2914", dob: "2001-05-06", sex: "F" },
  { label: "Gideon Marchetti-Oyelaran", mrn: "SYN-6073", dob: "1949-12-14", sex: "M" },
  { label: "Halina Berkovits", mrn: "SYN-1528", dob: "1972-08-08", sex: "F" },
  { label: "Ignatius Nwachukwu", mrn: "SYN-9461", dob: "1966-02-27", sex: "M" },
  { label: "Jovana Petrakis-Hume", mrn: "SYN-3807", dob: "1990-10-16", sex: "F" },
  { label: "Kwabena Lindqvist", mrn: "SYN-7134", dob: "1983-04-03", sex: "M" },
  { label: "Lorelai Abubakar-Stern", mrn: "SYN-4592", dob: "1958-06-21", sex: "F" },
  { label: "Arden Kowalczyk", mrn: "SYN-4419", dob: "1978-03-11", sex: "F", nearMatchOf: "SYN-4418" },
  { label: "Bassey Oduya", mrn: "SYN-7291", dob: "1961-11-20", sex: "M", nearMatchOf: "SYN-7290" }
];

export const PROVIDERS = [
  { label: "Dr. Imani Farrokhzad", role: "Internal Medicine" },
  { label: "Dr. Teodoro Haakonsen", role: "Family Medicine" },
  { label: "Dr. Ngozi Brandtsen", role: "Cardiology" },
  { label: "Dr. Rurik Vandeveer", role: "Orthopaedics" },
  { label: "Dr. Saoirse Mbeki-Lantz", role: "Endocrinology" },
  { label: "NP Caius Ostrowski", role: "Primary Care" },
  { label: "PA Yolanda Trevisani", role: "Urgent Care" }
];

export const STAFF = [
  { label: "M. Okonjo", role: "front-desk coordinator" },
  { label: "R. Skibinski", role: "referral coordinator" },
  { label: "T. Alvarado-Ng", role: "medical assistant" },
  { label: "L. Haverford", role: "scribe" },
  { label: "D. Eluwande", role: "triage nurse" },
  { label: "P. Kirchmayer", role: "billing specialist" }
];

export const PRACTICES = [
  "Rosemark Internal Medicine",
  "Cedar Hollow Family Practice",
  "Northgate Specialty Associates",
  "Larkspur Community Clinic"
];

export const PAYERS = [
  { label: "Meridian Health Plan", planId: "SYN-MRD-01" },
  { label: "Quarry State Mutual", planId: "SYN-QSM-04" },
  { label: "Vantage Care Network", planId: "SYN-VCN-12" }
];

export const CHANNELS = ["inbound telephone call", "patient portal message", "inbound fax", "voicemail", "secure internal message", "walk-in at the front desk"];

export const ENCOUNTER_DATES = [
  "2026-02-09", "2026-03-17", "2026-05-04", "2026-06-22", "2026-08-13", "2026-09-01",
  "2026-11-05", "2026-12-08", "2027-01-14", "2027-02-23"
];

export function pick(pool, index) {
  return pool[index % pool.length];
}

// ---------------------------------------------------------------------------
// Batch-scoped pools.
//
// `pick` indexes modulo the pool length, so appending to a pool re-casts every
// record already generated from it. KB-001's pools are therefore frozen exactly
// as they were when KB-001 was minted, and a later batch draws from its own
// cohort. This is what lets the persona set grow (charter section XXV,
// GAP_ANALYSIS section 3.4) without rewriting an earlier batch.
//
// Every persona below is invented. The synthetic MRN block SYN-1xxx..SYN-9xxx is
// reserved for this corpus and corresponds to no real record system.

/** A second patient cohort, used from KB-002 onward. */
export const PATIENTS_KB002 = [
  { label: "Marisol Ekwueme-Trask", mrn: "SYN-2207", dob: "1969-04-17", sex: "F" },
  { label: "Nikolai Adebayo-Frisk", mrn: "SYN-8836", dob: "1992-12-05", sex: "M" },
  { label: "Odalys Mwangi-Bergström", mrn: "SYN-5019", dob: "1954-08-29", sex: "F" },
  { label: "Peregrine Oyelude", mrn: "SYN-6742", dob: "1981-01-23", sex: "M" },
  { label: "Quilla Nakashima-Obi", mrn: "SYN-3168", dob: "2003-06-11", sex: "F" },
  { label: "Rasheed Vondracek", mrn: "SYN-9503", dob: "1947-10-08", sex: "M" },
  { label: "Sunniva Balogun-Reith", mrn: "SYN-4275", dob: "1975-02-14", sex: "F" },
  { label: "Thaddeus Iwuchukwu", mrn: "SYN-7681", dob: "1988-11-26", sex: "M" },
  { label: "Ulyana Sørensen-Adeyemi", mrn: "SYN-1394", dob: "1963-07-03", sex: "F" },
  { label: "Vikram Oyinlola-Haugen", mrn: "SYN-8250", dob: "1996-03-19", sex: "M" },
  { label: "Wilhelmina Acheampong", mrn: "SYN-5827", dob: "1951-09-12", sex: "F" },
  { label: "Xavier Rautenbach-Ejiofor", mrn: "SYN-2963", dob: "1984-05-28", sex: "M" },
  { label: "Yevgenia Olatunji-Kvist", mrn: "SYN-6418", dob: "1971-12-30", sex: "F" },
  { label: "Zacharias Ndlovu-Persson", mrn: "SYN-3541", dob: "1999-08-07", sex: "M" },
  { label: "Anneliese Chukwuemeka-Rho", mrn: "SYN-7095", dob: "1957-11-15", sex: "F" },
  { label: "Bartholomew Sannikov", mrn: "SYN-4632", dob: "1990-02-02", sex: "M" }
];

/** A second provider cohort, used from KB-002 onward. */
export const PROVIDERS_KB002 = [
  { label: "Dr. Anwuli Steensgaard", role: "Nephrology" },
  { label: "Dr. Basim Oyeleke-Nyström", role: "Pulmonology" },
  { label: "Dr. Coralie Abimbola-Wexler", role: "Rheumatology" },
  { label: "Dr. Dmitri Ogunsanya-Holt", role: "Gastroenterology" },
  { label: "Dr. Esperanza Nkemdirim", role: "Neurology" },
  { label: "Dr. Fionnuala Adeoti-Krause", role: "Dermatology" },
  { label: "NP Gustavo Ihejirika", role: "Geriatric Care" },
  { label: "PA Hyacinth Obuya-Lindfors", role: "Occupational Health" },
  { label: "CNM Isolde Babatunde-Reyes", role: "Midwifery" }
];

/** A second staff cohort, used from KB-002 onward. */
export const STAFF_KB002 = [
  { label: "A. Nwosu-Ferrand", role: "prior-authorisation specialist" },
  { label: "B. Tkachenko", role: "records clerk" },
  { label: "C. Oyedepo-Mansur", role: "patient access representative" },
  { label: "E. Villaseñor-Bak", role: "clinical documentation assistant" },
  { label: "F. Adegboyega", role: "results coordinator" },
  { label: "G. Hallgrimsdottir", role: "switchboard operator" },
  { label: "H. Ezeagwula-Roth", role: "pharmacy technician" },
  { label: "J. Marchesini-Ola", role: "scheduling coordinator" }
];

export const PRACTICES_KB002 = [
  "Willowbank Primary Care",
  "Ashcombe Multispecialty Group",
  "Bellrock Community Health Center",
  "Thornfield Medical Partners",
  "Quietwater Family Health",
  "Marbury Heights Clinic"
];

export const PAYERS_KB002 = [
  { label: "Ardent Commonwealth Plan", planId: "SYN-ACP-07" },
  { label: "Sablefield Mutual Health", planId: "SYN-SMH-19" },
  { label: "Thornwood Regional Care", planId: "SYN-TRC-23" },
  { label: "Kestrel Public Option", planId: "SYN-KPO-31" }
];

/** KB-001's pools, frozen. Do not append to these. */
const POOLS_KB001 = {
  patients: PATIENTS,
  providers: PROVIDERS,
  staff: STAFF,
  practices: PRACTICES,
  payers: PAYERS,
  channels: CHANNELS,
  encounterDates: ENCOUNTER_DATES
};

/** KB-002's pools. The new cohorts lead so that the batch opens on personas that
 *  KB-001 never used; the KB-001 cohort follows, because a persona reappearing in
 *  a different scenario is intended reuse, not a collision. */
const POOLS_KB002 = {
  patients: [...PATIENTS_KB002, ...PATIENTS.filter((patient) => !patient.nearMatchOf)],
  providers: [...PROVIDERS_KB002, ...PROVIDERS],
  staff: [...STAFF_KB002, ...STAFF],
  practices: [...PRACTICES_KB002, ...PRACTICES],
  payers: [...PAYERS_KB002, ...PAYERS],
  channels: CHANNELS,
  encounterDates: ENCOUNTER_DATES
};

const POOLS_BY_BATCH = new Map([
  ["KB-001", POOLS_KB001],
  ["KB-002", POOLS_KB002]
]);

/** The pools a batch draws from. An unregistered batch is an error rather than a
 *  silent fallback: falling back would quietly re-cast a new batch with KB-001's
 *  personas and hide the fact that nobody chose a cohort for it. */
export function poolsForBatch(batchId) {
  const pools = POOLS_BY_BATCH.get(batchId);
  if (!pools) throw new Error(`no slot pools registered for batch ${batchId} (add one in kb-slots.mjs)`);
  return pools;
}
