const express = require("express");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const isValidCoupon = require("../helpers/isValidCoupon");
const { Coupon, User, Cart } = require("../models");
const router = express.Router();
const FieldValue = admin.firestore.FieldValue;
const db = admin.firestore();

router.post("/create", async (req, res) => {
  const { restaurant_id } = req.query;
  const { coupon } = req.body;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  if (!(coupon && Object.keys(coupon)?.length != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Nothing to create a coupon",
    });
    return;
  }

  if (!coupon?.code) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Coupon code missing",
    });
    return;
  }

  try {
    await Coupon(restaurant_id).doc(coupon.code).set(coupon);
    res.status(200).send({
      status: 200,
      success: true,
      message: "Coupon created successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while creating coupon",
    });
  }
});

router.get("/apply-coupon", async (req, res) => {
  const { restaurant_id, coupon_code, order_id, user_id } = req.query;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id is missing",
    });
    return;
  }

  if (!user_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "User id is missing",
    });
    return;
  }

  if (!order_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Order id is missing",
    });
    return;
  }

  if (!coupon_code) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Coupon code is missing",
    });
    return;
  }

  try {
    let coupon_detail = Coupon(restaurant_id)
      .doc(coupon_code)
      .get()
      .then((response) => {
        return Promise.resolve({ id: response?.id, ...response?.data() });
      });

    let cart_detail = Cart.doc(user_id)
      .get()
      .then((response) => {
        return Promise.resolve({ id: response?.id, ...response?.data() });
      })
      .catch((error) => Promise.reject(error));

    let [coupon, cart] = await Promise.all([coupon_detail, cart_detail]);
    let visit = cart?.visit?.[restaurant_id] || 1;
    if (isValidCoupon(coupon, visit)) {
      let batch = db.batch();
      let couponRef = Coupon(restaurant_id).doc(coupon_code);
      let cartRef = Cart.doc(user_id);
      batch.update(couponRef, { usage: FieldValue.increment(1) });
      batch.update(cartRef, { discount: coupon.discount });

      await batch.commit();

      res.status(200).send({ discount: coupon.discount });
    } else {
      functions.logger.log("Coupon is not valid");
      res.status(500).json({
        status: 500,
        success: false,
        message: "Coupon is not valid",
      });
    }
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while applying coupon",
    });
  }
});

module.exports = router;
