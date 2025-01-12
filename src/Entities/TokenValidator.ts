// import axios from "axios";
// import { configDotenv } from "dotenv";
// import { ResponseProps } from "../types/responses.type";
// import { Transaction } from "../interfaces/TransactionProtocol";
// import { UserProps } from "../types/UserProps";
// import env from "../env";

// 

// export class TokenValidator {

//   static async getUser(token: string) {
//     const response = await axios.post(`${env}/token/user`, {
//       authorization: process.env.SECRET_TOKEN,
//       token
//     })

//     const data: ResponseProps<UserProps>= response.data;

//     if(!data.data) throw new Error("Error Getting User Data");
//     return data.data;
//   }
// }
