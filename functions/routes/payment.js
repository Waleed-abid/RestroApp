const express = require("express");
const router = express.Router();
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const FieldValue = admin.firestore.FieldValue;
const { User, Order, Tip, Payment } = require("../models");
const sendInvoice = require("../helpers/sendInvoice");
const sendWhatsapp = require("../helpers/sendWhatsapp");
const stripe_secretkey = functions.config().secret.stripe_secretkey;
const stripe = require("stripe")(stripe_secretkey);

router.get("/all", async (req, res) => {
  const { restaurant_id } = req.query;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  try {
    let payments = await Payment.where(
      "restaurant_id",
      "==",
      restaurant_id
    ).get();

    res.status(200).send(
      payments.docs?.map((payment) => {
        return { id: payment.id, ...payment.data() };
      })
    );
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while reading tips",
    });
  }
});

router.post("/add-card", async (req, res) => {
  const { user_id } = req.query;
  const { number, exp_month, exp_year, cvc } = req.body;

  if (!user_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "User id missing",
    });

    return;
  }

  if (!(number && exp_month && exp_year && cvc)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Card detail is missing",
    });
    return;
  }

  try {
    let user = await User.doc(user_id).get();

    if (!user.data()) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "No user found with given id",
      });
      return;
    }

    user = { id: user.id, ...user.data() };
    if (!user.customer_id) {
      let customer = stripe.customers.create({
        name: user.name,
        email: user.email || "",
        phone: user.phone_number || "",
      });

      let card = stripe.tokens.create({
        card: {
          number,
          exp_month,
          exp_year,
          cvc,
        },
      });

      let [customer_detail, card_detail] = await Promise.all([customer, card]);

      let token = await stripe.customers.createSource(customer_detail.id, {
        source: card_detail.id,
      });

      await User.doc(user_id).update({
        token: token.id,
        customer_id: token.customer,
      });

      res.status(200).send(token);
    } else {
      let card = await stripe.tokens.create({
        card: {
          number,
          exp_month,
          exp_year,
          cvc,
        },
      });
      let token = await stripe.customers.createSource(user.customer_id, {
        source: card.id,
      });

      await User.doc(user_id).update({
        token: token.id,
      });
      res.status(200).send(token);
    }
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while adding card",
    });
  }
});

