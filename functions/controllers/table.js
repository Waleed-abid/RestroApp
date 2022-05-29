const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const functions = require("firebase-functions")
const accountSid = functions.config().secret.twillo_account_sid
const authToken = functions.config().secret.twillo_auth_token
const client = require("twilio")(accountSid, authToken)
const validateFirebaseIdToken = require("./authMiddleware")
const router = express.Router()

router.use(cors({ origin: true }))
router.use(bodyParser.json())
router.use(bodyParser.urlencoded({ extended: false }))

const tableController = (db) => {
  // route for table status api
  router.get("/is_open", (req, res) => {
    const { table_id, restaurant_id } = req.query

    if (!(table_id && restaurant_id)) {
      res
        .status(400)
        .send({ error: { message: "Restaurant or table id missing" } })

      return
    }

    const tableRef = db
      .collection(`restaurants/${restaurant_id}/tables`)
      .doc(table_id)

    tableRef
      .get()
      .then((response) => {
        res.status(200).send({ is_open: response.data().is_open })
      })
      .catch((error) => {
        res
          .status(500)
          .send({ error: { message: "Error while reading table" } })
      })
  })
  // Route for sending whatsapp message for table closed
  router.put("/closed", validateFirebaseIdToken, (req, res) => {
    const { table_no } = req.query
    const { restaurant_no } = req.body

    if (!(table_no && restaurant_no)) {
      res.status(400).send({ error: { message: "Bad request" } })
      return
    }

    client.messages
      .create({
        from: "whatsapp:+14155238886",
        body: `Table ${table_no} is closed and can welcome new customers`,
        to: `whatsapp:${restaurant_no}`,
      })
      .then(() => {
        res.status(200).send({ message: "Request send to restaurant" })
      })
      .catch(() => {
        res
          .status(500)
          .send({ error: { message: "Error during sending waiter request" } })
      })
  })

  return router
}

module.exports = tableController
