import { System, DefaultSystem } from "./System";
import https from "https";
import request from "request-promise-native";
import fs from "fs";
import crypto from "crypto";
import open from "open";

import bungieApplicationSecrets from "../config/bungieApp.json";

class NoOAuthCodeReceivedError extends Error {
  public constructor(message: string) {
    super(message);
  }
}

class BadOAuthStateReceived extends Error {
  public constructor() {
    super();
  }
}

export class OAuthClient {
  public static System: System = DefaultSystem;
  public static async getAuthorizationCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        key: fs.readFileSync("localhost.key"),
        cert: fs.readFileSync("localhost.csr"),
        ca: fs.readFileSync("rootCA.key")
      };
      const state = crypto.randomBytes(16).toString("hex");
      const server = https
        .createServer(options, function(req, res) {
          const redirectUrl = new URL(`https://localhost${req.url}`);
          if (redirectUrl.pathname === "/") {
            if (redirectUrl.searchParams.get("state") !== state) {
              reject(new BadOAuthStateReceived());
            }
            if (!redirectUrl.searchParams.get("code")) {
              let data = "";
              req.setEncoding("utf8");
              req.on("data", chunk => (data += chunk));
              req.on("end", () => {
                reject(new NoOAuthCodeReceivedError(data));
              });
            }
            res.writeHead(200);
            res.end("All good!");
            const code = redirectUrl.searchParams.get("code");
            server.close(() => {
              resolve(code);
            });
          }
          if (redirectUrl.pathname === "/favicon.ico") {
            res.writeHead(200);
            res.end(fs.readFileSync("config/favicon.ico"));
          }
        })
        .listen(8000);
      const authorizeUrl = new URL("https://www.bungie.net/en/OAuth/Authorize");
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("client_id", bungieApplicationSecrets.clientId);
      open(authorizeUrl.toString());
    });
  }

  public static async getAccessToken(authorizationCode: string): Promise<Record<string, string>> {
    const accessTokenUrl = new URL("https://www.bungie.net/platform/app/oauth/token/");
    const authorizationHeader = `Basic ${Buffer.from(
      `${bungieApplicationSecrets.clientId}:${bungieApplicationSecrets.clientSecret}`
    ).toString("base64")}`;
    return request(accessTokenUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authorizationHeader
      },
      form: { grant_type: "authorization_code", code: authorizationCode }, // eslint-disable-line @typescript-eslint/camelcase
      json: true
    });
  }
}
(async function() {
  const authCode = await OAuthClient.getAuthorizationCode();
  const accessToken = await OAuthClient.getAccessToken(authCode);
  console.log(JSON.stringify(accessToken));
})();
