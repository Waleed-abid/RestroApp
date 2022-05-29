const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { User } = require("../models");
const router = express();

router.use(cors({ origin: true }));
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.get("/", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "user id is missing",
      });
    }

    let user = await User.doc(user_id).get();

    res.status(200).send({
      id: user.id,
      name: user?.data()?.name,
      email: user?.data()?.email,
      email_verified: user?.data()?.email_verified,
      image: user?.data()?.image,
      phone_number: user?.data()?.phone_number,
      phone_verified: user?.data()?.phone_verified,
      restaurant_id: user.data()?.restaurant_id ?? "",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while reading user detail",
    });
  }
});

module.exports = router;
