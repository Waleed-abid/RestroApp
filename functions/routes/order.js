const express = require("express"); 
const admin = require("firebase-admin"); 
const sendWhatsapp = require("../helpers/sendWhatsapp"); 
const { Table, Cart, Variant, Order, User, Restaurant } = require("../models"); 
const FieldValue = admin.firestore.FieldValue; 
const functions = require("firebase-functions"); 
const createLineItems = require("../helpers/createLineItems"); 
const router = express.Router(); 
const cors = require("cors"); 
const bodyParser = require("body-parser"); 
const visit_count = require("../helpers/visit_count"); 
const calculateTax = require("../helpers/calculateTax"); 
const addItem = require("../helpers/order/addItem"); 
const stripe_secretkey = functions.config().secret.stripe_secretkey; 
const stripe = require("stripe")(stripe_secretkey); 
const db = admin.firestore(); 
 
router.use(cors({ origin: true })); 
router.use(express.json()); 
router.use(bodyParser.urlencoded({ extended: false })); 
 
router.post("/place-order", async (req, res) => { 
  const { user_id, table_id, restaurant_id, user_name } = req.query; 
  const { restaurant_no } = req.body; 
 
  if (!user_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "User id is missing", 
    }); 
    return; 
  } 
 
  if (!table_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Table id is missing", 
    }); 
    return; 
  } 
 
  if (!restaurant_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Restaurant id is missing", 
    }); 
    return; 
  } 
 
  if (!user_name) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "User name is missing", 
    }); 
    return; 
  } 
 
  if (!restaurant_no) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Restaurant number missing", 
    }); 
    return; 
  } 
 
  const table_detail = Table(restaurant_id) 
    .doc(table_id) 
    .get() 
    .then((response) => { 
      return Promise.resolve({ id: response.id, ...response.data() }); 
    }) 
    .catch((error) => { 
      return Promise.reject(error); 
    }); 
 
  const fetchCart = async () => { 
    try { 
      let cart = await Cart.doc(user_id).get(); 
      if (!cart?.data()?.line_items) { 
        throw "Select items to place order"; 
      } 
      cart = cart.data(); 
 
      let line_items = Object.keys(cart.line_items)?.map((item) => { 
        return Variant.doc(item) 
          .get() 
          .then((response) => { 
            if (!response?.data()) { 
              throw "Variant not found"; 
            } 
            return Promise.resolve({ 
              id: response.id, 
              ...response.data(), 
              quantity: response.data() && cart.line_items?.[item]?.quantity, 
              flag: (response.data() && cart.line_items?.[item]?.flag) || null, 
            }); 
          }) 
          .then((response) => { 
            if (!response?.is_offer_active) { 
              return Promise.resolve(response); 
            } 
 
            if (response?.offer_category_id != 3) { 
              return Promise.resolve(response); 
            } 
 
            if ( 
              !response?.discount?.free_items || 
              Object.keys(response?.discount?.free_items).length == 0 
            ) { 
              return Promise.resolve({ 
                ...response, 
                discount: { 
                  ...response.discount, 
                  free_items: [], 
                }, 
              }); 
            } 
 
            if (Object.keys(response?.discount?.free_items).length != 0) { 
              let free_items = Object.keys(response?.discount?.free_items)?.map( 
                async (item) => { 
                  try { 
                    const response = await Variant.doc(item).get(); 
                    return await Promise.resolve({ 
                      id: response.id, 
                      category_id: response?.data()?.category_id, 
                      description: response?.data()?.description, 
                      image: response?.data()?.image, 
                      name: response?.data()?.name, 
                      restaurant_id: response?.data()?.restaurant_id, 
                      type: response?.data()?.type, 
                      price: 0, 
                    }); 
                  } catch (error) { 
                    return await Promise.reject(error); 
                  } 
                } 
              ); 
 
              return Promise.all(free_items) 
                .then((responses) => { 
                  return Promise.resolve({ 
                    ...response, 
                    discount: { 
                      ...response.discount, 
                      free_items: responses, 
                    }, 
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
      return Promise.resolve({ ...cart, line_items: result }); 
    } catch (error) { 
      return Promise.reject(error); 
    } 
  }; 
 
  let cart_detail = fetchCart() 
    .then((response) => { 
      return Promise.resolve(response); 
    }) 
    .catch((error) => { 
      return Promise.reject(error); 
    }); 
 
  try { 
    let restaurant = await Restaurant.doc(restaurant_id).get(); 
    if (!restaurant.data()?.is_active) { 
      return res.status(400).json({ 
        status: 400, 
        success: false, 
        message: "Restaurant is inactive", 
      }); 
    } 
    const [table, cart] = await Promise.all([table_detail, cart_detail]); 
    let newOrder = createLineItems(cart?.line_items); 
    if (!restaurant?.data()?.is_vat_included) { 
      newOrder = { 
        ...newOrder, 
        tax: newOrder.total * (restaurant?.data()?.vat ?? 0.05), 
        sub_total: newOrder.total, 
        total: 
          newOrder.total + newOrder.total * (restaurant?.data()?.vat ?? 0.05), 
      }; 
    } else { 
      newOrder = { 
        ...newOrder, 
        tax: calculateTax(newOrder.total, restaurant?.data()?.vat ?? 0.05), 
        sub_total: 
          (100 * newOrder.total) / (100 + (restaurant?.data()?.vat ?? 0.05)), 
      }; 
    } 
    let date = new Date(); 
    if (table?.open_order) { 
      await Order.doc(table?.open_order).set( 
        { 
          payment: { 
            total: FieldValue.increment(newOrder.total), 
            sub_total: FieldValue.increment(newOrder.sub_total), 
            tax: FieldValue.increment(newOrder.tax), 
            remaining: FieldValue.increment(newOrder.total), 
          }, 
          users: { 
            [user_id]: true, 
          }, 
          table_id: table_id, 
          restaurant_id: restaurant_id, 
          temp_status: "new order", 
          line_items: { 
            [user_id]: { 
              user_name: user_name, 
              user_id: user_id, 
              visit: visit_count(cart, restaurant_id), 
              total: FieldValue.increment(newOrder.total), 
              sub_total: FieldValue.increment(newOrder.sub_total), 
              tax: FieldValue.increment(newOrder.tax), 
              remaining: FieldValue.increment(newOrder.total), 
              time: date.toString(), 
              items: newOrder?.line_items?.reduce((prev, curr) => { 
                prev[`${curr.id}`] = { 
                  ...curr, 
                  quantity: FieldValue.increment(curr.quantity), 
                  temp_quantity: curr.quantity, 
                  temp_status: "new order", 
                  time: date.toString(), 
                }; 
 
                return prev; 
              }, {}), 
            }, 
          }, 
        }, 
        { merge: true } 
      ); 
    } else { 
      let order = await Order.add({ 
        payment: { 
          total: FieldValue.increment(newOrder.total), 
          sub_total: FieldValue.increment(newOrder.sub_total), 
          tax: FieldValue.increment(newOrder.tax), 
          remaining: FieldValue.increment(newOrder.total), 
        }, 
        users: { 
          [user_id]: true, 
        }, 
        time: date.toString(), 
        status: "new order", 
        temp_status: "new order", 
        table_id: table_id, 
        restaurant_id: restaurant_id, 
        line_items: { 
          [user_id]: { 
            user_name: user_name, 
            user_id: user_id, 
            visit: visit_count(cart, restaurant_id), 
            total: FieldValue.increment(newOrder.total), 
            sub_total: FieldValue.increment(newOrder.sub_total), 
            tax: FieldValue.increment(newOrder.tax), 
            remaining: FieldValue.increment(newOrder.total), 
            time: date.toString(), 
            items: newOrder?.line_items?.reduce((prev, curr) => { 
              prev[`${curr.id}`] = { 
                ...curr, 
                status: "new order", 
                temp_status: "new order", 
                time: date.toString(), 
                quantity: FieldValue.increment(curr.quantity), 
              }; 
 
              return prev; 
            }, {}), 
          }, 
        }, 
      }); 
      Table(restaurant_id) 
        .doc(table_id) 
        .set( 
          { 
            is_open: true, 
            open_order: order.id, 
          }, 
          { merge: true } 
        ) 
        .then((response) => functions.logger.log("Table updated")) 
        .catch((error) => 
          functions.logger.log("error while updaing table", error) 
        ); 
    } 
    Cart.doc(user_id) 
      .set( 
        { 
          total_quantity: 0, 
          line_items: {}, 
          visits: { 
            [restaurant_id]: { 
              visit: visit_count(cart, restaurant_id), 
              last_visit: date.toDateString(), 
            }, 
          }, 
        }, 
        { merge: true } 
      ) 
      .then((response) => functions.logger.log("Cart clear")) 
      .catch((error) => functions.logger.log(error)); 
    sendWhatsapp(restaurant_no, `Order place on table ${table_id}`) 
      .then((response) => functions.logger.log("Message send")) 
      .catch((error) => functions.logger.log(error)); 
    res.status(200).send({ 
      status: 200, 
      success: true, 
      message: "Order placed successfuly", 
    }); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: "Error while placing order", 
    }); 
  } 
}); 
 
router.get("/", async (req, res) => { 
  const { restaurant_id, table_id, user_id } = req.query; 
 
  if (!table_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Table id is missing", 
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
  if (!restaurant_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Restaurant id is missing", 
    }); 
    return; 
  } 
 
  try { 
    const card_detail = User.doc(user_id) 
      .get() 
      .then((response) => { 
        if (!(response?.data()?.customer_id && response?.data()?.token)) { 
          return Promise.resolve({}); 
        } 
 
        return stripe.customers 
          .retrieveSource(response.data().customer_id, response.data().token) 
          .then((response) => Promise.resolve(response)) 
          .catch((error) => Promise.reject(error)); 
      }) 
      .catch((error) => Promise.reject(error)); 
 
    let [table, card] = await Promise.all([ 
      Table(restaurant_id).doc(table_id).get(), 
      card_detail, 
    ]); 
 
    if (!table.data().open_order) { 
      res.status(200).send({ 
        status: 200, 
        success: true, 
        message: "No order placed yet", 
      }); 
 
      return; 
    } 
 
    let result = await Order.doc(table.data().open_order).get(); 
 
    res.status(200).send({ 
      id: result.id, 
      ...result.data(), 
      line_items: { 
        your_order: { 
          ...result.data()?.line_items?.[user_id], 
          items: Object.values(result?.data()?.line_items?.[user_id]?.items), 
        }, 
        other_orders: Object.values(result.data()?.line_items).reduce( 
          (accu, curr) => { 
            if (curr?.user_id == user_id) { 
              return accu; 
            } 
            accu = { 
              remaining: accu.remaining + curr.remaining, 
              tax: accu.tax + curr.tax, 
              total: accu.total + curr.total, 
              sub_total: accu.sub_total + curr.sub_total, 
              items: [...accu.items, ...Object.values(curr.items)], 
            }; 
          }, 
          { remaining: 0, tax: 0, total: 0, sub_total: 0, items: [] } 
        ), 
      }, 
      card, 
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
 
router.get("/all", async (req, res) => { 
  const { restaurant_id } = req.query; 
  if (!restaurant_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Restaurant id is missing", 
    }); 
    return; 
  } 
 
  try { 
    let result = await Order.where("restaurant_id", "==", restaurant_id).get(); 
    result = result.docs?.map((order) => { 
      return { 
        id: order.id, 
        ...order.data(), 
        line_items: Object.values(order.data().line_items)?.map((line_item) => { 
          return { 
            ...line_item, 
            items: Object.values(line_item.items)?.map((item) => item), 
          }; 
        }), 
      }; 
    }); 
    res.status(200).send(result); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: "Error while reading orders", 
    }); 
  } 
}); 
 
router.get("/new", async (req, res) => { 
  const { restaurant_id } = req.query; 
  if (!restaurant_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Restaurant id is missing", 
    }); 
    return; 
  } 
 
  try { 
    let result = await Order.where("restaurant_id", "==", restaurant_id) 
      .where("temp_status", "==", "new order") 
      .get(); 
    result = result.docs?.map((order) => { 
      return { 
        id: order.id, 
        ...order.data(), 
        line_items: Object.values(order.data().line_items)?.map((line_item) => { 
          return { 
            ...line_item, 
            items: Object.values(line_item.items)?.filter( 
              (item) => item?.temp_status == "new order" 
            ), 
          }; 
        }), 
      }; 
    }); 
    res.status(200).send(result); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: "Error while fetching error", 
    }); 
  } 
}); 
 
router.get("/inprogress", async (req, res) => { 
  const { restaurant_id } = req.query; 
  if (!restaurant_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Restaurant id is missing", 
    }); 
    return; 
  } 
 
  try { 
    let result = await Order.where("restaurant_id", "==", restaurant_id) 
      .where("status", "not-in", ["new order", "closed"]) 
      .get(); 
    result = result.docs?.map((order) => { 
      return { 
        id: order.id, 
        ...order.data(), 
        line_items: Object.values(order.data().line_items)?.map((line_item) => { 
          return { 
            ...line_item, 
            items: Object.values(line_item.items)?.filter( 
              (item) => item?.status && item?.status != "new order" 
            ), 
          }; 
        }), 
      }; 
    }); 
    res.status(200).send(result); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: "Error while fetching error", 
    }); 
  } 
}); 
 
