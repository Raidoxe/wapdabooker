import InstanceManger from "./InstanceManager";
import { MongoClient } from "mongodb";
require("dotenv").config();

async function run() {
  //initialize database
  const uri = process.env.DB_CONNECTION_STRING;
  if (uri === undefined) process.exit();

  const client = new MongoClient(uri);

  await client.connect();
  const database = client.db("WAPDABooker");

  const totalBookings = await database.collection("ActiveBookings").countDocuments();
  new InstanceManger(database, totalBookings);
}

run();
