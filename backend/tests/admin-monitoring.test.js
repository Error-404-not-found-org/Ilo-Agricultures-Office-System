import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Config } from "../src/models/config.model.js";
import { getSystemMonitoringData } from "../src/controllers/admin.controllers.js";

test("Admin Monitoring: getSystemMonitoringData returns correct structure and mock data counts", async () => {
    // Save original methods
    const origUserCount = User.countDocuments;
    const origUserFind = User.find;
    const origAnimalCount = Animal.countDocuments;
    const origAnimalAgg = Animal.aggregate;
    const origInseminationCount = Insemination.countDocuments;
    const origInseminationDistinct = Insemination.distinct;
    const origInseminationAgg = Insemination.aggregate;
    const origPregnancyCount = Pregnancy.countDocuments;
    const origCalvingCount = Calving.countDocuments;
    const origHealthRequestCount = HealthRequest.countDocuments;
    const origHealthRequestAgg = HealthRequest.aggregate;
    const origHealthRequestDistinct = HealthRequest.distinct;
    const origConfigFindOne = Config.findOne;

    // Stubbing User
    User.countDocuments = async (query) => {
        if (query && query.lastLogin) return 2; // online users
        return 10; // total active users
    };
    User.find = () => ({
        lean: () => [{ _id: "farmer1", name: "Farmer Bob", role: "farmer" }]
    });

    // Stubbing Animal
    Animal.countDocuments = async () => 1; // missing animal data count
    Animal.aggregate = async () => [
        { _id: "TAG-1234", count: 2, animals: [] }
    ]; // duplicate ear tags list

    // Stubbing Insemination
    Insemination.countDocuments = async () => 5;
    Insemination.distinct = async () => ["farmer1"];
    Insemination.aggregate = async () => [{ _id: "tech-1", count: 1 }];

    // Stubbing Pregnancy
    Pregnancy.countDocuments = async () => 3;

    // Stubbing Calving
    Calving.countDocuments = async () => 2;

    // Stubbing HealthRequest
    HealthRequest.countDocuments = async () => 4;
    HealthRequest.distinct = async () => ["farmer1"];
    HealthRequest.aggregate = async () => [
        { _id: "San Isidro", count: 5, criticalCount: 2 }
    ];

    // Stubbing Config
    Config.findOne = async () => ({ value: new Date() });

    let statusVal = null;
    let jsonVal = null;

    const req = {};
    const res = {
        status(code) {
            statusVal = code;
            return {
                json(data) {
                    jsonVal = data;
                }
            };
        }
    };

    try {
        await getSystemMonitoringData(req, res);
        
        assert.equal(statusVal, 200);
        assert.ok(jsonVal);
        assert.equal(jsonVal.systemHealth.onlineDevices, 2);
        assert.equal(jsonVal.systemHealth.offlineDevices, 8); // 10 - 2
        assert.equal(jsonVal.registryMonitor.duplicateEarTags, 1);
        assert.equal(jsonVal.registryMonitor.missingAnimalData, 1);
        assert.equal(jsonVal.moowieInsights.pregnancySuccessRate, 100); // 3 / 3
        assert.equal(jsonVal.moowieInsights.aiSuccessRate, 100);
        assert.ok(Array.isArray(jsonVal.alerts));
        assert.equal(jsonVal.alerts[0].category, "Registry");
    } finally {
        // Restore original methods
        User.countDocuments = origUserCount;
        User.find = origUserFind;
        Animal.countDocuments = origAnimalCount;
        Animal.aggregate = origAnimalAgg;
        Insemination.countDocuments = origInseminationCount;
        Insemination.distinct = origInseminationDistinct;
        Insemination.aggregate = origInseminationAgg;
        Pregnancy.countDocuments = origPregnancyCount;
        Calving.countDocuments = origCalvingCount;
        HealthRequest.countDocuments = origHealthRequestCount;
        HealthRequest.aggregate = origHealthRequestAgg;
        HealthRequest.distinct = origHealthRequestDistinct;
        Config.findOne = origConfigFindOne;
    }
});
