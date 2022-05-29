const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const client = require("../typesense/client")
const featuredRestaurantRouter = express.Router()

featuredRestaurantRouter.use(cors({ origin: true }))
featuredRestaurantRouter.use(bodyParser.json())
featuredRestaurantRouter.use(bodyParser.urlencoded({ extended: false }))

const featuredRestaurantsController = (db) => {
  featuredRestaurantRouter.get("/", (req, res) => {
    const restaurants = db.collection("restaurants")
    restaurants
      .get()
      .then((querySnapshot) => {
        const tempDoc = querySnapshot.docs.map((doc) => {
          return { id: doc.id, ...doc.data() }
        })
        res.status(200).send(tempDoc)
      })
      .catch((error) => {
        console.log(error)
        res.status(500).send({ error: { message: "Internal server error" } })
      })
  })

  //  route for restaurant typesence search
  featuredRestaurantRouter.get("/search", (req, res) => {
    const { search_text } = req.query
    if (!search_text) {
      res.status(400).send({
        error: { message: "search text is missing" },
      })
      return
    }

    client
      .collections(`restaurants`)
      .documents()
      .search({ q: search_text, query_by: "name" })
      .then(function (searchResults) {
        res.status(200).send(
          searchResults.hits?.map((doc) => {
            return doc.document
          })
        )
      })
      .catch((error) => {
        console.log(error)
        res.status(500).send(error)
      })
  })

  return featuredRestaurantRouter
}

module.exports = featuredRestaurantsController
