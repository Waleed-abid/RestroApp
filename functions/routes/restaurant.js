const { Restaurant } = require("../models");
const express = require("express");
const functions = require("firebase-functions");
const router = express.Router();
const admin = require("firebase-admin");
const client = require("../typesense/client");
const cors = require("cors");
const bodyParser = require("body-parser");

router.use(cors({ origin: true }));
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.get("/search", (req, res) => {
  const { search_text } = req.query;

  client
    .collections(`restaurants`)
    .documents()
    .search({ q: search_text, query_by: "name,description" })
    .then(function (response) {
      res.status(200).send(
        response.hits?.map((doc) => {
          return doc.document;
        })
      );
    })
    .catch((error) => {
      functions.logger.log("Error while searching restaurants", { error });
      res.status(500).json({
        status: 500,
        success: false,
        message:
          error?.details?.split(":")?.[0] ||
          "Error while searching restaurants",
      });
    });
});

router.post("/", async (req, res) => {
  let { restaurant } = req.body;

  if (!restaurant) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant data missing",
    });
    return;
  }

  if (Object.keys(restaurant).length == 0) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant data missing",
    });
    return;
  }

  restaurant = {
    name: restaurant?.name || "",
    description: restaurant?.description || "",
    log: restaurant?.logo || "",
    image: restaurant?.image || "",
    website_url: restaurant?.website_url || "",
    drinks: {
      image: restaurant?.drinks?.image || "",
      description: restaurant?.drinks?.description || "",
    },
    food_menu: {
      image: restaurant?.food_menu?.image || "",
      description: restaurant?.food_menu?.description || "",
    },
    chef_recommendation: {
      image: restaurant?.chef_recommendation?.image || "",
      description: restaurant?.chef_recommendation?.description || "",
    },
    location: new admin.firestore.GeoPoint(
      restaurant?.location?.lat || 0,
      restaurant?.location?.long || 0
    ),
    address: {
      flat_number: restaurant?.address?.flat_number || "",
      city: restaurant?.address?.city || "",
      postal_code: restaurant?.address?.postal_code || "",
      street: restaurant?.address?.street || "",
    },
    front_photo: restaurant?.front_photo || "",
    welcome_title: restaurant?.welcome_title || "",
    welcome_body: restaurant?.welcome_body || "",
    is_active: restaurant?.is_active || false,
  };

  try {
    await Restaurant.add(restaurant);
    res.status(201).send({
      status: 201,
      success: true,
      message: "Restaurant created successfully",
    });
  } catch (error) {
    functions.logger.log("Error while creating restaurant", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while creating restaurant",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await Restaurant.get();

    res.status(200).send(
      result?.docs?.map((doc) => {
        return { id: doc.id, ...doc.data() };
      })
    );
  } catch (error) {
    functions.logger.log("Error while reading restaurants", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while reading restaurants",
    });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Restaurant.doc(id).get();

    if (!result?.data()) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Restaurant not found",
      });
      return;
    }

    res.status(200).send({ id: result.id, ...result.data() });
  } catch (error) {
    functions.logger.log("Error while reading restaurant", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while reading restaurant",
    });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { restaurant } = req.body;

  if (!restaurant) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant data missing",
    });
    return;
  }

  if (Object.keys(restaurant).length == 0) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Nothing to update",
    });
    return;
  }

  try {
    await Restaurant.doc(id).set(restaurant, { merge: true });
    res.status(200).send({
      status: 200,
      success: true,
      message: "Restaurant updated successfully",
    });
  } catch (error) {
    functions.logger.log("Error while updating restaurant", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while updating restaurants",
    });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await Restaurant.doc(id).delete();
    res.status(200).send({
      status: 200,
      success: true,
      message: "Restaurant deleted successfully",
    });
  } catch (error) {
    functions.logger.log("Error while deleting restaurant", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while deleting restaurant",
    });
  }
});

module.exports = router;
