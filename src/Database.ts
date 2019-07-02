import { System, DefaultSystem } from "./System";
import { getFromBungie, createHierarchyIfNeeded } from "./Utils";
import { DestinyManifest, ServerResponse, PlatformErrorCodes } from "bungie-api-ts/destiny2";
import { get } from "request-promise-native";
import jszip from "jszip";
import sqlite3 from "better-sqlite3";
const JSZip = new jszip();

const LOCALE = "en";

export class Database {
  public static System: System = DefaultSystem;
  public static instance: Database;

  private databasePath: string;
  private databaseName: string;
  private apiKey: string;
  private sqlDatabase: sqlite3.Database;

  private constructor(databasePath: string, apiKey: string) {
    this.databasePath = databasePath;
    this.apiKey = apiKey;
  }

  private openDatabase(): void {
    this.sqlDatabase = sqlite3(
      Database.System.path.join(this.databasePath, Database.System.path.parse(this.databaseName).base)
    );
  }

  public getFromDatabase<T>(table: string, hash: number): T {
    const query = this.sqlDatabase.prepare(`SELECT json FROM ${table} WHERE id=?`).get(hash | 0);
    return JSON.parse(query.json) as T;
  }

  private async initialize(): Promise<void> {
    this.databaseName = await this.getDatabaseName();
    if (!this.isCached()) {
      await this.getFromAPI();
    }
    this.openDatabase();
  }

  public static async getDatabase(databasePath: string, apiKey: string): Promise<Database> {
    Database.instance = new Database(databasePath, apiKey);
    await Database.instance.initialize();
    return Database.instance;
  }

  private isCached(): boolean {
    try {
      Database.System.fs.statSync(this.databasePath);
      return Database.System.fs.readdirSync(this.databasePath).some(() => this.databaseName);
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

  private async getFromAPI(): Promise<void> {
    const databaseName = await this.getDatabaseName();

    const databaseFileName = Database.System.path.parse(databaseName).base;

    const rawZip = await get(`https://Bungie.net${databaseName}`, { encoding: null });
    const zipFile = await JSZip.loadAsync(rawZip);
    const databaseFile = zipFile.files[databaseFileName];

    createHierarchyIfNeeded(Database.System, this.databasePath);

    if (this.isWritable()) {
      Database.System.fs.readdirSync(this.databasePath).forEach(file => {
        try {
          Database.System.fs.unlinkSync(Database.System.path.join(this.databasePath, file));
        } catch (error) {
          // Wer're doing our best effort to clean the old files, but that's not critical either.
          console.warn(error);
        }
      });
      return this.writeDatabaseFile(databaseFile, databaseFileName);
    }
  }

  private async getDatabaseName(): Promise<string> {
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
    return manifest.mobileWorldContentPaths[LOCALE];
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
