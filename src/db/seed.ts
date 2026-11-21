import { eq, count } from "drizzle-orm";
import { db } from "./index";
import {
  adminUsers,
  checklistSessions,
  checklistVersions,
  documents,
  services,
} from "./schema";
import { hashPassword } from "@/lib/admin-auth";
import { generatePersonalizedChecklist } from "@/lib/checklist-engine";
import type { QuestionDefinition, VersionRequirement } from "@/lib/types";

let seedPromise: Promise<void> | null = null;
let seededChecked = false;

export const DEMO_ADMIN_EMAIL = "admin@ezdocs.gov.demo";
export const DEMO_ADMIN_PASSWORD = "EZDocs2026!";

const HARIPUR_DISCLAIMER =
  "These requirements are sample information and have not been confirmed with the Deputy Commissioner Office, Haripur. Documents, fees and attestation rules can change. Please confirm with the office or the Citizen Facilitation Center before you visit.";

const DOMICILE_QUESTIONS_V1: QuestionDefinition[] = [
  {
    id: "q_age_group",
    key: "age_group",
    step: 1,
    prompt: "What is the applicant's age group?",
    helpText:
      "Applicants aged 18+ typically apply with a CNIC, whereas minors under 18 apply using a NADRA B-Form (CRC) and parent/guardian CNIC.",
    required: true,
    type: "single_choice",
    options: [
      {
        value: "adult_18_plus",
        label: "18 years or older (Adult)",
        description: "Eligible to hold an individual CNIC / NICOP",
      },
      {
        value: "minor_under_18",
        label: "Under 18 years (Minor)",
        description: "Applies with NADRA B-Form and parent/guardian ID",
      },
    ],
  },
  {
    id: "q_id_document",
    key: "id_document",
    step: 2,
    prompt: "Which NADRA identity document does the applicant currently possess?",
    helpText:
      "Select the valid government-issued identity document you can bring to the counter.",
    required: true,
    type: "single_choice",
    options: [
      {
        value: "has_cnic",
        label: "Valid CNIC / NICOP",
        description: "Computerized National Identity Card",
      },
      {
        value: "has_bform",
        label: "NADRA B-Form / Child Registration Certificate (CRC)",
        description: "For minors or applicants awaiting first CNIC",
      },
      {
        value: "neither",
        label: "Neither CNIC nor B-Form yet",
        description: "You have not yet obtained a NADRA identity record",
      },
    ],
  },
  {
    id: "q_application_type",
    key: "application_type",
    step: 3,
    prompt: "What type of domicile application is this?",
    helpText:
      "Duplicate or re-issuance requests require additional proof regarding the previously issued certificate.",
    required: true,
    type: "single_choice",
    options: [
      {
        value: "first_time",
        label: "First-Time Application",
        description: "Applicant has never received a Haripur domicile before",
      },
      {
        value: "renewal_duplicate",
        label: "Duplicate / Re-issuance / Replacement",
        description: "Replacing a lost, damaged, or older manual domicile",
      },
    ],
  },
  {
    id: "q_haripur_residence",
    key: "haripur_residence",
    step: 4,
    prompt: "Is the applicant's permanent address listed in District Haripur?",
    helpText:
      "Applicants whose CNIC lists a permanent address outside Haripur usually need proof of continuous residence in Haripur.",
    required: true,
    type: "single_choice",
    options: [
      {
        value: "permanent_haripur",
        label: "Yes — Permanent address is in District Haripur",
        description: "Matches CNIC permanent address or ancestral property",
      },
      {
        value: "temporary_resident",
        label: "No — Temporary / Current resident in Haripur",
        description: "Residing in Haripur for work, family, or education",
      },
    ],
  },
  {
    id: "q_other_district",
    key: "other_district_domicile",
    step: 5,
    prompt: "Has the applicant previously held a domicile from another district?",
    helpText:
      "You can usually hold a domicile from only one district. If you have one from another district, it will likely need to be cancelled first.",
    required: true,
    type: "single_choice",
    options: [
      {
        value: "no",
        label: "No — Never held another district's domicile",
        description: "No prior domicile certificate exists elsewhere",
      },
      {
        value: "yes",
        label: "Yes — Previously held another district's domicile",
        description: "Requires cancellation certificate / NOC from prior district",
      },
    ],
  },
];

const DOMICILE_QUESTIONS_V2: QuestionDefinition[] = [
  ...DOMICILE_QUESTIONS_V1,
  {
    id: "q_spouse_basis",
    key: "spouse_domicile_basis",
    step: 5,
    prompt: "Are you applying on the basis of your spouse's Haripur domicile?",
    helpText:
      "Applicants relocating to Haripur after marriage may qualify using their spouse's domicile and registered Nikah Nama.",
    required: true,
    type: "single_choice",
    options: [
      {
        value: "no",
        label: "No — Applying independently or via parent's residence",
        description: "Standard residency basis",
      },
      {
        value: "yes",
        label: "Yes — Applying based on spouse's Haripur domicile",
        description: "Adds marriage registration and spouse ID requirements",
      },
    ],
  },
];

