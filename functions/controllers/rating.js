const { response } = require("express")
const express = require("express")
const validateFirebaseIdToken = require("./authMiddleware")
const reviewsRouter = express.Router()
const functions = require("firebase-functions")
const accountSid = functions.config().secret.twillo_account_sid
const authToken = functions.config().secret.twillo_auth_token
const client = require("twilio")(accountSid, authToken)

reviewsRouter.use(validateFirebaseIdToken)

const reviewsController = (db) => {
  // route for get Order detail for rating
  reviewsRouter.get("/orders/:id", (req, res) => {
    const { id } = req.params

    if (!id) {
      res.status(400).send({ error: { message: "Bad Request" } })
      return
    }

    db.collection("orders")
      .doc(id)
      .get()
      .then((response) => {
        res.status(200).send({
          dining_experience: {
            ambiance: 3,
            food: 4,
            service: 5,
          },
          food_experience: response?.data()?.line_items?.map((item) => {
            return { item: item.name, rating: 4 }
          }),
        })
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } })
      })
  })

  // route for chef recommendations
  reviewsRouter.post("/", (req, res) => {
    const { user_id, order_id, restaurant_id } = req.query
    const { rating, restaurant_no, table_no } = req.body
    if (!(user_id && order_id && restaurant_id && restaurant_no && table_no)) {
      res.status(400).send({ error: { message: "Bad Request" } })
      return
    }
    if (!rating?.food_experience) {
      res.status(400).send({
        error: { message: "food experience can't be empty" },
      })
      return
    }

    const reviewsRef = db.collection(`restaurants/${restaurant_id}/reviews`)

    reviewsRef
      .add({
        user_id,
        order_id,
        ...rating,
      })
      .then(() => {
        let whatsappMessage = `Table ${table_no} Customer Feedback\nFood ${rating?.dining_experience?.food}\nService ${rating?.dining_experience?.service}\nAmbiance ${rating?.dining_experience?.ambiance}\n`

        if (rating?.food_experience?.[0]) {
          whatsappMessage += rating?.food_experience?.map((item) => {
            return `${item.heading} ${item.rating}\n`
          })
        }

        client.messages
          .create({
            from: "whatsapp:+14155238886",
            body: whatsappMessage,
            to: `whatsapp:${restaurant_no}`,
          })
          .then((message) => {
            console.log("Message send to whatsapp", message.status)
          })
          .catch(() => {
            console.log("Error during sending waiter request")
          })
        res.status(200).send({ success: "Rating done" })
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } })
      })
  })

  return reviewsRouter
}

module.exports = reviewsController
