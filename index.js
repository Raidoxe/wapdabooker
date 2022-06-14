"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var date = require('date-and-time');
var rangeTop = date.parse('12/06/2022 6:00 PM', 'DD/MM/YYYY h:mm A');
var rangeBottom = date.parse('07/06/2022 9:00 AM', 'DD/MM/YYYY h:mm A');
var puppeteer = require('puppeteer');
var userInfo = {
    licenceNumber: '8147835',
    expiryDate: '09/06/2024',
    firstName: 'Samora',
    lastName: 'Wa Azaro',
    dateOfBirth: '21/03/2005'
};
(function () { return __awaiter(void 0, void 0, void 0, function () {
    function bookDate(listNumber) {
        page.click("#searchResultRadio" + listNumber).then(function () {
            return page.click('[value="Confirm Booking"]');
        }).then(function () {
            return console.log('FOUND BOOKING!');
        });
        //browser.close();
    }
    var browser, page, bookingsPageResponse, pageNavCheck, availableBookingsPageResponse, repeater;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, puppeteer.launch()];
            case 1:
                browser = _a.sent();
                return [4 /*yield*/, browser.newPage()];
            case 2:
                page = _a.sent();
                return [4 /*yield*/, page.goto('https://online.transport.wa.gov.au/pdabooking/manage/?3')["catch"](function (err) {
                        if (err.toString().includes('net::ERR_INTERNET_DISCONNECTED')) {
                            console.error('INTERNET NOT CONNECTED');
                            browser.close();
                            process.exit();
                        }
                    })];
            case 3:
                _a.sent();
                return [4 /*yield*/, page.type('[name="clientDetailsPanel:licenceNumber"]', userInfo.licenceNumber)];
            case 4:
                _a.sent();
                return [4 /*yield*/, page.type('#licenceExpiryDatePicker', userInfo.expiryDate)];
            case 5:
                _a.sent();
                return [4 /*yield*/, page.type('[name="clientDetailsPanel:firstName"]', userInfo.firstName)];
            case 6:
                _a.sent();
                return [4 /*yield*/, page.type('[name="clientDetailsPanel:lastName"]', userInfo.lastName)];
            case 7:
                _a.sent();
                return [4 /*yield*/, page.type('#dateOfBirthPicker', userInfo.dateOfBirth)];
            case 8:
                _a.sent();
                return [4 /*yield*/, Promise.all([
                        page.waitForNavigation(),
                        page.click('[title="Submit the details and continue to the next page"]')
                    ])];
            case 9:
                bookingsPageResponse = (_a.sent())[0];
                return [4 /*yield*/, page.$$('[name="clientDetailsPanel:licenceNumber"]')];
            case 10:
                pageNavCheck = _a.sent();
                console.log(pageNavCheck);
                if (pageNavCheck.length != 0) {
                    console.error('USER DETAILS INCORRECT');
                    return [2 /*return*/];
                }
                return [4 /*yield*/, Promise.all([
                        page.waitForNavigation(),
                        page.click('[title="Search for available bookings"]')
                    ])];
            case 11:
                availableBookingsPageResponse = (_a.sent())[0];
                return [4 /*yield*/, page.select('select', 'KELM')];
            case 12:
                _a.sent();
                repeater = setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
                    var times, regexString, dateText, datesWithinRange;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.click('[title="Search"]')];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 3000); }).then(function () {
                                        page.evaluate(function () { return document.querySelector('*').outerHTML; }); //.then(html => console.log(html));
                                    })];
                            case 2:
                                _a.sent();
                                return [4 /*yield*/, page.$$('#searchResultRadioLabel')];
                            case 3:
                                times = _a.sent();
                                regexString = new RegExp('at ');
                                dateText = times.map(function (element) {
                                    return page.evaluate(function (el) { return el.innerText; }, element);
                                });
                                return [4 /*yield*/, Promise.all(dateText).then(function (dateText) {
                                        console.log(dateText);
                                        var datesWithinRange = dateText.map(function (text) {
                                            console.log(text);
                                            var validDate = text.replace(regexString, '');
                                            console.log(validDate);
                                            var elDate = date.parse(validDate, 'DD/MM/YYYY h:mm A');
                                            console.log(elDate);
                                            var isDateInRange = checkDateInRange(elDate);
                                            console.log(isDateInRange);
                                            return isDateInRange;
                                        });
                                        return datesWithinRange;
                                    })];
                            case 4:
                                datesWithinRange = _a.sent();
                                datesWithinRange.every(function (bool, i) {
                                    if (bool === true) {
                                        bookDate(i);
                                        clearInterval(repeater);
                                        return false;
                                    }
                                });
                                return [2 /*return*/];
                        }
                    });
                }); }, 1000);
                return [2 /*return*/];
        }
    });
}); })();
function checkDateInRange(dateListing) {
    console.log(date.subtract(rangeTop, dateListing).toHours());
    console.log(date.subtract(dateListing, rangeBottom).toHours());
    if ((date.subtract(rangeTop, dateListing).toHours() >= 0) && (date.subtract(dateListing, rangeBottom).toHours() >= 0)) {
        return true;
    }
    else {
        return false;
    }
}
