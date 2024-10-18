import { Mongoose } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MONGO-DB

export class MongooConnection {
  static mongoose = new Mongoose();

  static verifyConnection() {
    MongooConnection.mongoose.connection.on('error', console.error.bind(console, 'connection error:'));
    MongooConnection.mongoose.connection.once('open', () => {
        console.log('Database connected');
    });
    return MongooConnection.mongoose.connection.readyState;
  }

  static async makeConnection() {
    if (MongooConnection.verifyConnection() === 1)
      return MongooConnection.mongoose

    await MongooConnection.mongoose.connect(process.env.MONGOOSE_URI as string);
    return MongooConnection.mongoose
  }

  static async destroy() {
    const connection = this.makeConnection();
    (await connection).disconnect()
  }
}
