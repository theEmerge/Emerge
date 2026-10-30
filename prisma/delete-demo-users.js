// Deletes the seeded demo accounts (you@example.com etc.) and everything that
// belongs to them. The schema has no ON DELETE CASCADE, so this walks the
// foreign keys in Postgres and removes child rows first.
//
//   node prisma/delete-demo-users.js            -> DRY RUN: only prints counts
//   node prisma/delete-demo-users.js --commit   -> really deletes (one transaction)
//
// Needs DATABASE_URL in the environment (it is read from .env by Prisma).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const EMAILS = ["you@example.com", "mara@example.com", "theo@example.com", "nadia@example.com"];
const COMMIT = process.argv.includes("--commit");
const q = (s) => '"' + s.replace(/"/g, '""') + '"';

async function children(tx, table) {
  return tx.$queryRawUnsafe(
    `SELECT c.conrelid::regclass::text AS child, a.attname AS child_col, pa.attname AS parent_col
       FROM pg_constraint c
       JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum  = c.conkey[1]
       JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND c.confrelid = $1::regclass`,
    q(table)
  );
}

// Delete rows of `table` matching `where` (SQL), children first.
async function del(tx, table, where, log, depth = 0) {
  if (depth > 8) throw new Error("FK chain too deep at " + table);
  for (const fk of await children(tx, table)) {
    const child = fk.child.replace(/"/g, "");
    await del(
      tx,
      child,
      `${q(fk.child_col)} IN (SELECT ${q(fk.parent_col)} FROM ${q(table)} WHERE ${where})`,
      log,
      depth + 1
    );
  }
  const n = await tx.$executeRawUnsafe(`DELETE FROM ${q(table)} WHERE ${where}`);
  if (n) log[table] = (log[table] || 0) + n;
}

(async () => {
  const log = {};
  const list = EMAILS.map((e) => `'${e}'`).join(",");
  try {
    await prisma.$transaction(
      async (tx) => {
        await del(tx, "User", `"email" IN (${list})`, log);
        console.log(COMMIT ? "Deleted rows per table:" : "DRY RUN - would delete rows per table:", log);
        if (!COMMIT) throw new Error("__dry_run__"); // roll back
      },
      { timeout: 60000 }
    );
  } catch (e) {
    if (e.message !== "__dry_run__") throw e;
    console.log("Nothing was changed. Re-run with --commit to delete.");
  } finally {
    await prisma.$disconnect();
  }
})();
