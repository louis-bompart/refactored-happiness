import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { get } from "./Utils";
import { UserInfoCard } from "bungie-api-ts/user/interfaces";
import { BungieMembershipType } from "bungie-api-ts/common";

const CONFIG_FOLDER_NAME = "ghost-discord";
const CONFIG_FILE_NAME = "config.json";
const CONFIG_FILE_PATH = path.join(
  os.homedir(),
  CONFIG_FOLDER_NAME,
  CONFIG_FILE_NAME
);

function hasConfigFile() {
  try {
    fs.accessSync(CONFIG_FILE_PATH, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function generateConfig(): ConfigFile {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const configFile: ConfigFile = {
    platform: undefined,
    playerId: undefined,
    apiKey: undefined
  };

  while (!configFile.platform) {
    rl.question(
      `On which platform do you play?
    Accepted answers: pc, playstation, xbox`,
      answer => {
        answer.trim().toLowerCase();
        switch (answer) {
          case "pc":
            configFile.platform = BungieMembershipType.TigerBlizzard;
            break;
          case "playstation":
            configFile.platform = BungieMembershipType.TigerPsn;
            break;
          case "xbox":
            configFile.platform = BungieMembershipType.TigerXbox;
          default:
            break;
        }
      }
    );
  }

  while (!configFile.playerId) {
    rl.question(
      "What is your BattleTag/PlaystationID/Gamertag?",
      async answer => {
        let playerIdsResponse = await get(
          {
            uri: `/Destiny2/SearchDestinyPlayer/${
              BungieMembershipType.All
            }/${answer}`
          },
          configFile.apiKey
        );
        if (
          playerIdsResponse.Response &&
          playerIdsResponse.Response.length > 0
        ) {
          configFile.playerId = playerIdsResponse.Response[0].membershipId;
          configFile.platform = playerIdsResponse.Response[0].membershipType;
        }
      }
    );
  }
  rl.close();
  return configFile;
}

function getConfig(): ConfigFile {
  if (hasConfigFile()) {
    const configFile = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH).toString());
    if (isConfigFile(configFile)) {
      return configFile;
    }
    fs.unlinkSync(CONFIG_FILE_PATH);
  }
  const configFile = generateConfig();
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(configFile));
  return configFile;
}

export interface ConfigFile {
  platform: BungieMembershipType;
  playerId: string;
  apiKey: string;
}

function isConfigFile(obj: any): obj is ConfigFile {
  if (!obj.playerId || !obj.apiKey) {
    return false;
  }
  return isValidPlatform(obj.platform);
}

function isValidPlatform(
  platform: string
): platform is "pc" | "xbox" | "playstation" {
  return platform !== "pc" && platform !== "xbox" && platform !== "playstation";
}

function start() {
  const config = getConfig();
}

console.log(hasConfigFile());
