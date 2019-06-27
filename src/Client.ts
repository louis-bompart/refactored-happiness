import { Client as DiscordClient } from "discord-rpc";
import {
  BungieMembershipType,
  DestinyCharacterComponent,
  DestinyComponentType,
  DestinyProfileResponse
} from "bungie-api-ts/destiny2";
const DISCORD_CLIENT_ID = "593302206661525504";
const REFRESH_RATE = 15e3;
import { ConfigFileData } from "./Config";
import { getFromBungie } from "./Utils";

/**
 * An All-in-One client (Discord RPC & Bungie API).
 */
export class Client {
  private static instance: Client;

  public static createClient(config: ConfigFileData): Client {
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
  private constructor(config: ConfigFileData) {
    this.discordClient = new DiscordClient({ transport: "ipc" });
    this.membershipType = config.platform;
    this.membershipId = config.playerId;
    this.apiKey = config.apiKey;
    this.init();
  }

  private handleDiscordClientReady(): void {
    setInterval(() => {
      console.log("Updated presence");
      /*
       * PullNewData(membershipId, membershipType);
       * setActivity();
       */
    }, REFRESH_RATE);
  }

  private async init(): Promise<void> {
    const getProfile: DestinyProfileResponse = (await getFromBungie(
      {
        uri: `/Destiny2/${this.membershipType}/Profile/${this.membershipId}`,
        components: [DestinyComponentType.Characters, DestinyComponentType.CharacterActivities]
      },
      this.apiKey
    )) as DestinyProfileResponse;
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

    this.discordClient.login({ clientId: DISCORD_CLIENT_ID }).catch(console.error);
  }
}
