const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authController.protect);

router.get("/", authController.restrictTo("admin"), userController.getAllUsers);
router.get("/:id", userController.getUser);
router.patch("/me", userController.updateUser);
router.delete(
  "/:id",
  authController.restrictTo("admin"),
  userController.deleteUser
);

module.exports = router;
