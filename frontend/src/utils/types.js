export function isNumericType(type) {
  const t = (type || "").toUpperCase();
  return t.includes("INT") || t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB") || t.includes("NUMERIC") || t.includes("DECIMAL");
}
