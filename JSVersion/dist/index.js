"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const date_and_time_1 = __importDefault(require("date-and-time"));
const puppeteer_extra_plugin_recaptcha_1 = __importDefault(require("puppeteer-extra-plugin-recaptcha"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
require("dotenv").config();
console.log("CAPTCHA KEY: " + process.env.TWOCAPTCHA_KEY);
const yargs = require("yargs/yargs");
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_recaptcha_1.default)());
const { hideBin } = require("yargs/helpers");
if (process.env.TWOCAPTCHA_KEY === undefined) {
    console.error("TWOCAPTCHA KEY NOT FOUND");
    process.exit(1);
}
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_recaptcha_1.default)({
    provider: {
        id: "2captcha",
        token: process.env.TWOCAPTCHA_KEY,
    },
}));
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
let pollingRate = 2000;
if (args.pollingRate != undefined) {
    pollingRate = args.pollingRate;
}
let isRegional = false;
if (args.regional === "TRUE")
    isRegional = true;
const rangeTop = date_and_time_1.default.parse(`${args.dateTop} 6:00 PM`, "DD/MM/YYYY h:mm A");
let rangeBottom = date_and_time_1.default.parse(`${args.dateBottom} 6:00 AM`, "DD/MM/YYYY h:mm A");
const pref1 = args.pref1;
const pref2 = args.pref2;
const pref3 = args.pref3;
const pref4 = args.pref4;
if (pref1 === undefined && pref2 === undefined && pref3 === undefined && pref4 === undefined) {
    console.error("Enter a location preference");
    process.exit(1);
}
const locations = [pref1, pref2, pref3, pref4];
console.log(locations);
const userInfo = {
    licenceNumber: args.licenceNum,
    expiryDate: args.expiryDate,
    firstName: args.firstName,
    lastName: args.lastName,
    dateOfBirth: args.dateOfBirth,
};
if (rangeBottom == null || rangeTop == null) {
    if (rangeBottom == null) {
        console.log("Lowest Date is Invalid!");
        process.exit();
    }
    if (rangeTop == null) {
        console.log("Highest Date is Invalid!");
        process.exit();
    }
}
console.log("Booking test for:");
console.log(userInfo);
console.log(`Between ${rangeBottom} to ${rangeTop}`);
let GCaptchaResponse = ""; //holds solution to reCaptcha
let isBooked = false;
let debug = false;
if (args.debug === "TRUE")
    debug = true;
