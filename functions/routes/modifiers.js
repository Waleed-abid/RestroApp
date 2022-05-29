const express = require("express");
const router = express.Router();
const functions = require("firebase-functions");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Modifier, Variant } = require("../models");
const admin = require("firebase-admin");
const db = admin.firestore();
const _ = require("lodash");
router.use(cors({ origin: true }));
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.get("/", async (req, res) => {
  try {
    const { restaurant_id } = req.query;

    if (!restaurant_id) {
      return res.status(400).send({
        status: 400,
        success: false,
        message: "Restaurant id missing",
      });
    }

    let modifiers = await Modifier.where(
      "restaurant_id",
      "==",
      restaurant_id
    ).get();
    modifiers = modifiers.docs?.map((doc) => {
      return {
        id: doc?.id,
        ...doc.data(),
      };
    });
    res.status(200).send(modifiers);
  } catch (error) {
    functions.logger.log(error);
    res.status(500).send({
      status: 500,
      success: false,
      error: error?.details?.split(":")?.[0] || "Internal server error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let modifier = await Modifier.doc(id).get();
    modifier = {
      id: modifier?.id,
      ...modifier.data(),
    };
    res.status(200).send(modifier);
  } catch (error) {
    functions.logger.log(error);
    res.status(500).send({
      status: 500,
      success: false,
      error: error?.details?.split(":")?.[0] || "Internal server error",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { modifier } = req.body;
    const { restaurant_id } = req.query;

    if (!restaurant_id) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Restaurant id missing",
      });
    }

    if (!modifier) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Modifier data missing",
      });
    }

    if (Object.keys(modifier)?.length == 0) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Modifier data missing",
      });
    }

    const newModifier = {
      name: modifier?.name ?? "",
      restaurant_id,
      modifier_options: modifier?.modifier_options ?? [],
    };

    await Modifier.add(newModifier);
    res.status(201).send({
      status: 201,
      success: true,
      message: "Modifier created successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).send({
      status: 500,
      success: false,
      error: error?.details?.split(":")?.[0] || "Internal server error",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant_id } = req.query;
    const { modifier } = req.body;

    if (!restaurant_id) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Restaurant id missing",
      });
    }

    if (!modifier) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Modifier data missing",
      });
    }

    if (Object.keys(modifier)?.length == 0) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Modifier data missing",
      });
    }

    const newModifier = {
      name: modifier?.name ?? "",
      restaurant_id,
      modifier_options: modifier?.modifier_options ?? [],
    };

    await Modifier.doc(id).update(newModifier);
    res.status(200).send({
      status: 200,
      success: true,
      message: "Modifier updated successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).send({
      status: 500,
      success: false,
      error: error?.details?.split(":")?.[0] || "Internal server error",
    });
  }
});

router.put("/", async (req, res) => {
  const { modifier, variants_ids } = req.body;
  try {
    if (!variants_ids?.length) {
      return res.status(400).send({
        status: 400,
        success: false,
        message: "No variant selected",
      });
    }

    if (!modifier) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Modifier data missing",
      });
    }

    if (!Object.keys(modifier)?.length) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Modifier data missing",
      });
    }

    const batches = _.chunk(variants_ids, 350).map((variant) => {
      const batch = db.batch();

      variant.forEach((id) => {
        batch.update(
          Variant.doc(id),
          {
            modifiers: {
              name: modifier?.name,
              modifier_options: modifier?.modifier_options,
            },
          },
          { merge: true }
        );
      });

      return batch.commit();
    });

    await Promise.all(batches);

    res.status(200).send({
      status: 200,
      success: true,
      message: "Modifiers Added To Variants Successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).send({
      status: 500,
      success: false,
      error: error?.details?.split(":")?.[0] || "Internal server error",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    let { id } = req.params;

    await Modifier.doc(id).delete();
    res.status(200).send({
      status: 200,
      success: true,
      message: "Modifier deleted successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).send({
      status: 500,
      success: false,
      error: error?.details?.split(":")?.[0] || "Internal server error",
    });
  }
});

module.exports = router;
