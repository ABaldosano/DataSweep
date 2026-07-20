/**
 * Real .sql dumps come out of MySQL, Postgres, and SQL Server, not SQLite --
 * so a statement can be a perfectly valid CREATE TABLE / INSERT and still
 * fail against better-sqlite3 purely on dialect syntax. This module rewrites
 * the common, well-understood dialect differences into SQLite-compatible
 * text. It never changes *meaning* (which rows, which columns, which
 * values) -- only surface syntax that SQLite's parser doesn't recognize.
 *
 * Deliberately NOT attempted here: anything that would require real
 * semantic translation (stored procedures, computed/generated columns,
 * MySQL's ON DUPLICATE KEY UPDATE, Postgres-specific types with no SQLite
 * equivalent like JSONB or ARRAY). Those statements will still fail to
 * execute against SQLite and get reported back per-statement (see
 * allowlistParser.js) rather than silently mangled.
 */

// MySQL backtick identifiers -> double quotes: `Orders` -> "Orders"
function convertBackticks(sql) {
  return sql.replace(/`([^`]*)`/g, '"$1"');
}

// T-SQL bracket identifiers -> double quotes: [dbo].[Orders] -> "dbo"."Orders"
// (SQLite already tolerates brackets, but normalizing keeps later regexes
// -- like the dbo.-prefix stripper below -- working on one consistent form.)
function convertBrackets(sql) {
  return sql.replace(/\[([^\]]*)\]/g, '"$1"');
}

// T-SQL/Postgres schema-qualified names -> unqualified: "dbo"."Orders" -> "Orders",
// public.orders -> orders. SQLite has no concept of a "dbo" or "public" schema
// inside a single :memory: database, so the prefix is just noise.
function stripSchemaPrefix(sql) {
  return sql.replace(/"(?:dbo|public|guest)"\s*\.\s*/gi, "").replace(/\b(?:dbo|public|guest)\.(?=["\w])/gi, "");
}

// T-SQL Unicode string prefix: N'text' -> 'text'. SQLite has no N-prefix
// notation; it's already Unicode-native.
function stripUnicodePrefix(sql) {
  return sql.replace(/(^|[\s(,=])N'/gi, "$1'");
}

// SQL Server / MySQL let VARCHAR/NVARCHAR/CHAR declare (MAX) instead of a
// number -- SQLite's grammar expects a number inside the parens (or nothing)
// and errors on the literal word MAX, so map it to a plain unbounded TEXT.
function normalizeMaxLength(sql) {
  return sql.replace(/\b(?:N)?(?:VAR)?CHAR\s*\(\s*MAX\s*\)/gi, "TEXT");
}

// T-SQL IDENTITY(seed, increment) and MySQL AUTO_INCREMENT both mean "the
// database assigns this integer column's value automatically when an
// INSERT doesn't supply one" -- which is exactly what SQLite's own
// INTEGER PRIMARY KEY (a rowid alias) does. Just dropping the IDENTITY/
// AUTO_INCREMENT keyword (as an earlier version of this function did)
// left the column as a plain NOT NULL integer with no default, so any
// INSERT that (as real dumps always do) omits the auto-generated column
// failed with a NOT NULL constraint error. Converting the whole column
// definition to "INTEGER PRIMARY KEY AUTOINCREMENT" preserves the actual
// behavior instead of just deleting the syntax that requested it.
//
// A CREATE TABLE can't declare PRIMARY KEY twice, so any separate
// "PRIMARY KEY (col)" table-constraint for the same column (T-SQL's
// PRIMARY KEY CLUSTERED (...), MySQL's trailing PRIMARY KEY (`col`)) is
// removed once the column itself becomes the primary key.
function convertAutoIncrementColumns(sql) {
  const convertedCols = [];

  const identityPattern =
    /"([\w]+)"\s+\w*int\w*\s*(?:\(\d+\))?\s+IDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)\s*(?:NOT\s+NULL)?/gi;
  sql = sql.replace(identityPattern, (_match, colName) => {
    convertedCols.push(colName);
    return `"${colName}" INTEGER PRIMARY KEY AUTOINCREMENT`;
  });

  const autoIncPattern =
    /"([\w]+)"\s+\w*int\w*\s*(?:\(\d+\))?\s*(?:NOT\s+NULL\s+)?AUTO_INCREMENT/gi;
  sql = sql.replace(autoIncPattern, (_match, colName) => {
    convertedCols.push(colName);
    return `"${colName}" INTEGER PRIMARY KEY AUTOINCREMENT`;
  });

  for (const col of convertedCols) {
    const redundantPk = new RegExp(
      `,?\\s*PRIMARY\\s+KEY\\s*(?:CLUSTERED\\s*)?\\(\\s*"?${col}"?(?:\\s+ASC|\\s+DESC)?\\s*\\)`,
      "gi"
    );
    sql = sql.replace(redundantPk, "");
  }

  return sql;
}

// Catches any leftover IDENTITY(...)/AUTO_INCREMENT tokens that
// convertAutoIncrementColumns' column-shape patterns didn't match (e.g.
// unusual spacing or a dialect variant) so they don't reach SQLite as a
// syntax error -- these columns just won't auto-generate, which is a
// smaller loss than failing the whole statement.
function stripLeftoverIdentitySpec(sql) {
  return sql.replace(/\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, "");
}

function stripLeftoverAutoIncrement(sql) {
  return sql.replace(/\bAUTO_INCREMENT\b/gi, "");
}

// MySQL UNSIGNED type modifier -- SQLite has no unsigned integer types.
function stripUnsigned(sql) {
  return sql.replace(/\bUNSIGNED\b/gi, "");
}

// MySQL per-column COMMENT 'text' -- decorative only, safe to drop.
function stripColumnComments(sql) {
  return sql.replace(/\bCOMMENT\s+'(?:[^'\\]|\\.|'')*'/gi, "");
}

// MySQL trailing table options after the closing paren of CREATE TABLE, e.g.
// ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
function stripTableOptions(sql) {
  return sql.replace(
    /\)\s*(?:ENGINE|DEFAULT CHARSET|CHARSET|COLLATE|AUTO_INCREMENT|ROW_FORMAT)\s*=\s*[\w]+[\s\w=]*$/gi,
    ")"
  );
}

// Postgres SERIAL / BIGSERIAL / SMALLSERIAL -> INTEGER. Loses the
// auto-increment behavior (same tradeoff as IDENTITY/AUTO_INCREMENT above)
// but keeps the column itself loadable.
function convertSerialTypes(sql) {
  return sql.replace(/\b(?:BIG|SMALL)?SERIAL\b/gi, "INTEGER");
}

// MySQL's /*!40101 SET ... */ "version comment" wrapper -- MySQL treats the
// contents as live SQL when the server version is new enough; every other
// engine treats the whole thing as a comment. Unwrap it to the inner SQL so
// the statement can still be classified and (if it's SET/USE/etc.) skipped
// cleanly, rather than showing up as one big opaque comment.
function unwrapMysqlVersionComments(sql) {
  return sql.replace(/\/\*!\d+\s?([\s\S]*?)\*\//g, "$1");
}

// Trailing MySQL storage-engine style backtick already handled by
// convertBackticks; this just removes stray double-backslash escaping some
// mysqldump exports use for quotes inside strings, normalizing to the
// doubled-quote form SQLite expects. Only applied inside single-quoted runs,
// which the splitter already tracks, so this is safe to run globally here:
// \' -> '' and \\ -> \ (backslash is not a special character in SQLite).
function convertBackslashEscapes(sql) {
  return sql.replace(/\\'/g, "''").replace(/\\\\/g, "\\");
}

// MySQL lets CREATE TABLE declare secondary indexes inline as table items --
// KEY "name" (col), INDEX "name" (col), FULLTEXT/SPATIAL KEY "name" (col).
// SQLite's CREATE TABLE grammar has no such item (indexes are always a
// separate CREATE INDEX statement), so left as-is these are a hard syntax
// error that fails the whole table. UNIQUE KEY is the one variant that
// carries real meaning (a uniqueness constraint, not just a lookup
// accelerator), so it's converted to a plain UNIQUE table constraint;
// everything else is just dropped, same tradeoff as dropping ENGINE=/
// CHARSET= table options above -- no equivalent CREATE INDEX is emitted
// here, so query results are unaffected, only lookup speed on those columns.
function stripInlineIndexes(sql) {
  return sql
    .replace(/\bUNIQUE\s+KEY\s+"[^"]+"\s*(\([^)]*\))/gi, "UNIQUE $1")
    .replace(/,\s*(?:FULLTEXT\s+|SPATIAL\s+)?(?:KEY|INDEX)\s+"[^"]+"\s*\([^)]*\)/gi, "");
}

// T-SQL's PRIMARY KEY CLUSTERED / NONCLUSTERED -- SQLite has no notion of
// clustered vs non-clustered indexes; the constraint itself (which columns
// form the key) is unaffected by dropping the word.
function stripClusteredKeyword(sql) {
  return sql.replace(/\b(?:NON)?CLUSTERED\b/gi, "");
}

// SQL Server 2000-era CREATE TABLE scripts end with a filegroup placement
// clause -- ") ON PRIMARY" or ") ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]" --
// specifying which physical file group stores the table/BLOB columns.
// SQLite has a single file and no file groups, so this is pure noise.
function stripFilegroupClause(sql) {
  return sql.replace(
    /\)\s*ON\s+"?\[?PRIMARY\]?"?\s*(?:TEXTIMAGE_ON\s+"?\[?PRIMARY\]?"?)?\s*$/gi,
    ")"
  );
}

// T-SQL allows "INSERT tablename VALUES (...)" -- the INTO keyword is
// optional. SQLite requires it. Only adds INTO when it's actually missing
// (i.e. not already "INSERT INTO").
function ensureInsertInto(sql) {
  return sql.replace(/^(\s*INSERT\s+)(?!INTO\b)/i, "$1INTO ");
}

// T-SQL/Sybase binary literals use a bare 0x prefix (0x1A2B...); SQLite's
// equivalent blob literal syntax is X'1A2B...'. Without this, any dump
// carrying binary columns (old Access/SQL Server exports commonly stored
// thumbnail images this way) fails every INSERT that touches the column.
function convertHexBlobLiterals(sql) {
  return sql.replace(/\b0x([0-9A-Fa-f]+)\b/g, "X'$1'");
}

export function normalizeStatement(sql) {
  let out = sql;
  out = unwrapMysqlVersionComments(out);
  out = convertBackslashEscapes(out);
  out = stripUnicodePrefix(out);
  out = convertBrackets(out);
  out = convertBackticks(out);
  out = stripSchemaPrefix(out);
  out = stripInlineIndexes(out);
  out = normalizeMaxLength(out);
  out = convertAutoIncrementColumns(out);
  out = stripLeftoverIdentitySpec(out);
  out = stripLeftoverAutoIncrement(out);
  out = stripUnsigned(out);
  out = stripColumnComments(out);
  out = stripClusteredKeyword(out);
  out = stripFilegroupClause(out);
  out = stripTableOptions(out);
  out = convertSerialTypes(out);
  out = ensureInsertInto(out);
  out = convertHexBlobLiterals(out);
  return out.trim();
}
