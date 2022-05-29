const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const functions = require("firebase-functions");
const accountSid = functions.config().secret.twillo_account_sid;
const authToken = functions.config().secret.twillo_auth_token;
const stripe_secretkey = functions.config().secret.stripe_secretkey;
const client = require("twilio")(accountSid, authToken);
const validateFirebaseIdToken = require("./authMiddleware");
const sendWhatsapp = require("../helpers/sendWhatsapp");

const orderRouter = express.Router();

orderRouter.use(cors({ origin: true }));
orderRouter.use(bodyParser.json());
orderRouter.use(bodyParser.urlencoded({ extended: false }));

const stripe = require("stripe")(stripe_secretkey);

const orderController = (db, FieldValue) => {
  // Route for placing order
  orderRouter.post("/placeorder", validateFirebaseIdToken, async (req, res) => {
    const { restaurant_no, note, tableId, userId, restaurantId, items } =
      req.body;
    const { table_no } = req.query;
    const tax = req.body.tax || 0.05;
    let whatappMessage = `Table ${table_no}`;

    const paymentDetail = {
      total_order: 0,
      discount: 0,
    };

    if (
      !(userId && restaurantId && tableId && restaurant_no && table_no && items)
    ) {
      res.status(400).send({ error: { message: "Bad request" } });
      return;
    }

    const tableRef = db
      .collection(`restaurants/${restaurantId}/tables`)
      .doc(tableId);

    try {
      let tabledata = await tableRef.get();

      if (!tabledata.exists) {
        res
          .status(500)
          .send({ error: { message: "No table exist with this id" } });
        return;
      }

      if (!tabledata?.data()?.is_open) {
        try {
          tabledata = await tableRef.set(
            {
              is_open: true,
              total_bill: 0,
              remaining_bill: 0,
            },
            { merge: true }
          );
        } catch (error) {
          res
            .status(500)
            .send({ error: { message: "Error for table updating" } });
          return;
        }
      }

      const dealsdb = db.collection(`restaurants/${restaurantId}/deals`);
      const dealsdata = dealsdb
        .where("expire_at", ">=", new Date())
        .get()
        .then((response) => {
          return Promise.resolve({
            id: response?.docs[0]?.id,
            ...response?.docs[0]?.data(),
          });
        })
        .catch((error) => {
          return Promise.reject(error);
        });
      const quantities = {};
      const itemrefs = items.map((item) => {
        quantities[`${item.id}`] = { quantity: item.quantity };
        return db
          .collection(`restaurants/${restaurantId}/variants`)
          .doc(`${item.id}`);
      });

      if (!itemrefs) {
        res.status(400).send({ error: { message: "Given items not found" } });
        return;
      }

      const itemsdata = db.getAll(...itemrefs).then((response) => {
        return Promise.resolve(
          response?.map((doc) => {
            if (doc.data()?.name) {
              whatappMessage +=
                `${doc.data()?.name} ${quantities[`${doc.id}`]?.quantity}` +
                "\n";
            }

            return {
              id: doc.id,
              ...doc.data(),
              quantity: quantities[`${doc.id}`]?.quantity,
            };
          })
        );
      });

      Promise.all([dealsdata, itemsdata])
        .then((responses) => {
          let deal = responses[0];
          let items = responses[1];

          items.forEach((item) => {
            if (item.id === deal.variant_id) {
              paymentDetail.discount +=
                item.price * deal.discount * item.quantity;
              paymentDetail.total_order += item.price * item.quantity;
            } else {
              paymentDetail.total_order += item.price * item.quantity;
            }
          });
          const sub_total = paymentDetail.total_order - paymentDetail.discount;
          const order_tax = sub_total * tax;
          const grand_toal = sub_total + order_tax;
          const newOrder = {
            line_items: items,
            user_id: userId,
            restaurant_id: restaurantId,
            table_id: tableId,
            status: "pending",
            note: note,
            payment_detail: {
              ...paymentDetail,
              sub_total: sub_total,
              tax: order_tax,
              grand_toal: grand_toal,
            },
          };

          db.collection("orders")
            .add(newOrder)
            .then((response) => {
              let special_requests = [];
              if (note?.[0]) {
                special_requests = note?.join("\n");
                whatappMessage += "Special requests \n" + special_requests;
              }

              tableRef
                .update({
                  total_bill: FieldValue.increment(grand_toal),
                  remaining_bill: FieldValue.increment(grand_toal),
                })
                .then(() => {
                  client.messages
                    .create({
                      from: "whatsapp:+14155238886",
                      body: whatappMessage,
                      to: `whatsapp:${restaurant_no}`,
                    })
                    .then(() => {
                      res.status(200).send({
                        order_id: response.id,
                        message: "Order placed successfully",
                      });
                      return;
                    })
                    .catch((error) => {
                      res.status(500).send({
                        error: {
                          message: error.message,
                        },
                      });
                      return;
                    });
                })
                .catch((error) => {
                  res
                    .status(500)
                    .send({ error: { message: "Error during table update" } });
                });
            })
            .catch((error) => {
              res.status(500).send({ error: { message: error.message } });
            });
        })
        .catch((error) => {
          res.status(500).send({ error: { message: error.message } });
        });
    } catch (error) {
      res.status(500).send({ error: { message: "Error for table reading" } });
      return;
    }
  });

  orderRouter.get("/tableorder", validateFirebaseIdToken, async (req, res) => {
    const { user_id, restaurant_id, table_id } = req.query;
    if (!(user_id && restaurant_id && table_id)) {
      res.status(400).send({ error: { message: "Bad req" } });
    }
    let tabledata = {};
    try {
      tabledata = await db
        .collection(`restaurants/${restaurant_id}/tables`)
        .doc(table_id)
        .get();

      tabledata = { id: tabledata.id, ...tabledata.data() };
    } catch (error) {
      res.status(500).send({ error: { message: "Error for table reading" } });
      return;
    }

    const orderdb = db.collection("orders");
    const table_order = {
      table_bill: 0,
      sub_total: 0,
      discount: 0,
      tax: 0,
      your_total: 0,
      others_payment: 0,
      your_orders: [],
      other_orders: [],
    };
    const cardDetail = db
      .collection("users")
      .doc(`${user_id}`)
      .get()
      .then((response) => {
        let userdata = response.data();
        if (userdata.customer_id && userdata.token) {
          return stripe.customers
            .retrieveSource(userdata.customer_id, userdata.token)
            .then((response) => Promise.resolve(response))
            .catch((error) => Promise.reject(error));
        } else {
          return Promise.resolve({});
        }
      })
      .catch((error) => Promise.reject(error));
    const tableorders = orderdb
      .where("restaurant_id", "==", restaurant_id)
      .where("table_id", "==", table_id)
      .where("status", "==", "pending")
      .get()
      .then((response) => {
        response.docs.forEach((order) => {
          const data = order.data();

          if (user_id === data.user_id) {
            table_order.table_bill += data.payment_detail.grand_toal;
            table_order.sub_total += data.payment_detail.sub_total;
            table_order.discount += data.payment_detail.discount;
            table_order.tax += data.payment_detail.tax;
            table_order.your_total += data.payment_detail.grand_toal;

            table_order["your_orders"].push({
              id: order.id,
              ...data,
            });
          } else {
            table_order.others_payment += data.payment_detail.grand_toal;
            table_order.sub_total += data.payment_detail.sub_total;
            table_order.table_bill += data.payment_detail.grand_toal;
            table_order.discount += data.payment_detail.discount;
            table_order.tax += data.payment_detail.tax;

            table_order["other_orders"].push({ id: order.id, ...data });
          }
        });

        return Promise.resolve(table_order);
      })
      .catch((error) => {
        return Promise.reject(error);
      });

    Promise.all([cardDetail, tableorders])
      .then((responses) => {
        let card = responses[0];
        let tableDetail = responses[1];
        res.status(200).send({
          data: {
            ...tableDetail,
            card: card,
            total_bill: tabledata.total_bill,
            remaining_bill: tabledata.remaining_bill,
          },
        });
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } });
      });
  });

  orderRouter.put("/requestwaiter", (req, res) => {
    const { table_no } = req.query;
    const { restaurant_no, reason } = req.body;

    if (!(table_no && restaurant_no)) {
      res.status(400).send({ error: { message: "Bad request" } });
      return;
    }

    sendWhatsapp(
      restaurant_no,
      reason
        ? `Table ${table_no} requires ${reason} payment`
        : `Table ${table_no} requires a waiter`
    )
      .then(() => {
        res.status(200).send({ message: "Request send to restaurant" });
      })
      .catch(() => {
        res
          .status(500)
          .send({ error: { message: "Error during sending waiter request" } });
      });
  });

  return orderRouter;
};

module.exports = orderController;
