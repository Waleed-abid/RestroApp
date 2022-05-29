const express = require("express");
const functions = require("firebase-functions");
const { Table } = require("../models");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

router.post("/multiple", async (req, res) => {
  const { restaurant_id } = req.query;
  const { tables } = req.body;

  if (!restaurant_id) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Restaurant id missing",
    });
    return;
  }
  if (!tables) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Tables data missing",
    });
    return;
  }

  if (tables?.length == 0) {
    res.status(400).json({
      status: 400,
      success: false,
      message: "Tables data missing",
    });
    return;
  }
  try {
    let batch = db.batch();

    tables?.filter((table) => {
      batch.set(Table(restaurant_id).doc(`${table.table_no}`), {
        is_open: false,
        open_order: "",
        table_no: table?.table_no,
      });
    });

    await batch.commit();

    res.status(200).send({
      status: 200,
      success: true,
      message: "Tables created",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while creating tables",
    });
  }
});

router.get("/", async (req, res) => {
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
    let result = await Table(restaurant_id).get();
    result = result?.docs?.map((table) => {
      return {
        id: table.id,
        ...table.data(),
      };
    });

    res.status(200).send(result);
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while reading tables",
    });
  }
});

router.post("/createTables", async (req, res) => {
  const { restaurant_id } = req.query;
  const { tables } = req.body;
  try {
    let batch = db.batch();
    if (!restaurant_id) {
      return res.status(400).send({
        status: 400,
        success: false,
        message: "Restaurant Id is missing",
      });
    }
    if (!tables.prefix) {
      return res.status(400).send({
        status: 404,
        success: false,
        message: "Prefix is missing",
      });
    }
    if (!tables.starting_number) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Starting number is either 0 or missing",
      });
    }
    if (!tables.total_tables) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Total Number of Tables is missing",
      });
    }

    if (tables.starting_number <= 0) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Starting Number Should be greater than 0",
      });
    }
    if (tables.total_tables <= 0) {
      return res.status(404).send({
        status: 404,
        success: false,
        message: "Total Tables should be graeter than 0",
      });
    }

    let result = tables.prefix.replace(" ", "_");

    for (
      let i = tables?.starting_number;
      i < tables?.total_tables + tables?.starting_number;
      i++
    ) {
      batch.set(
        Table(restaurant_id).doc(),
        {
          is_open: false,
          open_order: "",
          name: result.concat("-", i),
        },
        { merge: true }
      );
    }
    await batch.commit();

    res.status(201).send({
      status: 201,
      success: true,
      message: "Tables sucessfully created",
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;
