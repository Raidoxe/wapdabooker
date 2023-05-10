import { Db, FindCursor, WithId, Document } from "mongodb";
import { info, error, inputError, success } from "./MessageTypes";
var prompt = require("prompt-sync")({ sigint: true });
import date from "date-and-time";
import chalk from "chalk";
import { State, names, BookingInput, LocationList } from "./Types";

export default class CommandManager {
  private readonly _database: Db;
  private commandsStarted: boolean = false;

  constructor(readonly database: Db) {
    //initialize class
    this._database = database;
  }

  public async acceptCommands() {
    if (this.commandsStarted === false) {
      this.beginCommand();
      this.commandsStarted = true;
      return;
    }
    return;
  }

  private beginCommand(): void {
    const command = prompt(": ");
    if (command == null) this.beginCommand();
    //process command
    switch (command) {
      case "book -a":
        this.handleAddUserCommand().then(() => {
          this.beginCommand();
        });
        return;
      case "book ls":
        //show active users in database
        this.handleShowActiveBookingsCommand().then(() => this.beginCommand());
        return;
      case "book ls -b":
        //show active user in database
        this.handleShowActiveBookingCommand().then(() => this.beginCommand());
        return;
      case "book -r":
        //remove an active user from database
        this.handleRemoveUserCommand().then(() => {
          this.beginCommand();
        });
        return;
      case "book ls -i":
        //list all inactive users
        this.handleShowIncativeBookingCommand().then(() => this.beginCommand());
        return;
      case "book -e":
        //to edit a boooking or switch it between active/inactive
        this.handleChangeBookingCommand().then(() => this.beginCommand());
        return;
      default:
        inputError("\nInvalid command\n");
        this.beginCommand();
        return;
    }
  }

  private async handleChangeBookingCommand(): Promise<void> {
    const names = this.getNames();
    if (names.firstName === null || names.lastName === null) {
      inputError("Please enter a first name and last name\n");
      return;
    }
    let s = prompt("State: ");
    let state = this.formatState(s);

    if (state === undefined) {
      inputError("\nInvalid state\n");
      return;
    }

    const bookings = await this.getBookings(state, names).toArray();
    if (bookings.length === 0) {
      info(`\nUser not found: ${names.firstName} ${names.lastName}\n\n`);
      return;
    }

    if (bookings.length > 1) {
      info(`Multiple users found for: ${names.firstName} ${names.lastName}\n`);

      for (let i = 0; i < bookings.length; i++) {
        console.log(
          `${chalk.green(i.toString())}: ${bookings[i].licenceNum}: ${bookings[i].firstName} ${
            bookings[i].lastName
          }`,
        ); // logs in the format 0: FIRSTNAME LASTNAME
      }

      console.log("\n");

      const selectedUserNum = prompt("Please type your selected users number: ");

      if (selectedUserNum === null) {
        inputError("Aborted\n\n");
        return;
      }

      const parsedNum = parseInt(selectedUserNum);

      if (Number.isNaN(parsedNum) || parsedNum < 0 || parsedNum > bookings.length - 1) {
        inputError("Incorrect input, aborting.\n");
        return;
      }

      const originalBooking = bookings[parsedNum];

      const newBooking = this.getNewBookingInfo(originalBooking);

      if (newBooking === undefined) return;

      if (newBooking[0] === bookings[parsedNum]) {
        inputError("\nNo data change\n");
        return;
      }

      const res = await this.editBookingData(
        bookings[parsedNum],
        newBooking[0],
        state,
        newBooking[1],
      );
      if (res === undefined) {
        console.error("Internal error editing booking data");
        return;
      }

      this.logSwitchedBookingMessage(newBooking[0], res);
    }

    if (bookings.length === 1) {
      const newBooking = this.getNewBookingInfo(bookings[0]);

      if (newBooking === undefined) return;

      if (newBooking[0] === bookings[0]) {
        inputError("\nNo data change\n");
        return;
      }

      const res = await this.editBookingData(bookings[0], newBooking[0], state, newBooking[1]);
      if (res === undefined) {
        console.error("Internal error editing booking data");
        return;
      }

      this.logSwitchedBookingMessage(newBooking[0], res);
    }
  }

