function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value) {
  return (typeof value === "string" || value instanceof Date) &&
    !Number.isNaN(new Date(value).getTime());
}

function isNumericInput(value) {
  return (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
}

function forwardError(next, error, publicMessage, status) {
  const forwarded = error instanceof Error ? error : new Error(String(error || "Unknown server error"));
  forwarded.publicMessage = publicMessage;
  if (status) forwarded.status = status;
  return next(forwarded);
}

function isSameUserEmail(firstEmail, secondEmail) {
  return normalizeEmail(firstEmail) === normalizeEmail(secondEmail);
}

function ensureVendorOwnership(req, res, vendorEmail) {
  if (!isSameUserEmail(req.user?.email, vendorEmail)) {
    res.status(403).json({
      success: false,
      message: "You can only manage your own resources.",
    });

    return false;
  }

  return true;
}

function createTransactionId() {
  return `TXN-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

module.exports = {
  normalizeEmail,
  isPlainObject,
  isNonEmptyString,
  isValidDate,
  isNumericInput,
  forwardError,
  isSameUserEmail,
  ensureVendorOwnership,
  createTransactionId,
};