router.put("/waiter-required", async (req, res) => { 
  const { order_id } = req.query; 
  const { status } = req.body; 
  if (!order_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Order id is missing", 
    }); 
    return; 
  } 
 
  if (!status) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Nothing to update", 
    }); 
    return; 
  } 
 
  try { 
    await db.runTransaction(async (t) => { 
      let order = await t.get(Order.doc(order_id)); 
      order = order.data(); 
      if (!order) { 
        throw "No order found"; 
      } 
 
      if (order?.status == "new order" || order?.temp_status == "new order") { 
        throw "Admin has not accepted your latest order yet"; 
      } 
 
      t.update(Order.doc(order_id), { 
        ...order, 
        status: `waiter for ${status}`, 
      }); 
    }); 
 
    res.status(200).send({ 
      status: 200, 
      success: true, 
      message: "Order update successfully", 
    }); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: error?.message || error || "Error while updating order", 
    }); 
  } 
}); 
 
router.put("/accept-order", async (req, res) => { 
  const { order_id } = req.query; 
  const { order } = req.body; 
  if (!order_id) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Order id is missing", 
    }); 
    return; 
  } 
 
  if (!(order && order.line_items?.length != 0)) { 
    res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Nothing to update", 
    }); 
    return; 
  } 
 
  try { 
    let order_result = await Order.doc(order_id).set( 
      { 
        status: "pending", 
        temp_status: "pending", 
        line_items: { 
          ...order.line_items?.reduce((acc, curr) => { 
            acc[`${curr?.user_id}`] = { 
              items: curr?.items?.reduce((prev, item) => { 
                prev[`${item.id}`] = { 
                  status: "pending", 
                  temp_status: "pending", 
                  temp_quantity: 0, 
                }; 
 
                return prev; 
              }, {}), 
            }; 
 
            return acc; 
          }, {}), 
        }, 
      }, 
      { merge: true } 
    ); 
 
    res.status(200).send({ 
      status: 200, 
      success: true, 
      message: "Order accepted", 
    }); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: "Error while accepting order", 
    }); 
  } 
}); 
 
