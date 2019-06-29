import { System, DefaultSystem } from "./System";
import { getFromBungie, createHierarchyIfNeeded } from "./Utils";
import { DestinyManifest, ServerResponse, PlatformErrorCodes } from "bungie-api-ts/destiny2";
import { get } from "request-promise-native";
import jszip from "jszip";
const JSZip = new jszip();

const LOCALE = "en";

export class Database {
  public static System: System = DefaultSystem;

  private databasePath: string;
  private apiKey: string;

  public constructor(databasePath: string, apiKey: string) {
    this.databasePath = databasePath;
    this.apiKey = apiKey;
  }

  public async get(): Promise<void> {
    return this.getFromAPI();
  }

  private isLatest(): boolean {
    throw new Error("Method not implemented.");
    try {
    } catch (error) {}
  }

  private isCached(): boolean {
    try {
      Database.System.fs.statSync(this.databasePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  private isWritable(): boolean {
    try {
      Database.System.fs.accessSync(this.databasePath, Database.System.fs.constants.W_OK);
    } catch (error) {
      if (error.code !== "ENOENT") {
        return false;
      }
    }
    return true;
  }

  private getFromCache(): void {
    throw new Error("Method not implemented.");
  }

  private async getFromAPI(): Promise<void> {
    const manifestResponse = await getFromBungie<ServerResponse<DestinyManifest>>(
      { uri: "Destiny2/Manifest/" },
      this.apiKey
    );

    if (manifestResponse.ErrorCode !== PlatformErrorCodes.Success) {
      const error = new Error("Error while getting the manifest");
      error.stack = JSON.stringify(manifestResponse);
      throw error;
    }

    const manifest = manifestResponse.Response;

    const databaseFileName = Database.System.path.parse(manifest.mobileWorldContentPaths[LOCALE]).base;

    const rawZip = await get(`https://Bungie.net${manifest.mobileWorldContentPaths[LOCALE]}`, { encoding: null });
    const zipFile = await JSZip.loadAsync(rawZip);
    const databaseFile = zipFile.files[databaseFileName];

    createHierarchyIfNeeded(Database.System, this.databasePath);

    if (this.isWritable()) {
      return this.writeDatabaseFile(databaseFile, databaseFileName);
    }
  }

  private async writeDatabaseFile(databaseFile: jszip.JSZipObject, databaseFileName: string): Promise<void> {
    return new Promise<void>(resolve => {
      databaseFile.nodeStream().pipe(
        Database.System.fs
          .createWriteStream(Database.System.path.join(this.databasePath, databaseFileName))
          .on("close", () => {
            resolve();
          })
      );
    });
  }
}
