function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
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
  isSameUserEmail,
  ensureVendorOwnership,
  createTransactionId,
};
