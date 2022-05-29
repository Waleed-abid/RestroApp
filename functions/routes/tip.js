const express = require("express");
const functions = require("firebase-functions");
const { Tip } = require("../models");
const router = express.Router();

router.get("/all", async (req, res) => {
  const { restaurant_id } = req.query;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  try {
    let tips = await Tip.where("restaurant_id", "==", restaurant_id).get();

    res.status(200).send(
      tips.docs?.map((tip) => {
        return { id: tip.id, ...tip.data() };
      })
    );
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while reading tips",
    });
  }
});

module.exports = router;
