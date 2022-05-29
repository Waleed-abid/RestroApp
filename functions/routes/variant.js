const { Variant } = require("../models");
const express = require("express");
const functions = require("firebase-functions");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const client = require("../typesense/client");
const cors = require("cors");
const bodyParser = require("body-parser");
const pairingDetail = require("../helpers/pairings/pairingDetail");

router.use(cors({ origin: true }));
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.get("/", async (req, res) => {
  try {
    const { category_id } = req.query;
    if (!category_id) {
      return res.status(400).send({
        status: 400,
        success: false,
        message: "Category id missing",
      });
    }
    let variants = await Variant.where("category_id", "==", category_id).get();
    variants = variants?.docs?.map((variant) => {
      return {
        id: variant?.id,
        image: variant.data()?.image,
        restaurant_id: variant.data()?.restaurant_id,
        description: variant.data()?.description,
        type: variant.data()?.type,
        category_id: variant.data()?.category_id,
        price: variant.data()?.price,
        name: variant.data()?.name,
        is_active: variant.data()?.is_active,
        modifiers: variant.data()?.modifiers
          ? Object.values(variant?.data()?.modifiers)
          : [],
        food_pairings: variant.data()?.food_pairings
          ? Object.values(variant?.data()?.food_pairings)
          : [],
        drink_pairings: variant.data()?.drink_pairings
          ? Object.values(variant?.data()?.drink_pairings)
          : [],
      };
    });

    res.status(200).send(variants);
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while reading Variants",
    });
  }
});
router.get("/search", (req, res) => {
  const { search_text, restaurant_id } = req.query;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  client
    .collections("variants")
    .documents()
    .search({
      facet_by: "restaurant_id",
      q: search_text,
      query_by: "name,description",
      filter_by: `restaurant_id:=[${restaurant_id}]`,
    })
    .then(function (response) {
      res.status(200).send(
        response.hits?.map((doc) => {
          return doc.document;
        })
      );
    })
    .catch((error) => {
      functions.logger.log("searching variants", { error });
      res.status(500).json({
        status: 500,
        success: false,
        message: error?.details?.split(":")?.[0] ?? "searching variants",
      });
    });
});

router.get("/all-variants", async (req, res) => {
  const { restaurant_id } = req.query;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  try {
    let result = await Variant.where("restaurant_id", "==", restaurant_id)
      .where("is_active", "==", true)
      .get();

    if (result.docs.length == 0) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Variants not found",
      });
      return;
    }

    result = result?.docs?.map((doc) => {
      return {
        id: doc.id,
        image: doc.data()?.image,
        restaurant_id: doc.data()?.restaurant_id,
        description: doc.data()?.description,
        type: doc.data()?.type,
        category_id: doc.data()?.category_id,
        price: doc.data()?.price,
        name: doc.data()?.name,
      };
    });

    res.status(200).send(result);
  } catch (error) {
    functions.logger.log("Error while reading Variants", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while reading Variants",
    });
  }
});

router.get("/category-variants", async (req, res) => {
  const { category_id } = req.query;

  if (!category_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Category id missing",
    });
    return;
  }

  try {
    let result = await Variant.where("category_id", "==", category_id)
      .where("is_active", "==", true)
      .get();

    if (result.docs.length == 0) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Variants not found",
      });
      return;
    }

    result = result?.docs?.map(async (doc) => {
      try {
        return Promise.resolve({
          id: doc.id,
          image: doc.data()?.image,
          restaurant_id: doc.data()?.restaurant_id,
          description: doc.data()?.description,
          type: doc.data()?.type,
          category_id: doc.data()?.category_id,
          price: doc.data()?.price,
          name: doc.data()?.name,
          modifiers: doc?.data()?.modifiers
            ? Object.values(doc?.data()?.modifiers)
            : [],
          food_pairings: doc?.data()?.food_pairings
            ? await pairingDetail(Object.values(doc?.data()?.food_pairings))
            : [],
          drink_pairings: doc?.data()?.drink_pairings
            ? await pairingDetail(Object.values(doc?.data()?.drink_pairings))
            : [],
          is_active: doc.data()?.is_active,
        });
      } catch (error) {
        return Promise.reject(error);
      }
    });
    result = await Promise.all(result);
    res.status(200).send(result);
  } catch (error) {
    functions.logger.log("Error while reading Variants", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while reading Variants",
    });
  }
});

