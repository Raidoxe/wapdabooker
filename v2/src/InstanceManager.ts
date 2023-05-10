import Instance from "./Instance";
import { Availability, InstanceEvent, InstanceEventType, InstanceMode } from "./Types";
import { Db, WithId, Document } from "mongodb";
import date from "date-and-time";
import { info } from "./MessageTypes";

//function is to pull booking data from MongoDB database and launch bot instances accordingly
//pipe for communicating information from instance to master
/*Pipe will have a master slave dynamic, where bot instances will only communicate to the master(this)
    and the master will be responsible for processing the message*/
export default class InstanceManager {
  //current list of instances
  private _instances: Array<Instance> = [];
  private _db: Db;
  private _pollingRate: number = 10000;
  private _totalBookings: number;
  private static maxClickCount = 10;
  private static dbPollRate = 2 * 60000;
  private static maxLiveBookings = 5;
  private static BOOKING_POLLRATE = 1000;
  private static WAITING_POLLRATE = 60 * 60000;

  constructor(database: Db, totalBookings: number) {
    this._db = database;
    this._totalBookings = totalBookings;
    this.beginPollingDb();
  }

  //removes all bookings from list that currently match already launched instances
  private removeCurrentlyAlive(bookings: WithId<Document>[]) {
    for (let x = bookings.length - 1; x >= 0; x--) {
      for (let y = this._instances.length - 1; y >= 0; y--) {
        if (this._instances[y].getBooking()._id.toString() === bookings[x]._id.toString()) {
          bookings.splice(x, 1);
          break;
        }
      }
    }
  }

