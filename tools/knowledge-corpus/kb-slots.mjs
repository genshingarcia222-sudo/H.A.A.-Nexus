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
