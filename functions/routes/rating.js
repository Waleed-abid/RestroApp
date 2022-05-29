const express = require("express");
const functions = require("firebase-functions");
const sendWhatsapp = require("../helpers/sendWhatsapp");
const { Rating, Order } = require("../models");
const router = express.Router();

router.get("/", async (req, res) => {
  const { order_id, user_id } = req.query;

  if (!order_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Order id missing",
    });
  }

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "User id missing",
    });
  }

  try {
    let order = await Order.doc(order_id).get();
    order = {
      id: order.id,
      ...order.data(),
    };

    if (!order?.line_items?.[`${user_id}`]?.items) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: "You have not order anything",
      });
    }

    res.status(200).send({
      dining_experience: {
        ambiance: 3,
        food: 4,
        service: 5,
      },
      food_experience: Object.values(
        order?.line_items?.[`${user_id}`]?.items
      )?.map((item) => {
        return { item: item.name, rating: 4 };
      }),
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while reading order",
    });
  }
});

router.post("/", async (req, res) => {
  const { restaurant_id, order_id, user_id, table_id } = req.query;
  const { rating, restaurant_no } = req.body;
  if (!restaurant_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
  }

  if (!table_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Table id missing",
    });
  }

  if (!restaurant_no) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant number is missing",
    });
  }

  if (Object.keys(rating)?.length == 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Nothing to rate",
    });
  }

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user id missing",
    });
  }

  if (!order_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "order id missing",
    });
  }
  try {
    await Rating.doc(order_id).set(
      {
        restaurant_id,
        ratings: {
          [user_id]: {
            comment: rating?.comment || "",
            dining_experience: {
              ambiance: rating?.dining_experience?.ambiance || 5,
              service: rating?.dining_experience?.service || 5,
              food: rating?.dining_experience?.food || 5,
              food_experience: rating?.food_experience || [],
            },
          },
        },
      },
      { merge: true }
    );

    let whatsappMessage = `Table ${table_id} Customer Feedback\nFood ${rating?.dining_experience?.food}\nService ${rating?.dining_experience?.service}\nAmbiance ${rating?.dining_experience?.ambiance}\n`;

    if (rating?.food_experience?.[0]) {
      whatsappMessage += rating?.food_experience
        ?.map((item) => {
          return `${item.heading} ${item.rating}\n`;
        })
        ?.join("");
    }
    sendWhatsapp(restaurant_no, whatsappMessage)
      .then((response) => functions.logger.log("Message send"))
      .catch((error) => functions.logger.log(error));

    res.status(200).send({
      status: 200,
      success: true,
      message: "Rating done",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while creating rating",
    });
  }
});

module.exports = router;