  //event function that compares current booking availabilities to active users search ragnes and returns cross sections
  private async findNewBooking(count: number): Promise<WithId<Document>[]> {
    //smallest number takes priority
    /* WEIGHTING (all in days):
            time since date created: -2x
            range between dates: + up to 60 days (if past lower date, calculate from current date)
            time to lower date: + or becomes - if past lower date
        */

    let docs: WithId<Document>[] = [];

    let aliveBookings = await this.getAliveBookings();
    this.removeCurrentlyAlive(aliveBookings);

    if (aliveBookings.length > 0) {
      if (count <= aliveBookings.length) {
        return aliveBookings.slice(0, count - 1);
      }
    }

    let nonA = await this.getNonAliveBookings();
    this.removeCurrentlyAlive(nonA);

    docs.push(...nonA);

    //check if there are any errors present on bookings
    const nonErranous: WithId<Document>[] = [];

    docs.map((b) => {
      if (b.error === null || b.error === undefined) {
        nonErranous.push(b);
      }
    });

    //remove the ones that are out of searches
    for (let i = nonErranous.length - 1; i >= 0; i--) {
      const b = nonErranous[i];
      if (b.reachedLimit === undefined) continue;
      //check if it has been 24 hours since limit was reached
      const currentTime = new Date();
      const timeDiff = date.subtract(currentTime, b.reachedLimit).toHours();
      if (timeDiff < 24) {
        //remove as it is still within 24 hours since last booking
        nonErranous.splice(i, 1);
      }
    }

    //get weighting info for corresponding bookings
    const weightingInfo: Array<{ weight: number; booking: WithId<Document> }> = [];

    const currentDate = new Date();

    nonErranous.map((b) => {
      console.log(b.dateAdded);
      const timeScalar = -(date.subtract(currentDate, b.dateAdded).toDays() * 2);
      let rangeScalar: number;
      if (date.subtract(b.dateBottom, currentDate).toDays() < 0) {
        //will execute if current date is past the lower date
        rangeScalar = date.subtract(b.dateTop, currentDate).toDays();
        if (rangeScalar < 0) {
          this.createBookingError(b, "CURRENT DATE PAST TOP DATE");
          return;
        }
      } else {
        //executes if lower date is in front of current date
        rangeScalar = date.subtract(b.dateTop, b.dateBottom).toDays();
        if (rangeScalar > 60) rangeScalar = 60;
        if (rangeScalar < 0) {
          this.createBookingError(b, "LOWER DATE PAST TOP DATE");
          return;
        }
      }

      const timeToLowerScalar = date.subtract(b.dateBottom, currentDate).toDays();

      const finalWeight = timeScalar + rangeScalar + timeToLowerScalar;

      weightingInfo.push({ weight: finalWeight, booking: b });
    });

    //sort weighting info from smallest to largest (bubblesort)

    let isSorted = false;
    while (!isSorted) {
      let changed = false;
      for (let i = 0; i < weightingInfo.length - 1; i++) {
        if (weightingInfo[i].weight > weightingInfo[i + 1].weight) {
          //swap elements
          const w1 = weightingInfo[i];
          weightingInfo[i] = weightingInfo[i + 1];
          weightingInfo[i + 1] = w1;
          changed = true;
        }
      }

      if (changed === false) isSorted = true;
    }

    console.log("Final weights determined and sorted:");
    console.log(weightingInfo);

    let priorityBookings: WithId<Document>[] = [];

    for (let i = 0; i < weightingInfo.length; i++) {
      priorityBookings.push(weightingInfo[i].booking);
    }

    const aliveDocs = this._instances.map((i) => {
      return i.getBooking();
    });

    //MAKE SURE TO ADD IN A CHECK FOR OVERLAP
    this.optimiseOverlap(priorityBookings, aliveDocs);

    const newBookings: WithId<Document>[] = [];

    if (count > 1) {
      let numAdded = 0;
      //prioritise alive bookings
      if (aliveBookings.length > 0) {
        //push first element
        newBookings.push(aliveBookings[0]);
        numAdded++;
        aliveBookings.splice(0, 1);
        while (numAdded < count) {
          this.optimiseOverlap(aliveBookings, newBookings);
          if (aliveBookings.length === 0) break;
          newBookings.push(aliveBookings[0]);
          numAdded++;
          aliveBookings.splice(0, 1);
        }
      }

      if (priorityBookings.length > 0) {
        this.optimiseOverlap(priorityBookings, newBookings);
        while (numAdded < count) {
          if (priorityBookings.length === 0) break;
          newBookings.push(priorityBookings[0]);
          priorityBookings.splice(0, 1);
          this.optimiseOverlap(priorityBookings, newBookings);
          numAdded++;
        }
      }
    } else {
      //make sure to prioritise aliveBookings
      if (aliveBookings.length > 0) {
        newBookings.push(aliveBookings[0]);
      }

      if (priorityBookings.length > 0) {
        //first element of priorityBookings will always be entered
        newBookings.push(priorityBookings[0]);
      }
    }

    return newBookings;
  }

  /*returns a new array of Documents which no longer have any overlap with active documents, 
  however some documents will be removed if there is complete overlap*/
  private optimiseOverlap(
    targetDocs: WithId<Document>[],
    aliveDocs: WithId<Document>[],
  ): WithId<Document>[] {
    //check date ranges for overlap and remove ones which are overlapping with current instances
    //loop backwards to preserve indecies when splicing
    for (let i = targetDocs.length - 1; i >= 0; i--) {
      const t = targetDocs[i];
      for (let j = 0; j < aliveDocs.length; j++) {
        //check if either the bottom date or the top date of targetDocs[i] is inside of the range of aliveDocs[j]
        //to confirm if p is in the range of inst, check if p.dateBottom is below dateTop AND above dateBottom and the same for p.dateTop
        const inst = aliveDocs[j];

        //check if top dates are inst within range
        let tSubRes = date.subtract(t.dateTop, inst.dateTop).toDays();
        let bSubRes = date.subtract(t.dateTop, inst.dateBottom).toDays();
        if (tSubRes <= 0 && bSubRes >= 0) {
          if (this.removeLocationOverlap(targetDocs[i], aliveDocs[j]).length === 0) {
            targetDocs.splice(i, 1);
            break;
          } else {
            break;
          }
        }

        //check if bottom dates are within inst range
        tSubRes = date.subtract(t.dateBottom, inst.dateTop).toDays();
        bSubRes = date.subtract(t.dateBottom, inst.dateBottom).toDays();
        if (bSubRes <= 0 && tSubRes >= 0) {
          if (this.removeLocationOverlap(targetDocs[i], aliveDocs[j]).length === 0) {
            targetDocs.splice(i, 1);
            break;
          } else {
            break;
          }
        }
      }
    }
    return targetDocs;
  }