  private getNewBookingInfo(b: WithId<Document>): [WithId<Document>, boolean] | undefined {
    let originalBooking = { ...b }; //copies object as parameter is passed as reference
    let dataChanged = false;

    //remove selected user from curent users array
    //remove selected user from curent users array
    console.log("Type in the fields you want to change");

    const firstName: string = prompt("First Name: ").toLowerCase();
    const lastName: string = prompt("Last Name: ").toLowerCase();
    const licenceNum: string = prompt("Licence Number: ");
    const expiryDate: string = prompt("Expiry Date: ");
    const dateOfBirth: string = prompt("Date of Birth: ");
    let dateBottomString: string = prompt("Lower Date: ");
    let dateTopString: string = prompt("Upper Date: ");
    const locationsString: string = prompt("Locations: ");
    const isAlive = prompt("Is Alive: ").toLowerCase();
    let switchStateString: string = prompt("State: ").toLowerCase();
    let switchState: boolean = false;
    const error = prompt("Error: ");

    if (firstName != "") {
      originalBooking.firstName = firstName;
      dataChanged = true;
    }

    if (lastName != "") {
      originalBooking.lastName = lastName;
      dataChanged = true;
    }

    if (licenceNum != "") {
      originalBooking.licenceNum = licenceNum;
      dataChanged = true;
    }

    if (expiryDate != "") {
      if (!date.isValid(expiryDate, "DD/MM/YYYY")) {
        inputError("\nIncorrect expiry date\n");
        return;
      }
      originalBooking.expiryDate = expiryDate;
      dataChanged = true;
    }

    if (dateBottomString != "") {
      if (!date.isValid(dateBottomString, "DD/MM/YYYY")) {
        inputError("\nIncorrect bottom date\n");
        return;
      }
      const dateBottom = date.parse(`${dateBottomString} 6:00 AM`, "DD/MM/YYYY h:mm A");
      originalBooking.dateBottom = dateBottom;
      dataChanged = true;
    }

    if (dateTopString != "") {
      if (!date.isValid(dateTopString, "DD/MM/YYYY")) {
        inputError("\nIncorrect top date\n");
        return;
      }
      const dateTop = date.parse(`${dateTopString} 6:00 PM`, "DD/MM/YYYY h:mm A");
      originalBooking.dateTop = dateTop;
      dataChanged = true;
    }

    if (dateOfBirth != "") {
      if (!date.isValid(dateOfBirth, "DD/MM/YYYY")) {
        inputError("\nIncorrect date of birth\n");
        return;
      }
      originalBooking.dateOfBirth = dateOfBirth;
      dataChanged = true;
    }

    if (locationsString != "") {
      const preferredLocationStrings: Array<string> = locationsString.split(",");
      if (preferredLocationStrings.length > 4) {
        inputError("\nPlease provide only up to four locations\n");
        return;
      }

      for (let i = 0; i < preferredLocationStrings.length; i++) {
        if (!LocationList.includes(preferredLocationStrings[i])) {
          inputError(`\nInvalid location: ${preferredLocationStrings[i]}\n`);
          return;
        }
      }

      originalBooking.locationPreferences = preferredLocationStrings;
      dataChanged = true;
    }

    if (isAlive != "") {
      if (isAlive === "true" || isAlive === "false") {
        if (isAlive === "true") originalBooking.isAlive = true;
        if (isAlive === "false") originalBooking.isAlive = false;
        dataChanged = true;
      } else {
        inputError("Incorrect input for isAlive, must be either true or false");
        return;
      }
    }

    if (switchStateString != "") {
      switchState = true;
      dataChanged = true;
    }

    if (!dataChanged) {
      inputError("\nNo data changes\n");
      return;
    }

    if (error === "") {
      originalBooking.error = undefined;
    } else {
      originalBooking.error = "";
    }

    return [originalBooking, switchState];
  }

  private logSwitchedBookingMessage(newBooking: WithId<Document>, state: State): void {
    success("Successfully changed booking");
    info("New booking:");
    this.logBooking(newBooking);
    console.log(`State: ${state}`);
  }

  private flipState(state: State): State {
    switch (state) {
      case "Active":
        return "Inactive";
      case "Inactive":
        return "Active";
    }
  }

  private formatState(state: string): State | undefined {
    const low = state.toLowerCase();
    if (low === "active") {
      return "Active";
    } else if (low === "inactive") {
      return "Inactive";
    } else {
      return;
    }
  }

  private async editBookingData(
    originalBooking: WithId<Document>,
    newBooking: WithId<Document>,
    state: State,
    switchState: boolean,
  ): Promise<State | undefined> {
    //enter results into database
    if (!switchState) {
      //replace original booking with new booking
      const result = await this._database
        .collection(`${state}Bookings`)
        .replaceOne(originalBooking, newBooking);

      if (result.modifiedCount != 1) {
        return undefined;
      }

      return state;
    } else {
      const flippedState = this.flipState(state);
      //delete original booking from original state database and add new booking to the other
      const r1 = await this._database.collection(`${state}Bookings`).deleteOne(originalBooking);
      if (r1.deletedCount != 1) {
        return undefined;
      }
      const r2 = await this._database.collection(`${flippedState}Bookings`).insertOne(newBooking);
      if (!r2.acknowledged) return undefined;

      return flippedState;
    }
  }

