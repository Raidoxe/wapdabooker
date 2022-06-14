import { ElementHandle } from "puppeteer";
const date = require('date-and-time');

const rangeTop = date.parse('12/06/2022 6:00 PM', 'DD/MM/YYYY h:mm A');
const rangeBottom = date.parse('07/06/2022 9:00 AM', 'DD/MM/YYYY h:mm A');

const puppeteer =  require('puppeteer');

const userInfo = {
    licenceNumber: '8147835',
    expiryDate: '09/06/2024',
    firstName: 'Samora',
    lastName: 'Wa Azaro',
    dateOfBirth: '21/03/2005'
};

(
    async () => {
        const browser = await puppeteer.launch()
        const page = await browser.newPage()
        await page.goto('https://online.transport.wa.gov.au/pdabooking/manage/?3').catch(err => {
            if(err.toString().includes('net::ERR_INTERNET_DISCONNECTED')) {
                console.error('INTERNET NOT CONNECTED');
                browser.close();
                process.exit();
            }
        })

        await page.type('[name="clientDetailsPanel:licenceNumber"]', userInfo.licenceNumber);
        await page.type('#licenceExpiryDatePicker', userInfo.expiryDate);
        await page.type('[name="clientDetailsPanel:firstName"]', userInfo.firstName);
        await page.type('[name="clientDetailsPanel:lastName"]', userInfo.lastName);
        await page.type('#dateOfBirthPicker', userInfo.dateOfBirth);

        const [bookingsPageResponse] = await Promise.all([
            page.waitForNavigation(),
            page.click('[title="Submit the details and continue to the next page"]')
        ]);
        const pageNavCheck: [] = await page.$$('[name="clientDetailsPanel:licenceNumber"]');
        console.log(pageNavCheck)
        if(pageNavCheck.length != 0) {
            console.error('USER DETAILS INCORRECT');
            return;
        }


        //title="Search for available bookings"
        const [availableBookingsPageResponse] = await Promise.all([
            page.waitForNavigation(),
            page.click('[title="Search for available bookings"]')
        ])

        await page.select('select', 'KELM');
        /* 
        <option value="CAN">Cannington</option>
        <option value="JNP">Joondalup</option>
        <option value="KELM">Kelmscott</option>
        <option value="ROCK">Rockingham</option>
        */

        const repeater = setInterval(async () => {
            await page.click('[title="Search"]');
            await new Promise(r => setTimeout(r, 3000)).then(() => {
                page.evaluate(() => document.querySelector('*').outerHTML)//.then(html => console.log(html));
            });
    
            const times: Array<ElementHandle> = await page.$$('#searchResultRadioLabel');
    
            const regexString = new RegExp('at ');
            const dateText = times.map((element) => {
                return page.evaluate(el => el.innerText, element);
            });
    
            const datesWithinRange = await Promise.all(dateText).then(dateText => {
                console.log(dateText);
                const datesWithinRange: boolean[] = dateText.map(text => {
                    console.log(text);
                    const validDate = text.replace(regexString, '');
                    console.log(validDate);
                    const elDate = date.parse(validDate, 'DD/MM/YYYY h:mm A');
                    console.log(elDate);
                    const isDateInRange = checkDateInRange(elDate);
                    console.log(isDateInRange);
                    return isDateInRange;
                })
                return datesWithinRange;
            })
            
            datesWithinRange.every((bool, i) => {
                if(bool === true) {
                    bookDate(i);
                    clearInterval(repeater);
                    return false;
                }
            })
    
            
        }, 1000);

        function bookDate(listNumber: number) {
            page.click(`#searchResultRadio${listNumber}`).then(() => 
            page.click('[value="Confirm Booking"]')).then(() => 
            console.log('FOUND BOOKING!'));
            //browser.close();
        }
        

        //await browser.close();
    }
)();

function checkDateInRange(dateListing): boolean {
    console.log(date.subtract(rangeTop, dateListing).toHours());
    console.log(date.subtract(dateListing, rangeBottom).toHours());
    if((date.subtract(rangeTop, dateListing).toHours() >= 0) && (date.subtract(dateListing, rangeBottom).toHours() >= 0)) {
        return true;
    } else {
        return false;
    }
}