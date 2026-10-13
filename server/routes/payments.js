const express = require("express");
const { verifyToken, authorizeRole, verifyPaymentConfirmSecret } = require("../middleware/auth");
const controllers = require("../controllers/paymentsController");

const router = express.Router();

// PAYMENT ROUTES

// DIRECT PAYMENT
// USER ONLY


router.post("/payments", verifyToken, authorizeRole("user"), controllers.post_payments);


// STRIPE PAYMENT CONFIRMATION

// It is protected by PAYMENT_CONFIRM_SECRET.


router.post("/payments/confirm", verifyPaymentConfirmSecret, controllers.post_payments_confirm);

// GET USER PAYMENTS
// USER ONLY


router.get("/payments/user", verifyToken, authorizeRole("user"), controllers.get_payments_user);

// GET VENDOR PAYMENTS / REVENUE
// VENDOR ONLY


router.get("/payments/vendor", verifyToken, authorizeRole("vendor"), controllers.get_payments_vendor);

// GET ADMIN PAYMENTS / REVENUE
// ADMIN ONLY

router.get("/payments/admin", verifyToken, authorizeRole("admin"), controllers.get_payments_admin);

module.exports = router;