const MASTER_DOCUMENTS = [
  {
    code: "DOC-APP-FORM",
    title: "Domicile Application Form (Form P / District Prescribed Format)",
    category: "Application Forms",
    defaultInstructions:
      "Obtain Form P from the Citizen Facilitation Center (CFC) Haripur or authorized stamp vendor. Fill clearly in block letters with matching CNIC spelling and signature/thumb impression.",
    originalOrCopy: "Original Completed Form",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample based on KP district domicile workflows (verify at DC Office Haripur).",
  },
  {
    code: "DOC-PHOTOS",
    title: "Recent Passport-Size Photographs",
    category: "Photographs & Fees",
    defaultInstructions:
      "Provide 3 recent passport-size color photographs with a plain blue background. Have one photograph attested on the reverse by a Grade-17 gazetted officer or Union Council secretary if requested.",
    originalOrCopy: "3 Original Prints (Blue Background)",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample — photo count and background color may vary by counter.",
  },
  {
    code: "DOC-RESIDENCE-PROOF",
    title: "Proof of Residence in District Haripur (Utility Bill / Property Record)",
    category: "Residency Proof",
    defaultInstructions:
      "Bring a recent electricity (PESCO) or Sui Gas bill from the last 3 months showing the Haripur residential address in the applicant's or parent's name, or registry/fard copy.",
    originalOrCopy: "Original for Sighting + 1 Photocopy",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample — confirm acceptable utility/revenue proof at CFC Haripur.",
  },
  {
    code: "DOC-PATWARI-SLIP",
    title: "Manual Patwari / Numberdar Paper Verification Slip",
    category: "Residency Proof",
    defaultInstructions:
      "Obtain a manual signed residence confirmation slip from the local Patwari or Numberdar verifying the applicant's Mouza/village residence.",
    originalOrCopy: "Original Signed Slip",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative legacy step in v1.0 (superseded in v2.0 sample workflow).",
  },
  {
    code: "DOC-UC-VERIFICATION",
    title: "Union Council / Local Verification Form",
    category: "Residency Proof",
    defaultInstructions:
      "Have the residence verification section endorsed by the Secretary Union Council / Village Council or Tehsil office having jurisdiction over your Haripur address.",
    originalOrCopy: "Original Endorsed Form",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample — check whether e-verification at CFC replaces manual endorsement.",
  },
  {
    code: "DOC-FEE-CHALLAN",
    title: "Treasury Fee Challan Receipt (Form 32-A / e-Sahulat)",
    category: "Photographs & Fees",
    defaultInstructions:
      "Deposit the prescribed provincial domicile fee into the National Bank of Pakistan (NBP) or designated e-Payment / CFC counter and attach the stamped applicant copy of Challan 32-A.",
    originalOrCopy: "Original Paid Receipt + 1 Copy",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample — confirm current KP government fee schedule before payment.",
  },
  {
    code: "DOC-CNIC",
    title: "Applicant CNIC / NICOP",
    category: "Identity",
    defaultInstructions:
      "Carry your original valid NADRA CNIC for biometric/counter verification along with 2 clear front-and-back photocopies attested by a gazetted officer if required.",
    originalOrCopy: "Original + 2 Attested Photocopies",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample — verify attestation requirement at CFC Haripur.",
  },
  {
    code: "DOC-BFORM-PARENT",
    title: "NADRA B-Form (CRC) & Father/Mother CNIC",
    category: "Identity",
    defaultInstructions:
      "Provide the minor's NADRA Child Registration Certificate (B-Form) together with the father's or legal guardian's valid CNIC showing Haripur residence.",
    originalOrCopy: "Originals + 2 Photocopies Each",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample for applicants under 18 years of age.",
  },
  {
    code: "DOC-NADRA-PREREQ",
    title: "NADRA Registration Prerequisite (Obtain B-Form or CNIC First)",
    category: "Identity",
    defaultInstructions:
      "STOP BEFORE VISITING DC OFFICE: A valid NADRA identity number (CNIC for 18+ or B-Form/CRC for under 18) is generally required before domicile issuance. Bring your Birth Certificate and parent CNIC to NADRA Registration Center Haripur first.",
    originalOrCopy: "Prerequisite Action + Birth Certificate",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative advisory to prevent wasted government office trips.",
  },
  {
    code: "DOC-NOC-CANCELLATION",
    title: "Previous Domicile Cancellation Certificate (NOC)",
    category: "Clearance & NOC",
    defaultInstructions:
      "Obtain an official Domicile Cancellation Certificate / No Objection Certificate from the Deputy Commissioner Office of the previous district confirming your earlier domicile has been cancelled.",
    originalOrCopy: "Original NOC + 1 Photocopy",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample — dual district domiciles are not permitted.",
  },
  {
    code: "DOC-DUPLICATE-AFFIDAVIT",
    title: "Lost/Damaged Domicile Affidavit & Old Record / Police Report",
    category: "Affidavits",
    defaultInstructions:
      "Prepare an affidavit on non-judicial stamp paper declaring loss/damage of the previous domicile, accompanied by a police Roznamcha/report (if lost) or the damaged original certificate and previous certificate number.",
    originalOrCopy: "Original Stamp Paper Affidavit + Copy of Old Record/Report",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample for duplicate/re-issuance requests.",
  },
  {
    code: "DOC-TEMP-RESIDENCE",
    title: "Continuous Residence Proof (Tenancy Agreement / Employer or Institute Letter)",
    category: "Residency Proof",
    defaultInstructions:
      "Since your permanent CNIC address is outside Haripur, attach proof of continuous residence in Haripur (e.g., registered rent agreement, employer posting letter, or educational enrollment record plus utility bills).",
    originalOrCopy: "Original Letter/Agreement + 1 Photocopy",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample — confirm minimum residency duration policy at DC Office Haripur.",
  },
  {
    code: "DOC-FRC",
    title: "NADRA Family Registration Certificate (FRC)",
    category: "Identity",
    defaultInstructions:
      "Obtain a Family Registration Certificate (FRC) from NADRA or Pak-Identity app showing family linkage with parents/guardian residing in Haripur.",
    originalOrCopy: "Original NADRA Printout + 1 Photocopy",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample added in v2.0 to streamline family linkage checks.",
  },
  {
    code: "DOC-NIKAH-SPOUSE",
    title: "Registered Nikah Nama & Spouse CNIC / Haripur Domicile",
    category: "Residency Proof",
    defaultInstructions:
      "Provide a computerized Marriage Registration Certificate (MRC) or attested Nikah Nama along with your spouse's valid CNIC and existing Haripur Domicile Certificate.",
    originalOrCopy: "Originals + 2 Photocopies Each",
    verificationStatus: "illustrative",
    sourceNote: "Illustrative sample for spouse-based domicile applications.",
  },
];

