const express = require("express");
const admin = require("firebase-admin");
const FieldValue = admin.firestore.FieldValue;
const router = express.Router();
const functions = require("firebase-functions");
const { Cart, Variant } = require("../models");

router.post("/add-item", async (req, res) => {
  const { user_id } = req.query;
  const { items } = req.body;

  if (!user_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "User id missing",
    });
    return;
  }

  if (!(items && items?.length != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Atleast select one item",
    });
    return;
  }

  try {
    await Cart.doc(user_id).set(
      {
        total_quantity: FieldValue.increment(items.length),
        line_items: {
          ...items?.reduce((acc, curr) => {
            acc[`${curr.id}`] = {
              quantity: FieldValue.increment(1),
              flag: curr?.flag || null,
            };
            return acc;
          }, {}),
        },
      },
      { merge: true }
    );
    res.status(200).json({
      status: 200,
      success: true,
      message: "Item added in cart",
    });
  } catch (error) {
    functions.logger.log("Error while adding item to cart", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while adding item to cart",
    });
  }
});

router.get("/remove-item", async (req, res) => {
  const { user_id, item_id, quantity } = req.query;

  if (!user_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "User id missing",
    });

    return;
  }

  if (!item_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Select item to remove",
    });

    return;
  }

  if (!quantity) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Quantity of item is missing",
    });
    return;
  }

  try {
    await Cart.doc(user_id).set(
      {
        total_quantity: FieldValue.increment(-1),
        line_items: {
          [item_id]:
            quantity <= 1
              ? FieldValue.delete()
              : {
                  quantity: FieldValue.increment(-1),
                },
        },
      },
      { merge: true }
    );
    res.status(200).send({
      status: 200,
      success: true,
      message: "Item removed from cart",
    });
  } catch (error) {
    functions.logger.log("Error while removing item from cart", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while removing item from cart",
    });
  }
});

router.get("", async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "User id is missing",
    });
    return;
  }

  try {
    let result = await Cart.doc(user_id).get();

    let cart = result.data();
    if (!cart?.line_items) {
      res.status(200).send({});
      return;
    }

    let line_items = Object.keys(cart.line_items)?.map((item) => {
      return Variant.doc(item)
        .get()
        .then((response) => {
          return Promise.resolve({
            id: response.id,
            ...response.data(),
            quantity: response.data() && cart.line_items?.[item]?.quantity,
            flag: response.data() && cart.line_items?.[item]?.flag,
          });
        })
        .then((response) => {
          if (
            response.offer_category_id == 3 &&
            response?.discount?.free_items &&
            Object.keys(response?.discount?.free_items).length != 0
          ) {
            let free_items = Object.keys(response?.discount?.free_items)?.map(
              (item) => {
                return Variant.doc(item)
                  .get()
                  .then((response) => {
                    return Promise.resolve({
                      id: response.id,
                      ...response.data(),
                      price: 0,
                    });
                  })
                  .catch((error) => {
                    return Promise.reject(error);
                  });
              }
            );

            return Promise.all(free_items)
              .then((responses) => {
                return Promise.resolve({
                  ...response,
                  discount: { ...response.discount, free_items: responses },
                });
              })
              .catch((error) => Promise.reject(error));
          }
          return Promise.resolve(response);
        })
        .catch((error) => {
          return Promise.reject(error);
        });
    });

    result = await Promise.all(line_items);

    res.status(200).send({
      ...cart,
      line_items: result.filter((item) => item.quantity),
    });
  } catch (error) {
    functions.logger.log("Error while reading cart", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while reading cart",
    });
  }
});

module.exports = router;
