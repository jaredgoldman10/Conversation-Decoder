# Conversation Decoder

A private word bank for business conversations. Decode jargon in context, log what mattered in each conversation, and quiz yourself. Each person signs in with their own email and sees only their own word bank. When you decode a new term, the AI reads your saved terms and recent conversations, so explanations build on what you already know.

## What's in this repository

| File | What it does |
| --- | --- |
| `index.html` | The app |
| `config.js` | Your Supabase project URL and public (anon) key |
| `supabase/schema.sql` | Creates the database table and the privacy rules |
| `supabase/functions/decode/index.ts` | The AI decoder; holds your Anthropic key on the server |

## Setup (about 30 minutes, once)

### 1. Supabase: database and sign-in
1. Create a free account at supabase.com and click **New project**. Pick a region close to you (e.g. East US) and save the database password somewhere safe.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and click **Run**.
3. Open **Authentication > Sign In / Providers** and turn **off** "Allow new users to sign up". Email stays on. From now on, only people you invite can get in.
4. Open **Authentication > Users > Invite user** and invite yourself first. Invite others the same way later.
5. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key. Paste both into `config.js`.

### 2. Anthropic: the AI key
1. At console.anthropic.com, create an API key and add a small amount of credit.
2. Under **Limits**, set a monthly spend limit you're comfortable with.
3. In Supabase, open **Edge Functions > Secrets** and add `ANTHROPIC_API_KEY` with that key. The key stays on the server. It never goes in this repository or in the browser.

### 3. Supabase: deploy the decoder function
1. In Supabase, open **Edge Functions > Deploy a new function > Via editor**.
2. Name it exactly `decode`, replace the sample code with all of `supabase/functions/decode/index.ts`, and click **Deploy**.
3. Leave JWT verification on. That's what limits the function to signed-in people.

(If you use the Supabase CLI instead: `supabase functions deploy decode`.)

### 4. GitHub: publish the site
1. Create a repository at github.com/new, e.g. `conversation-decoder`. It can be public; your data lives in Supabase, not in the code.
2. Click **uploading an existing file** and drag in everything from this folder, keeping the `supabase` folder. Commit.
3. Open **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After a minute, your site appears at `https://<your-username>.github.io/conversation-decoder/`.

### 5. Connect the two
1. In Supabase, open **Authentication > URL Configuration**.
2. Set **Site URL** to your GitHub Pages address and add it under **Redirect URLs**.
3. Open your site, enter your email, and click the link that arrives. You'll land in your word bank with 16 starter terms.

## Sharing with someone
Invite their email in Supabase (**Authentication > Users > Invite user**), then send them the site link. They get their own empty word bank, and can't see yours. To remove someone, delete them under **Users**; their data goes with them.

## Where your data is
All of it is in your Supabase project, in one table called `docs`. You can view or export it under **Table Editor**, and each person can also download a backup from the app. Row-level security blocks every person from reading anyone else's rows, including through the decoder function.

## Changing the app
Edit files in GitHub (or in Claude Code, pointed at this repository) and commit. GitHub Pages republishes within a minute. If you change `supabase/functions/decode/index.ts`, redeploy the function in Supabase.
