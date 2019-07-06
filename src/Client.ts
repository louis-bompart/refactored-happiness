/* istanbul ignore file: techdebt, todo */

import { Database } from "./Database";
import { ConfigFile } from "./Config";
import { DiscordRPC } from "./DiscordRPC";
import { Presence } from "discord-rpc";
import {
  DestinyComponentType,
  DestinyCharacterActivitiesComponent,
  DestinyCharacterComponent,
  DestinyActivityDefinition,
  DestinyActivityModeDefinition,
  DestinyPlaceDefinition,
  DestinyClassDefinition
} from "bungie-api-ts/destiny2/interfaces";
import { getFromBungie } from "./Utils";
import { ServerResponse, PlatformErrorCodes } from "bungie-api-ts/common";
import { createHash } from "crypto";
import { System, DefaultSystem } from "./System";
import { clearInterval } from "timers";

interface CharacterComponentsData<T> {
  [characterId: string]: T;
}
interface CharacterComponentsDataWrapper<T> {
  data: CharacterComponentsData<T>;
}

interface DestinyCharacterActivitiesComponentResponse {
  characterActivities: CharacterComponentsDataWrapper<DestinyCharacterActivitiesComponent>;
  characters: CharacterComponentsDataWrapper<DestinyCharacterComponent>;
}

const PLACE_ORBIT = 2961497387;
const ACTIVITY_TYPE_FORGE = 838603889;

export class Client {
  public static System: System = DefaultSystem;

  private interval: NodeJS.Timeout;

  private database: Database;
  private configFile: ConfigFile;
  private discordRpc: DiscordRPC;
  private refreshRate: number;

  private lastActivity: number;

  public constructor(
    database: Database,
    configFile: ConfigFile,
    discordRpc: DiscordRPC,
    refreshRate: number = 10e3,
    startNow: boolean = true
  ) {
    this.database = database;
    this.configFile = configFile;
    this.discordRpc = discordRpc;
    this.refreshRate = refreshRate;

    if (startNow) {
      this.start();
    }
  }

  private async getCharacterInformation(): Promise<DestinyCharacterActivitiesComponentResponse> {
    const response = await getFromBungie<ServerResponse<DestinyCharacterActivitiesComponentResponse>>(
      {
        uri: `Destiny2/${this.configFile.data.platform}/Profile/${this.configFile.data.playerId}`,
        components: [DestinyComponentType.CharacterActivities, DestinyComponentType.Characters]
      },
      this.configFile.data.apiKey
    );

    if (response.ErrorCode !== PlatformErrorCodes.Success) {
      // TODO
    }
    return response.Response;
  }

  public start(): void {
    if (!this.interval) {
      console.log("Starting service");
      this.interval = setInterval(async () => {
        let response;
        try {
          response = await this.getCharacterInformation();
        } catch (error) {
          throw error;
        }

        const currentCharacterId = this.getCurrentCharacterId(response);
        if (!currentCharacterId) {
          return this.stop();
        }

        const currentActivityData = response.characterActivities.data[currentCharacterId];
        const currentCharacterData = response.characters.data[currentCharacterId];

        if (currentActivityData.currentActivityHash != this.lastActivity) {
          const activityInfo = this.getActivityInfo(currentActivityData, currentCharacterData);
          console.log(`\nNew activity:\n${activityInfo.details || ""}\n${activityInfo.state}`);
          this.discordRpc.setActivity(activityInfo);
          this.lastActivity = currentActivityData.currentActivityHash;
        }
      }, this.refreshRate);
    }
  }

  private getCurrentCharacterId(response: DestinyCharacterActivitiesComponentResponse): string {
    let currentCharacterId: string;
    if (!response.characterActivities.data) {
      console.warn(
        "No character activities found, try to modify your privacy settings (see https://github.com/brakacai/discord-ghost/docs/PrivacySettings.md)"
      );
    }
    Object.keys(response.characterActivities.data).forEach(characterId => {
      if (this.isCharacterMoreRecent(currentCharacterId, response, characterId)) {
        currentCharacterId = characterId;
      }
    });
    return currentCharacterId;
  }

  private isCharacterMoreRecent(
    currentCharacterId: string,
    response: DestinyCharacterActivitiesComponentResponse,
    characterId: string
  ): boolean {
    return (
      response.characterActivities.data[characterId].currentActivityHash &&
      (!currentCharacterId ||
        new Date(response.characterActivities.data[characterId].dateActivityStarted) >
          new Date(response.characterActivities.data[currentCharacterId].dateActivityStarted))
    );
  }

  public isRunning(): boolean {
    return !!this.interval;
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      console.log("Service stopped");
    }
  }

  private getActivityInfo(
    currentActivityData: DestinyCharacterActivitiesComponent,
    currentCharacterData: DestinyCharacterComponent
  ): Presence {
    let currentActivity = this.database.getFromDatabase<DestinyActivityDefinition>(
      "DestinyActivityDefinition",
      currentActivityData.currentActivityHash
    );

    if (currentActivity.placeHash == PLACE_ORBIT) {
      // Orbit has no additional data to show
      return {
        state: "In Orbit",
        largeImageKey: "default_large",
        largeImageText: "In Orbit",
        startTimestamp: Date.parse(currentActivityData.dateActivityStarted)
      };
    }

    const currentActivityMode = this.database.getFromDatabase<DestinyActivityModeDefinition>(
      "DestinyActivityModeDefinition",
      currentActivityData.currentActivityModeHash
    );

    const currentPlaylist = this.database.getFromDatabase<DestinyActivityDefinition>(
      "DestinyActivityDefinition",
      currentActivityData.currentPlaylistActivityHash
    );

    const currentCharacterRace = this.database.getFromDatabase<DestinyClassDefinition>(
      "DestinyClassDefinition",
      currentCharacterData.classHash
    );

    if (currentActivity.activityTypeHash == ACTIVITY_TYPE_FORGE) {
      /*
       * Forge activity defintions are for some reason rather sparse, but the
       * playlist activity definition has more detail.
       */
      currentActivity = currentPlaylist;
    }

    let detailText;
    if (
      currentPlaylist.displayProperties.name &&
      currentPlaylist.displayProperties.name != currentActivity.displayProperties.name &&
      currentPlaylist.displayProperties.name != currentActivityMode.displayProperties.name
    ) {
      detailText = currentPlaylist.displayProperties.name + " \u2013 " + currentActivityMode.displayProperties.name;
    } else {
      detailText = currentActivityMode.displayProperties.name;
    }
    return {
      state: currentActivity.displayProperties.name,
      details: detailText,
      largeImageKey: this.getLargeImageKey(currentActivity),
      largeImageText: currentActivity.displayProperties.description || currentActivity.displayProperties.name,
      smallImageKey: this.getSmallImageKey(currentActivityMode),
      smallImageText: `${currentCharacterRace.displayProperties.name} \u2013 ${currentCharacterData.light}`,
      startTimestamp: Date.parse(currentActivityData.dateActivityStarted)
    };
  }

  private getSmallImageKey(currentActivityMode: DestinyActivityModeDefinition): string {
    const smallImage = Client.System.path.parse(currentActivityMode.displayProperties.icon).name;
    return smallImage.substr(smallImage.indexOf("_") + 1);
  }

  private getLargeImageKey(currentActivity: DestinyActivityDefinition): string {
    return currentActivity.pgcrImage
      ? createHash("md5")
          .update(Client.System.path.parse(currentActivity.pgcrImage).name)
          .digest("hex")
      : "default_large";
  }
}
