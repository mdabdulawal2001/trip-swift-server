const express = require("express");
const { verifyToken, authorizeRole } = require("../middleware/auth");
const controllers = require("../controllers/bookingsController");

const router = express.Router();

// ================== bookings routes ==================
// bookings route for vendors to get their bookings
router.get("/bookings/vendor", verifyToken, authorizeRole("vendor"), controllers.get_bookings_vendor);

// update booking status route for vendors
router.patch("/bookings/:id/status", verifyToken, authorizeRole("vendor"), controllers.patch_bookings_id_status);


// BOOKINGS ROUTES


// CREATE BOOKING
// USER ONLY

router.post("/bookings", verifyToken, authorizeRole("user"), controllers.post_bookings);


// GET USER BOOKINGS
// USER ONLY

router.get("/bookings/user", verifyToken, authorizeRole("user"), controllers.get_bookings_user);


// GET SINGLE USER BOOKING
// USER ONLY


router.get("/bookings/:id", verifyToken, authorizeRole("user"), controllers.get_bookings_id);

module.exports = router;
