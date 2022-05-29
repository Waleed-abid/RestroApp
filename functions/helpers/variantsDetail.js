const { Variant } = require("../models");
const admin = require("firebase-admin");
const FieldPath = admin.firestore.FieldPath;

module.exports = async (ids) => {
  try {
    if (ids?.length == 0) {
      return Promise.resolve([]);
    }
    let variants = await Variant.where(FieldPath.documentId(), "in", ids).get();

    variants = variants?.docs?.map(async (variant) => {
      if (!variant?.data()?.pairing) {
        return Promise.resolve({
          id: variant.id,
          image: variant.data()?.image,
          restaurant_id: variant.data()?.restaurant_id,
          description: variant.data()?.description,
          type: variant.data()?.type,
          category_id: variant.data()?.category_id,
          price: variant.data()?.price,
          name: variant.data()?.name,
          pairings: [],
        });
      }

      try {
        let pairings = await Variant.where(
          FieldPath.documentId(),
          "in",
          Object.keys(variant?.data()?.pairing)
        ).get();

        return Promise.resolve({
          id: variant.id,
          image: variant.data()?.image,
          restaurant_id: variant.data()?.restaurant_id,
          description: variant.data()?.description,
          type: variant.data()?.type,
          category_id: variant.data()?.category_id,
          price: variant.data()?.price,
          name: variant.data()?.name,
          pairings: pairings?.docs?.map((pairing) => {
            return {
              id: pairing.id,
              image: pairing.data()?.image,
              restaurant_id: pairing.data()?.restaurant_id,
              description: pairing.data()?.description,
              type: pairing.data()?.type,
              category_id: pairing.data()?.category_id,
              price: pairing.data()?.price,
              name: pairing.data()?.name,
            };
          }),
        });
      } catch (error) {
        return Promise.reject(error);
      }
    });

    variants = await Promise.all(variants);

    return Promise.resolve(variants);
  } catch (error) {
    return Promise.reject(error);
  }
};
