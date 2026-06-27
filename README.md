# InnerView

**A searchable, illustrated emotional-memory journal — powered by the Pollinations AI API.**

InnerView turns journaling from a linear diary into a **searchable emotional memory**.
You capture a moment by typing, speaking, or attaching a photo. For each entry, InnerView:

1. **Transcribes** voice entries (Pollinations `whisper`).
2. **Captions** photos (vision model) for richer context.
3. **Reflects** with you — a reasoning model returns a short empathetic reflection, emotion
   tags, a colour palette, an abstract-art prompt, and a "thread to carry forward" (structured
   outputs via JSON schema).
4. **Auto-redacts PII** — names, emails, addresses, and secrets are stripped *before* any model
   sees them (`Pollinations-Safe: privacy,secrets`).
5. **Paints your mood** — a unique abstract image of the entry's emotional texture (`flux`).
6. **Reads it back to you** — narration via TTS (`nova`), for people who process by hearing.
7. **Embeds** the entry so it's searchable by feeling (OpenAI-compatible embeddings).
8. **Finds patterns** — *"when have I felt this way before?"* surfaces semantically similar past
   entries with similarity scores. This is the magic that only multimodal embeddings enable.

## Why this is not another clone

- **No existing app combines** auto-PII-redaction + per-entry generative mood-art + voice
  narration + semantic search across text *and* photos.
- **Privacy-first & local**: all entries live in your browser (IndexedDB). Nothing is sent to a
  server you don't control. PII is redacted upstream of the models.
- **You pay your own way**: via **BYOP (Bring Your Own Pollen)**, you authorize InnerView to spend
  *your own* Pollinations balance — the app developer pays nothing and never touches your funds.
  Revoke access any time at [enter.pollinations.ai](https://enter.pollinations.ai).

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **OpenAI JS SDK** pointed at `https://gen.pollinations.ai/v1` (OpenAI-compatible)
- **IndexedDB** (via `idb`) for local-first, private storage + in-browser cosine similarity search
- **framer-motion** for the timeline river; **lucide-react** for icons
- Client-direct calls to Pollinations using the user's BYOP key — no backend secrets

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure BYOP (recommended) or use a manual key

Copy the example env and add your publishable App Key:

```bash
cp .env.example .env.local
```

Create an App Key (`pk_…`) at [enter.pollinations.ai](https://enter.pollinations.ai) →
**Create New App Key**, and add your callback URL (e.g. `http://localhost:3000/onboarding/callback`)
as a **Redirect URI**. Then set it in `.env.local`:

```
NEXT_PUBLIC_POLLINATIONS_APP_KEY=pk_your_app_key
```

> If you skip this, the app still works — users can paste a `sk_`/`pk_` key manually on the
> Connect page — but the consent screen won't show your app's name.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000, click **Connect your Pollen**, authorize, and start journaling.

## How the Pollinations API is used

| Feature | Endpoint(s) |
|---|---|
| Reflection + structured emotions/palette/art-prompt | `POST /v1/chat/completions` (JSON schema) |
| PII redaction | `Pollinations-Safe: privacy,secrets` header + `safe=` query |
| Voice entry transcription | `POST /v1/audio/transcriptions` (`whisper`) |
| Narration | `POST /v1/audio/speech` (`nova`) |
| Mood-art | `GET /image/{prompt}?model=flux&safe=privacy,secrets` |
| Photo captioning | `POST /v1/chat/completions` (vision: `qwen-vision-pro`) |
| Semantic search vectors | `POST /v1/embeddings` (`openai-3-small`) |
| Durable art/photo storage | `POST /upload` + `GET /{hash}` (media.pollinations.ai) |
| Auth — users pay with their own pollen | BYOP redirect → `#api_key=sk_…` |
| Balance / usage in-app | `GET /account/balance`, `/account/usage` |

## Project structure

```
src/
  app/
    layout.tsx, page.tsx (landing), not-found.tsx
    onboarding/connect/page.tsx      # BYOP authorize + manual key
    onboarding/callback/page.tsx     # capture #api_key fragment
    journal/layout.tsx               # KeyGate (auth required)
    journal/page.tsx                 # timeline (river of mood-art)
    journal/new/page.tsx             # compose entry
    journal/[id]/page.tsx            # detail + "find similar"
    journal/search/page.tsx          # semantic search by feeling
    settings/page.tsx                # balance/usage, models, clear data
  components/
    PollinationsProvider.tsx, AppNav.tsx, KeyGate.tsx, Brand.tsx,
    EntryComposer.tsx, MoodArt.tsx, ReflectionCard.tsx,
    NarrationPlayer.tsx, EmotionTags.tsx, TimelineRiver.tsx
  lib/
    pollinations/{client,image,media,byop,models,safety,constants}.ts
    storage/{db,entries,settings}.ts
    emotions.ts, audio.ts
  types/index.ts
```

## Privacy & safety

- All journal data is stored **only in your browser** (IndexedDB). Clearing browser storage
  erases everything.
- PII (names, emails, phone numbers, addresses, URLs, usernames, keys, passwords) is
  **redacted before** reaching any model, via the Pollinations safety layer.
- Each user connects with **their own** revocable BYOP key; the app never sees a developer secret.
- InnerView is a **self-reflection tool, not therapy or medical advice**. If the model detects
  possible crisis language, the UI surfaces crisis-line resources.

## License

MIT.
