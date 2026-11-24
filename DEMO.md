# Demo guide — chapter study hub

**What it does:** pick *board → class → medium → book → chapter*; the app loads only that chapter's passages
(Pinecone, ~37k chunks for Maharashtra State Board + NCERT, Classes 1–10, English and Marathi) and builds everything
from them: summary, key terms, flashcards, a grounded "Ask this chapter" Q&A, quizzes with instant feedback and a
printable practice paper. Notes can be shown in the book's language, English or Marathi, and read aloud.

## Setup (once)

```bash
npm install
cp .env.example .env.local   # then fill in the values below
```

| Variable | Needed for |
| --- | --- |
| `PINECONE_API_KEY`, `PINECONE_INDEX_HOST` | loading chapter text (index `textbooks-bge`) |
| `LLM_API_KEY` + `LLM_PROVIDER=gemini` + `LLM_MODEL=gemini-3.5-flash-lite` | AI notes, Q&A, quiz writing (without it everything still works in basic mode) |
| `LLM_REASONING_EFFORT=low` | **much faster Gemini replies** (a 6-question quiz drops from ≈45 s to ≈7 s) |
| `GROUNDING_JUDGE=false` | skips the optional second AI check (quotes are still verified against the chapter text) |
| `EMBEDDING_PROVIDER=none` | stops the app embedding passages it will never search |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **required on Vercel** so quizzes survive between requests |

## Run it

```bash
npm run build && npm start      # http://localhost:3000
npm run warm                    # pre-generates AI notes for six demo chapters (takes a few minutes)
```

`npm run warm` caches the AI summary / terms / flashcards, so those open instantly during the demo.
Quiz generation always runs live (a few seconds with `LLM_REASONING_EFFORT=low`).

## Suggested 5-minute walk-through

1. **/tutor → Study a chapter.** Choose *CBSE · Class 7 · English · Curiosity · Life Processes in Plants* → **Study this chapter**.
2. **Summary** – overview, key points, "Remember this". Press **Listen**. Switch to **मराठी** to translate the notes.
3. **Key terms** – search "stomata". **Flashcards** – flip, mark *I know this* (progress is remembered).
4. **Ask** – tap "What is Photosynthesis?", then ask something *outside* the chapter to show it refuses to guess.
5. **Quiz** – 8 questions, Easy → answer → results with the supporting lines from the chapter; **Printable practice paper**.
6. Repeat on a Marathi-medium chapter (*Maharashtra · Class 7 · Marathi · सामान्य विज्ञान · वनस्पती : रचना व कार्य*).

## Known limits (be upfront with the faculty)

- Notes/Q&A come from the chapter text only; scanned Marathi books are OCR'd, so a few passages (especially Class 1 picture
  books) contain noise. About 4 % of NCERT chapter titles are still rough.
- NCERT Class 9–10 have no Marathi-medium books; 14 NCERT files don't exist on NCERT's server.
- Free-text search *across* the whole library is not built; students pick a chapter first by design.
- AI output can be wrong: quiz questions are checked so every answer quote exists in the chapter, but a teacher should review.
