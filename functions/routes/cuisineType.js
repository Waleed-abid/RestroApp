const express = require("express");
const bodyParser = require("body-parser");
const functions = require("firebase-functions");
const cors = require("cors");
const { Cuisine } = require("../models");
const router = express();

router.use(cors({ origin: true }));
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.json());

router.post("/", async (req, res) => {
  try {
    const { cuisine } = req.body;

    if (!(cuisine && Object.keys(cuisine)?.length != 0)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Ambiance data missing",
      });
    }

    await Cuisine.add({
      title: cuisine?.title || "",
    });

    res.status(200).send({
      status: 200,
      success: true,
      message: "Cuisine created",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(400).json({
      status: 400,
      success: false,
      message: "Error while creating cuisine",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    let cuisines = await Cuisine.get();
    cuisines = cuisines?.docs?.map((cuisine) => {
      return {
        id: cuisine.id,
        title: cuisine?.data()?.title,
      };
    });
    res.status(200).send(cuisines);
  } catch (error) {
    functions.logger.log(error);
    res.status(400).json({
      status: 400,
      success: false,
      message: "Error while fetching cuisines",
    });
  }
});

module.exports = router;
