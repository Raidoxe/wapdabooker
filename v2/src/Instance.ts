import { ChildProcess, fork } from "child_process";
import fsp from "node:fs/promises";
import fs from "fs";
import { InstanceEvent, InstanceEventType, InstanceMode } from "./Types";
import { WithId, Document } from "mongodb";
import date from "date-and-time";

//layer to interact with instances
export default class Instance {
  //booking that is linked to instance
  private _booking: WithId<Document>;
  //spawned process itself
  private _process: ChildProcess | undefined;
  //event listeners
  private _listeners: Array<(e: InstanceEvent) => void> = [];

  public _mode: InstanceMode | undefined;

  private readonly _logFilePath: string;

  private _maxClicks: number;

  //constructor
  constructor(booking: WithId<Document>, maxClicks: number) {
    this._booking = booking;
    this._logFilePath = `./dist/logs/${booking.licenceNum}.txt`;
    this._maxClicks = maxClicks;
  }

  public spawn() {
    //launch process
    const proc = fork("./dist/BotController.js", this.getArgs());

    proc.on("error", async (err: string) => {
      //log error
      this.writeToFile("ERROR", err);

      //restart process
      this.spawn();
    });

    proc.on("message", async (msg: InstanceEvent) => {
      //invoke message listener
      this.handleInstanceEvent(msg);

      //log message
      this.writeToFile(
        "MSG",
        `Type: ${InstanceEventType[msg.type]}, Data: ${JSON.stringify(msg.data)}`,
      );
    });

    this._process = proc;
  }

  private async writeToFile(msgType: "MSG" | "ERROR", data: string) {
    try {
      const isFile = fs.existsSync(this._logFilePath);
      if (isFile === false) await fsp.writeFile(this._logFilePath, "");
      const fh = await fsp.open(this._logFilePath, "a");
      await fh.write(`\n${msgType}:\n${data}`);
      await fh.close();
    } catch (e) {
      console.error("Error while writing data to log file", e);
    }
  }

  private getArgs(): string[] {
    if (this._booking.searchesLeft === undefined) this._booking.searchesLeft = 1000;
    let arr = [
      `--firstName="${this._booking.firstName}"`,
      `--lastName="${this._booking.lastName}"`,
      `--licenceNum=${this._booking.licenceNum}`,
      `--expiryDate="${this._booking.expiryDate}"`,
      `--dateOfBirth="${this._booking.dateOfBirth}"`,
      `--dateBottom="${date.format(this._booking.dateBottom, "DD/MM/YYYY")}"`,
      `--dateTop="${date.format(this._booking.dateTop, "DD/MM/YYYY")}"`,
      `--searchesLeft=${this._booking.searchesLeft}`,
      `--maxClicks=${this._maxClicks}`,
    ];

    for (let i = 0; i < this._booking.locationPreferences.length; i++) {
      arr.push(`--pref${i + 1}="${this._booking.locationPreferences[i]}"`); //will return something like pref1=KELM, pref2=CAN ect
    }

    return arr;
  }

  private handleInstanceEvent(e: InstanceEvent) {
    this._listeners.map((l) => {
      l(e);
    });
  }

  public on(listener: (e: InstanceEvent) => void): void {
    this._listeners.push(listener);
  }

  public kill(): boolean {
    if (this._process === undefined) {
      return false;
    }

    return this._process.send({ newMode: "KILL" });
  }

  public async setMode(m: InstanceMode, pollingRate?: number): Promise<boolean> {
    const res = new Promise<boolean>((result) => {
      if (this._process === undefined) {
        result(false);
        return;
      }
      this._mode = m;
      this._process.send({ newMode: m, pollingRate: pollingRate }, (r) => {
        if (r === null) {
          result(true);
        } else {
          result(false);
        }
      });
    });
    return res;
  }

  public getBooking(): WithId<Document> {
    return this._booking;
  }
  //getters, all instance variables are readonly

  //add process error handler
}
