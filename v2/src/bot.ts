import { Browser, ElementHandle, HTTPResponse, Page } from "puppeteer";
import {
  Availability,
  BookingInput,
  BotState,
  InstanceEventType,
  InstanceMode,
  MetroLocations,
} from "./Types";
import date from "date-and-time";

export default class Bot {
  private _browser: Browser;
  private _page: Page;
  private _details: BookingInput;
  private _mode: InstanceMode | undefined;
  private _GCaptchaResponse = "";
  private _isRegional: boolean;
  private _isBooked: boolean = false;
  private _pollingRate: number | undefined;
  private _clicksLeft: number = 1000;
  private _state: BotState = BotState.IDLE;
  private _maxClicks: number;

  constructor(
    details: BookingInput,
    searchesLeft: number,
    isRegional: boolean,
    browser: Browser,
    page: Page,
    maxClicks: number,
  ) {
    this._details = details;
    this._isRegional = isRegional;
    this._browser = browser;
    this._page = page;
    this._clicksLeft = searchesLeft;
    this._maxClicks = maxClicks;
  }
  //logs in and starts waiting unless in search state
  public async start() {
    if (this._mode === undefined) {
      throw new Error("ATTEMPTED TO START BOT WITHOUT ASSIGNING MODE");
    }
    await this._page.setViewport({ width: 1366, height: 768 });
    await this._page
      .goto("https://online.transport.wa.gov.au/pdabooking/manage/?3")
      .catch((err: any) => {
        if (err.toString().includes("net::ERR_INTERNET_DISCONNECTED")) {
          //implement no internet error message
          this.emitEvent(InstanceEventType.ERROR, { message: "NO INTERNET CONNECTION" });
        }
      });

    await this._page.setRequestInterception(true);

    this._page.on("request", (request) => {
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
            let postDataFinal: string = postData.replace(
              "&continue=1",
              "&g-recaptcha-response=" + this._GCaptchaResponse,
            );
            postDataFinal = postDataFinal.concat("&continue=1");
            request.continue({ postData: postDataFinal }); //injects postData with new form data
            return;
          }
        }
      }
      request.continue();
    });

    //editing to incorporate isSearching
    this._page.on("response", (response: HTTPResponse) => {
      //have to use text as the pda website is so old it uses xml instead of json
      const requestPostData = response.request().postData();
      if (requestPostData != undefined) {
        if (requestPostData.includes("search=1")) {
          //marker for booking list search
          this.newTimesInfoCallback();
        }
      }
    });

    const { solutions, error } = await this._page.solveRecaptchas(); //solves recaptchas and returns a solution/errors
    if (error != undefined) {
      //implement recaptcha error message
      throw error;
    }
    const solution = solutions[0].text;
    if (solution != undefined) {
      this._GCaptchaResponse = solution;
    }

    //Types in user info
    await this._page.type('[name="clientDetailsPanel:licenceNumber"]', this._details.licenceNum);
    await this._page.type("#licenceExpiryDatePicker", this._details.expiryDate);
    await this._page.type('[name="clientDetailsPanel:firstName"]', this._details.firstName);
    await this._page.type('[name="clientDetailsPanel:lastName"]', this._details.lastName);
    await this._page.type("#dateOfBirthPicker", this._details.dateOfBirth);

    //clicks page and waits for navigation
    await Promise.all([
      this._page.waitForNavigation(),
      this._page.click('[title="Submit the details and continue to the next page"]'),
    ]);

    //Checks if page has navigated
    const pageNavCheck = await this._page.$$('[name="clientDetailsPanel:licenceNumber"]');
    if (pageNavCheck.length != 0) {
      //implement incorrect details error message
      this.emitEvent(InstanceEventType.ERROR, { message: "INCORRECT DETAILS" });
      return;
    } else {
      //implement logged in successfully message
      //update instance state to logged in
    }

    if (this._isRegional) {
      await this._page.click('[value="REGIONAL"]'); //clicks regional radio button
    }

    await this.delay(1000);

    await this.typeDates();

    await this.delay(1000);

    await this.selectLocations();

    this._state = BotState.ACTIVE;
    this.performModeAction();
  }

  private async performModeAction() {
    switch (this._mode) {
      case InstanceMode.BOOKING:
        this.beginLooking();
        break;
      case InstanceMode.SEARCHING:
        this.beginLooking();
        break;
      case InstanceMode.WAITING:
        this.beginLooking();
        break;
    }
  }

  private async typeDates() {
    switch (this._mode) {
      case InstanceMode.BOOKING:
        //types upper and lower dates for booking
        await this._page.type("#fromDateInput", this._details.dateBottom);

        await this.delay(1000);

        await this._page.type("#toDateInput", this._details.dateTop);
        break;
      case InstanceMode.SEARCHING:
        //sets dates to nothing to see all dates
        await this._page.type("#fromDateInput", "");

        await this.delay(1000);

        await this._page.type("#toDateInput", "");
        break;
      case InstanceMode.WAITING:
        //types upper and lower dates for booking
        await this._page.type("#fromDateInput", this._details.dateBottom);

        await this.delay(1000);

        await this._page.type("#toDateInput", this._details.dateTop);
        break;
    }
  }

  //only works for metro locations currently
  private async selectLocations() {
    switch (this._mode) {
      case InstanceMode.BOOKING:
        await this.reselectDesiredLocations();
        break;
      case InstanceMode.SEARCHING: //selects every location
        //Selects locations to look for
        await this._page.evaluateHandle((locations) => {
          locations.forEach((loc) => {
            if (loc != undefined) {
              const el = document.querySelector(`[value=${loc}]`) as HTMLInputElement;
              if (el.checked) {
                return;
              }
              el.click();
            }
          });
        }, MetroLocations);
        break;
      case InstanceMode.WAITING:
        await this.reselectDesiredLocations();
        break;
    }
  }

  private async reselectDesiredLocations() {
    //Selects locations to look for
    await this._page.evaluateHandle(
      (obj) => {
        //loop through all locations to uncheck
        obj.all.forEach((loc) => {
          const el = document.querySelector(`[value=${loc}]`) as HTMLInputElement;
          if (el.checked) {
            el.click(); //unchecks
          }
        });

        //then checks desired locations
        obj.sel.forEach((loc) => {
          if (loc != undefined) {
            const el = document.querySelector(`[value=${loc}]`) as HTMLInputElement;
            el.click();
          }
        });
      },
      { sel: this._details.locationPreferences, all: MetroLocations },
    );
  }

  public handleChangeMode(mode: InstanceMode, pollingRate: number | undefined) {
    this._mode = mode;
    this._pollingRate = pollingRate;
    if (this._state === BotState.STARTING) {
      return;
    }
    if (this._state === BotState.IDLE) {
      this.start();
      return;
    }
    //reset locations and dates to match state
    this.selectLocations();
    this.typeDates();
  }

  private emitEvent(type: InstanceEventType, data: Object): void {
    if (process.send === undefined) {
      console.error("IPC pipeline not found");
      process.exit(1);
    }
    process.send({ type: type, data: data });
  }

  private async newTimesInfoCallback() {
    const times: ElementHandle<Element>[] = await this._page.$$("#searchResultRadioLabel"); //list of elements containing dates needed
    const errors: ElementHandle<Element>[] = await this._page.$$("span.feedbackPanelERROR"); //error messages that show at the top of the screen

    if (errors.length > 0) {
      const errorMessages: Array<string> = await Promise.all(
        errors.map(async (element) => {
          return this._page.evaluate((el: any) => el.innerText, element); //extracts error message text
        }),
      );

      for (let i = 0; i < errorMessages.length; i++) {
        if (errorMessages[i].includes("search limit")) {
          //checks if user has maxed out their searches
          const currentDate = new Date();
          console.error(`Out of searches... exiting. Time ${currentDate.toString()}`);
          this.emitEvent(InstanceEventType.OUT_OF_SEARCHES, {});
          return;
        }

        if (!errorMessages[i].includes("no bookings")) {
          console.error(`DOT ERROR: ${errorMessages[i]}`);
          this.emitEvent(InstanceEventType.ERROR, { message: errorMessages[i] });
          return;
        }
      }
    }

    if (times.length != 0 && this._isBooked === false) {
      const dateTextProms: Promise<string>[] = times.map(async (element) => {
        // retrieves text form of dates from all html elements
        return this._page.evaluate((el: any) => el.innerText, element); //this is a promise
      });

      const dateText: Array<string> = await Promise.all(dateTextProms);

      if (this._mode === InstanceMode.SEARCHING) {
        const availabilities = this.formatDates(dateText);
        //later add upgrade to check for duplicate date messages for performance reasons
        this.emitEvent(InstanceEventType.BOOKING_INFO, { a: availabilities });
        return;
      }

      if (this._mode === InstanceMode.BOOKING) {
        const availabilities = this.formatDates(dateText);
        const cDate = new Date();
        for (let i = 0; i < availabilities.length; i++) {
          if (date.subtract(availabilities[i].date, cDate).toDays() > 3) {
            //maybe change so it can be within 3 days at a later stage
            this._isBooked = true;

            this.bookDate(dateText, i);
            return;
          }
        }
      }
    }
    this.emitEvent(InstanceEventType.SEARCHES_LEFT, { count: this._clicksLeft });
    if (this._pollingRate === undefined) return;
    await this.delay(this._pollingRate);
    this.pressSearch();
  }

  private formatDates(dates: string[]): Availability[] {
    return dates.map((text) => {
      const splitDate = text.split(" "); //splits string into something like ["02/11/2022", "at", "11:35", "AM", ...]
      const formattedDate = `${splitDate[0]} ${splitDate[2]} ${splitDate[3]}`; //creates a string that can be easily converted into a date
      const d = date.parse(formattedDate, "DD/MM/YYYY h:mm A"); //parses textual date into a date object
      if (isNaN(d.getTime())) {
        this.emitEvent(InstanceEventType.ERROR, { message: "Unable to format date" });
      }

      let locString = splitDate[4].toLowerCase();
      //format loc string into a Location
      switch (locString) {
        case "kelmscott":
          locString = "KELM";
          break;
        case "joondalup":
          locString = "JNP";
          break;
        case "success":
          locString = "SUC";
          break;
        case "cannington":
          locString = "CAN";
          break;
        case "mandurah":
          locString = "MDH";
          break;
        case "midland":
          locString = "MID";
          break;
        case "rockingham":
          locString = "ROCK";
          break;
        case "mirrabooka":
          locString = "MBK";
          break;
        case "west":
          locString = "CTYW";
          break;
      }

      return { date: d, loc: locString };
    });
  }

  private bookDate(dateText: Array<string>, index: number) {
    this._page
      .click(`#searchResultRadio${index}`)
      .then(() =>
        Promise.all([
          this._page.waitForNavigation(),
          this._page.click('[value="Confirm booking"]'),
        ]),
      )
      .then(() =>
        //make sure to add check if there is an extra confirmation for tests in less that 3 days time
        Promise.all([this._page.waitForNavigation(), this._page.click('[value="Finish"]')]),
      )
      .then(() => {
        this.delay(10000);
      })
      .then(() => {
        this.emitEvent(InstanceEventType.BOOKED, { date: dateText[index] });
        this._browser.close();
      })
      .catch((e) => {
        this.emitEvent(InstanceEventType.ERROR, { message: "ERROR BOOKING DATE" });
      });
  }

  public async beginLooking() {
    if (this._pollingRate === undefined) return;
    await this.delay(this._pollingRate);
    this.pressSearch(); //continues in a loop after that
    this.buttonPressSynchron();
  }

  private async pressSearch() {
    if (this._clicksLeft <= Math.ceil(this._maxClicks / 10)) {
      //if clicks left is less than 10% of max clicks
      this.emitEvent(InstanceEventType.SEARCH_LIMIT_REACHED, { clicksLeft: 100 });
      return;
    }
    try {
      const searchButton = await this._page.$$('[title="Search"]');
      if (searchButton.length === 0) {
        //session has expired
        await this._browser.close();
        //implement session ended message
        this.emitEvent(InstanceEventType.SESSION_ENDED, {});
        await this.start(); //starts a new bot instance
        return;
      }

      await searchButton[0].click();
      this._clicksLeft--;
    } catch (e) {
      console.error(e);
      this.emitEvent(InstanceEventType.ERROR, { message: "ERROR DURING PRESSING SEARCH BUTTON" });
      await this._browser.close();
      this.start();
      return;
    }
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  //closes page and browser
  public async clearMem() {
    await this._page.close();
    await this._browser.close();
  }

  private async buttonPressSynchron() {
    /*while (true) {
      const earlierClicks = this._clicksLeft;
      await this.delay(3 * 60000);
      if (earlierClicks === this._clicksLeft && this._state === BotState.ACTIVE) {
        //presses search if fell out of loop
        this.pressSearch();
      }
    }*/
  }
}
