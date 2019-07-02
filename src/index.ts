/* istanbul ignore file: only a basic runner for now, it'll be scrapped */
import { ConfigFile } from "./Config";
import { getFromBungie } from "./Utils";
import { DiscordRPC } from "./DiscordRPC";
import { Database } from "./Database";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";
import {
  DestinyComponentType,
  ServerResponse,
  DestinyCharacterActivitiesComponent,
  PlatformErrorCodes,
  DestinyActivityDefinition,
  DestinyActivityModeDefinition,
  DestinyPlaceDefinition,
  DestinyCharacterComponent,
  DestinyClassDefinition
} from "bungie-api-ts/destiny2";

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

(async function() {
  const config = await ConfigFile.getExistingConfig();
  const database = await Database.getInstance(path.join(os.homedir(), "discord-ghost", "data"), config.data.apiKey);
  const rpc = await DiscordRPC.getInstance();

  setInterval(async () => {
    const response = await getFromBungie<ServerResponse<DestinyCharacterActivitiesComponentResponse>>(
      {
        uri: `Destiny2/${config.data.platform}/Profile/${config.data.playerId}`,
        components: [DestinyComponentType.CharacterActivities, DestinyComponentType.Characters]
      },
      config.data.apiKey
    );
    if (response.ErrorCode !== PlatformErrorCodes.Success) {
      // TODO
    }
    let currentCharacterId: string;
    Object.keys(response.Response.characterActivities.data).forEach(characterId => {
      if (response.Response.characterActivities.data[characterId].currentActivityHash) {
        currentCharacterId = characterId;
      }
    });
    const currentActivity = database.getFromDatabase<DestinyActivityDefinition>(
      "DestinyActivityDefinition",
      response.Response.characterActivities.data[currentCharacterId].currentActivityHash
    );

    let additionalInfos;

    if (currentActivity.directActivityModeHash) {
      const activityMode = database.getFromDatabase<DestinyActivityModeDefinition>(
        "DestinyActivityModeDefinition",
        currentActivity.directActivityModeHash
      );
      additionalInfos = activityMode;
    } else {
      const destination = database.getFromDatabase<DestinyPlaceDefinition>(
        "DestinyPlaceDefinition",
        currentActivity.placeHash
      );
      additionalInfos = destination;
    }

    const smallImageKey = path.parse(additionalInfos.displayProperties.icon).name;
    const currentCharacterData = response.Response.characters.data[currentCharacterId];
    const currentCharacterRace = database.getFromDatabase<DestinyClassDefinition>(
      "DestinyClassDefinition",
      currentCharacterData.classHash
    );

    rpc.setActivity({
      state: currentActivity.displayProperties.description ? currentActivity.displayProperties.description : "  ",
      details: `${additionalInfos.displayProperties.name}`,
      largeImageKey: currentActivity.pgcrImage
        ? createHash("md5")
            .update(path.parse(currentActivity.pgcrImage).name)
            .digest("hex")
        : "default_large",
      largeImageText: currentActivity.displayProperties.name,
      smallImageKey: smallImageKey.substr(smallImageKey.indexOf("_") + 1),
      smallImageText: `${currentCharacterRace.displayProperties.name} - ${currentCharacterData.light}`,
      startTimestamp: Date.parse(response.Response.characterActivities.data[currentCharacterId].dateActivityStarted)
    });
  }, 15e3);
})();
