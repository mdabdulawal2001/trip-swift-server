const express = require("express");
const { verifyToken, authorizeRole } = require("../middleware/auth");
const controllers = require("../controllers/contactController");

const router = express.Router();

router.post("/contact", controllers.post_contact);
router.get(
  "/contact/admin",
  verifyToken,
  authorizeRole("admin"),
  controllers.get_contact_admin,
);
router.delete(
  "/contact/:id",
  verifyToken,
  authorizeRole("admin"),
  controllers.delete_contact_id,
);

module.exports = router;
