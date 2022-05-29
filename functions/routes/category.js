const { Category } = require("../models");
const express = require("express");
const functions = require("firebase-functions");
const router = express.Router();
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const db = admin.firestore();

router.use(cors({ origin: true }));
router.use(bodyParser.json());
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.post("/", async (req, res) => {
  let { category } = req.body;
  const { restaurant_id } = req.query;

  if (!category) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Category data missing",
    });
    return;
  }
  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  if (Object.keys(category).length == 0) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Category data missing",
    });
    return;
  }

  category = {
    image: category?.image || "",
    position: category?.position || 1,
    name: category?.name || "",
    type: category?.type || "food",
    restaurant_id,
  };

  try {
    await Category.add(category);
    res
      .status(201)
      .send({ status: 201, success: true, message: "Category created" });
  } catch (error) {
    functions.logger.log("Error while creating Category", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error during category create",
    });
  }
});

router.post("/multiple", async (req, res) => {
  let { categories } = req.body;
  const { restaurant_id } = req.query;

  if (!categories) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Categories data missing",
    });
    return;
  }
  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  if (categories.length == 0) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Categories data missing",
    });
    return;
  }

  try {
    let batch = db.batch();

    categories.map((category) => {
      batch.set(Category.doc(), {
        image: category?.image || "",
        position: category?.position || 1,
        name: category?.name || "",
        type: category?.type || "food",
        restaurant_id: restaurant_id,
      });
    });

    await batch.commit();

    res
      .status(201)
      .send({ status: 201, success: true, message: "Categories created" });
  } catch (error) {
    functions.logger.log("Error while creating Categories", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error during categories create",
    });
  }
});

router.get("/", async (req, res) => {
  const { restaurant_id } = req.query;
  const type = req?.query?.type || "food";

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }
  try {
    const result = await Category.where("restaurant_id", "==", restaurant_id)
      .where("type", "==", type)
      .orderBy("position", "asc")
      .get();

    if (result.docs.length == 0) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Categories not found",
      });
      return;
    }

    res.status(200).send(
      result?.docs?.map((doc) => {
        return { id: doc.id, ...doc.data() };
      })
    );
  } catch (error) {
    functions.logger.log("Error while reading Categories", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while reading Categories",
    });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Category.doc(id).get();

    if (!result?.data()) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Category not found",
      });
      return;
    }

    res.status(200).send({ id: result.id, ...result.data() });
  } catch (error) {
    functions.logger.log("Error while reading Category", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while reading category",
    });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { category } = req.body;

  if (!(category && Object.keys(category).length != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Nothing to update",
    });
    return;
  }

  try {
    await Category.doc(id).update(category);

    res
      .status(200)
      .send({ status: 200, success: true, message: "Category updated" });
  } catch (error) {
    functions.logger.log("Error while updating Category", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while updating category",
    });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await Category.doc(id).delete();

    res.status(204).send({
      status: 204,
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    functions.logger.log("Error while deleting Category", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] || "Error while deleting Category",
    });
  }
});

module.exports = router;