  private removeLocationOverlap(b: WithId<Document>, aliveBooking: WithId<Document>): string[] {
    //check if priorityBookings[i] location preferences overlap with this._instances[j] location preferences
    const bookPrefs = b.locationPreferences;
    const alivePrefs = aliveBooking.locationPreferences;

    //loop through each location preference of priorityBookings[i] for each location preference of this._instances[j]
    for (let x = bookPrefs.length - 1; x >= 0; x--) {
      for (let y = alivePrefs.length - 1; y >= 0; y--) {
        if (bookPrefs[x] === alivePrefs[y]) {
          //if there is an overlap then remove the location from priorityBookings[i]
          b.locationPreferences.splice(x, 1);
          break;
        }
      }
    }

    return b.locationPreferences;
  }

  //adds error to booking in database - moves to inactive bookings
  private async createBookingError(b: WithId<Document>, err: string) {
    b.isAlive = false;
    const realB = await this._db.collection("ActiveBookings").find({ _id: b._id }).toArray();
    if (realB.length === 0) {
      console.error("ERROR deleting booking from active bookings:");
      console.error(b);
      return;
    }

    const delRes = await this._db.collection("ActiveBookings").deleteOne({ _id: b._id });
    if (delRes.deletedCount === 0) {
      console.error("ERROR deleting booking from active bookings:");
      console.error(b);
      return;
    }

    await this._db.collection("InactiveBookings").insertOne({ ...realB[0], error: err });
  }

  //function that pulls user booking data from db

  //to be run every 5 minutes
  private async getAliveBookings(): Promise<WithId<Document>[]> {
    const aliveBookings = await this._db
      .collection("ActiveBookings")
      .find({ isAlive: true })
      .toArray(); //array use is temporary as memory usage is not a concern currently

    return aliveBookings;
  }

  private async getNonAliveBookings(): Promise<WithId<Document>[]> {
    const nonAliveBookings = await this._db
      .collection("ActiveBookings")
      .find({ isAlive: false })
      .toArray(); //array use is temporary as memory usage is not a concern currently

    return nonAliveBookings;
  }

  private async getTotalBookings(): Promise<number> {
    const c = await this._db.collection("ActiveBookings").countDocuments();
    this._totalBookings = c;
    return c;
  }

  //function that figures out which bookings from a list of active bookings to prioritize and make "alive" (launch) *FL*

  //formula to optimise the polling rate depending on the number of students (returns in ms)
  private getPollingRate(): number {
    const totalNum = this._totalBookings;
    const isPeak = this.isPeak();

    const msPerBookingAvg = 86400000 / totalNum;
    const msPerClickAvg = msPerBookingAvg / InstanceManager.maxClickCount;

    let pollingRate: number;

    if (isPeak) {
      pollingRate = msPerClickAvg / 3;
    } else {
      pollingRate = msPerClickAvg * 3;
    }

    return pollingRate;
    //during peak hours pollingRate is 3x faster than during off hours
    //PEAKS: 9-12 4-9
  }

  private isPeak(): boolean {
    const h = new Date().getHours();
    if (h >= 9 && h <= 12) return true;
    if (h >= 16 && h <= 21) return true;
    return false;
  }