router.post("/multiple", async (req, res) => {
  let { variants } = req.body;
  const { restaurant_id, category_id } = req.query;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }
  if (!category_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Category id missing",
    });
  }

  if (variants.length == 0) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Variants missing",
    });
    return;
  }

  try {
    let batch = db.batch();

    variants?.forEach((variant) => {
      let newVariant = {
        is_active: variant?.is_active ?? false,
        description: variant?.description ?? "",
        image: variant?.image ?? "",
        category_id,
        type: variant?.type ?? "food",
        price: variant.price,
        name: variant?.name ?? "",
        restaurant_id,
      };

      if (variant?.modifiers && variant?.modifiers?.length != 0) {
        newVariant = {
          ...newVariant,
          modifiers: variant?.modifiers?.reduce((accu, curr) => {
            accu[`${curr?.id}`] = curr;
            return accu;
          }, {}),
        };
      }

      if (variant?.food_pairings && variant?.food_pairings?.length != 0) {
        newVariant = {
          ...newVariant,
          food_pairings: variant?.food_pairings?.reduce((accu, curr) => {
            accu[`${curr?.category_id}`] = curr;
            return accu;
          }, {}),
        };
      }

      if (variant?.drink_pairings && variant?.drink_pairings?.length != 0) {
        newVariant = {
          ...newVariant,
          drink_pairings: variant?.drink_pairings?.reduce((accu, curr) => {
            accu[`${curr?.category_id}`] = curr;
            return accu;
          }, {}),
        };
      }

      batch.set(Variant.doc(), newVariant);
    });

    await batch.commit();
    res.status(201).send({
      status: 201,
      success: true,
      message: "Variants created successfully",
    });
  } catch (error) {
    functions.logger.log("Error while creating Variants", error);
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while creating Variants",
    });
  }
});

router.post("/", async (req, res) => {
  const { variant } = req.body;
  const { category_id, restaurant_id } = req.query;

  if (!category_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Category id missing",
    });
    return;
  }

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }

  if (!(variant && Object.keys(variant).length != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Variant missing",
    });
    return;
  }

  if (!variant?.price) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Variant price missing",
    });
    return;
  }

  let newVariant = {
    description: variant?.description ?? "",
    image: variant?.image ?? "",
    category_id,
    type: variant?.type ?? "food",
    price: variant.price,
    name: variant?.name ?? "",
    restaurant_id,
    is_active: variant?.is_active ?? false,
  };

  if (variant?.modifiers && variant?.modifiers?.length != 0) {
    newVariant = {
      ...newVariant,
      modifiers: variant?.modifiers?.reduce((accu, curr) => {
        accu[`${curr?.id}`] = curr;
        return accu;
      }, {}),
    };
  }

  if (variant?.food_pairings && variant?.food_pairings?.length != 0) {
    newVariant = {
      ...newVariant,
      food_pairings: variant?.food_pairings?.reduce((accu, curr) => {
        accu[`${curr?.category_id}`] = curr;
        return accu;
      }, {}),
    };
  }

  if (variant?.drink_pairings && variant?.drink_pairings?.length != 0) {
    newVariant = {
      ...newVariant,
      drink_pairings: variant?.drink_pairings?.reduce((accu, curr) => {
        accu[`${curr?.category_id}`] = curr;
        return accu;
      }, {}),
    };
  }

  try {
    await Variant.add(newVariant);
    res.status(201).send({
      status: 201,
      success: true,
      message: "Variant created successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while creating Variant",
    });
  }
});

router.get("/all", async (req, res) => {
  const { category_id } = req.query;

  if (!category_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Category id missing",
    });
    return;
  }

  try {
    let result = await Variant.where("category_id", "==", category_id)
      .where("is_active", "==", true)
      .get();

    if (result.docs.length == 0) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Variants not found",
      });
      return;
    }

    result = result?.docs?.map((doc) => {
      return {
        id: doc.id,
        image: doc.data()?.image,
        restaurant_id: doc.data()?.restaurant_id,
        description: doc.data()?.description,
        type: doc.data()?.type,
        category_id: doc.data()?.category_id,
        price: doc.data()?.price,
        name: doc.data()?.name,
      };
    });

    res.status(200).send(result);
  } catch (error) {
    functions.logger.log("Error while reading Variants", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while reading Variants",
    });
  }
});

// router.get("/", async (req, res) => {
//   const { restaurant_id } = req.query;

//   if (!restaurant_id) {
//     res.status(400).json({
//       status: 400,
//       success: false,
//       message: "Restaurant id missing",
//     });
//     return;
//   }

//   try {
//     let result = await Variant.where(
//       "restaurant_id",
//       "==",
//       restaurant_id
//     ).get();

//     if (result.docs.length == 0) {
//       res.status(404).json({
//         status: 404,
//         success: false,
//         message: "Variants not found",
//       });
//       return;
//     }

