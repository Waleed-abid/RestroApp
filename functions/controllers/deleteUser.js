const functions = require("firebase-functions")

const deleteUserController = (db) => {
  return functions.auth.user().onDelete((user) => {
    const { uid } = user

    db.collection("users")
      .doc(uid)
      .delete()
      .then(() => {
        res.status(200).send({
          data: {
            message: "User Successfully deleted ",
          },
        })
      })
      .catch((error) => {
        res.status(500).send({
          error: { message: error.message },
        })
      })
  })
}

module.exports = deleteUserController
