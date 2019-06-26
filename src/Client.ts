import { Client as DiscordClient } from "discord-rpc";
import {
  getProfile,
  BungieMembershipType,
  DestinyCharacterComponent,
  DestinyComponentType,
  DestinyProfileResponse,
  DestinyCharacterActivitiesComponent,
  DestinyActivityModeType
} from "bungie-api-ts/destiny2";
const DISCORD_CLIENT_ID = "593302206661525504";
const REFRESH_RATE = 15e3;
import * as Assert from "assert";
import { ConfigFile } from "./Config";
import { get } from "./Utils";

/**
 * Parse the arg given to the program.
 */
const args = (() => {
  const rawArgs = process.argv.slice(2);
  // ToDo: Create type/interface.
  const processedArgs: any = {};
  for (let index = 0; index < rawArgs.length / 2; index++) {
    const element = rawArgs[index];
    // Check that the args checked up.
    (index % 2 ? Assert.notEqual : Assert.equal).apply(this, [
      element.substr(0, 2),
      "--",
      `Unexpected input: ${element}`
    ]);
    // Extract the key.
    const key = rawArgs[index].substr(2);
    // Check that the key is here just once
    if (processedArgs.hasOwnProperty(key)) {
      throw new Error(`${key} flag have been received twice.`);
    }

    processedArgs[key] = rawArgs[index + 1];
  }
  return processedArgs;
})();

/**
 * An All-in-One client (Discord RPC & Bungie API).
 */
export class Client {
  private static instance: Client;

  static createClient(config: ConfigFile) {
    if (!Client.instance) {
      Client.instance = new Client(config);
    }
    return Client.instance;
  }

  private membershipId: string;
  private membershipType: BungieMembershipType;
  private currentCharacter: DestinyCharacterComponent;
  private apiKey: string;

  private discordClient: DiscordClient;
  private constructor(config: ConfigFile) {
    this.discordClient = new DiscordClient({ transport: "ipc" });
    this.membershipType = config.platform;
    this.membershipId = config.playerId;
    this.apiKey = config.apiKey;
    this.init();
  }

  private handleDiscordClientReady() {
    setInterval(() => {
      console.log("Updated presence");
      // pullNewData(membershipId, membershipType);
      // setActivity();
    }, REFRESH_RATE);
  }

  private async init() {
    const getProfile: DestinyProfileResponse = await get(
      {
        uri: `/Destiny2/${this.membershipType}/Profile/${this.membershipId}`,
        components: [
          DestinyComponentType.Characters,
          DestinyComponentType.CharacterActivities
        ]
      },
      this.apiKey
    );
    const charactersActivitiesData = getProfile.characterActivities.data;
    let currentActivity = {};
    let currentCharacter;
    for (const key in charactersActivitiesData) {
      if (charactersActivitiesData.hasOwnProperty(key)) {
        const characterActivities = charactersActivitiesData[key];
        if (characterActivities.currentActivityHash === 0) {
          continue;
        } else {
          currentActivity = {
            hash: characterActivities.currentActivityHash,
            mode: characterActivities.currentActivityModeTypes.length
              ? characterActivities.currentActivityModeTypes
              : [characterActivities.currentActivityModeType],
            playlist: characterActivities.currentPlaylistActivityHash
          };
          currentCharacter = key;
          break;
        }
      }
    }

    this.discordClient.on("ready", this.handleDiscordClientReady);

    this.discordClient
      .login({ clientId: DISCORD_CLIENT_ID })
      .catch(console.error);
  }
}