//     result = result?.docs?.map((doc) => {
//       if (!doc.data().pairing) {
//         return Promise.resolve({
//           id: doc.id,
//           image: doc.data()?.image,
//           restaurant_id: doc.data()?.restaurant_id,
//           description: doc.data()?.description,
//           type: doc.data()?.type,
//           category_id: doc.data()?.category_id,
//           price: doc.data()?.price,
//           name: doc.data()?.name,
//           pairings: [],
//           is_active: doc.data()?.is_active,
//         });
//       }
//       let refs = Object.keys(doc?.data()?.pairing)?.map((id) =>
//         Variant.doc(id)
//       );
//       return db
//         .getAll(...refs)
//         .then((response) => {
//           return Promise.resolve({
//             id: doc.id,
//             image: doc.data()?.image,
//             restaurant_id: doc.data()?.restaurant_id,
//             description: doc.data()?.description,
//             type: doc.data()?.type,
//             category_id: doc.data()?.category_id,
//             price: doc.data()?.price,
//             name: doc.data()?.name,
//             is_active: doc.data()?.is_active,
//             pairings: response.map((pairing) => {
//               return {
//                 id: pairing.id,
//                 image: pairing.data()?.image,
//                 restaurant_id: pairing.data()?.restaurant_id,
//                 description: pairing.data()?.description,
//                 type: pairing.data()?.type,
//                 category_id: pairing.data()?.category_id,
//                 price: pairing.data()?.price,
//                 name: pairing.data()?.name,
//                 is_active: pairing.data()?.is_active,
//               };
//             }),
//           });
//         })
//         .catch((error) => Promise.reject(error));
//     });

//     result = await Promise.all(result);

//     res.status(200).send(result);
//   } catch (error) {
//     functions.logger.log("Error while reading Variants", { error });
//     res.status(500).json({
//       status: 500,
//       success: false,
//       message:
//         error?.details?.split(":")?.[0] ?? "Error while reading Variants",
//     });
//   }
// });

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    let variant = await Variant.doc(id).get();

    if (!variant.data()) {
      res.status(404).json({
        status: 404,
        success: false,
        message: "Variant not found",
      });
      return;
    }
    variant = {
      id: variant.id,
      image: variant.data()?.image,
      restaurant_id: variant.data()?.restaurant_id,
      description: variant.data()?.description,
      type: variant.data()?.type,
      category_id: variant.data()?.category_id,
      price: variant.data()?.price,
      name: variant.data()?.name,
      modifiers: variant?.data()?.modifiers
        ? Object.values(variant?.data()?.modifiers)
        : [],
      food_pairings: variant?.data()?.food_pairings
        ? await pairingDetail(Object.values(variant?.data()?.food_pairings))
        : [],
      drink_pairings: variant?.data()?.drink_pairings
        ? await pairingDetail(Object.values(variant?.data()?.drink_pairings))
        : [],
      is_active: variant.data()?.is_active,
    };

    res.status(200).send(variant);
  } catch (error) {
    functions.logger.log("Error while reading Variant", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message: error?.details?.split(":")?.[0] ?? "Error while reading Variant",
    });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { variant } = req.body;

  if (!(variant && Object.keys(variant) != 0)) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Nothing to update",
    });
    return;
  }

  let newVariant = {
    name: variant?.name ?? "",
    price: variant?.price ?? 0,
    type: variant?.type ?? "food",
    description: variant?.description ?? "",
    image: variant?.image ?? "",
    drink_pairings: variant?.drink_pairings?.reduce((accu, curr) => {
      accu[`${curr?.category_id}`] = curr;
      return accu;
    }, {}),

    food_pairings: variant?.food_pairings?.reduce((accu, curr) => {
      accu[`${curr?.category_id}`] = curr;
      return accu;
    }, {}),
    modifiers: variant?.modifiers?.reduce((accu, curr) => {
      accu[`${curr?.id}`] = curr;
      return accu;
    }, {}),
    is_active: true,
  };

  try {
    await Variant.doc(id).update(newVariant);
    res.status(200).send({
      status: 200,
      success: true,
      message: "Variant updated successfuly",
    });
  } catch (error) {
    functions.logger.log(error?.message);
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while updating Variant",
    });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await Variant.doc(id).delete();
    res.status(200).send({
      status: 200,
      success: true,
      message: "Variant delete successfuly",
    });
  } catch (error) {
    functions.logger.log("Error while deleting Variant", { error });
    res.status(500).json({
      status: 500,
      success: false,
      message:
        error?.details?.split(":")?.[0] ?? "Error while deleting Variant",
    });
  }
});

module.exports = router;