router.post("/pay", async (req, res) => {
  const {
    restaurant_id,
    user_id,
    table_id,
    order_id,
    currency,
    send_invoice,
    tip,
    flag,
    no_customers,
    selected_amount,
    email,
    total_customers,
  } = req.query;
  const { restaurant_no } = req.body;

  if (!user_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "User id missing",
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

  if (!table_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Table id missing",
    });

    return;
  }

  if (!order_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Order id missing",
    });

    return;
  }

  if (!flag) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Flag is missing",
    });

    return;
  }

  if (!restaurant_no) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant number is missing",
    });

    return;
  }

  if (send_invoice && !email) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Email is missing",
    });

    return;
  }

  if (+flag == 3 && !selected_amount) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "selected amount missing",
    });

    return;
  }

  if (+flag == 2 && !no_customers && !total_customers) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "No of customers missing",
    });

    return;
  }

  try {
    let [order, user] = await Promise.all([
      Order.doc(order_id).get(),
      User.doc(user_id).get(),
    ]);

    if (!order?.data()) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Order Not found",
      });

      return;
    }
    if (!user?.data()) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "User Not found",
      });

      return;
    }

    if (
      order?.data()?.temp_status &&
      order?.data()?.temp_status == "new order"
    ) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: "Can't pay before admin accept order items",
      });
    }

    order = { id: order.id, ...order.data() };
    user = { id: user.id, ...user.data() };
    if (order?.payment?.remaining <= 0) {
      res.status(200).send({
        status: 200,
        success: true,
        message: "Nothing to pay",
      });
      return;
    }
    let amount_to_pay;
    if (+flag == 1) {
      amount_to_pay = order?.payment?.remaining;
    }
    if (+flag == 2) {
      amount_to_pay =
        (order?.payment?.total / +total_customers) * +no_customers;
    }
    if (+flag == 3) {
      amount_to_pay = +selected_amount;
    }
    if (order?.payment?.remaining < amount_to_pay) {
      amount_to_pay = order?.payment?.remaining;
    }

    if (!user?.customer_id || !user?.token) {
      res.status(400).json({
        status: 400,
        success: false,
        message: "Add card details",
      });
      return;
    }

    let charged = await stripe.charges.create({
      amount: Math.round((amount_to_pay + (+tip || 0)).toFixed(2) * 100),
      currency: currency,
      description: `payment for order ${order_id}`,
      customer: user.customer_id,
    });
    let message = "";
    if (charged.status == "succeeded") {
      await Payment.doc(order_id).set(
        {
          total: FieldValue.increment(amount_to_pay),
          table_id,
          restaurant_id,
          [user_id]: {
            table_id,
            restaurant_id,
            amount: FieldValue.increment(amount_to_pay),
          },
        },
        { merge: true }
      );
      try {
        if (tip && +tip > 0) {
          Tip.doc(order_id)
            .set(
              {
                total: FieldValue.increment(+tip),
                tips: {
                  [user_id]: FieldValue.increment(+tip),
                  time: new Date(),
                },
                order_id,
                restaurant_id,
                table_id,
              },
              { merge: true }
            )
            .then((response) => functions.logger.log("Tip added to collection"))
            .catch((error) => functions.logger.log(error));
        }

        if (send_invoice) {
          sendInvoice(
            email,
            order?.payment?.total,
            amount_to_pay,
            order?.payment?.remaining - amount_to_pay,
            tip
          )
            .then((response) => {
              functions.logger.log("Invoice send to your mail");
            })
            .catch((error) => {
              functions.logger.log(error);
            });
        }
      } catch (error) {
        functions.logger.log(error);
      }
      let newOrder = {};
      if (order?.payment?.remaining - amount_to_pay <= 0) {
        message = `Payment done for table ${table_id}`;
        newOrder = {
          status: "paid",
          temp_status: "paid",
          line_items: {
            ...Object.values(order?.line_items)?.reduce((acc, curr) => {
              acc[`${curr?.user_id}`] = {
                ...curr,
                remaining: 0,
                items: {
                  ...Object.values(curr?.items)?.reduce((prev, item) => {
                    prev[`${item.id}`] = {
                      ...item,
                      status: "paid",
                      temp_status: "paid",
                    };

                    return prev;
                  }, {}),
                },
              };

              return acc;
            }, {}),
          },
          payment_types: {
            restroapp: {
              amount: FieldValue.increment(amount_to_pay),
              menthod: "restroapp",
            },
          },
          payment: {
            remaining: FieldValue.increment(-amount_to_pay),
          },
        };
      } else {
        message = `${amount_to_pay} payment done for table ${table_id}`;
        newOrder = {
          payment_types: {
            restroapp: {
              amount: FieldValue.increment(amount_to_pay),
              menthod: "restroapp",
            },
          },
          payment: {
            remaining: FieldValue.increment(-amount_to_pay),
          },
        };
      }
      await Order.doc(order_id).set(newOrder, { merge: true });

      setTimeout(() => {
        sendWhatsapp(restaurant_no, `Table ${table_id} is closed`)
          .then((response) => {
            functions.logger.log("Message send");
          })
          .catch((error) => {
            functions.logger.log(error);
          });
      }, 2 * 60 * 1000);

      sendWhatsapp(restaurant_no, message)
        .then((response) => functions.logger.log("Message send to restaurant"))
        .catch((error) => functions.logger.log(error));
    }

    res.status(200).send({
      status: 200,
      success: true,
      message: message,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
