import { stakingChains } from "../common/blockchains";
import {
    getChainValidatorsListPath,
    getChainValidatorAssetLogoPath,
    getChainValidatorsAssets
} from "../common/repo-structure";
import { isPathExistsSync } from "../common/filesystem";
import { formatSortJsonFile, readJsonFile } from "../common/json";
import { ActionInterface, CheckStepInterface } from "./interface";
import { isValidJSON } from "../common/json";
import { ValidatorModel } from "../common/validator-models";
import { isLogoOK } from "../common/image";
import * as bluebird from "bluebird";

function formatValidators() {
    stakingChains.forEach(chain => {    
        const validatorsPath = getChainValidatorsListPath(chain);
        formatSortJsonFile(validatorsPath);
    })
}

function getChainValidatorsList(chain: string): ValidatorModel[] {
    return readJsonFile(getChainValidatorsListPath(chain));
}

function isValidatorHasAllKeys(val: ValidatorModel): boolean {
    return typeof val.id === "string"
        && typeof val.name === "string"
        && typeof val.description === "string"
        && typeof val.website === "string";
}

export class Validators implements ActionInterface {
    getName(): string { return "Validators"; }

    getSanityChecks(): CheckStepInterface[] {
        var steps: CheckStepInterface[] = [
            {
                getName: () => { return "Make sure tests added for new staking chain"},
                check: async (): Promise<[string[], string[]]> => {
                    if (stakingChains.length != 8) {
                        return [[`Wrong number of staking chains ${stakingChains.length}`], []];
                    }
                    return [[], []];
                }
            },
        ];
        stakingChains.forEach(chain => {
            steps.push(
                {
                    getName: () => { return `Make sure chain ${chain} has valid list file, has logo`},
                    check: async (): Promise<[string[], string[]]> => {
                        const validatorsListPath = getChainValidatorsListPath(chain);
                        if (!isValidJSON(validatorsListPath)) {
                            return [[`Not valid Json file at path ${validatorsListPath}`], []];
                        }

                        var errors: string[] = [];
                        const validatorsList = getChainValidatorsList(chain);
                        const chainValidatorsAssetsList = getChainValidatorsAssets(chain);
                        await bluebird.each(validatorsList, async (val: ValidatorModel) => {
                            if (!isValidatorHasAllKeys(val)) {
                                errors.push(`Some key and/or type missing for validator ${JSON.stringify(val)}`);
                            }

                            const id = val.id;
                            const path = getChainValidatorAssetLogoPath(chain, id);
                            if (!isPathExistsSync(path)) {
                                errors.push(`Chain ${chain} asset ${id} logo must be present at path ${path}`);
                            }
                            const [isOk, logoMsg] = await isLogoOK(path);
                            if (!isOk) {
                                errors.push(logoMsg);
                            }
                        
                            // Make sure validator has corresponding logo
                            if (!(chainValidatorsAssetsList.indexOf(id) >= 0)) {
                                errors.push(`Expecting image asset for validator ${id} on chain ${chain}`);
                            }
                        });

                        // Make sure validator asset logo has corresponding info
                        chainValidatorsAssetsList.forEach(valAssetLogoID => {
                            if (validatorsList.filter(v => v.id === valAssetLogoID).length != 1) {
                                errors.push(`Expect validator logo ${valAssetLogoID} to have info`);
                            }
                        });

                        return [errors, []];
                    }
                }
            );
        });
        return steps;
    }

    getConsistencyChecks = null;

    async sanityFix(): Promise<void> {
        formatValidators();
    }

    consistencyFix = null;

    update = null;
}
