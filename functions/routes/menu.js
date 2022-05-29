const express = require("express");
const functions = require("firebase-functions");
const pairingDetail = require("../helpers/pairings/pairingDetail");
const router = express.Router();
const { Category, Variant } = require("../models/index");
const db = require("firebase-admin").firestore();

router.get("/", async (req, res) => {
  const { restaurant_id } = req.query;
  const type = req.query?.type || "food";
  const category_id = req.query?.category_id || null;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  try {
    let categories = await Category.where("restaurant_id", "==", restaurant_id)
      .where("type", "==", type)
      .orderBy("position", "asc")
      .get();
    categories = categories.docs?.map((category) => {
      return {
        id: category.id,
        ...category.data(),
      };
    });

    if (categories.length == 0) {
      res.status(200).json({});
      return;
    }

    let variants_data = Variant.where(
      "category_id",
      "==",
      category_id || categories?.[0].id
    )
      .where("is_active", "==", true)
      .get()
      .then((responses) => {
        if (responses.docs?.length == 0) {
          return Promise.resolve([]);
        }
        let pairings_data = responses?.docs?.map(async (doc) => {
          try {
            return Promise.resolve({
              id: doc.id,
              image: doc.data()?.image,
              restaurant_id: doc.data()?.restaurant_id,
              description: doc.data()?.description,
              type: doc.data()?.type,
              category_id: doc.data()?.category_id,
              price: doc.data()?.price,
              name: doc.data()?.name,
              modifiers: doc?.data()?.modifiers
                ? Object.values(doc?.data()?.modifiers)
                : [],
              food_pairings: doc?.data()?.food_pairings
                ? await pairingDetail(Object.values(doc?.data()?.food_pairings))
                : [],
              drink_pairings: doc?.data()?.drink_pairings
                ? await pairingDetail(
                    Object.values(doc?.data()?.drink_pairings)
                  )
                : [],
              is_active: doc.data()?.is_active,
            });
          } catch (error) {
            return Promise.reject(error);
          }
        });

        return Promise.all(pairings_data);
      })
      .catch((error) => {
        functions.logger.log(error);
        return Promise.reject(error);
      });
    let [variants] = await Promise.all([variants_data]);

    res.status(200).send({
      categories: categories,
      variants: variants,
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while reading menu",
    });
  }
});

module.exports = router;
