const express = require("express");
const bodyParser = require("body-parser");
const functions = require("firebase-functions");
const cors = require("cors");
const { Ambiance } = require("../models");
const router = express();

router.use(cors({ origin: true }));
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.json());

router.post("/", async (req, res) => {
  try {
    const { ambiance } = req.body;

    if (!(ambiance && Object.keys(ambiance)?.length != 0)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Ambiance data missing",
      });
    }

    await Ambiance.add({
      title: ambiance?.title || "",
    });

    res.status(200).send({
      status: 200,
      success: true,
      message: "Ambiance created",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(400).json({
      status: 400,
      success: false,
      message: "Error while creating ambiance",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    let ambiances = await Ambiance.get();
    ambiances = ambiances?.docs?.map((ambiance) => {
      return {
        id: ambiance.id,
        title: ambiance?.data()?.title,
      };
    });
    res.status(200).send(ambiances);
  } catch (error) {
    functions.logger.log(error);
    res.status(400).json({
      status: 400,
      success: false,
      message: "Error while fetching ambiances",
    });
  }
});

module.exports = router;
