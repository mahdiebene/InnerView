# Supabase setup for InnerView (accounts + encrypted sync)

InnerView uses Supabase for **identity** and **encrypted storage**. The server
only ever stores **ciphertext** — your journal is encrypted on your device with
a key derived from your passphrase *before* anything is uploaded. Supabase
can never read your journal.

This takes ~5 minutes and is free on the Supabase hobby tier.

## 1. Create a Supabase project

1. Go to **https://supabase.com** → sign in → **New project**.
2. Pick a name (e.g. `innerview`), set a strong DB password, choose a region
   close to you, and create it. Wait ~2 min for provisioning.

## 2. Run the schema + Row-Level Security

1. In your project, open **SQL Editor** → **New query**.
2. Paste the entire contents of [`schema.sql`](./schema.sql) and **Run**.

This creates two tables (`profiles`, `entries`) and enables **Row-Level Security**
so each user can only ever read/write their own rows. It also stores, per user,
the Argon2id salt and the recovery key-wrap (both ciphertext/metadata).

## 3. Get your public API credentials

1. Go to **Project Settings** → **API**.
2. Copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (the `anon` `pk_...`-ish value — **not** the `service_role` key)

Both of these are designed to be public (safe to ship in client code). Security
is enforced by RLS + end-to-end encryption, never by hiding these values.

## 4. Configure auth (email/password)

1. Go to **Authentication** → **Providers** → enable **Email**.
2. Under **Authentication** → **Sign In / Up**, decide on **Confirm email**:
   - For local dev: you can **disable "Confirm email"** so sign-up logs you in
     immediately without checking an inbox.
   - For production: **leave it on** and configure SMTP (Supabase provides a
     built-in mailer up to a few emails/hour on hobby).

> InnerView uses **email + password** for Supabase identity. The same string
> doubles as the E2EE passphrase in this build (one thing to remember). They
> are conceptually independent and could be split later.

## 5. Add the credentials to the app

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Then:

```bash
npm install      # installs @supabase/supabase-js + @noble/hashes
npm run dev
```

Open http://localhost:3000 → **Create your journal** → sign up with email +
passphrase. The app derives your master key, encrypts, and (once you create
entries) syncs ciphertext to Supabase.

## 6. For production (Vercel)

1. Add the same two `NEXT_PUBLIC_SUPABASE_*` vars in **Vercel → Project →
   Settings → Environment Variables**.
2. In **Supabase → Authentication → URL Configuration**, add your production
   site URL (e.g. `https://your-app.vercel.app`) to **Site URL** / **Redirect
   URLs** so email-confirm links point to the right place.
3. Redeploy.

## How the security model holds together

| Layer | What it does |
|---|---|
| **Supabase Auth** | Proves *you're you* (email + password). Issues a session. |
| **Argon2id (client)** | Derives a 256-bit master key from your passphrase + per-user salt. |
| **AES-GCM (client)** | Encrypts every entry *before* upload; decrypts on read. |
| **Row-Level Security** | Even with the anon key, you can only touch your own rows. |
| **Recovery wrap** | Your master key is wrapped with your current Pollinations key and stored in `profiles.wrapped_key` — the "forgot passphrase" fallback. |

**Forgot your passphrase?** If your Pollen is still connected, use
`/auth/recover` → unlock with your Pollinations key → set a new passphrase.
We re-encrypt your whole journal under the new key.

**Forgot passphrase AND lost your Pollen key with no device cached?** Your
journal can't be decrypted — by anyone, including us. That's the tradeoff that
makes the journal truly private. Keep your passphrase safe, and keep pollen
connected so recovery stays possible.
