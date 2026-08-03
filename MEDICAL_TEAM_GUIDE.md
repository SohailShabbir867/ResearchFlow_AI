# 🏥 ResearchFlow AI — Medical Team Guide

> Data Collection & AI Training Manual for Medical Professionals

---

## 👋 Welcome, Doctor

This guide is written specifically for **medical professionals** — not developers.
You do not need to understand code. Your role is the most important part of this project:
**finding, selecting, and organizing the medical knowledge** that the AI will learn from.

The AI is only as good as the documents you give it.
A doctor with good sources = a smart AI assistant.

---

## 📋 Table of Contents

- [What Is This AI and How Does It Learn](#-what-is-this-ai-and-how-does-it-learn)
- [Your Role on the Team](#-your-role-on-the-team)
- [What Documents to Collect](#-what-documents-to-collect)
- [Where to Find Quality Medical Sources](#-where-to-find-quality-medical-sources)
- [Document Quality Checklist](#-document-quality-checklist)
- [How to Submit Documents](#-how-to-submit-documents)
- [Document Naming Rules](#-document-naming-rules)
- [Week-by-Week Collection Plan](#-week-by-week-collection-plan)
- [Testing the AI After Each Batch](#-testing-the-ai-after-each-batch)
- [Reporting Bad Answers](#-reporting-bad-answers)
- [Specialty Coverage Tracker](#-specialty-coverage-tracker)
- [Do's and Don'ts](#-dos-and-donts)

---

## 🧠 What Is This AI and How Does It Learn

### Plain language explanation

Think of this AI like a **very fast medical librarian**.

When you ask it a question, it does NOT guess. Instead it:

1. Searches through every document you gave it
2. Finds the most relevant paragraphs
3. Reads those paragraphs and writes you a summary answer
4. Tells you exactly which document the answer came from

```
You ask:  "What is the first-line treatment for hypertension?"

AI does:  Searches 200 documents → finds 5 relevant paragraphs
          from "JNC8_hypertension_guidelines.pdf" and
          "WHO_cardiovascular_protocol.pdf"

AI says:  "According to JNC8 guidelines, first-line treatment
          includes thiazide diuretics, ACE inhibitors..."
          Source: JNC8_hypertension_guidelines.pdf
```

### What makes it smarter

The AI does NOT need to be retrained. It gets smarter simply by reading more documents.
**Every PDF you add = more knowledge the AI can draw from.**

---

## 👨‍⚕️ Your Role on the Team

As a medical professional, you are responsible for:

| Task | Description |
|------|-------------|
| **Source selection** | Find trustworthy, current medical documents |
| **Quality review** | Reject outdated or unreliable sources |
| **Coverage planning** | Make sure all key specialties are represented |
| **Answer testing** | Ask the AI questions and flag wrong answers |
| **Feedback reporting** | Tell the developer when an answer is incorrect |

You do NOT need to:
- Write any code
- Understand how embeddings work
- Configure any servers

---

## 📚 What Documents to Collect

### ✅ Best Document Types (Highest Priority)

```
1. Clinical Practice Guidelines
   Examples: AHA, ACC, WHO, CDC, NICE, ESC guidelines
   Why: Evidence-based, peer-reviewed, regularly updated

2. Systematic Reviews and Meta-analyses
   Examples: Cochrane Reviews, PubMed systematic reviews
   Why: Highest level of evidence, comprehensive coverage

3. Standard Treatment Protocols
   Examples: Hospital SOPs, national treatment protocols
   Why: Directly actionable for clinical decisions

4. Pharmacology References
   Examples: Drug monographs, prescribing guidelines, BNF chapters
   Why: Critical for dosage and interaction questions

5. Diagnostic Criteria Documents
   Examples: DSM-5 criteria, ICD-11 descriptions, WHO diagnostic guidelines
   Why: Accurate, standardized diagnostic information
```

### ⚠️ Use With Caution (Medium Priority)

```
6. Medical Textbook Chapters (scanned or digital)
   Why: Good content but may be older editions

7. Case Reports and Case Series
   Why: Good for rare conditions, low generalizability

8. Hospital Discharge Guidelines
   Why: Practical but institution-specific
```

### ❌ Do Not Submit

```
× Patient records or any data with patient names
× Documents older than 10 years (unless historically important)
× Opinion pieces without evidence base
× Newspaper or magazine health articles
× Social media content or blog posts
× Documents in languages other than English (current version)
× Scanned PDFs where text is not readable (image-only scans)
```

---

## 🌐 Where to Find Quality Medical Sources

### Free Full-Text Research Papers

```
PubMed Central (PMC)
Link:  https://www.ncbi.nlm.nih.gov/pmc/
How:   Search your topic → filter "Free Full Text" → Download PDF
Best for: Research papers, systematic reviews, clinical trials
```

```
WHO Publications Library
Link:  https://www.who.int/publications
How:   Browse by topic or disease → Download PDF
Best for: Global health guidelines, disease protocols
```

```
CDC Clinical Guidelines
Link:  https://www.cdc.gov/library/
How:   Search by disease or condition → Download PDF
Best for: Infectious disease, public health protocols
```

```
NIH Health Information
Link:  https://www.nih.gov/health-information
How:   Browse by institute (NCI, NHLBI, NIDDK etc.)
Best for: Cancer, heart disease, diabetes guidelines
```

```
NICE Guidelines (UK)
Link:  https://www.nice.org.uk/guidance
How:   Search condition → Download full guideline PDF
Best for: Comprehensive evidence-based clinical guidelines
```

```
Cochrane Library
Link:  https://www.cochranelibrary.com
How:   Search topic → Download systematic review
Best for: Systematic reviews and meta-analyses
```

```
ESC Guidelines (Cardiology)
Link:  https://www.escardio.org/Guidelines
How:   Browse by topic → Download PDF
Best for: Cardiology guidelines
```

```
AHA / ACC Guidelines
Link:  https://www.ahajournals.org
How:   Browse guidelines section → Download PDF
Best for: Heart failure, hypertension, arrhythmia
```

### Specialty-Specific Sources

| Specialty           | Best Source                                      |
|---------------------|--------------------------------------------------|
| Cardiology          | ESC, AHA, ACC guidelines                        |
| Endocrinology       | ADA Standards of Care, Endocrine Society        |
| Oncology            | NCCN Guidelines (free registration), ASCO       |
| Infectious Disease  | CDC, IDSA, WHO                                  |
| Psychiatry          | DSM-5, APA guidelines, NICE mental health       |
| Pulmonology         | GOLD COPD, GINA Asthma, ATS guidelines          |
| Nephrology          | KDIGO guidelines                                |
| Neurology           | AAN guidelines, Stroke guidelines (AHA)         |
| Pediatrics          | AAP guidelines, WHO child health protocols      |
| Pharmacology        | BNF, WHO Essential Medicines, FDA drug labels   |

---

## ✅ Document Quality Checklist

Before submitting any document, answer these questions:

```
□  Is this document from a recognized medical authority?
   (WHO, CDC, NIH, peer-reviewed journal, national medical society)

□  Is it published within the last 5 years?
   (Exception: foundational texts, historical guidelines)

□  Is it evidence-based? (not opinion only)

□  Is the full text readable? (not a scanned image-only PDF)

□  Does it NOT contain any patient-identifying information?

□  Is it in English?

□  Is it relevant to the specialties we are covering?

□  Is the file size under 50MB?
```

If you answered YES to all 8 — submit the document.
If any answer is NO — do not submit without discussing with the team.

---

## 📤 How to Submit Documents

### Step 1 — Rename the file correctly
See naming rules below before renaming.

### Step 2 — Place the file in the shared folder

```
Location on project computer:
medresearch-ai → backend-python → data → documents

If working remotely, upload to the shared Google Drive folder:
[Ask developer for the shared drive link]
```

### Step 3 — Log the document in the tracking sheet

Fill in the **Document Tracker** spreadsheet (shared with the team):

| Column | What to fill |
|--------|-------------|
| Filename | Exact filename you saved |
| Topic | Main medical topic |
| Source | Where you downloaded it from |
| Year | Publication year |
| Specialty | Which specialty it covers |
| Submitted by | Your name |
| Date added | Today's date |
| Quality rating | 1-5 stars |

### Step 4 — Notify the developer

Send a message: *"Added 3 new documents to the folder — ready to index."*
The developer will run the indexing script to feed them to the AI (takes 2-5 minutes).

---

## 🏷️ Document Naming Rules

Good filenames make the AI's source citations readable and professional.

### Format

```
[topic]_[subtype]_[organization]_[year].pdf
```

### Examples

```
✅ Correct:
   diabetes_type2_management_ADA_2024.pdf
   hypertension_guidelines_JNC8_2023.pdf
   heart_failure_treatment_ESC_2023.pdf
   pharmacology_antibiotics_WHO_2022.pdf
   oncology_breast_cancer_NCCN_2024.pdf
   pediatrics_vaccination_schedule_CDC_2024.pdf

❌ Wrong:
   document.pdf
   scan001.pdf
   guidelines (1).pdf
   New Microsoft Word Document.pdf
   Copy of copy of guidelines FINAL v3.pdf
```

### Naming Rules Summary

- Use underscores `_` not spaces
- All lowercase
- Include the year
- Include the source organization
- Keep it short but descriptive (3-6 words + year)

---

## 📅 Week-by-Week Collection Plan

### Week 1 — Foundation (10-15 documents)

Focus on the most common conditions seen in your practice.

```
Priority topics for Week 1:
  □ Diabetes (Type 1, Type 2, management guidelines)
  □ Hypertension (diagnosis, treatment protocols)
  □ Heart failure (ACC/AHA or ESC guidelines)
  □ Common infections (WHO antibiotic guidelines)
  □ Asthma / COPD (GINA, GOLD guidelines)

Goal: AI can answer basic questions in these 5 areas.
Test: Ask 5 questions per topic after indexing.
```

### Week 2 — Specialty Expansion (20-30 documents)

```
Priority topics for Week 2:
  □ Oncology basics (NCCN or local protocol)
  □ Mental health (depression, anxiety — NICE or APA)
  □ Pediatric common conditions (AAP guidelines)
  □ Neurology basics (stroke, headache, seizure)
  □ Pharmacology reference (BNF section or WHO drug list)

Goal: AI covers the top 10 medical specialties.
Test: 3 questions per new specialty.
```

### Week 3 — Quality and Depth (20-30 documents)

```
Priority topics for Week 3:
  □ Replace any documents that gave wrong answers
  □ Add more specific drug dosage references
  □ Add clinical case studies for rare conditions
  □ Add local hospital protocols (de-identified)
  □ Add diagnostic criteria documents (ICD-11 selections)

Goal: AI gives more precise, cited answers.
Test: Compare AI answer to your own clinical knowledge.
```

### Month 2 — Specialty Deep Dive (50+ documents)

```
Pick 2-3 specialties and go deep:
  □ Full cardiology guideline set (AHA + ESC + ACC)
  □ Complete oncology protocols for top 5 cancers
  □ Comprehensive pharmacology reference
  □ Emergency medicine protocols

Goal: AI becomes a reliable specialist-level assistant.
```

---

## 🧪 Testing the AI After Each Batch

After the developer indexes a new batch of documents, test the AI:

### How to Test

1. Open the ResearchFlow AI chat interface
2. Ask questions related to the documents you just added
3. Check: Is the answer correct? Does it cite the right source?

### Good Test Questions to Ask

```
Factual questions (has a clear correct answer):
  "What is the first-line treatment for Type 2 diabetes?"
  "What are the diagnostic criteria for hypertension?"
  "What is the recommended dose of metformin?"

Differential questions:
  "What are the differences between Type 1 and Type 2 diabetes?"
  "How do ACE inhibitors differ from ARBs?"

Protocol questions:
  "What should be done in the first hour of a STEMI?"
  "What is the sepsis 3-hour bundle?"

Negative test (AI should say it doesn't know):
  "What is the secret cure for cancer?"
  → AI should say: "I don't have enough information" NOT make something up
```

### Scoring Each Answer

Rate each answer after testing:

```
⭐⭐⭐⭐⭐  Correct, well-cited, clinically useful
⭐⭐⭐⭐    Mostly correct, minor gaps
⭐⭐⭐      Partially correct, needs better documents on this topic
⭐⭐        Incorrect but cited a source (source may be wrong or misread)
⭐          Hallucinated (gave wrong answer without source) — report immediately
```

---

## 🚨 Reporting Bad Answers

If the AI gives a wrong or dangerous answer, report it immediately.

### How to Report

Fill in the **Answer Issue Log** spreadsheet:

| Field | What to write |
|-------|--------------|
| Date | Today's date |
| Question asked | Exact question you typed |
| AI answer | Copy the AI's answer |
| What is wrong | Briefly explain the error |
| Correct answer | What the correct clinical answer is |
| Source of correct answer | Which guideline or textbook |
| Severity | Low / Medium / High / Critical |

### Severity Guide

```
Low      — Minor inaccuracy, not clinically dangerous
           Example: wrong publication year, missing one drug option

Medium   — Partially wrong information
           Example: correct drug but wrong dose range

High     — Wrong information that could affect clinical decisions
           Example: wrong first-line treatment recommendation

Critical — Dangerous or harmful information
           Example: contraindication missed, lethal dose error
           → Contact developer immediately, do not wait
```

---

## 📊 Specialty Coverage Tracker

Use this to track which specialties have enough documents:

| Specialty | Documents Added | Coverage | Status |
|-----------|----------------|----------|--------|
| Cardiology | 0 | 0% | ❌ Not started |
| Endocrinology | 0 | 0% | ❌ Not started |
| Infectious Disease | 0 | 0% | ❌ Not started |
| Oncology | 0 | 0% | ❌ Not started |
| Pulmonology | 0 | 0% | ❌ Not started |
| Neurology | 0 | 0% | ❌ Not started |
| Psychiatry | 0 | 0% | ❌ Not started |
| Nephrology | 0 | 0% | ❌ Not started |
| Pediatrics | 0 | 0% | ❌ Not started |
| Pharmacology | 0 | 0% | ❌ Not started |
| Emergency Medicine | 0 | 0% | ❌ Not started |
| Gastroenterology | 0 | 0% | ❌ Not started |

Update this table in your team meeting each week.

Target: **10+ documents per specialty** before calling it production-ready.

---

## 🚫 Do's and Don'ts

### ✅ Do

- Submit documents from recognized authorities (WHO, CDC, NIH, ESC, AHA)
- Use recent publications (last 5 years preferred)
- Name files clearly using the naming convention
- Test the AI after every batch of new documents
- Report wrong answers promptly using the issue log
- Keep the document tracker spreadsheet updated
- Ask the developer to re-index after adding 5+ new documents

### ❌ Don't

- Submit any document containing patient names or identifiers
- Submit documents older than 10 years without team approval
- Submit scanned PDFs where the text cannot be copied
- Assume the AI is always right — always verify critical clinical decisions
- Skip the quality checklist when submitting documents
- Use the AI output directly without your own clinical judgment

---

## ⚠️ Important Clinical Disclaimer

```
This AI assistant is a research and information tool only.

It is NOT a substitute for:
  - Clinical judgment
  - Direct patient assessment
  - Specialist consultation
  - Current local formulary and protocols

Always verify AI-generated information against current
guidelines before applying to patient care.

The AI can be wrong. The AI can be outdated.
You are the doctor. You are responsible for the decision.
```

---

## 📞 Contact

For technical issues: Contact the developer (Sohail)
For document quality questions: Discuss with the lead physician on the team
For urgent wrong-answer reports: Contact both immediately

---

*ResearchFlow AI — Medical Team Guide v1.0*
*For internal use only · Not for patient distribution*