router.get("/close-order", async (req, res) => { 
  const { order_id, table_id, restaurant_id } = req.query; 
  if (!order_id) { 
    return res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Order id is missing", 
    }); 
  } 
 
  if (!table_id) { 
    return res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Table id is missing", 
    }); 
  } 
 
  if (!restaurant_id) { 
    return res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Restaurant id is missing", 
    }); 
  } 
 
  try { 
    await db.runTransaction(async (t) => { 
      let order = await t.get(Order.doc(order_id)); 
      order = order.data(); 
      if (!order) { 
        throw "No order found"; 
      } 
      const remaining = order?.payment?.remaining; 
 
      if (remaining == 0) { 
        t.update(Order.doc(order_id), { 
          ...order, 
          status: "closed", 
          temp_status: "closed", 
          line_items: { 
            ...order?.line_items, 
            ...Object.values(order?.line_items)?.reduce((acc, curr) => { 
              acc[`${curr?.user_id}`] = { 
                ...curr, 
                remaining: 0, 
                items: { 
                  ...curr?.items, 
                  ...Object.values(curr?.items)?.reduce((prev, item) => { 
                    prev[`${item.id}`] = { 
                      ...item, 
                      status: "closed", 
                      temp_status: "closed", 
                    }; 
 
                    return prev; 
                  }, {}), 
                }, 
              }; 
 
              return acc; 
            }, {}), 
          }, 
        }); 
      } else { 
        throw "Table bill is remaining"; 
      } 
    }); 
 
    await Table(restaurant_id).doc(table_id).update({ 
      open_order: "", 
      is_open: false, 
    }); 
 
    res.status(200).send({ 
      status: 200, 
      success: true, 
      message: "Order closed", 
    }); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: 
        error?.details?.split(":")?.[0] || error || "Error while closing order", 
    }); 
  } 
}); 
 
