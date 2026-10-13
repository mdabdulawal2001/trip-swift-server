const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
const PAYMENT_CONFIRM_SECRET = process.env.PAYMENT_CONFIRM_SECRET;

if (!BETTER_AUTH_URL) {
  console.error("NEXT_PUBLIC_BETTER_AUTH_URL is missing");
}

if (!PAYMENT_CONFIRM_SECRET) {
  console.error("PAYMENT_CONFIRM_SECRET is missing");
}

let JWKS = null;

function getJWKS() {
  if (!BETTER_AUTH_URL) {
    throw new Error("BETTER_AUTH_URL is not configured");
  }

  if (!JWKS) {
    JWKS = createRemoteJWKSet(new URL(`${BETTER_AUTH_URL}/api/auth/jwks`));
  }

  return JWKS;
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authorization token is required",
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authorization token is missing",
    });
  }

  try {
    const jwks = getJWKS();

    const { payload } = await jwtVerify(token, jwks, {
      issuer: BETTER_AUTH_URL,
      audience: BETTER_AUTH_URL,
    });

    if (!payload?.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    req.user = {
      id: payload.sub,
      email: payload.email || null,
      role: payload.role || null,
      ...payload,
    };

    next();
  } catch (error) {
    console.error("JWT Verification Error:", error?.message || error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden. You do not have permission to access this resource.",
      });
    }

    next();
  };
};

const verifyPaymentConfirmSecret = (req, res, next) => {
  const secret = req.headers["x-payment-confirm-secret"];

  if (!PAYMENT_CONFIRM_SECRET || !secret || secret !== PAYMENT_CONFIRM_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized payment confirmation request",
    });
  }

  next();
};

module.exports = {
  verifyToken,
  authorizeRole,
  verifyPaymentConfirmSecret,
};
