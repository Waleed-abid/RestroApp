const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const functions = require("firebase-functions");
const stripe_secretkey = functions.config().secret.stripe_secretkey;
const validateFirebaseIdToken = require("./authMiddleware");
const sendInvoice = require("../helpers/sendInvoice");
const sendWhatsapp = require("../helpers/sendWhatsapp");
const paymentRouter = express.Router();

paymentRouter.use(cors({ origin: true }));
paymentRouter.use(bodyParser.json());
paymentRouter.use(bodyParser.urlencoded({ extended: false }));
paymentRouter.use(validateFirebaseIdToken);

const stripe = require("stripe")(stripe_secretkey);

const paymentController = (db, FieldValue) => {
  //  route for card insertion
  paymentRouter.post("/addcard", (req, res) => {
    const { user_id } = req.query;
    const { number, exp_month, exp_year, cvc } = req.body;
    if (!(number, exp_month, exp_year, cvc, user_id)) {
      res.status(400).send({ error: "Bad request" });
      return;
    }

    db.collection("users")
      .doc(user_id)
      .get()
      .then((response) => {
        if (!response.data()) {
          res.status(400).send({ error: "No user" });
          return;
        }
        const user = response.data();
        if (!user.customer_id) {
          stripe.customers
            .create({
              name: user.name,
              email: user.email || "",
              phone: user.phone_number || "",
            })
            .then((customer) => {
              stripe.tokens
                .create({
                  card: {
                    number,
                    exp_month,
                    exp_year,
                    cvc,
                  },
                })
                .then((token) => {
                  stripe.customers
                    .createSource(customer.id, {
                      source: token.id,
                    })
                    .then((source) => {
                      db.collection("users")
                        .doc(user_id)
                        .update({
                          token: source.id,
                          customer_id: source.customer,
                        })
                        .then(() => {
                          res
                            .status(200)
                            .send({ success: { message: "user card added" } });
                        })
                        .catch((error) => {
                          res.status(500).send(error);
                        });
                    });
                });
            });
        } else {
          stripe.tokens
            .create({
              card: {
                number,
                exp_month,
                exp_year,
                cvc,
              },
            })
            .then((token) => {
              stripe.customers
                .createSource(user.customer_id, {
                  source: token.id,
                })
                .then((source) => {
                  db.collection("users")
                    .doc(user_id)
                    .update({
                      token: source.id,
                    })
                    .then(() => {
                      res.status(200).send(source);
                    })
                    .catch((error) => {
                      res.status(500).send(error);
                    });
                });
            });
        }
      })
      .catch((error) => {
        res.status(500).send({ error: error.message });
      });
  });

  // route for payment
  paymentRouter.post("/pay", async (req, res) => {
    const {
      restaurant_id,
      user_id,
      table_id,
      flag,
      no_customers,
      selected_amount,
      table_no,
      email,
    } = req.query;
    const { restaurant_no, currency, order_ids, send_invoice, tip } = req.body;
    if (
      !(
        user_id &&
        restaurant_id &&
        table_id &&
        flag &&
        table_no &&
        restaurant_no &&
        email
      )
    ) {
      res.status(400).send({
        error:
          "User or restaurant or table id or flag or table or restaurant no or customer email missing",
      });
      return;
    }

    if (flag == 3 && !selected_amount) {
      res.status(400).send({ error: "selected amount missing" });
      return;
    }

    if (flag == 2 && !no_customers) {
      res.status(400).send({ error: "No of customers missing" });
      return;
    }

    const tableRef = db
      .collection(`restaurants/${restaurant_id}/tables`)
      .doc(table_id);
    let tabledata = {};
    let amount_to_pay = 0;
    try {
      tabledata = await tableRef.get();
      tabledata = tabledata.data();
      if (tabledata?.remaining_bill == 0) {
        res.status(200).send({ message: "Nothing to pay" });
        return;
      }

      if (flag == 1) {
        amount_to_pay = tabledata.remaining_bill;
      }
      if (flag == 2) {
        amount_to_pay = tabledata.remaining_bill / +no_customers;
      }
      if (flag == 3) {
        amount_to_pay = +selected_amount;
      }
      if (tabledata.remaining_bill < amount_to_pay) {
        amount_to_pay = tabledata.remaining_bill;
      }
    } catch (error) {
      res.status(500).send({ error: "Error for table reading" });
      return;
    }

    db.collection("users")
      .doc(user_id)
      .get()
      .then((response) => {
        const user = response.data();

        if (!user) {
          res.status(400).send({ error: "No user" });
          return;
        }

        if (!user?.customer_id || !user?.token) {
          res.status(400).send({ error: "Add card details" });
          return;
        }
        stripe.charges
          .create({
            amount: Math.round((amount_to_pay + (tip || 0)).toFixed(2) * 100),
            currency: currency,
            description: `payment for orders ${order_ids.join(",")}`,
            customer: user.customer_id,
          })
          .then((response) => {
            if (response.status == "succeeded") {
              if (tip && tip > 0) {
                db.collection("tips")
                  .add({
                    user_id,
                    tip,
                    order_ids,
                  })
                  .then(() => {
                    console.log("payment done");
                  })
                  .catch((error) => console.log(error));
              }
              if (send_invoice) {
                sendInvoice(
                  email,
                  tabledata?.total_bill,
                  amount_to_pay,
                  tabledata?.remaining_bill - amount_to_pay,
                  tip
                )
                  .then(() => {
                    console.log("Invoice send to customer");
                  })
                  .catch((error) => {
                    console.log(error);
                  });
              }

              sendWhatsapp(
                restaurant_no,
                `${amount_to_pay} payment done for table ${table_no}`
              )
                .then(() => {
                  console.log("Whatsapp message send");
                })
                .catch(() => {
                  console.log("Error during sending whatsapp message");
                });

              if (tabledata?.remaining_bill - amount_to_pay == 0) {
                let batch = db.batch();
                order_ids.forEach((element) => {
                  const docRef = db.collection("orders").doc(element);
                  batch.update(docRef, {
                    status: "approved",
                  });
                });

                batch.update(tableRef, {
                  total_bill: 0,
                  remaining_bill: 0,
                  is_open: false,
                });
                batch
                  .commit()
                  .then(() => {
                    res.status(200).send({ success: "payment done" });

                    setTimeout(() => {
                      sendWhatsapp(restaurant_no, `Table ${table_no} is closed`)
                        .then(() => {
                          console.log("Message send");
                        })
                        .catch((error) => {
                          console.log(error);
                        });
                    }, 2 * 60 * 1000);
                  })
                  .catch((error) => {
                    res.status(500).send({
                      error: "Error while updating order",
                    });
                  });
              } else {
                tableRef
                  .update({
                    remaining_bill: FieldValue.increment(-amount_to_pay),
                  })
                  .then(() => console.log("table updated"))
                  .catch((error) => console.log(error));

                res.status(200).send({
                  message: `Pay remaining ${
                    tabledata?.remaining_bill - amount_to_pay
                  }`,
                });
              }
            }
          })
          .catch((error) => {
            console.log(error.message);
            res.status(500).send({ error: "Error during charges" });
          });
      });
  });

  return paymentRouter;
};

module.exports = paymentController;
