import { expect, use } from "chai";
import Sinon from "sinon";
use(require("sinon-chai"));

import { Database } from "../src/Database";
import * as Utils from "../src/Utils";
import request, { RequestPromise } from "request-promise-native";
import { ServerResponse, PlatformErrorCodes } from "bungie-api-ts/common";
import { DestinyManifest } from "bungie-api-ts/destiny2";
import * as fs from "fs";
import * as path from "path";
import jszip from "jszip";
import SQLite3 from "better-sqlite3";

describe("Database", () => {
  const sandbox = Sinon.createSandbox();
  let requestGetStub: Sinon.SinonStub;
  let getFromBungieStub: Sinon.SinonStub;
  let createHierarchyIfNeededStub: Sinon.SinonStub;
  let jsZipLoadAsyncStub: Sinon.SinonStub;
  let sqliteFakeConstructor: Sinon.SinonSpy;
  let latestSqliteDatabaseStub: Sinon.SinonStubbedInstance<SQLite3.Database>;

  before(() => {
    requestGetStub = sandbox.stub(request, "get");
    getFromBungieStub = sandbox.stub(Utils, "getFromBungie");
    createHierarchyIfNeededStub = sandbox.stub(Utils, "createHierarchyIfNeeded");
    jsZipLoadAsyncStub = sandbox.stub(jszip.prototype, "loadAsync");
    sqliteFakeConstructor = Sinon.fake(() => {
      latestSqliteDatabaseStub = sandbox.createStubInstance(SQLite3);
      return latestSqliteDatabaseStub;
    });
    Database.DatabaseDriver = sqliteFakeConstructor;
    Database.System.fs = {
      ...fs,
      createWriteStream: sandbox.stub(fs, "createWriteStream"),
      statSync: sandbox.stub(fs, "statSync").returns(new fs.Stats()),
      accessSync: sandbox.stub(fs, "accessSync"),
      readdirSync: (sandbox.stub(fs, "readdirSync") as unknown) as typeof fs.readdirSync,
      writeFileSync: sandbox.stub(fs, "writeFileSync"),
      unlinkSync: sandbox.stub(fs, "unlinkSync")
    };
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe("getInstance", () => {
    const fakeDatabaseUri = "/path/dir/file.ext";

    const manifestResponse: ServerResponse<DestinyManifest> = {
      ErrorCode: PlatformErrorCodes.Success,
      ErrorStatus: "OK",
      Message: "OK",
      MessageData: {},
      ThrottleSeconds: 0,
      Response: {
        iconImagePyramidInfo: [],
        jsonWorldContentPaths: {},
        mobileAssetContentPath: "aPath",
        mobileClanBannerDatabasePath: "aPath",
        mobileGearAssetDataBases: [],
        version: "1.0.0",
        mobileGearCDN: {},
        mobileWorldContentPaths: {
          en: fakeDatabaseUri
        }
      }
    };

    beforeEach(() => {
      getFromBungieStub.returns(manifestResponse);
    });

    it("should get the manifest no matter what", async () => {
      try {
        await Database.getInstance("database/path", "apikey");
      } catch (e) {
      } finally {
        expect(getFromBungieStub).to.be.calledWith({ uri: "Destiny2/Manifest/" }, "apikey");
      }
    });

    context("when the database is not cached", () => {
      let writeStreamOnFake: Sinon.SinonSpy;
      beforeEach(() => {
        writeStreamOnFake = Sinon.fake(function(event: string, callback: Function): void {
          callback();
        });
        (Database.System.fs.statSync as Sinon.SinonStub).throws("EONENT");
        (Database.System.fs.readdirSync as Sinon.SinonStub).returns([]);
        (Database.System.fs.createWriteStream as Sinon.SinonStub).returns({ on: writeStreamOnFake });
        jsZipLoadAsyncStub.returns({
          files: {
            "file.ext": {
              nodeStream: () => {
                return {
                  pipe: sandbox.spy()
                };
              }
            }
          }
        });
      });

      it("should download it", async () => {
        await Database.getInstance("database/path", "apikey");

        expect(getFromBungieStub).to.be.calledWith({ uri: "Destiny2/Manifest/" }, "apikey");
        expect(requestGetStub).to.be.calledWith(`https://Bungie.net${fakeDatabaseUri}`, { encoding: null });
        expect(jsZipLoadAsyncStub).to.be.called;
        expect(createHierarchyIfNeededStub).to.calledWith(Sinon.match.any, "database/path");
        expect(Database.System.fs.createWriteStream as Sinon.SinonStub).to.be.calledWith(
          path.join("database/path", "file.ext")
        );
        expect(sqliteFakeConstructor).to.be.calledWith(path.join("database/path", "file.ext"));
      });
    });

    context("when the database is cached but deprecated", () => {
      it("should delete the deprecated version and download the most recent one");
    });

    context("when the database is cached and up-to-date", () => {
      it("should use the cache");
    });
  });

  describe("getFromDatabase", () => {
    it("call sqlite with the proper argument and it should parse the response accordingly");
  });
});