  //function for launching an instance
  private async launchInstance(b: WithId<Document>) {
    const i = new Instance(b, InstanceManager.maxClickCount);

    i.spawn();

    i.on((e) => this.handleInstanceEvent(e, i));

    this._instances.push(i);

    //ADD ALIVE TAG TO INSTANCE and set launchedAt
    const coll = this._db.collection("ActiveBookings");
    if (b.launchedAt === undefined) {
      b.searchesLeft = InstanceManager.maxClickCount;
      await coll.updateOne({ _id: b._id }, { $set: { isAlive: true, launchedAt: new Date() } });
      return;
    } else {
      if (date.subtract(new Date(), b.launchedAt).toHours() >= 24) {
        await coll.updateOne(
          { _id: b._id },
          {
            $set: {
              isAlive: true,
              launchedAt: new Date(),
              searchesLeft: InstanceManager.maxClickCount,
            },
          },
        );
        b.searchesLeft = InstanceManager.maxClickCount;
        return;
      }
      await coll.updateOne({ _id: b._id }, { $set: { isAlive: true } });
    }
  }

  //MAKE SURE TO REMOVE ALIVE TAG FROM INSTANCE WHEN IT IS REMOVED

  private availabilityLocationCrossover(a: Availability[], instances: Instance[]): Instance[] {
    let matchedInstances: Instance[] = [];
    instances.map((q) => {
      const iBooking = q.getBooking();
      const preferences = iBooking.locationPreferences;
      for (let x = 0; x < preferences.length, x++; ) {
        for (let y = 0; y < a.length, y++; ) {
          if (preferences[x] === a[y].loc) {
            matchedInstances.push(q);
            return;
          }
        }
      }
    });

    return matchedInstances;
  }

  private handleInstanceEvent(e: InstanceEvent, i: Instance) {
    switch (e.type) {
      case InstanceEventType.SEARCHES_LEFT:
        i.getBooking().searchesLeft = e.data.count;
        return;
      case InstanceEventType.BOOKED:
        this.onInstanceBooked(i, e.data.date);
        return;
      case InstanceEventType.ERROR:
        this.createBookingError(i.getBooking(), e.data.message);
        this.removeInstance(i);
        return;
      case InstanceEventType.BOOKING_INFO:
        //process booking info and change instance modes accordingly
        const availabilities = e.data.a;
        const locCrossOver = this.availabilityLocationCrossover(availabilities, this._instances);
        if (locCrossOver.length === 0) return;
        const dateCrossOver = this.availabilityDateCrossover(availabilities, locCrossOver);
        if (dateCrossOver.length === 0) return;
        dateCrossOver.map((i: Instance) =>
          i.setMode(InstanceMode.BOOKING, InstanceManager.BOOKING_POLLRATE),
        );
        return;
      case InstanceEventType.OUT_OF_SEARCHES:
        this.removeInstance(i);
        this.setSearchLimitReached(i.getBooking());
        return;
      case InstanceEventType.READY:
        //set instances mode to pre determined mode on the instance object
        const m = this.determineMode(i);
        i.setMode(m.mode, m.pollRate);
        return;
      case InstanceEventType.SESSION_ENDED:
        //maybe add some extra error checking here in some time
        return;
      case InstanceEventType.SEARCH_LIMIT_REACHED:
        //set process to waiting mode
        i.setMode(InstanceMode.WAITING, InstanceManager.WAITING_POLLRATE);
        this.setSearchLimitReached(i.getBooking());
        return;
    }
  }

  private setSearchLimitReached(b: WithId<Document>) {
    this._db
      .collection("ActiveBookings")
      .updateOne({ _id: b._id }, { $set: { reachedLimit: new Date() } });
  }

  private availabilityDateCrossover(a: Availability[], instances: Instance[]): Instance[] {
    let matchedInstances: Instance[] = [];
    instances.map((q) => {
      const b = q.getBooking();
      for (let i = 0; i < a.length; i++) {
        //check if above lower date
        if (date.subtract(a[i].date, b.dateBottom).toDays() < 0) return;

        //check if below upper date
        if (date.subtract(b.dateTop, a[i].date).toDays() < 0) return;

        matchedInstances.push(q);
      }
    });

    return matchedInstances;
  }

  //instance auto restarter after set period LATER

  //function for killing an instance
  private removeInstance(i: Instance) {
    if (i.kill()) {
      this._instances.splice(this._instances.indexOf(i), 1);
    } else {
      console.error("FAILED TO KILL INSTANCE:");
      console.error(i);
    }

    //set alive tag to false
    this._db
      .collection("ActiveBookings")
      .updateOne({ _id: i.getBooking()._id }, { $set: { isAlive: false } });
  }

