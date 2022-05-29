const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const userRouter = express.Router()

userRouter.use(cors({ origin: true }))
userRouter.use(bodyParser.json())
userRouter.use(bodyParser.urlencoded({ extended: false }))

const updateUserController = (db) => {
  userRouter.post("/", (req, res) => {
    const { uid, data } = req.body.user

    db.collection("users")
      .doc(uid)
      .set(data, { merge: true })
      .then(() => {
        res.status(200).send({
          data: {
            message: "User Successfully updated ",
          },
        })
      })
      .catch((error) => {
        res.status(500).send({
          error: { message: error.message },
        })
      })
  })
  return userRouter
}

module.exports = updateUserController