function buildV1Requirements(docIdMap: Map<string, number>): VersionRequirement[] {
  return [
    {
      id: "req-v1-app-form",
      documentId: docIdMap.get("DOC-APP-FORM") ?? null,
      documentCode: "DOC-APP-FORM",
      title: "Domicile Application Form (Form P / District Prescribed Format)",
      category: "Application Forms",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Obtain Form P from the Citizen Facilitation Center (CFC) Haripur or authorized stamp vendor. Fill clearly in block letters with matching CNIC spelling and signature/thumb impression.",
      originalOrCopy: "Original Completed Form",
      tips: "Double-check Father's Name and Mouza/Tehsil spelling against your CNIC.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 1,
    },
    {
      id: "req-v1-photos",
      documentId: docIdMap.get("DOC-PHOTOS") ?? null,
      documentCode: "DOC-PHOTOS",
      title: "Recent Passport-Size Photographs",
      category: "Photographs & Fees",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Bring 4 recent passport-size photographs with a plain white background.",
      originalOrCopy: "4 Original Prints (White Background)",
      tips: "Write your full name lightly on the back of each photograph.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 2,
    },
    {
      id: "req-v1-residence",
      documentId: docIdMap.get("DOC-RESIDENCE-PROOF") ?? null,
      documentCode: "DOC-RESIDENCE-PROOF",
      title: "Proof of Residence in District Haripur (Utility Bill)",
      category: "Residency Proof",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Attach a photocopy of a recent electricity or gas bill for your Haripur residence.",
      originalOrCopy: "1 Photocopy",
      tips: "Make sure the street/mohalla address is clearly legible.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 3,
    },
    {
      id: "req-v1-patwari",
      documentId: docIdMap.get("DOC-PATWARI-SLIP") ?? null,
      documentCode: "DOC-PATWARI-SLIP",
      title: "Manual Patwari / Numberdar Paper Verification Slip",
      category: "Residency Proof",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Obtain a manual signed residence confirmation slip from the area Patwari or Numberdar verifying your residence in Haripur.",
      originalOrCopy: "Original Signed Slip",
      tips: "Visit the local Patwar Khana before going to the DC Office.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 4,
    },
    {
      id: "req-v1-uc",
      documentId: docIdMap.get("DOC-UC-VERIFICATION") ?? null,
      documentCode: "DOC-UC-VERIFICATION",
      title: "Union Council / Local Verification Form",
      category: "Residency Proof",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Get the residence endorsement signed and stamped by the Secretary Union Council / Village Council in Haripur.",
      originalOrCopy: "Original Endorsed Form",
      tips: "Bring your utility bill when requesting UC endorsement.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 5,
    },
    {
      id: "req-v1-cnic",
      documentId: docIdMap.get("DOC-CNIC") ?? null,
      documentCode: "DOC-CNIC",
      title: "Applicant CNIC / NICOP",
      category: "Identity",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          { questionKey: "age_group", comparator: "equals", value: "adult_18_plus" },
          { questionKey: "id_document", comparator: "equals", value: "has_cnic" },
        ],
      },
      conditionSummary: "Applies to adults (18+) with a valid CNIC",
      instructions:
        "Bring your original valid CNIC along with 1 attested photocopy.",
      originalOrCopy: "Original + 1 Attested Photocopy",
      tips: "Ensure CNIC has not expired before your office visit.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 6,
    },
    {
      id: "req-v1-bform",
      documentId: docIdMap.get("DOC-BFORM-PARENT") ?? null,
      documentCode: "DOC-BFORM-PARENT",
      title: "NADRA B-Form (CRC) & Father/Mother CNIC",
      category: "Identity",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ANY",
        rules: [
          { questionKey: "age_group", comparator: "equals", value: "minor_under_18" },
          { questionKey: "id_document", comparator: "equals", value: "has_bform" },
        ],
      },
      conditionSummary: "Applies to minors under 18 or applicants using a B-Form",
      instructions:
        "Provide the applicant's NADRA B-Form (CRC) and father/guardian's valid CNIC.",
      originalOrCopy: "Originals + 2 Photocopies Each",
      tips: "Parent or legal guardian should accompany minor applicants where required.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 7,
    },
    {
      id: "req-v1-nadra-prereq",
      documentId: docIdMap.get("DOC-NADRA-PREREQ") ?? null,
      documentCode: "DOC-NADRA-PREREQ",
      title: "NADRA Registration Prerequisite (Obtain B-Form or CNIC First)",
      category: "Identity",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [{ questionKey: "id_document", comparator: "equals", value: "neither" }],
      },
      conditionSummary: "Applies when applicant has neither CNIC nor B-Form",
      instructions:
        "Before visiting the DC Office, visit NADRA Haripur with your computerized Birth Certificate and parent CNIC to obtain a B-Form or CNIC first.",
      originalOrCopy: "Prerequisite Action + Birth Certificate",
      tips: "Completing NADRA registration first saves a rejected trip at the domicile counter.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 8,
    },
    {
      id: "req-v1-noc",
      documentId: docIdMap.get("DOC-NOC-CANCELLATION") ?? null,
      documentCode: "DOC-NOC-CANCELLATION",
      title: "Previous Domicile Cancellation Certificate (NOC)",
      category: "Clearance & NOC",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          {
            questionKey: "other_district_domicile",
            comparator: "equals",
            value: "yes",
          },
        ],
      },
      conditionSummary: "Applies if applicant previously held another district's domicile",
      instructions:
        "Submit the original Cancellation Certificate / NOC issued by the Deputy Commissioner Office of your previous district.",
      originalOrCopy: "Original NOC + 1 Photocopy",
      tips: "Keep a scanned copy of the NOC for your personal records.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 9,
    },
    {
      id: "req-v1-duplicate",
      documentId: docIdMap.get("DOC-DUPLICATE-AFFIDAVIT") ?? null,
      documentCode: "DOC-DUPLICATE-AFFIDAVIT",
      title: "Lost/Damaged Domicile Affidavit & Old Record / Police Report",
      category: "Affidavits",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          {
            questionKey: "application_type",
            comparator: "equals",
            value: "renewal_duplicate",
          },
        ],
      },
      conditionSummary: "Applies to duplicate, replacement, or renewal applications",
      instructions:
        "Attach a sworn affidavit on stamp paper plus either the damaged original domicile or a police report (Roznamcha) for a lost domicile.",
      originalOrCopy: "Original Stamp Paper Affidavit + Supporting Copy",
      tips: "Note down your original domicile registration number and year if available.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 10,
    },
    {
      id: "req-v1-temp-res",
      documentId: docIdMap.get("DOC-TEMP-RESIDENCE") ?? null,
      documentCode: "DOC-TEMP-RESIDENCE",
      title: "Continuous Residence Proof (Tenancy Agreement / Employer Letter)",
      category: "Residency Proof",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          {
            questionKey: "haripur_residence",
            comparator: "equals",
            value: "temporary_resident",
          },
        ],
      },
      conditionSummary: "Applies when permanent address is outside District Haripur",
      instructions:
        "Provide documentary proof of continuous stay in Haripur (rent agreement, employer posting letter, or school/college enrollment certificate).",
      originalOrCopy: "Original Letter/Agreement + 1 Photocopy",
      tips: "Verify the required continuous residency duration with CFC Haripur.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 11,
    },
  ];
}

