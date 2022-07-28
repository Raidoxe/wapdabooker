"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const date = require('date-and-time');
const yargs = require('yargs/yargs');
const puppeteer = require('puppeteer');
const { hideBin } = require('yargs/helpers');
const args = yargs(hideBin(process.argv)).option('licenceNum', {
    alias: 'l',
    description: 'Drivers Licence number',
    type: 'string'
}).option('expiryDate', {
    alias: 'e',
    description: 'Drivers Licence expiry date',
    type: 'string'
}).option('firstName', {
    alias: 'f',
    description: 'Drivers First name',
    type: 'string'
}).option('lastName', {
    description: 'Drivers Last name',
    type: 'string'
}).option('dateOfBirth', {
    alias: 'd',
    description: 'Drivers date of birth',
    type: 'string'
}).option('dateTop', {
    description: 'Preffered highest date',
    type: 'string'
}).option('dateBottom', {
    description: 'Preffered lowest date',
    type: 'string'
}).option('location', {
    description: 'Preffered spot/location for driving test',
    type: 'string'
}).argv;
const rangeTop = date.parse(`${args.dateTop} 6:00 PM`, 'DD/MM/YYYY h:mm A');
const rangeBottom = date.parse(`${args.dateBottom} 6:00 AM`, 'DD/MM/YYYY h:mm A');
//const args: Array<string> = process.argv.slice(2);
const userInfo = {
    licenceNumber: args.licenceNum,
    expiryDate: args.expiryDate,
    firstName: args.firstName,
    lastName: args.lastName,
    dateOfBirth: args.dateOfBirth
};
if (isNaN(rangeBottom) || isNaN(rangeTop)) {
    if (isNaN(rangeBottom)) {
        console.log('Lowest Date is Invalid!');
        process.exit();
    }
    if (isNaN(rangeTop)) {
        console.log('Highest Date is Invalid!');
        process.exit();
    }
}
console.log('Booking test for:');
console.log(userInfo);
console.log(`At location ${args.location}`);
console.log(`Between ${rangeBottom} to ${rangeTop}`);
(async () => {
    /*const infoRepeater = setInterval(async () => {
        //console.log('Currently booking for: ');
        //console.log(userInfo);
        //console.log(`At: ${args.location}`);
        //console.log(`Between ${rangeBottom} to ${rangeTop}`);
       
    }, 60000)*/
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto('https://online.transport.wa.gov.au/pdabooking/manage/?3').catch((err) => {
            if (err.toString().includes('net::ERR_INTERNET_DISCONNECTED')) {
                console.error('INTERNET NOT CONNECTED');
                browser.close();
                process.exit();
            }
        });
        await page.type('[name="clientDetailsPanel:licenceNumber"]', userInfo.licenceNumber);
        await page.type('#licenceExpiryDatePicker', userInfo.expiryDate);
        await page.type('[name="clientDetailsPanel:firstName"]', userInfo.firstName);
        await page.type('[name="clientDetailsPanel:lastName"]', userInfo.lastName);
        await page.type('#dateOfBirthPicker', userInfo.dateOfBirth);
        const [bookingsPageResponse] = await Promise.all([
            page.waitForNavigation(),
            page.click('[title="Submit the details and continue to the next page"]')
        ]);
        const pageNavCheck = await page.$$('[name="clientDetailsPanel:licenceNumber"]');
        //console.log(pageNavCheck)
        if (pageNavCheck.length != 0) {
            console.error('USER DETAILS INCORRECT');
            return;
        }
        //title="Search for available bookings"
        const [availableBookingsPageResponse] = await Promise.all([
            page.waitForNavigation(),
            page.click('[title="Search for available bookings"]')
        ]);
        await page.select('select', args.location);
        /*
        <option value="CAN">Cannington</option>
        <option value="JNP">Joondalup</option>
        <option value="KELM">Kelmscott</option>
        <option value="ROCK">Rockingham</option>
        SUCCESS=SUC
        Mirrabooka=MBK
        Midland=MID
        West Perth = CTYW
        Mandurah=MDH
        */
        const repeater = setInterval(async () => {
            await page.click('[title="Search"]'); //clicks button to get server to refresh information
            await new Promise(r => setTimeout(r, 500)).then(() => {
                page.evaluate(() => document.querySelector('*')?.outerHTML); //gets  html from document
            });
            const times = await page.$$('#searchResultRadioLabel'); //list of elements containing dates needed
            const regexString = new RegExp('at '); //to remove the word 'at' from the date
            const dateText = times.map((element) => {
                return page.evaluate((el) => el.innerText, element); //this is a promise
            });
            const datesWithinRange = await Promise.all(dateText).then(dateText => {
                //console.log(dateText);
                const datesWithinRange = dateText.map(text => {
                    //console.log(text);
                    const validDate = text.replace(regexString, '');
                    //console.log(validDate);
                    const elDate = date.parse(validDate, 'DD/MM/YYYY h:mm A'); //parses textual date into a date object
                    //console.log(elDate);
                    const isDateInRange = checkDateInRange(elDate); // checks if date is in a specific range of dates
                    //console.log(isDateInRange);
                    return isDateInRange;
                });
                return datesWithinRange;
            });
            await datesWithinRange.every((bool, i) => {
                if (bool === true) {
                    bookDate(i);
                    clearInterval(repeater);
                    return false;
                }
            });
            return 0;
        }, 2000);
        function bookDate(listNumber) {
            page.click(`#searchResultRadio${listNumber}`).then(() => page.click('[value="Confirm Booking"]')).then(() => {
                console.log('FOUND BOOKING!');
                //clearInterval(infoRepeater)
            });
            //browser.close();
        }
    }
    catch (e) {
        console.error(e);
        console.log('ERROR');
        //clearInterval(infoRepeater)
    }
    finally {
    }
    //await browser.close();
})();
function checkDateInRange(dateListing) {
    //console.log(date.subtract(rangeTop, dateListing).toHours());
    //console.log(date.subtract(dateListing, rangeBottom).toHours());
    if ((date.subtract(rangeTop, dateListing).toHours() >= 0) && (date.subtract(dateListing, rangeBottom).toHours() >= 0)) {
        return true;
    }
    else {
        return false;
    }
}