router.put("/charge-remaining", async (req, res) => { 
  const { order_id } = req.query; 
  const { payment } = req.body; 
  let message = ""; 
 
  if (!order_id) { 
    return res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Order id is missing", 
    }); 
  } 
 
  if (Object.keys(payment)?.length == 0) { 
    return res.status(400).json({ 
      status: 400, 
      success: false, 
      message: "Payment detail is missing", 
    }); 
  } 
 
  try { 
    await db.runTransaction(async (t) => { 
      let order = await t.get(Order.doc(order_id)); 
      order = order.data(); 
 
      if (order?.temp_status && order?.temp_status == "new order") { 
        throw "Can not pay before restaurant accept order items"; 
      } 
      let amount_to_pay = 
        (payment?.card_payment || 0) + 
        (payment?.cash_payment || 0) + 
        (payment?.other_payment || 0); 
 
      let payment_types = {}; 
      if (payment?.card_payment) { 
        payment_types = { 
          ...payment_types, 
          card: { 
            amount: order?.payment_types?.card?.amount 
              ? order?.payment_types?.card?.amount + payment?.card_payment 
              : payment?.card_payment, 
            menthod: "card", 
          }, 
        }; 
      } 
      if (payment?.cash_payment) { 
        payment_types = { 
          ...payment_types, 
          cash: { 
            amount: order?.payment_types?.cash?.amount 
              ? order?.payment_types?.cash?.amount + payment?.cash_payment 
              : payment?.cash_payment, 
            menthod: "cash", 
          }, 
        }; 
      } 
      if (payment?.other_payment) { 
        payment_types = { 
          ...payment_types, 
          other: { 
            amount: order?.payment_types?.other?.amount 
              ? order?.payment_types?.other?.amount + payment?.other_payment 
              : payment?.other_payment, 
            menthod: "other", 
          }, 
        }; 
      } 
      const remaining = order?.payment?.remaining; 
      if (amount_to_pay > remaining) { 
        amount_to_pay = remaining; 
      } 
      if (remaining == 0) { 
        throw "Nothing to pay"; 
      } 
      if (remaining == amount_to_pay) { 
        t.update(Order.doc(order_id), { 
          ...order, 
          status: "paid", 
          temp_status: "paid", 
          line_items: { 
            ...order?.line_items, 
            ...Object.values(order?.line_items)?.reduce((acc, curr) => { 
              acc[`${curr?.user_id}`] = { 
                ...curr, 
                remaining: 0, 
                items: { 
                  ...curr?.items, 
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
          payment: { 
            ...order?.payment, 
            remaining: 0, 
          }, 
          payment_types: { 
            ...order?.payment_types, 
            ...payment_types, 
          }, 
        }); 
        message = "payment done"; 
      } else { 
        t.update(Order.doc(order_id), { 
          ...order, 
          payment: { 
            ...order?.payment, 
            remaining: order?.payment?.remaining - amount_to_pay, 
          }, 
          payment_types: { 
            ...order?.payment_types, 
            ...payment_types, 
          }, 
        }); 
        message = `${amount_to_pay} payment done remaining is ${ 
          order?.payment?.remaining - amount_to_pay 
        }`; 
      } 
    }); 
 
    res.status(200).send({ 
      status: 200, 
      success: true, 
      message: message, 
    }); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: 
        error?.details?.split(":")?.[0] || error || "Error while charging bill", 
    }); 
  } 
}); 
router.put("/add-item", async (req, res) => { 
  try { 
    const { restaurant_id, order_id, item_id } = req.query; 
    const { quantity } = req.body; 
 
    if (!(quantity && quantity >= 0)) { 
      return res.status(400).json({ 
        status: 400, 
        success: false, 
        message: "Quantity must be greater than 0", 
      }); 
    } 
    if (!restaurant_id) { 
      return res.status(400).json({ 
        status: 400, 
        success: false, 
        message: "Restaurant id missing", 
      }); 
    } 
 
    if (!order_id) { 
      return res.status(400).json({ 
        status: 400, 
        success: false, 
        message: "order id missing", 
      }); 
    } 
 
    if (!item_id) { 
      return res.status(400).json({ 
        status: 400, 
        success: false, 
        message: "Item id missing", 
      }); 
    } 
 
    let [restaurant, variant] = await Promise.all([ 
      Restaurant.doc(restaurant_id).get(), 
      Variant.doc(item_id).get(), 
    ]); 
 
    if (!restaurant?.data()) { 
      throw "No restaurant found"; 
    } 
 
    if (!variant?.data()) { 
      throw "No variant found"; 
    } 
 
    variant = { 
      id: variant.id, 
      ...variant?.data(), 
      quantity: quantity, 
      flag: "variant", 
    }; 
 
    let newOrder = addItem(restaurant.data(), variant); 
 
    await db.runTransaction(async (t) => { 
      try { 
        let order = await t.get(Order.doc(order_id)); 
        order = order.data(); 
        if (!order) { 
          throw "No order found"; 
        } 
 
        let date = new Date(); 
 
        await t.update(Order.doc(order_id), { 
          ...order, 
          payment: { 
            total: order?.payment?.total + newOrder?.total, 
            sub_total: order?.payment?.sub_total + newOrder?.sub_total, 
            remaining: order?.payment?.remaining + newOrder?.total, 
          }, 
          line_items: { 
            ...order?.line_items, 
            others: { 
              ...order?.line_items?.["others"], 
              remaining: order?.line_items?.["others"] 
                ? order?.line_items?.["others"]?.remaining + newOrder?.total 
                : newOrder?.total, 
              sub_total: order?.line_items?.["others"] 
                ? order?.line_items?.["others"]?.sub_total + newOrder?.sub_total 
                : newOrder?.sub_total, 
              tax: order?.line_items?.["others"] 
                ? order?.line_items?.["others"]?.tax + newOrder?.tax 
                : newOrder?.tax, 
              total: order?.line_items?.["others"] 
                ? order?.line_items?.["others"]?.total + newOrder?.total 
                : newOrder?.total, 
              user_id: "others", 
              time: date.toString(), 
              user_name: "others", 
              visit: 1, 
              items: order?.line_items?.["others"]?.items 
                ? Object.values(order?.line_items?.["others"]?.items)?.reduce( 
                    (accu, curr) => { 
                      if (!accu[`${curr?.id}`]) { 
                        accu[`${curr?.id}`] = curr; 
                        return accu; 
                      } 
 
                      accu[`${curr?.id}`] = { 
                        ...curr, 
                        quantity: 
                          curr?.quantity + accu[`${curr?.id}`]?.quantity, 
                      }; 
                      return accu; 
                    }, 
                    { [`${variant?.id}`]: variant } 
                  ) 
                : { [`${variant?.id}`]: variant }, 
            }, 
          }, 
        }); 
      } catch (error) { 
        throw "Error during adding item to order"; 
      } 
    }); 
 
    res.status(200).send({ 
      status: 200, 
      success: true, 
      message: "item added in order", 
    }); 
  } catch (error) { 
    functions.logger.log(error); 
    res.status(500).json({ 
      status: 500, 
      success: false, 
      message: 
        error?.details?.split(":")?.[0] || 
        error || 
        "Error while adding item to order", 
    }); 
  } 
}); 
module.exports = router; 
