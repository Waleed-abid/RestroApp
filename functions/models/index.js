const admin = require("firebase-admin");
const db = admin.firestore();

const User = db.collection("users");
const Restaurant = db.collection("restaurants");
const Category = db.collection("categories");
const Variant = db.collection("variants");
const Cart = db.collection("carts");
const Pairing = db.collection("pairings");
const Order = db.collection("orders");
const Payment = db.collection("payments");
const Rating = db.collection("ratings");
const Tip = db.collection("tips");
const Coupon = (id) => db.collection(`restaurants/${id}coupons`);
const Table = (id) => db.collection(`restaurants/${id}/tables`);
const Offer = db.collection("offers");
const Ambiance = db.collection("ambiances");
const Cuisine = db.collection("cuisines");
const Campaign = db.collection("campaigns");
const Recommendation = db.collection("recommendations");
const Modifier = db.collection("modifiers");
module.exports = {
  User,
  Restaurant,
  Category,
  Variant,
  Cart,
  Pairing,
  Table,
  Order,
  Payment,
  Tip,
  Offer,
  Coupon,
  Rating,
  Ambiance,
  Cuisine,
  Campaign,
  Recommendation,
  Modifier,
};
