/**
 * Tests for profile metadata utilities (nori.json read/write)
 */

import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  readProfileMetadata,
  writeProfileMetadata,
  addSkillToNoriJson,
} from "./metadata.js";

describe("writeProfileMetadata", () => {
  let profileDir: string;

  beforeEach(async () => {
    profileDir = await fs.mkdtemp(path.join(tmpdir(), "nori-metadata-test-"));
  });

  afterEach(async () => {
    await fs.rm(profileDir, { recursive: true, force: true });
  });

  it("should write nori.json that can be read back by readProfileMetadata", async () => {
    const metadata = {
      name: "test-profile",
      version: "1.0.0",
      description: "A test profile",
    };

    await writeProfileMetadata({ profileDir, metadata });

    const result = await readProfileMetadata({ profileDir });
    expect(result).toEqual(metadata);
  });

  it("should preserve all fields including dependencies", async () => {
    const metadata = {
      name: "test-profile",
      version: "2.0.0",
      description: "Profile with dependencies",
      dependencies: {
        skills: {
          "writing-plans": "^1.0.0",
          "systematic-debugging": "*",
        },
      },
    };

    await writeProfileMetadata({ profileDir, metadata });

    const result = await readProfileMetadata({ profileDir });
    expect(result).toEqual(metadata);
  });

  it("should overwrite existing nori.json", async () => {
    const original = { name: "original", version: "1.0.0" };
    const updated = { name: "updated", version: "2.0.0" };

    await writeProfileMetadata({ profileDir, metadata: original });
    await writeProfileMetadata({ profileDir, metadata: updated });

    const result = await readProfileMetadata({ profileDir });
    expect(result).toEqual(updated);
  });
});

describe("addSkillToNoriJson", () => {
  let profileDir: string;

  beforeEach(async () => {
    profileDir = await fs.mkdtemp(path.join(tmpdir(), "nori-metadata-test-"));
  });

  afterEach(async () => {
    await fs.rm(profileDir, { recursive: true, force: true });
  });

  it("should create nori.json when none exists and add the skill", async () => {
    await addSkillToNoriJson({
      profileDir,
      skillName: "my-skill",
      version: "*",
    });

    const metadata = await readProfileMetadata({ profileDir });
    expect(metadata.name).toBe(path.basename(profileDir));
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.dependencies?.skills).toEqual({ "my-skill": "*" });
  });

  it("should add skill to existing nori.json that has no dependencies key", async () => {
    await writeProfileMetadata({
      profileDir,
      metadata: { name: "my-profile", version: "1.0.0" },
    });

    await addSkillToNoriJson({
      profileDir,
      skillName: "new-skill",
      version: "^2.0.0",
    });

    const metadata = await readProfileMetadata({ profileDir });
    expect(metadata.name).toBe("my-profile");
    expect(metadata.version).toBe("1.0.0");
    expect(metadata.dependencies?.skills).toEqual({ "new-skill": "^2.0.0" });
  });

  it("should add skill to existing nori.json preserving existing skill dependencies", async () => {
    await writeProfileMetadata({
      profileDir,
      metadata: {
        name: "my-profile",
        version: "1.0.0",
        dependencies: {
          skills: {
            "existing-skill": "^1.0.0",
            "another-skill": "*",
          },
        },
      },
    });

    await addSkillToNoriJson({
      profileDir,
      skillName: "new-skill",
      version: "*",
    });

    const metadata = await readProfileMetadata({ profileDir });
    expect(metadata.dependencies?.skills).toEqual({
      "existing-skill": "^1.0.0",
      "another-skill": "*",
      "new-skill": "*",
    });
  });

  it("should throw when nori.json contains corrupt JSON", async () => {
    await fs.writeFile(
      path.join(profileDir, "nori.json"),
      "{ this is not valid json",
    );

    await expect(
      addSkillToNoriJson({
        profileDir,
        skillName: "my-skill",
        version: "*",
      }),
    ).rejects.toThrow("nori.json exists but contains invalid JSON");
  });

  it("should update version for an already-present skill", async () => {
    await writeProfileMetadata({
      profileDir,
      metadata: {
        name: "my-profile",
        version: "1.0.0",
        dependencies: {
          skills: {
            "my-skill": "^1.0.0",
          },
        },
      },
    });

    await addSkillToNoriJson({
      profileDir,
      skillName: "my-skill",
      version: "*",
    });

    const metadata = await readProfileMetadata({ profileDir });
    expect(metadata.dependencies?.skills).toEqual({ "my-skill": "*" });
  });
});
