const express = require("express");
const admin = require("firebase-admin");
const FieldValue = admin.firestore.FieldValue;
const db = admin.firestore();
const router = express.Router();
const functions = require("firebase-functions");
const { Offer, Variant } = require("../models");

router.post("", async (req, res) => {
  const { offer } = req.body;
  const { restaurant_id } = req.query;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });

    return;
  }

  if (!(offer && Object.keys(offer).length != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "offer is missing",
    });

    return;
  }

  if (!(offer?.items && (offer?.items?.length != 0) != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "At least one item must be included",
    });

    return;
  }

  let newOffer = {};
  if (offer?.category_id == 3) {
    newOffer = {
      ...offer,
      restaurant_id: restaurant_id,
      items: offer?.items.reduce((accu, curr) => {
        accu[`${curr.id}`] = curr;

        return accu;
      }, {}),
      free_items: offer?.free_items?.reduce((accu, curr) => {
        accu[`${curr.id}`] = curr;

        return accu;
      }, {}),
    };
  } else {
    newOffer = {
      ...offer,
      restaurant_id: restaurant_id,
      items: offer?.items.reduce((accu, curr) => {
        accu[`${curr.id}`] = curr;

        return accu;
      }, {}),
    };
  }

  try {
    await Offer.add(newOffer);
    res.status(200).send({
      status: 200,
      success: true,
      message: "Offer created successfully",
    });
  } catch (error) {
    functions.logger.log("Error while creating offer", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while creating offer",
    });
  }
});

const offer = async (change, context) => {
  try {
    const { offer_id } = context.params;

    const offer = change.after.data();
    let offer_data = {};

    switch (offer?.category_id) {
      case 1:
        offer_data = {
          quantity: 2,
          valid_from: offer?.valid_from,
          valid_untill: offer?.valid_untill,
          valid_start_time: offer?.valid_start_time,
          valid_end_time: offer?.valid_end_time,
          valid_customer: offer?.valid_customer || "all",
        };
        break;
      case 3:
        offer_data = {
          free_items: Object.keys(offer?.free_items)?.reduce((accu, curr) => {
            accu[curr] = true;
            return accu;
          }, {}),
          valid_from: offer?.valid_from,
          valid_untill: offer?.valid_untill,
          valid_start_time: offer?.valid_start_time,
          valid_end_time: offer?.valid_end_time,
          valid_customer: offer?.valid_customer || "all",
        };
        break;
      default:
        offer_data = {
          discount: offer?.discount,
          temp_price: offer?.temp_price,
          valid_from: offer?.valid_from,
          valid_untill: offer?.valid_untill,
          valid_start_time: offer?.valid_start_time,
          valid_end_time: offer?.valid_end_time,
          valid_customer: offer?.valid_customer || "all",
        };

        break;
    }

    const batch = db.batch();

    Object.keys(offer?.items)?.forEach((item) => {
      batch.update(Variant.doc(item), {
        offer_category_id: offer?.category_id,
        offer_id: offer_id,
        is_offer_active: offer?.is_active || false,
        discount: offer_data,
      });
    });

    await batch.commit();
    functions.logger.log("Varaint offer detail added");
  } catch (error) {
    functions.logger.log("Error while updating variants", { error });
  }

  return;
};

module.exports = { router, offer };
