/**
 * Splits a .sql file into individual statements and validates that every
 * one of them is either a CREATE TABLE or an INSERT. Nothing else is
 * permitted -- no DROP, DELETE, UPDATE, ALTER, ATTACH, PRAGMA, multi-
 * statement tricks, etc. This is a data-loading allowlist, not a general
 * SQL executor.
 *
 * Validation happens in a separate pass *before* anything touches the
 * database, so a bad file is rejected wholesale with a clear reason
 * instead of partially executing.
 */

const ALLOWED_LEADING_KEYWORDS = ["CREATE TABLE", "INSERT"];

/**
 * Splits on top-level semicolons only -- semicolons inside quoted strings
 * or comments don't count as statement boundaries.
 */
export function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      current += ch;
      if (ch === "*" && next === "/") {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingleQuote) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i++;
      } else if (ch === "'") {
        inSingleQuote = false;
      }
      continue;
    }
    if (inDoubleQuote) {
      current += ch;
      if (ch === '"' && next === '"') {
        current += next;
        i++;
      } else if (ch === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      current += ch;
      continue;
    }
    if (ch === "-" && next === "-") {
      inLineComment = true;
      current += ch;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      current += ch;
      continue;
    }
    if (ch === ";") {
      statements.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim().length > 0) statements.push(current.trim());

  return statements.filter((s) => s.length > 0);
}

function leadingKeyword(statement) {
  // Strip leading comments/whitespace, then check the first two words.
  const stripped = statement
    .replace(/^(\s*--[^\n]*\n)+/g, "")
    .replace(/^\s*\/\*[\s\S]*?\*\//, "")
    .trim();

  const upper = stripped.toUpperCase();
  return ALLOWED_LEADING_KEYWORDS.find((kw) => upper.startsWith(kw)) || null;
}

/**
 * Validates every statement in a .sql file against the allowlist.
 * Returns { valid: true, statements } or { valid: false, error }.
 * Never executes anything -- pure validation.
 */
export function validateSqlFile(sql) {
  const statements = splitStatements(sql);

  if (statements.length === 0) {
    return { valid: false, error: "No SQL statements found in file." };
  }

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const keyword = leadingKeyword(statement);

    if (!keyword) {
      const preview = statement.slice(0, 60).replace(/\s+/g, " ");
      return {
        valid: false,
        error: `Statement ${i + 1} is not allowed: only CREATE TABLE and INSERT statements are accepted. Got: "${preview}${statement.length > 60 ? "…" : ""}"`,
      };
    }
  }

  return { valid: true, statements };
}