function buildV2Requirements(docIdMap: Map<string, number>): VersionRequirement[] {
  return [
    {
      id: "req-v2-app-form",
      documentId: docIdMap.get("DOC-APP-FORM") ?? null,
      documentCode: "DOC-APP-FORM",
      title: "Domicile Application Form (Form P / District Prescribed Format)",
      category: "Application Forms",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Obtain Form P from the Citizen Facilitation Center (CFC) Haripur or authorized stamp vendor. Fill clearly in block letters with matching CNIC spelling and signature/thumb impression.",
      originalOrCopy: "Original Completed Form",
      tips: "Double-check Father's Name and Mouza/Tehsil spelling against your CNIC.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 1,
    },
    {
      id: "req-v2-photos",
      documentId: docIdMap.get("DOC-PHOTOS") ?? null,
      documentCode: "DOC-PHOTOS",
      title: "Recent Passport-Size Photographs",
      category: "Photographs & Fees",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Provide 3 recent passport-size color photographs with a plain blue background. Have one photograph attested on the reverse by a Grade-17 gazetted officer or Union Council secretary if requested.",
      originalOrCopy: "3 Original Prints (Blue Background)",
      tips: "Updated in v2.0: Blue background is preferred for digitized CFC cards (3 prints instead of 4).",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 2,
    },
    {
      id: "req-v2-residence",
      documentId: docIdMap.get("DOC-RESIDENCE-PROOF") ?? null,
      documentCode: "DOC-RESIDENCE-PROOF",
      title: "Proof of Residence in District Haripur (Utility Bill / Property Record)",
      category: "Residency Proof",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Bring a recent electricity (PESCO) or Sui Gas bill from the last 3 months showing the Haripur residential address in the applicant's or parent's name, or registry/fard copy.",
      originalOrCopy: "Original for Sighting + 1 Photocopy",
      tips: "Updated in v2.0: Carry the original bill for counter sighting, not just a photocopy.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 3,
    },
    {
      id: "req-v2-fee-challan",
      documentId: docIdMap.get("DOC-FEE-CHALLAN") ?? null,
      documentCode: "DOC-FEE-CHALLAN",
      title: "Treasury Fee Challan Receipt (Form 32-A / e-Sahulat)",
      category: "Photographs & Fees",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Deposit the prescribed provincial domicile fee into the National Bank of Pakistan (NBP) or designated e-Payment / CFC counter and attach the stamped applicant copy of Challan 32-A.",
      originalOrCopy: "Original Paid Receipt + 1 Copy",
      tips: "Added in v2.0: Paying the challan early in the morning avoids bank queue delays.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 4,
    },
    {
      id: "req-v2-uc",
      documentId: docIdMap.get("DOC-UC-VERIFICATION") ?? null,
      documentCode: "DOC-UC-VERIFICATION",
      title: "Union Council / Local Verification Form",
      category: "Residency Proof",
      requirementType: "mandatory",
      conditionLogic: null,
      conditionSummary: "Mandatory for all applicants",
      instructions:
        "Get the residence endorsement signed and stamped by the Secretary Union Council / Village Council in Haripur.",
      originalOrCopy: "Original Endorsed Form",
      tips: "Bring your utility bill when requesting UC endorsement.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 5,
    },
    {
      id: "req-v2-cnic",
      documentId: docIdMap.get("DOC-CNIC") ?? null,
      documentCode: "DOC-CNIC",
      title: "Applicant CNIC / NICOP",
      category: "Identity",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          { questionKey: "age_group", comparator: "equals", value: "adult_18_plus" },
          { questionKey: "id_document", comparator: "equals", value: "has_cnic" },
        ],
      },
      conditionSummary: "Applies to adults (18+) with a valid CNIC",
      instructions:
        "Carry your original valid NADRA CNIC for biometric/counter verification along with 2 clear front-and-back photocopies attested by a gazetted officer if required.",
      originalOrCopy: "Original + 2 Attested Photocopies",
      tips: "Updated in v2.0: Bring 2 photocopies instead of 1 (one for CFC file, one for verification ledger).",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 6,
    },
    {
      id: "req-v2-bform",
      documentId: docIdMap.get("DOC-BFORM-PARENT") ?? null,
      documentCode: "DOC-BFORM-PARENT",
      title: "NADRA B-Form (CRC) & Father/Mother CNIC",
      category: "Identity",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ANY",
        rules: [
          { questionKey: "age_group", comparator: "equals", value: "minor_under_18" },
          { questionKey: "id_document", comparator: "equals", value: "has_bform" },
        ],
      },
      conditionSummary: "Applies to minors under 18 or applicants using a B-Form",
      instructions:
        "Provide the applicant's NADRA B-Form (CRC) and father/guardian's valid CNIC.",
      originalOrCopy: "Originals + 2 Photocopies Each",
      tips: "Parent or legal guardian should accompany minor applicants where required.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 7,
    },
    {
      id: "req-v2-nadra-prereq",
      documentId: docIdMap.get("DOC-NADRA-PREREQ") ?? null,
      documentCode: "DOC-NADRA-PREREQ",
      title: "NADRA Registration Prerequisite (Obtain B-Form or CNIC First)",
      category: "Identity",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [{ questionKey: "id_document", comparator: "equals", value: "neither" }],
      },
      conditionSummary: "Applies when applicant has neither CNIC nor B-Form",
      instructions:
        "Before visiting the DC Office, visit NADRA Haripur with your computerized Birth Certificate and parent CNIC to obtain a B-Form or CNIC first.",
      originalOrCopy: "Prerequisite Action + Birth Certificate",
      tips: "Completing NADRA registration first saves a rejected trip at the domicile counter.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 8,
    },
    {
      id: "req-v2-frc",
      documentId: docIdMap.get("DOC-FRC") ?? null,
      documentCode: "DOC-FRC",
      title: "NADRA Family Registration Certificate (FRC)",
      category: "Identity",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ANY",
        rules: [
          { questionKey: "age_group", comparator: "equals", value: "minor_under_18" },
          {
            questionKey: "haripur_residence",
            comparator: "equals",
            value: "temporary_resident",
          },
        ],
      },
      conditionSummary:
        "Applies to minors under 18 OR temporary residents proving family linkage",
      instructions:
        "Obtain a Family Registration Certificate (FRC) from NADRA or Pak-Identity app showing family linkage with parents/guardian residing in Haripur.",
      originalOrCopy: "Original NADRA Printout + 1 Photocopy",
      tips: "Added in v2.0: Can be ordered online via NADRA Pak-Identity before your visit.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 9,
    },
    {
      id: "req-v2-noc",
      documentId: docIdMap.get("DOC-NOC-CANCELLATION") ?? null,
      documentCode: "DOC-NOC-CANCELLATION",
      title: "Previous Domicile Cancellation Certificate (NOC)",
      category: "Clearance & NOC",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          {
            questionKey: "other_district_domicile",
            comparator: "equals",
            value: "yes",
          },
        ],
      },
      conditionSummary: "Applies if applicant previously held another district's domicile",
      instructions:
        "Submit the original Cancellation Certificate / NOC issued by the Deputy Commissioner Office of your previous district.",
      originalOrCopy: "Original NOC + 1 Photocopy",
      tips: "Keep a scanned copy of the NOC for your personal records.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 10,
    },
    {
      id: "req-v2-duplicate",
      documentId: docIdMap.get("DOC-DUPLICATE-AFFIDAVIT") ?? null,
      documentCode: "DOC-DUPLICATE-AFFIDAVIT",
      title: "Lost/Damaged Domicile Affidavit & Old Record / Police Report",
      category: "Affidavits",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          {
            questionKey: "application_type",
            comparator: "equals",
            value: "renewal_duplicate",
          },
        ],
      },
      conditionSummary: "Applies to duplicate, replacement, or renewal applications",
      instructions:
        "Attach a sworn affidavit on stamp paper plus either the damaged original domicile or a police report (Roznamcha) for a lost domicile.",
      originalOrCopy: "Original Stamp Paper Affidavit + Supporting Copy",
      tips: "Note down your original domicile registration number and year if available.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 11,
    },
    {
      id: "req-v2-temp-res",
      documentId: docIdMap.get("DOC-TEMP-RESIDENCE") ?? null,
      documentCode: "DOC-TEMP-RESIDENCE",
      title: "Continuous Residence Proof (Tenancy Agreement / Employer or Institute Letter)",
      category: "Residency Proof",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          {
            questionKey: "haripur_residence",
            comparator: "equals",
            value: "temporary_resident",
          },
        ],
      },
      conditionSummary: "Applies when permanent address is outside District Haripur",
      instructions:
        "Since your permanent CNIC address is outside Haripur, attach proof of continuous residence in Haripur (e.g., registered rent agreement, employer posting letter, or educational enrollment record plus utility bills).",
      originalOrCopy: "Original Letter/Agreement + 1 Photocopy",
      tips: "Verify the required continuous residency duration with CFC Haripur.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 12,
    },
    {
      id: "req-v2-nikah",
      documentId: docIdMap.get("DOC-NIKAH-SPOUSE") ?? null,
      documentCode: "DOC-NIKAH-SPOUSE",
      title: "Registered Nikah Nama & Spouse CNIC / Haripur Domicile",
      category: "Residency Proof",
      requirementType: "conditional",
      conditionLogic: {
        operator: "ALL",
        rules: [
          {
            questionKey: "spouse_domicile_basis",
            comparator: "equals",
            value: "yes",
          },
        ],
      },
      conditionSummary: "Applies when applying based on spouse's Haripur domicile",
      instructions:
        "Provide a computerized Marriage Registration Certificate (MRC) or attested Nikah Nama along with your spouse's valid CNIC and existing Haripur Domicile Certificate.",
      originalOrCopy: "Originals + 2 Photocopies Each",
      tips: "Added in v2.0: Ensure spouse's CNIC reflects current marital status.",
      verificationStatus: "illustrative",
      sourceNote: "Sample requirement. Not confirmed with the office.",
      displayOrder: 13,
    },
  ];
}

