const express = require("express")
var QRCode = require("qrcode")
const bodyParser = require("body-parser")
const cors = require("cors")
const qrcodeRouter = express.Router()

qrcodeRouter.use(cors({ origin: true }))
qrcodeRouter.use(bodyParser.json())
qrcodeRouter.use(bodyParser.urlencoded({ extended: false }))

const qrcodeController = (db) => {
  qrcodeRouter.post("/", (req, res) => {
    const { restaurant_id, table_id, logo, name, table_number, app_link } =
      req.body

    if (
      !(restaurant_id && table_id && logo && name, table_number && app_link)
    ) {
      res.status(400).send({ error: { message: "Bad request" } })
      return
    }

    QRCode.toDataURL(
      JSON.stringify(req.body),
      { text: "scan me" },
      function (err, url) {
        if (err) {
          res.status(500).send({ error: { message: "Internal server error" } })
          return
        }

        res.status(200).send({ qrcode: url })
      }
    )
  })
  return qrcodeRouter
}

module.exports = qrcodeController