  private async handleShowIncativeBookingCommand(): Promise<void> {
    try {
      const names = this.getNames();
      const inactiveBookings = this.getBookings("Inactive", names);
      await this.displayBookings("Inactive", inactiveBookings);
    } catch (err) {
      console.error("Internal error: " + err);
    }
  }

  private getBookings(type: State, names?: names) {
    const coll = this._database.collection(`${type}Bookings`);
    if (names === undefined) {
      return coll.find();
    }
    return coll.find({ firstName: names.firstName, lastName: names.lastName });
  }

  private async displayBookings(type: State, bookings: FindCursor<WithId<Document>>) {
    info(`${type} Bookings: `);
    await bookings.forEach((booking: any) => {
      this.logBooking(booking);
    });
  }

  private async handleShowActiveBookingCommand(): Promise<void> {
    try {
      const names = this.getNames();
      await this.displayBookings("Active", this.getBookings("Active", names));
    } catch (err) {
      console.error("Internal error: " + err);
    }
  }

  private async handleShowActiveBookingsCommand() {
    try {
      const activeBookings = this.getBookings("Active");
      info("Active Bookings:");
      await activeBookings.forEach((booking) => {
        const info = {
          firstName: booking.firstName,
          lastName: booking.lastName,
          licenceNum: booking.licenceNum,
        };
        console.log(info);
      });
      return;
    } catch (err) {
      console.error("Internal Error: " + err);
    }
  }

  private async handleAddUserCommand(): Promise<void> {
    try {
      console.log("\n");

      const firstName: string = prompt("First Name: ").toLowerCase();
      const lastName: string = prompt("Last Name: ").toLowerCase();
      const licenceNum: string = prompt("Licence Number: ");
      const expiryDate: string = prompt("Expiry Date: ");
      const dateOfBirth: string = prompt("Date of Birth: ");
      let dateBottomString: string = prompt("Lower Date: ");
      let dateTopString: string = prompt("Upper Date: ");
      const locationsString: string = prompt("Locations: ");

      const currentDate = new Date();

      //format input and make sure it is correct
      const preferredLocationStrings: Array<string> = locationsString.split(",");

      if (
        !this.checkBookingInput(
          {
            firstName: firstName,
            lastName: lastName,
            licenceNum: licenceNum,
            expiryDate: expiryDate,
            dateOfBirth: dateOfBirth,
            dateBottom: dateBottomString,
            dateTop: dateTopString,
            locationPreferences: preferredLocationStrings,
          },
          currentDate,
        )
      ) {
        return;
      }

      const dateBottom = date.parse(`${dateBottomString} 6:00 PM`, "DD/MM/YYYY h:mm A");
      const dateTop = date.parse(`${dateTopString} 6:00 AM`, "DD/MM/YYYY h:mm A");

      const newBooking: Document = {
        firstName: firstName,
        lastName: lastName,
        licenceNum: licenceNum,
        expiryDate: expiryDate,
        dateOfBirth: dateOfBirth,
        locationPreferences: preferredLocationStrings,
        dateBottom: dateBottom,
        dateTop: dateTop,
        isAlive: false,
        dateAdded: currentDate,
      };
      //add user to database
      const coll = this._database.collection("ActiveBookings");
      await coll.insertOne(newBooking);

      console.log("User:");
      this.logBooking(newBooking);
      success("Added to database successfully\n");
    } catch (err) {
      console.error("Internal Error");
      console.error(err);
    }
  }

  private logBooking(b: Document) {
    let displayBooking: any = { ...b };
    //convert dates into readable strings
    displayBooking.dateBottom = displayBooking.dateBottom.toLocaleString();
    displayBooking.dateTop = displayBooking.dateTop.toLocaleString();
    displayBooking.dateAdded = displayBooking.dateAdded.toLocaleString();

    console.log(displayBooking);
  }

