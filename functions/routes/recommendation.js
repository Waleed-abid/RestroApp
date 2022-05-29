const express = require("express");
const bodyParser = require("body-parser");
const functions = require("firebase-functions");
const cors = require("cors");
const { Recommendation, Variant } = require("../models");
const variantsDetail = require("../helpers/variantsDetail");
const router = express();

router.use(cors({ origin: true }));
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.json());

router.post("/", async (req, res) => {
  try {
    let { restaurant_id } = req.query;
    let { recommendation } = req.body;
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Restaurant id missing",
      });
    }

    if (!(recommendation && Object.keys(recommendation) != 0)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Recommendation data missing",
      });
    }

    let starters =
      recommendation?.starters?.length != 0
        ? recommendation?.starters.slice(0, 3)
        : [];
    let main_courses =
      recommendation?.main_courses?.length != 0
        ? recommendation?.main_courses.slice(0, 3)
        : [];
    let desserts =
      recommendation?.desserts?.length != 0
        ? recommendation?.desserts.slice(0, 3)
        : [];

    await Recommendation.add({
      name: recommendation?.name || "",
      description: recommendation?.description || "",
      restaurant_id,
      starters: starters?.reduce((accu, curr) => {
        accu[`${curr?.id}`] = curr;
        return accu;
      }, {}),
      main_courses: main_courses?.reduce((accu, curr) => {
        accu[`${curr?.id}`] = curr;
        return accu;
      }, {}),
      desserts: desserts?.reduce((accu, curr) => {
        accu[`${curr?.id}`] = curr;
        return accu;
      }, {}),
    });

    res.status(200).send({
      status: 200,
      success: true,
      message: "Recommendation created successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while creating recommendation",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    let { restaurant_id } = req.query;
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Restaurant id missing",
      });
    }

    let recommendations = await Recommendation.where(
      "restaurant_id",
      "==",
      restaurant_id
    ).get();
    recommendations = recommendations?.docs?.map((recommendation) => {
      return {
        id: recommendation.id,
        ...recommendation.data(),
        starters: Object.values(recommendation.data()?.starters),
        main_courses: Object.values(recommendation.data()?.main_courses),
        desserts: Object.values(recommendation.data()?.desserts),
      };
    });
    res.status(200).send(recommendations);
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while fetching recommendation",
    });
  }
});

router.get("/all", async (req, res) => {
  try {
    let { restaurant_id } = req.query;
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Restaurant id missing",
      });
    }

    let recommendations = await Recommendation.where(
      "restaurant_id",
      "==",
      restaurant_id
    ).get();
    recommendations = recommendations?.docs?.map(async (recommendation) => {
      try {
        let [starters, main_courses, desserts] = await Promise.all([
          variantsDetail(Object.keys(recommendation?.data()?.starters)),
          variantsDetail(Object.keys(recommendation?.data()?.main_courses)),
          variantsDetail(Object.keys(recommendation?.data()?.desserts)),
        ]);

        return Promise.resolve({
          id: recommendation.id,
          ...recommendation?.data(),
          starters,
          main_courses,
          desserts,
        });
      } catch (error) {
        return Promise.reject(error);
      }
    });

    recommendations = await Promise.all(recommendations);

    res.status(200).send(recommendations);
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while fetching recommendation",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    let { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Recommendation id missing",
      });
    }

    let recommendation = await Recommendation.doc(id).get();

    let [starters, main_courses, desserts] = await Promise.all([
      variantsDetail(Object.keys(recommendation?.data()?.starters)),
      variantsDetail(Object.keys(recommendation?.data()?.main_courses)),
      variantsDetail(Object.keys(recommendation?.data()?.desserts)),
    ]);

    recommendation = {
      id: recommendation?.id,
      ...recommendation?.data(),
      starters,
      main_courses,
      desserts,
    };

    res.status(200).send(recommendation);
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while fetching recommendation",
    });
  }
});

router.put("/", async (req, res) => {
  try {
    let { restaurant_id, recommendation_id } = req.query;
    let { recommendation } = req.body;
    if (!restaurant_id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Restaurant id missing",
      });
    }

    if (!recommendation_id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Recommendation id missing",
      });
    }

    if (!(recommendation && Object.keys(recommendation) != 0)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Recommendation data missing",
      });
    }

    let starters =
      recommendation?.starters?.length != 0
        ? recommendation?.starters.slice(0, 3)
        : [];
    let main_courses =
      recommendation?.main_courses?.length != 0
        ? recommendation?.main_courses.slice(0, 3)
        : [];
    let desserts =
      recommendation?.desserts?.length != 0
        ? recommendation?.desserts.slice(0, 3)
        : [];

    await Recommendation.doc(recommendation_id).update({
      name: recommendation?.name || "",
      description: recommendation?.description || "",
      restaurant_id,
      starters: starters?.reduce((accu, curr) => {
        accu[`${curr?.id}`] = curr;
        return accu;
      }, {}),
      main_courses: main_courses?.reduce((accu, curr) => {
        accu[`${curr?.id}`] = curr;
        return accu;
      }, {}),
      desserts: desserts?.reduce((accu, curr) => {
        accu[`${curr?.id}`] = curr;
        return accu;
      }, {}),
    });

    res.status(200).send({
      status: 200,
      success: true,
      message: "Recommendation updated successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while updating recommendation",
    });
  }
});

module.exports = router;
