module.exports = (cart, restaurant_id) => {
  let date = new Date();
  if (!cart?.visits?.[restaurant_id]) {
    return 1;
  }
  let last_visit = cart?.visits?.[restaurant_id]?.Last_visit;
  if (last_visit == date.toDateString()) {
    return cart?.visits?.[restaurant_id]?.visit + 1;
  }

  return cart?.visits?.[restaurant_id]?.visit;
};
