// Set (or reset) a user's password without email. Run: node --env-file=.env.local scripts/set-password.mjs
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : "*");
    }
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = (await ask("Email: ")).toLowerCase();
const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const user = data.users.find((u) => u.email?.toLowerCase() === email);
if (!user) { console.error(`No account for ${email}.`); process.exit(1); }

const pw = await ask("New password (8+ chars): ", true);
const again = await ask("Again: ", true);
if (pw.length < 8 || pw !== again) { console.error("Passwords don't match or are too short."); process.exit(1); }

const { error: upd } = await db.auth.admin.updateUserById(user.id, { password: pw, email_confirm: true });
if (upd) { console.error(upd.message); process.exit(1); }
console.log(`Done — sign in as ${email} at http://bensmeals.localhost:3000/login`);
