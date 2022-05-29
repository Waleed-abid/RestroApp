const express = require("express")
const chefPairRecommendationRouter = express.Router()

const chefPairRecommendationController = (db) => {
  // route for chef recommendations
  chefPairRecommendationRouter.get("/", (req, res) => {
    const { restaurant_id, variant_id } = req.query

    if (!(restaurant_id && variant_id)) {
      res.status(400).send({
        error: { message: "Restaurant or variant id is missing" },
      })

      return
    }
    const chefRecommendation = db.collection(
      `restaurants/${restaurant_id}/variants/${variant_id}/pairings`
    )
    chefRecommendation
      .get()
      .then((responses) => {
        Promise.all(
          responses.docs.map((doc) => {
            return doc
              .data()
              ?.item.get()
              .then((item) => {
                return {
                  title: doc.data()?.title,
                  id: item.id,
                  ...item.data(),
                }
              })
          })
        ).then((response) => {
          res.status(200).send({ data: response })
        })
      })
      .catch((error) => {
        console.log(error)
        res.status(500).send({ error: "Database Error" })
      })
  })

  // route for chef recommendations
  chefPairRecommendationRouter.get("/:id/:category_id", (req, res) => {
    const chefRecommendation = db.collection(
      `restaurants/${req.params.id}/categories/${req.params.category_id}/pairings`
    )
    chefRecommendation
      .get()
      .then((responses) => {
        Promise.all(
          responses.docs.map((doc) => {
            return doc
              .data()
              ?.item.get()
              .then((item) => {
                return {
                  title: doc.data()?.name,
                  id: item.id,
                  ...item.data(),
                }
              })
          })
        ).then((response) => {
          res.status(200).send({ data: response })
        })
      })
      .catch((error) => {
        console.log(error)
        res.status(500).send({ error: "Database Error" })
      })
  })

  return chefPairRecommendationRouter
}

module.exports = chefPairRecommendationController
