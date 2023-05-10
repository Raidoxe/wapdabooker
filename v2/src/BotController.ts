import date from "date-and-time";

import ReCaptchaPlugin from "puppeteer-extra-plugin-recaptcha";

import puppeteer from "puppeteer-extra";

import {
  InstanceEventType,
  InstanceMode,
  Location,
  InstanceMessage,
  BookingInput,
} from "./Types.js";
import Bot from "./bot.js";

require("dotenv").config();

console.log("CAPTCHA KEY: " + process.env.TWOCAPTCHA_KEY);

const yargs = require("yargs/yargs");

puppeteer.use(ReCaptchaPlugin());

const { hideBin } = require("yargs/helpers");

if (process.env.TWOCAPTCHA_KEY === undefined) {
  console.error("TWOCAPTCHA KEY NOT FOUND");
  process.exit(1);
}

puppeteer.use(
  ReCaptchaPlugin({
    provider: {
      id: "2captcha",
      token: process.env.TWOCAPTCHA_KEY,
    },
  }),
);

if (process.send === undefined) {
  console.error("IPC pipeline not found");
  process.exit(1);
}

const args = yargs(hideBin(process.argv))
  .option("licenceNum", {
    alias: "l",
    description: "Drivers Licence number",
    type: "string",
  })
  .option("expiryDate", {
    alias: "e",
    description: "Drivers Licence expiry date",
    type: "string",
  })
  .option("firstName", {
    alias: "f",
    description: "Drivers First name",
    type: "string",
  })
  .option("lastName", {
    description: "Drivers Last name",
    type: "string",
  })
  .option("dateOfBirth", {
    alias: "d",
    description: "Drivers date of birth",
    type: "string",
  })
  .option("dateTop", {
    //highest preffered date (e.g. 23/02/2005)
    description: "Preffered highest date",
    type: "string",
  })
  .option("dateBottom", {
    //lowest preffered date (e.g. 01/02/2005)
    description: "Preffered lowest date",
    type: "string",
  })
  .option("location", {
    description: "Preffered spot/location for driving test",
    type: "string",
  })
  .option("debug", {
    description: "set to TRUE to enable debug mode",
    type: "string",
  }).argv;

const rangeTop: Date = date.parse(args.dateTop, "DD/MM/YYYY");
let rangeBottom: Date = date.parse(args.dateBottom, "DD/MM/YYYY");

const pref1: Location = args.pref1;
const pref2: Location = args.pref2;
const pref3: Location = args.pref3;
const pref4: Location = args.pref4;

if (pref1 === undefined && pref2 === undefined && pref3 === undefined && pref4 === undefined) {
  emitEvent(InstanceEventType.ERROR, { message: "NO LOCATION PREFERENCE PROVIDED" });
  process.exit(1);
}

const locations: Array<Location> = [pref1, pref2, pref3, pref4];

console.log(locations);

if (rangeBottom == null || rangeTop == null) {
  if (rangeBottom == null) {
    emitEvent(InstanceEventType.ERROR, { message: "INVALID LOWER DATE" });
    process.exit();
  }
  if (rangeTop == null) {
    emitEvent(InstanceEventType.ERROR, { message: "INVALID TOP DATE" });
    process.exit();
  }
}

//let debug: boolean = false;
//if (args.debug === "TRUE") debug = true;

const browserargs = {
  headless: false,
};

rangeBottom = formatDateRanges(rangeBottom, rangeTop);

args.dateBottom = date.format(rangeBottom, "DD/MM/YYYY");

const booking: BookingInput = {
  licenceNum: args.licenceNum,
  expiryDate: args.expiryDate,
  firstName: args.firstName,
  lastName: args.lastName,
  dateOfBirth: args.dateOfBirth,
  locationPreferences: locations,
  dateBottom: args.dateBottom,
  dateTop: args.dateTop,
};

async function run() {
  const browser = await puppeteer.launch(browserargs);
  const page = await browser.newPage();

  const bot = new Bot(
    booking,
    args.searchesLeft,
    false /*Remains false until further update*/,
    browser,
    page,
    args.maxClicks,
  );
  process.on("message", (m: InstanceMessage) => {
    switch (m.newMode) {
      case InstanceMode.BOOKING:
        bot.handleChangeMode(InstanceMode.BOOKING, m.pollingRate);
        break;
      case InstanceMode.SEARCHING:
        bot.handleChangeMode(InstanceMode.SEARCHING, m.pollingRate);
        break;
      case InstanceMode.WAITING:
        bot.handleChangeMode(InstanceMode.WAITING, m.pollingRate);
        break;
      case "KILL":
        bot.clearMem().then(() => {
          process.exit();
        });
    }
  });
}

function formatDateRanges(rangeBottom: Date, rangeTop: Date): Date {
  let newBottomDate: Date = rangeBottom;
  //date selector logic
  let currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + 1); //sets date 1 day into the future
  /*
          Difference between current date and lower bound of booking range
          to make sure rangeBottom is not behind the current date
          */
  const lowerDiff = date.subtract(rangeBottom, currentDate);
  const rangeDiff = date.subtract(rangeTop, rangeBottom);

  if (lowerDiff.toMinutes() < 0) {
    newBottomDate = currentDate;
  }
  if (rangeDiff.toMinutes() <= 0) {
    //implement change top date message
    emitEvent(InstanceEventType.ERROR, { message: "Lower date past top date" });
    process.exit(1);
  }

  return newBottomDate;
}

function emitEvent(type: InstanceEventType, data: Object): void {
  if (process.send === undefined) {
    console.error("IPC pipeline not found");
    process.exit(1);
  }
  process.send({ type: type, data: data });
}

run();
emitEvent(InstanceEventType.READY, {});
