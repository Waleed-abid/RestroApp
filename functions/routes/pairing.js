const { Pairing, Variant } = require("../models");
const express = require("express");
const router = express.Router();
const functions = require("firebase-functions");

router.post("/", async (req, res) => {
  const { variant_id } = req.query;
  const { items } = req.body;

  if (!variant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Variant id missing",
    });
    return;
  }

  if (!(items && items?.length != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Items are missing",
    });
    return;
  }

  const addPairings = () => {
    return items?.map((item) => {
      return Variant.doc(item).set(
        { parent: { [variant_id]: true } },
        { merge: true }
      );
    });
  };

  try {
    await Promise.all(addPairings());
    res.status(200).send({
      status: 200,
      success: true,
      message: "Pairing added successfuly",
    });
  } catch (error) {
    functions.logger.log("Error while adding pairings", { error });
    res.status(400).json({
      status: 500,
      success: false,
      message: "Error while adding pairings",
    });
  }
});

module.exports = router;
