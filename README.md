# EZDocs

Find out which documents you need before you go to a government office.

You pick a service, answer a few questions about your situation, and get a checklist of the documents that apply to you. You can mark each document as ready, missing or needing a check, save the checklist with a code, and download it as a PDF.

The first service is the **Domicile Certificate for District Haripur, Pakistan**.

## Running it

```bash
npm install
npx drizzle-kit push   # create the tables (needs DATABASE_URL in .env)
npm run build && npm start
```

Sample data is added automatically the first time the app is opened.

## Admin

Go to `/admin` and sign in with the demo account:

- Email: `admin@ezdocs.gov.demo`
- Password: `EZDocs2026!`

In the admin area you can:

- add and edit services
- manage reusable document templates
- create a draft checklist (blank or copied from an earlier version)
- edit questions, documents and the rules that decide who needs each document
- publish a draft (published versions are locked and can't be edited or deleted)
- compare any two versions to see what was added, removed or changed

## How versions work

Each checklist version has a version number, effective date, publish date, last-checked date and source note. A saved checklist keeps a copy of the version it was made with. When a newer version is published, the saved checklist shows a notice with the changes and lets the person create an updated copy. The original stays unchanged, and statuses carry over to the copy. If a document's instructions changed, it's marked "needs checking" instead of "ready".

## Sample data

- **Domicile Certificate – Haripur**: published versions 1.0 and 2.0
- **Police Character Certificate – Haripur**: draft only (shows how a service without a published checklist behaves)
- **Birth Registration – Haripur**: no checklist yet
- Saved checklists:
  - `EZD-HRP-1001`: made with version 1.0, so it shows the update notice
  - `EZD-HRP-2042`: adult who moved from another district
  - `EZD-HRP-2088`: applicant under 18, all documents ready

## Cases handled

| Case | Where to see it |
| --- | --- |
| A question is left unanswered | `/services/domicile-certificate-haripur/questionnaire` (checked in the browser and on the server) |
| A document doesn't apply | `/checklists/EZD-HRP-2088` → "Not needed for you" |
| A newer version was published after the checklist was made | `/checklists/EZD-HRP-1001` |
| The checklist code doesn't exist | `/checklists/EZD-XXX-0000` |
| The service has no published checklist | `/services/police-character-certificate-haripur` |

The `/about` page runs five example cases against version 2.0 each time it loads and shows whether the documents listed match what we expect. These are automatic rule checks, not results from user testing. No testing with real users has been done yet.

## Limitations

- The Haripur requirements are **sample information**, not confirmed with the Deputy Commissioner Office. They are marked as sample requirements on every checklist and PDF.
- EZDocs doesn't connect to any government system and doesn't submit anything.
- Anyone with a checklist code can open that checklist.
- The admin area uses one demo account.

## Built with
Next.js (App Router), React, TypeScript, Tailwind CSS, PostgreSQL with Drizzle ORM, and jsPDF.
## Link
https://ezdocs-chi.vercel.app/services
