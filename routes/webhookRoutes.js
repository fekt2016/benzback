const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

router.get("/test", (req, res) => {
res.json({ message: "Webhook route is working!" });
});

router.post("/", webhookController.handleStripeWebhook);

module.exports = router;
