import { Mongoose } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      ticker?: string;
    }
  }

  mongoose: Mongoose | undefined;
}


export {  RequestType  };