  //function for telling an instance to book a specific date
  private onInstanceBooked(i: Instance, date: string) {
    this.removeInstance(i);
    this.setToBooked(i.getBooking(), date);
  }

  private async setToBooked(b: WithId<Document>, date: string) {
    try {
      const realB = await this._db.collection("ActiveBookings").findOne({ _id: b._id });
      if (realB === null) {
        console.error("ERROR while setting instance to booked");
        return;
      }
      this._db.collection("ActiveBookings").deleteOne({ _id: b._id });
      realB.isAlive = false;
      this._db.collection("InactiveBookings").insertOne({ realB, dateBooked: date });
    } catch (err) {
      console.error("ERROR while setting instance to booked");
      console.error(err);
    }
  }

  //updates current instance data onto mongodb database
  private async updateInstanceData() {
    const coll = this._db.collection("ActiveBookings");
    this._instances.map(async (i) => {
      const b = i.getBooking();
      await coll.updateOne({ _id: b._id }, { $set: { searchesLeft: b.searchesLeft } });
    });
  }

  //runs every ... minutes set by dbPollRate
  private async beginPollingDb() {
    this.updateInstanceData();
    this._totalBookings = await this.getTotalBookings();
    this._pollingRate = this.getPollingRate();
    this.setSearching();
    if (this._instances.length < InstanceManager.maxLiveBookings) {
      const count = InstanceManager.maxLiveBookings - this._instances.length;
      const priorityBookings = await this.findNewBooking(count);
      priorityBookings.map((b) => {
        this.launchInstance(b);
      });

      //log stats
      info("Polled DB");
      info(`Total Bookings: ${this._totalBookings}`);
      info(`Alive Bookings:`);
      this._instances.map((i) => console.log(i.getBooking()));
      info(`Live Polling Rate: ${this._pollingRate / 1000}s`);
    }

    await this.delay(InstanceManager.dbPollRate);
    this.beginPollingDb(); //recursion
  }

  private determineMode(ins: Instance): { mode: InstanceMode; pollRate: number } {
    //loop through instances and check if any are in search state, if so return
    //if not find a new instance to search
    for (let i = 0; i < this._instances.length; i++) {
      if (this._instances[i]._mode === InstanceMode.SEARCHING)
        return { mode: InstanceMode.WAITING, pollRate: InstanceManager.WAITING_POLLRATE };
    }

    //executes if no instance is currently searching
    for (let i = 0; i < this._instances.length; i++) {
      const reachedLimit = this._instances[i].getBooking().reachedLimit;
      if (reachedLimit === undefined) {
        return { mode: InstanceMode.SEARCHING, pollRate: this._pollingRate };
      }
      if (date.subtract(new Date(), reachedLimit).toHours() > 24) {
        return { mode: InstanceMode.SEARCHING, pollRate: this._pollingRate };
      }
    }

    console.error("Error determining instance mode");
    return { mode: InstanceMode.SEARCHING, pollRate: this._pollingRate };
  }

  //checks to see if an instance is currently in search mode, if not then it sets one to search mode
  private setSearching() {
    //loop through instances and check if any are in search state, if so return
    //if not find a new instance to search
    for (let i = 0; i < this._instances.length; i++) {
      if (this._instances[i]._mode === InstanceMode.SEARCHING) return;
    }

    //executes if no instance is currently searching
    for (let i = 0; i < this._instances.length; i++) {
      const reachedLimit = this._instances[i].getBooking().reachedLimit;
      if (reachedLimit === undefined) {
        this._instances[i].setMode(InstanceMode.SEARCHING, this._pollingRate);
        return;
      }
      if (date.subtract(new Date(), reachedLimit).toHours() > 24) {
        this._instances[i].setMode(InstanceMode.SEARCHING, this._pollingRate);
        return;
      }
    }
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
//definition of instance communication codes
//definition of instance state codes
