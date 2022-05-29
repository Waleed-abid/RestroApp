module.exports = (total, vat) => {
  return total - (100 * total) / (100 + vat * 100);
};