async function runSeed() {
  // Check if admin user already exists -> fast path if fully seeded
  const [{ value: serviceCount }] = await db
    .select({ value: count() })
    .from(services);

  const [{ value: adminCount }] = await db
    .select({ value: count() })
    .from(adminUsers);

  if (adminCount === 0) {
    await db
      .insert(adminUsers)
      .values({
        email: DEMO_ADMIN_EMAIL,
        name: "Ayesha Khan (Demo Admin)",
        role: "Civic Service Administrator",
        passwordHash: hashPassword(DEMO_ADMIN_PASSWORD),
      })
      .onConflictDoNothing();
  }

  if (serviceCount > 0) {
    seededChecked = true;
    return;
  }

  // 1. Seed Master Documents
  const insertedDocs = await db
    .insert(documents)
    .values(MASTER_DOCUMENTS)
    .onConflictDoNothing()
    .returning();

  const allDocs =
    insertedDocs.length > 0 ? insertedDocs : await db.select().from(documents);
  const docIdMap = new Map<string, number>(allDocs.map((d) => [d.code, d.id]));

  // 2. Seed Services
  const [domicileService] = await db
    .insert(services)
    .values({
      slug: "domicile-certificate-haripur",
      name: "Domicile Certificate",
      jurisdiction: "Haripur, Khyber Pakhtunkhwa, Pakistan",
      officeName: "Deputy Commissioner Office / Citizen Facilitation Center, Haripur",
      category: "Identity & Residency",
      summary:
        "Proof that you are a permanent resident of District Haripur. Often needed for admissions, jobs and other applications.",
      description:
        "A domicile certificate shows that you are a permanent resident of District Haripur. It is often needed for university admissions, government jobs and other official applications. Answer a few questions to see which documents you need to bring, whether this is your first application or a replacement.",
      estimatedTime: "About 10 minutes",
      feeInfo: "Paid by bank challan. Confirm the current amount at CFC Haripur.",
      isActive: true,
    })
    .returning();

  const [characterService] = await db
    .insert(services)
    .values({
      slug: "police-character-certificate-haripur",
      name: "Police Character Certificate",
      jurisdiction: "Haripur, Khyber Pakhtunkhwa, Pakistan",
      officeName: "Police Assistance Lines (PAL), Haripur",
      category: "Police & Clearance",
      summary:
        "Shows your police record. Often needed for jobs, scholarships and visas.",
      description:
        "The document checklist for this service is still being prepared.",
      estimatedTime: "About 10 minutes",
      feeInfo: "Confirm the fee at Police Assistance Lines, Haripur.",
      isActive: true,
    })
    .returning();

  await db.insert(services).values({
    slug: "birth-registration-haripur",
    name: "Computerized Birth Registration Certificate",
    jurisdiction: "Haripur, Khyber Pakhtunkhwa, Pakistan",
    officeName: "Union Council / Tehsil Municipal Administration, Haripur",
    category: "Civil Registration",
    summary:
      "Birth certificate issued by your Union Council and registered with NADRA.",
    description:
      "The document checklist for this service is still being prepared.",
    estimatedTime: "About 10 minutes",
    feeInfo: "Confirm the fee at your Union Council.",
    isActive: true,
  });

  // 3. Seed Domicile Versions: v1.0 (Published) and v2.0 (Published)
  const v1Reqs = buildV1Requirements(docIdMap);
  const v2Reqs = buildV2Requirements(docIdMap);

  const [v1] = await db
    .insert(checklistVersions)
    .values({
      serviceId: domicileService.id,
      versionNumber: "1.0",
      status: "published",
      changelogSummary:
        "First published checklist.",
      effectiveDate: "2025-09-20",
      publishedAt: new Date("2025-09-15T09:00:00Z"),
      lastVerifiedDate: "2025-09-15",
      sourceReference:
        "Sample data based on the general domicile process in Khyber Pakhtunkhwa. Not confirmed with DC Office Haripur.",
      disclaimerText: HARIPUR_DISCLAIMER,
      questionsJson: DOMICILE_QUESTIONS_V1,
      requirementsJson: v1Reqs,
      createdBy: DEMO_ADMIN_EMAIL,
    })
    .returning();

  const [v2] = await db
    .insert(checklistVersions)
    .values({
      serviceId: domicileService.id,
      versionNumber: "2.0",
      status: "published",
      changelogSummary:
        "The Patwari slip is no longer needed. The fee challan is now required, the Family Registration Certificate was added for minors and temporary residents, and there is a new question about applying through a spouse. Photo and CNIC copy requirements were updated.",
      effectiveDate: "2026-02-15",
      publishedAt: new Date("2026-02-10T10:30:00Z"),
      lastVerifiedDate: "2026-02-10",
      sourceReference:
        "Sample data based on the Citizen Facilitation Center (CFC) Haripur process. Not confirmed with the office.",
      disclaimerText: HARIPUR_DISCLAIMER,
      questionsJson: DOMICILE_QUESTIONS_V2,
      requirementsJson: v2Reqs,
      createdBy: DEMO_ADMIN_EMAIL,
    })
    .returning();

  // Seed a Draft v0.9 on Police Character Certificate (unpublished -> demonstrates edge case!)
  await db.insert(checklistVersions).values({
    serviceId: characterService.id,
    versionNumber: "0.9",
    status: "draft",
    changelogSummary:
      "First draft. Not published yet.",
    effectiveDate: "2026-04-01",
    publishedAt: null,
    lastVerifiedDate: "2026-03-01",
    sourceReference: "Draft. Not confirmed with Police Assistance Lines, Haripur.",
    disclaimerText:
      "Draft checklist. Not confirmed or published.",
    questionsJson: [
      {
        id: "q_purpose",
        key: "clearance_purpose",
        step: 1,
        prompt: "What is the purpose of your Character Certificate?",
        helpText: "Visa/foreign travel requests may require passport details.",
        required: true,
        type: "single_choice",
        options: [
          { value: "domestic", label: "Domestic Employment / Education" },
          { value: "abroad", label: "Foreign Visa / Immigration" },
        ],
      },
    ],
    requirementsJson: [
      {
        id: "req-char-cnic",
        documentId: docIdMap.get("DOC-CNIC") ?? null,
        documentCode: "DOC-CNIC",
        title: "Applicant CNIC / NICOP",
        category: "Identity",
        requirementType: "mandatory",
        conditionLogic: null,
        conditionSummary: "Mandatory for all applicants",
        instructions: "Original CNIC plus 2 photocopies.",
        originalOrCopy: "Original + 2 Photocopies",
        tips: "Ensure current Haripur address is verifiable.",
        verificationStatus: "illustrative",
        sourceNote: "Illustrative draft.",
        displayOrder: 1,
      },
    ],
    createdBy: DEMO_ADMIN_EMAIL,
  });

  // 4. Seed 3 Realistic Citizen Checklist Sessions
  // Session 1: EZD-HRP-1001 generated on v1.0 (OUTDATED -> demonstrates update detection!)
  const s1Answers = {
    age_group: "adult_18_plus",
    id_document: "has_cnic",
    application_type: "first_time",
    haripur_residence: "permanent_haripur",
    other_district_domicile: "no",
  };
  const s1Gen = generatePersonalizedChecklist(v1Reqs, DOMICILE_QUESTIONS_V1, s1Answers);
  s1Gen.items = s1Gen.items.map((item, idx) => {
    if (idx === 0 || idx === 1 || idx === 5) return { ...item, status: "ready" };
    if (idx === 2)
      return {
        ...item,
        status: "needs_verification",
        citizenNote: "Bill is in father's name — confirm if acceptable at counter.",
      };
    return { ...item, status: "missing" };
  });

  await db.insert(checklistSessions).values({
    sessionCode: "EZD-HRP-1001",
    serviceId: domicileService.id,
    serviceSlug: domicileService.slug,
    serviceName: domicileService.name,
    jurisdiction: domicileService.jurisdiction,
    checklistVersionId: v1.id,
    versionNumber: v1.versionNumber,
    applicantLabel: "Hamza Tariq",
    answersJson: s1Answers,
    itemsJson: s1Gen.items,
    excludedItemsJson: s1Gen.excludedItems,
    versionSnapshotMeta: {
      effectiveDate: v1.effectiveDate,
      publishedAt: v1.publishedAt ? v1.publishedAt.toISOString() : null,
      lastVerifiedDate: v1.lastVerifiedDate,
      sourceReference: v1.sourceReference,
      disclaimerText: v1.disclaimerText,
    },
    parentSessionCode: null,
  });

  // Session 2: EZD-HRP-2042 generated on v2.0 (Adult with prior district domicile -> includes NOC!)
  const s2Answers = {
    age_group: "adult_18_plus",
    id_document: "has_cnic",
    application_type: "first_time",
    haripur_residence: "temporary_resident",
    other_district_domicile: "yes",
    spouse_domicile_basis: "no",
  };
  const s2Gen = generatePersonalizedChecklist(v2Reqs, DOMICILE_QUESTIONS_V2, s2Answers);
  s2Gen.items = s2Gen.items.map((item) => {
    if (
      ["DOC-APP-FORM", "DOC-PHOTOS", "DOC-RESIDENCE-PROOF", "DOC-CNIC", "DOC-FEE-CHALLAN"].includes(
        item.documentCode
      )
    ) {
      return { ...item, status: "ready" };
    }
    if (item.documentCode === "DOC-NOC-CANCELLATION") {
      return {
        ...item,
        status: "needs_verification",
        citizenNote: "Requested cancellation NOC from Abbottabad DC Office last week.",
      };
    }
    return { ...item, status: "missing" };
  });

  await db.insert(checklistSessions).values({
    sessionCode: "EZD-HRP-2042",
    serviceId: domicileService.id,
    serviceSlug: domicileService.slug,
    serviceName: domicileService.name,
    jurisdiction: domicileService.jurisdiction,
    checklistVersionId: v2.id,
    versionNumber: v2.versionNumber,
    applicantLabel: "Sana Bibi",
    answersJson: s2Answers,
    itemsJson: s2Gen.items,
    excludedItemsJson: s2Gen.excludedItems,
    versionSnapshotMeta: {
      effectiveDate: v2.effectiveDate,
      publishedAt: v2.publishedAt ? v2.publishedAt.toISOString() : null,
      lastVerifiedDate: v2.lastVerifiedDate,
      sourceReference: v2.sourceReference,
      disclaimerText: v2.disclaimerText,
    },
    parentSessionCode: null,
  });

  // Session 3: EZD-HRP-2088 generated on v2.0 (Minor under 18 with B-Form -> 100% Ready!)
  const s3Answers = {
    age_group: "minor_under_18",
    id_document: "has_bform",
    application_type: "first_time",
    haripur_residence: "permanent_haripur",
    other_district_domicile: "no",
    spouse_domicile_basis: "no",
  };
  const s3Gen = generatePersonalizedChecklist(v2Reqs, DOMICILE_QUESTIONS_V2, s3Answers);
  s3Gen.items = s3Gen.items.map((item) => ({ ...item, status: "ready" }));

  await db.insert(checklistSessions).values({
    sessionCode: "EZD-HRP-2088",
    serviceId: domicileService.id,
    serviceSlug: domicileService.slug,
    serviceName: domicileService.name,
    jurisdiction: domicileService.jurisdiction,
    checklistVersionId: v2.id,
    versionNumber: v2.versionNumber,
    applicantLabel: "Bilal Ahmed (son)",
    answersJson: s3Answers,
    itemsJson: s3Gen.items,
    excludedItemsJson: s3Gen.excludedItems,
    versionSnapshotMeta: {
      effectiveDate: v2.effectiveDate,
      publishedAt: v2.publishedAt ? v2.publishedAt.toISOString() : null,
      lastVerifiedDate: v2.lastVerifiedDate,
      sourceReference: v2.sourceReference,
      disclaimerText: v2.disclaimerText,
    },
    parentSessionCode: null,
  });

  // Verify seed completed
  const check = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.slug, "domicile-certificate-haripur"));
  if (check.length > 0) {
    seededChecked = true;
  }
}

export async function ensureSeeded(): Promise<void> {
  if (seededChecked) return;
  if (!seedPromise) {
    seedPromise = runSeed().finally(() => {
      seedPromise = null;
    });
  }
  await seedPromise;
}
