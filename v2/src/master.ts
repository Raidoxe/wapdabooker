import chalk from "chalk";
import { MongoClient } from "mongodb";
require("dotenv").config();
import CommandManager from "./CommandManager";

console.log(
  chalk.blue(
    "\nWestern Australia PDA Booking bot started, created by Oliver Huth at https://github.com/Raidoxe\n",
  ),
);
//const action = (string: string) => console.log(chalk.italic.gray(string));

/* Check for internet conection */

async function run() {
  //initialize database
  const uri = process.env.DB_CONNECTION_STRING;
  if (uri === undefined) {
    console.error("No db connection string environment variable found");
    process.exit(1);
  }
  const client = new MongoClient(uri);

  await client.connect();
  const database = client.db("WAPDABooker");
  const cm = new CommandManager(database);

  cm.acceptCommands();

  //launch new worker thread to start master2.js
}

run();

/*Database schema:
    ActiveBookings:
        {
            firstName: string
            lastName: string
            licenceNum: number
            expiryDate: string
            dateOfBirth: string
            locationPreferences: [Location]
            dateBottom: Date
            dateTop: Date
            isAlive: boolean
            dateAdded: Date
        } 
    InactiveBookings
        {
            firstName: string
            lastName: string
            licenceNum: number
            expiryDate: string
            dateOfBirth: string
            locationPreferences: [Location]
            dateBottom: Date
            dateTop: Date
            dateAdded: Date
            dateBooked: string
        }*/

//import config

//get current users from database

//list of instances with their information
/* Information:
 * User info (licence number ect)
 * Est num of clicks left
 * Time alive
 * isSearching
 * Booking preference (locations and dates)
 */
