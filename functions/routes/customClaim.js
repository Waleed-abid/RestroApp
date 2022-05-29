const express = require("express");
const router = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

router.use(cors({ origin: true }));
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.post("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "email is missing",
      });
    }

    const user = await admin.auth().getUserByEmail(email);
    console.log(user?.claims);

    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
    });

    res.status(200).send({
      status: 200,
      success: true,
      message: "User role set to admin",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: error?.details?.split(":")?.[0] || "Error setting custom claims",
    });
  }
});

module.exports = router;
