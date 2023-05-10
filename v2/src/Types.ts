import { ObjectId } from "mongodb";

export type Location =
  | "CAN"
  | "JNP"
  | "KELM"
  | "ROCK"
  | "SUC"
  | "MBK"
  | "MID"
  | "CTYW"
  | "MDH"
  | "ALB"
  | "AUGO"
  | "AUSO"
  | "BEVO"
  | "BODO"
  | "BOYO"
  | "BRIO"
  | "BBKO"
  | "BRM"
  | "BRUO"
  | "BNY"
  | "BSNDT"
  | "CMHO"
  | "CAR"
  | "CLLE"
  | "CRWO"
  | "CORO"
  | "CBKO"
  | "CCRO"
  | "DALO"
  | "SBYO"
  | "DENO"
  | "DERO"
  | "DCRO"
  | "DOWO"
  | "ESPDP"
  | "EXM"
  | "FIZO"
  | "GTE"
  | "GGNO"
  | "GNWO"
  | "GOOO"
  | "HALO"
  | "HARO"
  | "HOPO"
  | "JERO"
  | "DCBO"
  | "BLD"
  | "KMBO"
  | "KAMO"
  | "KAR"
  | "KATO"
  | "KELO"
  | "KOJO"
  | "KONO"
  | "KORO"
  | "KBBO"
  | "KUN"
  | "LGCO"
  | "LAVO"
  | "LEEO"
  | "LEIP"
  | "MJCO"
  | "MGTO"
  | "KALO"
  | "MCRO"
  | "MERO"
  | "MIGO"
  | "MOOE"
  | "MOWO"
  | "PLAO"
  | "MMAO"
  | "MUKO"
  | "MULO"
  | "NANO"
  | "NMBO"
  | "NGNO"
  | "NEW"
  | "DNDO"
  | "NORO"
  | "NTHO"
  | "ONS"
  | "PANP"
  | "PAR"
  | "PGYO"
  | "QDGO"
  | "RAVO"
  | "ROE"
  | "SHD"
  | "YILO"
  | "TAMO"
  | "TSPO"
  | "TOM"
  | "TBBO"
  | "TRYO"
  | "WAGO"
  | "WARO"
  | "WLMO"
  | "WONO"
  | "WYCO"
  | "WYNO"
  | "YLGO"
  | "YORO"
  | "ANY";

export const MetroLocations = ["CAN", "JNP", "KELM", "ROCK", "SUC", "MBK", "MID", "CTYW", "MDH"];

export const LocationList: Array<string> = [
  "CAN",
  "JNP",
  "KELM",
  "ROCK",
  "SUC",
  "MBK",
  "MID",
  "CTYW",
  "MDH",
  "ALB",
  "AUGO",
  "AUSO",
  "BEVO",
  "BODO",
  "BOYO",
  "BRIO",
  "BBKO",
  "BRM",
  "BRUO",
  "BNY",
  "BSNDT",
  "CMHO",
  "CAR",
  "CLLE",
  "CRWO",
  "CORO",
  "CBKO",
  "CCRO",
  "DALO",
  "SBYO",
  "DENO",
  "DERO",
  "DCRO",
  "DOWO",
  "ESPDP",
  "EXM",
  "FIZO",
  "GTE",
  "GGNO",
  "GNWO",
  "GOOO",
  "HALO",
  "HARO",
  "HOPO",
  "JERO",
  "DCBO",
  "BLD",
  "KMBO",
  "KAMO",
  "KAR",
  "KATO",
  "KELO",
  "KOJO",
  "KONO",
  "KORO",
  "KBBO",
  "KUN",
  "LGCO",
  "LAVO",
  "LEEO",
  "LEIP",
  "MJCO",
  "MGTO",
  "KALO",
  "MCRO",
  "MERO",
  "MIGO",
  "MOOE",
  "MOWO",
  "PLAO",
  "MMAO",
  "MUKO",
  "MULO",
  "NANO",
  "NMBO",
  "NGNO",
  "NEW",
  "DNDO",
  "NORO",
  "NTHO",
  "ONS",
  "PANP",
  "PAR",
  "PGYO",
  "QDGO",
  "RAVO",
  "ROE",
  "SHD",
  "YILO",
  "TAMO",
  "TSPO",
  "TOM",
  "TBBO",
  "TRYO",
  "WAGO",
  "WARO",
  "WLMO",
  "WONO",
  "WYCO",
  "WYNO",
  "YLGO",
  "YORO",
  "ANY",
];

export type InstanceEvent = { type: InstanceEventType; data: any };

export enum InstanceEventType {
  BOOKED,
  ERROR,
  BOOKING_INFO,
  OUT_OF_SEARCHES,
  SESSION_ENDED,
  SEARCH_LIMIT_REACHED,
  READY,
  SEARCHES_LEFT,
}

export type Booking = {
  firstName: string;
  lastName: string;
  licenceNum: string;
  expiryDate: string;
  dateOfBirth: string;
  locationPreferences: Array<string>;
  dateBottom: Date;
  dateTop: Date;
  isAlive: boolean;
  dateAdded: Date;
  _id: ObjectId;
};

export type State = "Active" | "Inactive";

export type BookingInput = {
  firstName: string;
  lastName: string;
  licenceNum: string;
  expiryDate: string;
  dateOfBirth: string;
  locationPreferences: Array<string>;
  dateBottom: string;
  dateTop: string;
};

export type names = {
  firstName: string;
  lastName: string;
};

export enum InstanceMode {
  BOOKING, //actively booking
  SEARCHING,
  WAITING,
}

export enum BotState {
  STARTING,
  ACTIVE,
  IDLE,
}

export type Availability = {
  date: Date;
  loc: string;
};

export type InstanceMessage = {
  newMode: InstanceMode | "KILL";
  pollingRate: number;
};
