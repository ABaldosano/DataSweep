/**
 * Splits a .sql file into individual statements and classifies each one as
 * either allowed (CREATE TABLE / INSERT -- these get executed) or skipped
 * (anything else -- DROP, DELETE, UPDATE, ALTER, ATTACH, PRAGMA, stored
 * procedures, views, T-SQL admin commands, etc.). This is a data-loading
 * allowlist, not a general SQL executor: skipped statements are simply
 * never executed, never a reason to reject an otherwise-loadable file.
 *
 * Also normalizes two common real-world dump conventions that aren't valid
 * SQLite syntax on their own:
 *   - SQL Server's "GO" batch separator (scripts that don't use semicolons
 *     at all, common in dumps exported from SQL Server Management Studio)
 *   - The T-SQL Unicode string prefix, e.g. N'hello' -- SQLite just wants 'hello'
 */

const ALLOWED_LEADING_KEYWORDS = ["CREATE TABLE", "INSERT"];

// Used only to detect *where a new statement starts* in dumps that put one
// full statement per line with no semicolon or GO at all between them (common
// in bulk INSERT sections of SQL Server exports). Deliberately broader than
// the allowlist above -- this is for finding boundaries, not deciding what's
// safe to run; every statement found this way still goes through the same
// allowlist check afterward.
const STATEMENT_START_KEYWORDS = [
  "CREATE", "INSERT", "DROP", "ALTER", "SET", "IF", "SELECT", "UPDATE",
  "DELETE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "PRINT", "USE",
  "DECLARE", "WHILE", "RAISERROR", "WAITFOR", "TRUNCATE", "MERGE",
];

function lineStartsWithStatementKeyword(line) {
  const match = line.trimStart().match(/^([A-Za-z]+)/);
  return !!match && STATEMENT_START_KEYWORDS.includes(match[1].toUpperCase());
}

/**
 * Normalizes a few common real-world SQL Server dump conventions that
 * aren't valid SQLite syntax on their own:
 *   - T-SQL Unicode string prefix: N'hello' -> 'hello'
 *   - INSERT without INTO (T-SQL allows it, SQLite requires INTO): INSERT
 *     "table" (...) -> INSERT INTO "table" (...)
 *   - CLUSTERED/NONCLUSTERED after PRIMARY KEY/UNIQUE in a constraint --
 *     T-SQL-specific, no SQLite equivalent, safe to just drop the word
 */
export function normalizeSql(sql) {
  return sql
    .replace(/(?<![A-Za-z0-9_])[Nn]'/g, "'")
    .replace(/\bINSERT\b(?!\s+INTO\b)/gi, "INSERT INTO")
    .replace(/\b(NON)?CLUSTERED\b/gi, "")
    .replace(/("dbo"|\[dbo\]|\bdbo\b)\s*\./gi, "")
    .replace(/\bgetdate\s*\(\s*\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\bON\s+(\[PRIMARY\]|"PRIMARY"|PRIMARY)/gi, "")
    .replace(/\b0x([0-9A-Fa-f]+)\b/g, "X'$1'");
}

/**
 * Splits on top-level semicolons AND standalone "GO" lines (SQL Server's
 * batch separator) -- semicolons/GO-lines inside quoted strings or
 * comments don't count as statement boundaries.
 */
export function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let parenDepth = 0;

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) statements.push(trimmed);
    current = "";
  };

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
    if (ch === "(") {
      parenDepth++;
      current += ch;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
      continue;
    }
    if (ch === ";") {
      flush();
      continue;
    }
    if (ch === "\n") {
      // A line that's just "GO" (SQL Server's batch separator) is a
      // statement boundary, same as a semicolon -- but the line itself
      // isn't part of any statement, so it gets dropped, not appended.
      const lastNewline = current.lastIndexOf("\n");
      const line = current.slice(lastNewline + 1);
      if (/^\s*GO\s*$/i.test(line)) {
        current = current.slice(0, lastNewline + 1);
        flush();
        continue;
      }
      current += ch;

      // Heuristic boundary: real-world dumps (especially bulk INSERT
      // sections of SQL Server exports) often put one full statement per
      // line with no semicolon or GO between them at all. If we're not
      // mid-expression (paren depth back to 0) and the next line opens with
      // a new SQL statement keyword, treat this newline as an implicit
      // statement boundary.
      if (parenDepth === 0 && current.trim().length > 0) {
        const nextNewline = sql.indexOf("\n", i + 1);
        const peekEnd = nextNewline === -1 ? sql.length : nextNewline;
        const nextLine = sql.slice(i + 1, peekEnd);
        if (lineStartsWithStatementKeyword(nextLine)) {
          flush();
        }
      }
      continue;
    }

    current += ch;
  }

  // A trailing "GO" with no final newline after it.
  const lastNewline = current.lastIndexOf("\n");
  const tailLine = current.slice(lastNewline + 1);
  if (/^\s*GO\s*$/i.test(tailLine)) {
    current = current.slice(0, lastNewline + 1);
  }

  flush();

  return statements;
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

function preview(statement, max = 80) {
  const p = statement.slice(0, max).replace(/\s+/g, " ");
  return p + (statement.length > max ? "…" : "");
}

/**
 * Classifies every statement in a .sql file as allowed (CREATE TABLE /
 * INSERT) or skipped (anything else). Never executes anything -- pure
 * classification. Unlike a wholesale reject, a file with a mix of allowed
 * and disallowed statements comes back with both lists so the caller can
 * execute only what's safe and report the rest.
 */
export function classifySqlFile(rawSql) {
  const sql = normalizeSql(rawSql);
  const statements = splitStatements(sql);

  if (statements.length === 0) {
    return { allowed: [], skipped: [], totalStatements: 0 };
  }

  const allowed = [];
  const skipped = [];

  statements.forEach((statement, i) => {
    if (leadingKeyword(statement)) {
      allowed.push(statement);
    } else {
      skipped.push({ index: i + 1, preview: preview(statement) });
    }
  });

  return { allowed, skipped, totalStatements: statements.length };
}