const browserargs = {
    headless: !debug,
};
rangeBottom = formatDateRanges(rangeBottom, rangeTop);
const startBot = async () => {
    console.log("STARTING BOT");
    const browser = await puppeteer_extra_1.default.launch(browserargs);
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto("https://online.transport.wa.gov.au/pdabooking/manage/?3").catch((err) => {
        if (err.toString().includes("net::ERR_INTERNET_DISCONNECTED")) {
            console.error("INTERNET NOT CONNECTED");
            browser.close();
            process.exit();
        }
    });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
        //method to intercept and edit authorisation requests
        const method = request.method();
        if (method == "POST") {
            const postData = request.postData();
            if (postData != undefined) {
                if (postData.includes("id4_hf_0")) {
                    //checks for string unique to login auth form
                    /**?
                     * Edits form to include g-recaptcha-response token
                     */
                    let postDataFinal = postData.replace("&continue=1", "&g-recaptcha-response=" + GCaptchaResponse);
                    postDataFinal = postDataFinal.concat("&continue=1");
                    request.continue({ postData: postDataFinal }); //injects postData with new form data
                    return;
                }
            }
        }
        request.continue();
    });
    page.on("response", (response) => {
        //have to use text as the pda website is so old it uses xml instead of json
        const requestPostData = response.request().postData();
        if (requestPostData != undefined) {
            if (requestPostData.includes("search=1")) {
                //marker for booking list search
                newTimesInfoCallback();
            }
        }
    });
    const { solutions, error } = await page.solveRecaptchas(); //solves recaptchas and returns a solution/errors
    if (error != undefined) {
        console.error("RECAPTCHA ERROR");
        throw error;
    }
    const solution = solutions[0].text;
    if (solution != undefined) {
        GCaptchaResponse = solution;
    }
    //Types in user info
    await page.type('[name="clientDetailsPanel:licenceNumber"]', userInfo.licenceNumber);
    await page.type("#licenceExpiryDatePicker", userInfo.expiryDate);
    await page.type('[name="clientDetailsPanel:firstName"]', userInfo.firstName);
    await page.type('[name="clientDetailsPanel:lastName"]', userInfo.lastName);
    await page.type("#dateOfBirthPicker", userInfo.dateOfBirth);
    //clicks page and waits for navigation
    await Promise.all([
        page.waitForNavigation(),
        page.click('[title="Submit the details and continue to the next page"]'),
    ]);
    //Checks if page has navigated
    const pageNavCheck = await page.$$('[name="clientDetailsPanel:licenceNumber"]');
    console.log("Logged in successfully");
    if (pageNavCheck.length != 0) {
        console.error("USER DETAILS INCORRECT");
        return;
    }
    const testTypeContainer = await page.$$('[name="searchBookingContainer:testType"]');
    if (testTypeContainer.length != 0) {
        await page.select('[name="searchBookingContainer:testType"]', "C");
    }
    if (isRegional) {
        await page.click('[value="REGIONAL"]'); //clicks regional radio button
    }
    await delay(1000);
    //types upper and lower dates for booking
    await page.type("#fromDateInput", date_and_time_1.default.format(rangeBottom, "DD/MM/YYYY"));
    await delay(1000);
    await page.type("#toDateInput", date_and_time_1.default.format(rangeTop, "DD/MM/YYYY"));
    await delay(1000);
    //Selects locations to look for
    await page.evaluateHandle((locations) => {
        locations.forEach((loc) => {
            if (loc != undefined) {
                const doc = document.querySelector(`[value=${loc}]`);
                doc.click();
            }
        });
    }, locations);
    async function newTimesInfoCallback() {
        try {
            const times = await page.$$("#searchResultRadioLabel"); //list of elements containing dates needed
            const errors = await page.$$("span.feedbackPanelERROR"); //error messages that show at the top of the screen
            if (errors.length > 0) {
                const errorMessages = await Promise.all(errors.map(async (element) => {
                    return page.evaluate((el) => el.innerText, element); //extracts error message text
                }));
                for (let i = 0; i < errorMessages.length; i++) {
                    if (errorMessages[i].includes("limit of searches")) {
                        //checks if user has maxed out their searches
                        const currentDate = new Date();
                        console.error(`Out of searches... exiting. Time ${currentDate.toString()}`);
                        process.exit(0);
                    }
                }
            }
            if (times.length != 0 && isBooked == false) {
                const dateTextProms = times.map(async (element) => {
                    // retrieves text form of dates from all html elements
                    return page.evaluate((el) => el.innerText, element); //this is a promise
                });
                const dateText = await Promise.all(dateTextProms);
                isBooked = true;
                bookDate(dateText);
                return;
            }
            await delay(pollingRate);
            const searchButton = await page.$$('[title="Search"]');
            if (searchButton.length === 0) {
                //session has expired
                await browser.close();
                console.log("Session ended, restarting.");
                startBot(); //starts a new bot instance
                return;
            }
            await searchButton[0].click();
        }
        catch (e) {
            console.log(e);
            browser.close();
            startBot();
            return;
        }
    }
    /*const repeater = setInterval(async () => {
        let searchButton = await page.$$('[title="Search"]');
        console.log(searchButton);
        if (searchButton.length === 0) {
          //session has expired
          await browser.close();
          console.log("Session ended, restarting.");
          startBot(); //starts a new bot instance
          clearInterval(repeater);
          return;
        }
        await searchButton[0].click().catch((e) => {
          console.log(e);
          browser.close();
          console.log("Session ended, restarting.");
          startBot(); //starts a new bot instance
          clearInterval(repeater);
          return;
        }); //clicks button to get server to refresh information
  
        await delay(1000); //waits for booking info to reach client
  
        while (isBooked == false) {
          searchButton = await page.$$('[title="Search"]');
          if (searchButton.length === 0) {
            //session has expired
            await browser.close();
            console.log("Session ended, restarting.");
            startBot(); //starts a new bot instance
            clearInterval(repeater);
            break;
          }
  
          if (informationRecieved == true) {
            //checks if information has reached client
            const times: ElementHandle<Element>[] = await page.$$("#searchResultRadioLabel"); //list of elements containing dates needed
  
            if (times.length != 0) {
              const dateTextProms: Promise<string>[] = times.map(async (element) => {
                // retrieves text form of dates from all html elements
                return page.evaluate((el: any) => el.innerText, element); //this is a promise
              });
  
              const dateText: Array<string> = await Promise.all(dateTextProms);
  
              isBooked = true;
  
              bookDate(dateText);
              clearInterval(repeater);
            }
  
            informationRecieved = false;
            break;
          } else {
            console.log(1);
            await delay(500); //waits another 500ms if information hasn't reached client
          }
        }
        /*const datesWithinRange: boolean[] = dateText.map((text) => {
          const splitDate = text.split(" "); //splits string into something like ["02/11/2022", "at", "11:35", "AM", ...]
  
          const formattedDate = `${splitDate[0]} ${splitDate[2]} ${splitDate[3]}`; //creates a string that can be easily converted into a date
  
          const elDate = date.parse(formattedDate, "DD/MM/YYYY h:mm A"); //parses textual date into a date object
  
          const isDateInRange = checkDateInRange(elDate); // checks if date is in specified range of dates
  
          return isDateInRange;
        });
  
        await datesWithinRange.every((bool, i) => {
          if (isBooked === false) {
            if (bool === true) {
              bookDate(i, dateText);
              clearInterval(repeater);
              return false;
            }
          }
        });
      }, pollingRate);*/
    function bookDate(dateText) {
        page
            .click(`#searchResultRadio0`)
            .then(() => Promise.all([page.waitForNavigation(), page.click('[value="Confirm booking"]')]))
            .then(() => Promise.all([page.waitForNavigation(), page.click('[value="Finish"]')]))
            .then(() => {
            console.log("FOUND BOOKING!");
            console.log(dateText[0]);
            return delay(10000);
        })
            .then(() => {
            browser.close();
        })
            .catch((e) => {
            console.log("Error booking date");
            console.error(e);
        });
    }
    try {
        const searchButton = await page.$$('[title="Search"]');
        if (searchButton.length === 0) {
            //session has expired
            await browser.close();
            console.log("Session ended, restarting.");
            startBot(); //starts a new bot instance
            return;
        }
        await searchButton[0].click();
    }
    catch (e) {
        console.log(e);
        console.log("ERROR during pressing search button");
        await browser.close();
        startBot();
    }
};
function formatDateRanges(rangeBottom, rangeTop) {
    let newBottomDate = rangeBottom;
    //date selector logic
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + 1); //sets date 1 day into the future
    /*
            Difference between current date and lower bound of booking range
            to make sure rangeBottom is not behind the current date
            */
    const lowerDiff = date_and_time_1.default.subtract(rangeBottom, currentDate);
    const rangeDiff = date_and_time_1.default.subtract(rangeTop, rangeBottom);
    if (lowerDiff.toMinutes() < 0) {
        console.log("Setting lower date to current date as it is in the past");
        newBottomDate = currentDate;
    }
    if (rangeDiff.toMinutes() <= 0) {
        console.log("Please make your top date further than your bottom date");
        process.exit(1);
    }
    return newBottomDate;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
startBot();
//# sourceMappingURL=index.js.map