  private checkBookingInput(bookingInput: BookingInput, currentDate: Date): boolean {
    if (bookingInput.locationPreferences.length > 4) {
      inputError("\nPlease provide only up to four locations\n");
      return false;
    }

    for (let i = 0; i < bookingInput.locationPreferences.length; i++) {
      if (!LocationList.includes(bookingInput.locationPreferences[i])) {
        inputError(`\nInvalid location: ${bookingInput.locationPreferences[i]}\n`);
        return false;
      }
    }

    if (!date.isValid(bookingInput.expiryDate, "DD/MM/YYYY")) {
      inputError(`\nInvalid expiry date: ${bookingInput.expiryDate}\n`);
      return false;
    }

    if (!date.isValid(bookingInput.dateOfBirth, "DD/MM/YYYY")) {
      inputError(`\nInvalid date of birth: ${bookingInput.dateOfBirth}\n`);
      return false;
    }

    if (!date.isValid(bookingInput.dateBottom, "DD/MM/YYYY")) {
      inputError(`\nInvalid bottom date: ${bookingInput.dateBottom}\n`);
      return false;
    }

    if (!date.isValid(bookingInput.dateTop, "DD/MM/YYYY")) {
      inputError(`\nInvalid top date: ${bookingInput.dateTop}\n`);
      return false;
    }

    if (!date.isValid(bookingInput.dateOfBirth, "DD/MM/YYYY")) {
      inputError(`\nInvalid date of birth: ${bookingInput.dateOfBirth}\n`);
      return false;
    }

    const dateTop = date.parse(`${bookingInput.dateTop} 6:00 PM`, "DD/MM/YYYY h:mm A");
    const dateBottom = date.parse(`${bookingInput.dateBottom} 6:00 AM`, "DD/MM/YYYY h:mm A");

    const lowerDiff = date.subtract(dateBottom, currentDate);

    const rangeDiff = date.subtract(dateTop, dateBottom);

    if (lowerDiff.toMinutes() < 0) {
      inputError("\nYour lower date must be in the future\n");
      return false;
    }
    if (rangeDiff.toMinutes() <= 0) {
      inputError("\nPlease make your top date further than your bottom date\n");
      return false;
    }
    return true;
  }

  private getNames(): names {
    const userFirstName = prompt("First Name: ").toLowerCase();
    const userLastName = prompt("Last Name: ").toLowerCase();
    return { firstName: userFirstName, lastName: userLastName };
  }

  private async handleRemoveUserCommand() {
    try {
      //remove an active user from database
      console.log("\n");
      const names = this.getNames();

      if (names.firstName === null || names.lastName === null) {
        inputError("Please enter a first name and last name\n");
        return;
      }

      const numOfFoundBookings = await this._database
        .collection("ActiveBookings")
        .countDocuments(names);

      if (numOfFoundBookings === 0) {
        info(`\nUser not found: ${names.firstName} ${names.lastName}\n\n`);
        return;
      }

      if (numOfFoundBookings > 1) {
        info(`Multiple users found for: ${names.firstName} ${names.lastName}\n`);

        const matchedBookings = await this.getBookings("Active", names).toArray();

        for (let i = 0; i < numOfFoundBookings; i++) {
          console.log(
            `${chalk.green(i.toString())}: ${matchedBookings[i].licenceNum}: ${
              matchedBookings[i].firstName
            } ${matchedBookings[i].lastName}`,
          ); // logs in the format 0: FIRSTNAME LASTNAME
        }

        console.log("\n");

        const selectedUserNum = prompt("Please type your selected users number: ");

        if (selectedUserNum === null) {
          inputError("Aborted\n\n");
          return;
        }

        const parsedNum = parseInt(selectedUserNum);

        if (Number.isNaN(parsedNum) || parsedNum < 0 || parsedNum > matchedBookings.length - 1) {
          inputError("Incorrect input, aborting.\n");
          return;
        }

        //remove selected user from curent users array
        const deletionResult = await this._database
          .collection("ActiveBookings")
          .deleteOne(matchedBookings[parsedNum]);

        if (deletionResult.deletedCount > 0) {
          success(`\nSuccessfully removed user: ${names.firstName} ${names.lastName}`);
          //check if booking is currently running, if so, kill process
          return;
        } else {
          error("\nInternal error: Unable to remove user from database\n");
          return;
        }
      }

      if (numOfFoundBookings === 1) {
        //remove selected user from curent users array
        const booking = await this.getBookings("Active", names).toArray();
        const deletionResult = await this._database
          .collection("ActiveBookings")
          .deleteOne(booking[0]);

        if (deletionResult.deletedCount > 0) {
          success(`\nSuccessfully removed user: ${names.firstName} ${names.lastName}\n`);
          //check if booking is currently running, if so, kill process
          return;
        } else {
          error("\nInternal error: Unable to remove user from database\n");
          return;
        }
      }

      error("Internal error\n");
      return;
    } catch (err) {
      error("Internal Error: Error while removing user");
      console.error(err);
      return;
    }
  }

  /*private async checkMatchingBookings(activeBookings: FindCursor<WithId<Document>>, names: names) {
    let matchedBookings: Array<any> = [];
    await activeBookings.forEach((booking) => {
      if (booking.firstName === names.firstName) {
        if (booking.lastName === names.lastName) {
          matchedBookings.push(booking);
        }
      }
    });
    return matchedBookings;
  }*/
}
