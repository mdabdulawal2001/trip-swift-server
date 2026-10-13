const express = require("express");
const { verifyToken, authorizeRole } = require("../middleware/auth");
const controllers = require("../controllers/ticketsController");

const router = express.Router();

// Example Route: Get All Tickets
router.get("/tickets", controllers.get_tickets);
// get vendor tickets route
router.get("/tickets/vendor", verifyToken, authorizeRole("vendor"), controllers.get_tickets_vendor);

// admin route to get all tickets
router.get("/tickets/admin", verifyToken, authorizeRole("admin"), controllers.get_tickets_admin);

// get vendor tickets by id route
router.get("/tickets/vendor/:id", verifyToken, authorizeRole("vendor"), controllers.get_tickets_vendor_id);

// get admin tickets by id route
router.get("/tickets/admin/:id", verifyToken, authorizeRole("admin"), controllers.get_tickets_admin_id);

// advertise ticket route
router.get("/tickets/advertised", controllers.get_tickets_advertised);

// ticket details route
router.get("/tickets/:id", controllers.get_tickets_id);

// manage status route

router.patch("/tickets/:id/status", verifyToken, authorizeRole("admin"), controllers.patch_tickets_id_status);

// add ticket route
router.post("/tickets", verifyToken, authorizeRole("vendor"), controllers.post_tickets);

// ADMIN ADVERTISEMENT TOGGLE
// ONLY ADMIN CAN ADVERTISE TICKETS

router.patch("/tickets/:id/advertise", verifyToken, authorizeRole("admin"), controllers.patch_tickets_id_advertise);

// edit ticket route
router.patch("/tickets/:id", verifyToken, authorizeRole("vendor"), controllers.patch_tickets_id);

// delete ticket route
router.delete("/tickets/:id", verifyToken, authorizeRole("vendor"), controllers.delete_tickets_id);

module.exports = router;
